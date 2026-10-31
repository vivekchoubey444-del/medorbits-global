
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits Meta Ad Creator
File: tools/meta_ad_creator.py
Version: 2.0.0

Create and validate review-ready Facebook and Instagram campaign drafts.

Features:
- Generate primary text, headlines, descriptions and CTAs.
- Suggest campaign objectives and audience guidance.
- Add UTM parameters while preserving duplicate query keys.
- Validate campaign JSON structure and safety flags.
- Detect sensitive targeting language.
- Validate HTTP(S) destinations and reject obvious private destinations.
- Export drafts without overwriting existing files.
- Reject symbolic-link campaign input files.

Safety:
- Draft generation only.
- No Meta API connection.
- No ad publishing or account modification.
- No advertising spend.
- Local URL validation does not guarantee DNS or redirect safety.
- Passing validation does not constitute Meta policy approval.

Usage:
    python tools/meta_ad_creator.py create
    python tools/meta_ad_creator.py create —brand “MedOrbits”
    python tools/meta_ad_creator.py validate reports/meta-campaign-draft.json
    python tools/meta_ad_creator.py example
===============================================================================
“””

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import stat
import sys

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import (
    parse_qsl,
    urlencode,
    urlsplit,
    urlunsplit,
)


TOOL_NAME = “MedOrbits Meta Ad Creator”
VERSION = “2.0.0”
SCHEMA_VERSION = “1.0”

MAX_URL_LENGTH = 2048
MAX_CAMPAIGN_FILE_SIZE = 2_000_000
MAX_CAMPAIGN_TEXT_LENGTH = 500

OBJECTIVES = {
    “awareness”: “Awareness”,
    “traffic”: “Traffic”,
    “leads”: “Leads”,
    “engagement”: “Engagement”,
    “sales”: “Sales”,
    “app_promotion”: “App promotion”,
}

CTA_OPTIONS = {
    “learn_more”: “Learn More”,
    “sign_up”: “Sign Up”,
    “contact_us”: “Contact Us”,
    “apply_now”: “Apply Now”,
    “get_quote”: “Get Quote”,
    “send_message”: “Send Message”,
}

DEFAULT_AUDIENCE = {
    “locations”: [
        “Select eligible locations in Meta Ads Manager.”
    ],
    “age_range”: (
        “Configure an age range appropriate to the service “
        “and applicable advertising rules.”
    ),
    “interests”: [
        “Education”,
        “Higher education”,
        “Career development”,
    ],
    “exclusions”: [
        “Do not infer sensitive personal attributes.”,
        “Review current Meta advertising and targeting restrictions.”,
    ],
}

# Terms that should not be used as personal-attribute targeting criteria.
# This is a conservative keyword safeguard, not a complete policy engine.
SENSITIVE_TARGETING_TERMS = {
    “religion”,
    “religious belief”,
    “race”,
    “ethnicity”,
    “sexual orientation”,
    “medical condition”,
    “disability”,
    “political affiliation”,
    “financial hardship”,
}

# —————————————————————————
# DATA MODEL
# —————————————————————————

@dataclass
class CampaignDraft:
    schema_version: str
    status: str
    platform: str
    brand: str
    campaign_name: str
    objective: str
    destination_url: str
    audience: dict[str, Any]
    creative: dict[str, Any]
    tracking: dict[str, str]
    compliance_review_required: bool
    publishing_enabled: bool = False


# —————————————————————————
# TEXT VALIDATION
# —————————————————————————

def clean_text(
    value: str,
    field_name: str,
    max_length: int = MAX_CAMPAIGN_TEXT_LENGTH,
) -> str:
    “””Validate and normalize a required text field.”””

    if not isinstance(value, str):
        raise ValueError(f”{field_name} must be a string.”)

    value = value.strip()

    if not value:
        raise ValueError(f”{field_name} cannot be empty.”)

    if len(value) > max_length:
        raise ValueError(
            f”{field_name} must not exceed {max_length} characters.”
        )

    if any(
        ord(char) < 32 and char not in “\t\n\r”
        for char in value
    ):
        raise ValueError(
            f”{field_name} contains invalid control characters.”
        )

    return value


def is_object(value: Any) -> bool:
    return isinstance(value, dict)


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


# —————————————————————————
# URL VALIDATION
# —————————————————————————

def validate_http_url(
    value: str,
    *,
    require_public_host: bool = True,
) -> str:
    “””
    Validate an HTTP(S) URL.

    Reject:
    - Non-HTTP schemes.
    - Embedded credentials.
    - Malformed hostnames.
    - Local and reserved hostnames.
    - Non-global literal IP addresses.
    - Backslashes and whitespace.

    DNS resolution and redirect destinations are not inspected.
    “””

    value = clean_text(
        value,
        “Destination URL”,
        MAX_URL_LENGTH,
    )

    if any(char.isspace() for char in value):
        raise ValueError(
            “Destination URL cannot contain whitespace.”
        )

    if “\\” in value:
        raise ValueError(
            “Destination URL cannot contain backslashes.”
        )

    try:
        parts = urlsplit(value)
        hostname = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise ValueError(
            f”Malformed destination URL: {exc}”
        ) from exc

    if parts.scheme.lower() not in {“http”, “https”}:
        raise ValueError(
            “Destination URL must use HTTP or HTTPS.”
        )

    if not parts.netloc or not hostname:
        raise ValueError(
            “Destination URL must contain a hostname.”
        )

    if parts.username is not None or parts.password is not None:
        raise ValueError(
            “Embedded URL credentials are not permitted.”
        )

    if port is not None and not 1 <= port <= 65535:
        raise ValueError(
            “Destination URL contains an invalid port.”
        )

    if “%” in hostname:
        raise ValueError(
            “Percent-encoded hostnames are not permitted.”
        )

    hostname = hostname.rstrip(“.”).lower()

    if not hostname:
        raise ValueError(“Destination hostname is invalid.”)

    if not require_public_host:
        return value

    local_suffixes = (
        “.localhost”,
        “.local”,
        “.internal”,
        “.test”,
        “.invalid”,
        “.example”,
    )

    if hostname == “localhost” or hostname.endswith(local_suffixes):
        raise ValueError(
            “Local or reserved hostnames are not permitted.”
        )

    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None

    if address is not None:
        if not address.is_global:
            raise ValueError(
                “Destination IP address must be globally routable.”
            )

        return value

    # Normalize internationalized domain names.
    try:
        ascii_hostname = hostname.encode(“idna”).decode(“ascii”)
    except UnicodeError as exc:
        raise ValueError(
            “Destination hostname is not a valid internationalized domain.”
        ) from exc

    if len(ascii_hostname) > 253:
        raise ValueError(“Destination hostname is too long.”)

    labels = ascii_hostname.split(“.”)

    if len(labels) < 2:
        raise ValueError(
            “Destination must use a fully qualified hostname.”
        )

    for label in labels:
        if (
            not label
            or len(label) > 63
            or label.startswith(“-“)
            or label.endswith(“-“)
            or not re.fullmatch(r”[a-z0-9-]+”, label)
        ):
            raise ValueError(
                “Destination hostname is malformed.”
            )

    if labels[-1].startswith(“xn—“) is False:
        if not re.fullmatch(r”[a-z]{2,63}”, labels[-1]):
            raise ValueError(
                “Destination hostname has an invalid final label.”
            )

    return value


# —————————————————————————
# UTM TRACKING
# —————————————————————————

def add_utm_parameters(
    destination_url: str,
    campaign_name: str,
    source: str = “meta”,
    medium: str = “paid_social”,
) -> str:
    “””
    Add UTM parameters.

    Existing UTM parameters are preserved.
    Duplicate unrelated query parameters are retained.
    URL fragments are retained.
    “””

    destination_url = validate_http_url(destination_url)

    campaign_name = clean_text(
        campaign_name,
        “Campaign tracking name”,
        120,
    )

    parts = urlsplit(destination_url)

    query_items = parse_qsl(
        parts.query,
        keep_blank_values=True,
    )

    existing_keys = {
        key.lower()
        for key, _ in query_items
    }

    additions = {
        “utm_source”: source,
        “utm_medium”: medium,
        “utm_campaign”: campaign_name,
    }

    for key, value in additions.items():
        if key.lower() not in existing_keys:
            query_items.append((key, value))

    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query_items, doseq=True),
            parts.fragment,
        )
    )


def campaign_slug(value: str) -> str:
    “””Generate a URL-safe campaign identifier.”””

    slug = re.sub(
        r”[^a-zA-Z0-9]+”,
        “-“,
        value.strip().lower(),
    ).strip(“-“)

    return slug[:80] or “medorbits-campaign”


# —————————————————————————
# TARGETING SAFETY
# —————————————————————————

def find_sensitive_targeting_terms(
    audience: dict[str, Any],
) -> list[str]:
    “””
    Check targeting descriptions for sensitive personal attributes.

    This is a keyword safeguard. It cannot determine policy compliance
    from context or replace a Meta policy review.
    “””

    searchable_fields = (
        “locations”,
        “interests”,
        “exclusions”,
        “audience_description”,
        “age_range”,
    )

    text_parts: list[str] = []

    for field in searchable_fields:
        value = audience.get(field)

        if isinstance(value, str):
            text_parts.append(value)

        elif isinstance(value, list):
            text_parts.extend(
                item for item in value if isinstance(item, str)
            )

    combined = “ “.join(text_parts).casefold()

    detected = []

    for term in sorted(SENSITIVE_TARGETING_TERMS):
        pattern = (
            r”(?<!\w)”
            + re.escape(term)
            + r”(?!\w)”
        )

        if re.search(pattern, combined):
            detected.append(term)

    return detected


# —————————————————————————
# CREATIVE GENERATION
# —————————————————————————

def build_creative(
    brand: str,
    product: str,
    audience_description: str,
    destination_url: str,
    cta_key: str,
) -> dict[str, Any]:

    brand = clean_text(brand, “Brand”, 100)
    product = clean_text(product, “Service or offer”, 160)

    audience_description = clean_text(
        audience_description,
        “Audience description”,
        200,
    )

    if cta_key not in CTA_OPTIONS:
        raise ValueError(
            f”Unsupported CTA: {cta_key}. “
            f”Choose: {‘, ‘.join(CTA_OPTIONS)}”
        )

    destination_url = validate_http_url(destination_url)

    primary_text = (
        f”Explore {product} with {brand}. “
        f”Find useful information and guidance for “
        f”{audience_description}. “
        “Review eligibility, requirements, timelines, “
        “and official sources before making a decision.”
    )

    return {
        “format”: “single_image_or_video”,
        “primary_text”: primary_text,
        “headline”: f”Explore {product}”,
        “description”: (
            “Get clear information and explore your next steps.”
        ),
        “call_to_action”: CTA_OPTIONS[cta_key],
        “destination_url”: destination_url,
        “creative_asset”: {
            “status”: “not_attached”,
            “note”: (
                “Attach an approved image or video in Meta Ads Manager.”
            ),
        },
        “review_notes”: [
            “Verify factual claims and service descriptions.”,
            (
                “Do not imply guaranteed admission, employment, “
                “scholarships, visa approval, or financial outcomes.”
            ),
            (
                “Use only images, music, logos, and testimonials “
                “for which appropriate rights are available.”
            ),
            (
                “Check landing-page accuracy, privacy disclosures, “
                “and consent flows.”
            ),
            (
                “Review current advertising policies applicable “
                “to education and regulated services.”
            ),
        ],
    }


def create_campaign(args: argparse.Namespace) -> CampaignDraft:

    brand = clean_text(args.brand, “Brand”, 100)
    product = clean_text(args.offer, “Service or offer”, 160)

    audience_description = clean_text(
        args.audience,
        “Audience description”,
        200,
    )

    destination = validate_http_url(args.url)

    if args.objective not in OBJECTIVES:
        raise ValueError(
            f”Unsupported objective: {args.objective}”
        )

    name = clean_text(
        args.campaign_name
        or f”{brand}-{args.objective}-{product}”,
        “Campaign name”,
        120,
    )

    slug = campaign_slug(name)

    tracked_url = add_utm_parameters(
        destination,
        slug,
    )

    audience = {
        **DEFAULT_AUDIENCE,
        “audience_description”: audience_description,
        “targeting_mode”: (
            “Draft suggestion; configure and review in Meta Ads Manager.”
        ),
    }

    detected_terms = find_sensitive_targeting_terms(audience)

    if detected_terms:
        raise ValueError(
            “Sensitive targeting language detected: “
            + “, “.join(detected_terms)
            + “. Revise the audience description.”
        )

    creative = build_creative(
        brand=brand,
        product=product,
        audience_description=audience_description,
        destination_url=tracked_url,
        cta_key=args.cta,
    )

    return CampaignDraft(
        schema_version=SCHEMA_VERSION,
        status=“draft”,
        platform=“Meta Ads (Facebook and Instagram)”,
        brand=brand,
        campaign_name=name,
        objective=OBJECTIVES[args.objective],
        destination_url=tracked_url,
        audience=audience,
        creative=creative,
        tracking={
            “utm_source”: “meta”,
            “utm_medium”: “paid_social”,
            “utm_campaign”: slug,
        },
        compliance_review_required=True,
        publishing_enabled=False,
    )


# —————————————————————————
# SAFE FILE OUTPUT
# —————————————————————————

def write_json(data: Any, output: Path) -> Path:
    “””
    Create a new JSON file without overwriting an existing file.

    Uses exclusive file creation and rejects a symbolic-link destination.
    “””

    output = output.expanduser()

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    payload = (
        asdict(data)
        if hasattr(data, “__dataclass_fields__”)
        else data
    )

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

    if hasattr(os, “O_NOFOLLOW”):
        flags |= os.O_NOFOLLOW

    descriptor = None

    try:
        descriptor = os.open(
            output,
            flags,
            0o600,
        )

        with os.fdopen(
            descriptor,
            “w”,
            encoding=“utf-8”,
            newline=“\n”,
        ) as handle:
            descriptor = None

            json.dump(
                payload,
                handle,
                indent=2,
                ensure_ascii=False,
            )

            handle.write(“\n”)

    except FileExistsError as exc:
        raise FileExistsError(
            f”Output already exists; refusing to overwrite: {output}”
        ) from exc

    except Exception:
        if descriptor is not None:
            os.close(descriptor)

        raise

    return output.resolve()


# —————————————————————————
# CAMPAIGN VALIDATION
# —————————————————————————

def validate_campaign_data(data: Any) -> list[str]:

    errors: list[str] = []

    if not isinstance(data, dict):
        return [“Campaign JSON must contain an object.”]

    required = {
        “schema_version”,
        “status”,
        “platform”,
        “brand”,
        “campaign_name”,
        “objective”,
        “destination_url”,
        “audience”,
        “creative”,
        “tracking”,
        “compliance_review_required”,
        “publishing_enabled”,
    }

    missing = sorted(required - data.keys())

    if missing:
        return [
            “Missing required fields: “ + “, “.join(missing)
        ]

    for field in (
        “schema_version”,
        “status”,
        “platform”,
        “brand”,
        “campaign_name”,
        “objective”,
    ):
        if not is_nonempty_string(data.get(field)):
            errors.append(
                f”Field ‘{field}’ must be a non-empty string.”
            )

    if data.get(“schema_version”) != SCHEMA_VERSION:
        errors.append(
            f”schema_version must be ‘{SCHEMA_VERSION}’.”
        )

    if data.get(“status”) != “draft”:
        errors.append(“status must be ‘draft’.”)

    if data.get(“publishing_enabled”) is not False:
        errors.append(“publishing_enabled must be false.”)

    if data.get(“compliance_review_required”) is not True:
        errors.append(“compliance_review_required must be true.”)

    if data.get(“objective”) not in OBJECTIVES.values():
        errors.append(“Objective is not supported.”)

    try:
        validate_http_url(data.get(“destination_url”))
    except (ValueError, TypeError) as exc:
        errors.append(f”Invalid destination URL: {exc}”)

    # Audience.
    audience = data.get(“audience”)

    if not is_object(audience):
        errors.append(“’audience’ must be an object.”)
    else:
        if not is_nonempty_string(
            audience.get(“audience_description”)
        ):
            errors.append(
                “audience.audience_description is required.”
            )

        if not is_nonempty_string(audience.get(“age_range”)):
            errors.append(“audience.age_range is required.”)

        for field in (“locations”, “interests”, “exclusions”):
            values = audience.get(field)

            if (
                not isinstance(values, list)
                or not all(is_nonempty_string(item) for item in values)
            ):
                errors.append(
                    f”audience.{field} must be a list “
                    “of non-empty strings.”
                )

        if is_object(audience):
            sensitive_terms = find_sensitive_targeting_terms(audience)

            if sensitive_terms:
                errors.append(
                    “Sensitive targeting language detected: “
                    + “, “.join(sensitive_terms)
                )

    # Creative.
    creative = data.get(“creative”)

    if not is_object(creative):
        errors.append(“’creative’ must be an object.”)
    else:
        for field in (
            “format”,
            “primary_text”,
            “headline”,
            “description”,
            “call_to_action”,
            “destination_url”,
        ):
            if not is_nonempty_string(creative.get(field)):
                errors.append(
                    f”creative.{field} must be a non-empty string.”
                )

        if creative.get(“call_to_action”) not in CTA_OPTIONS.values():
            errors.append(“Creative CTA is not supported.”)

        try:
            creative_url = validate_http_url(
                creative.get(“destination_url”)
            )
        except (ValueError, TypeError) as exc:
            errors.append(f”Invalid creative destination URL: {exc}”)
            creative_url = None

        if isinstance(creative_url, str):
            if creative_url != data.get(“destination_url”):
                errors.append(
                    “Creative and campaign destination URLs do not match.”
                )

        asset = creative.get(“creative_asset”)

        if not is_object(asset):
            errors.append(“creative.creative_asset must be an object.”)
        elif asset.get(“status”) not in {
            “not_attached”,
            “attached”,
        }:
            errors.append(
                “creative_asset.status must be ‘not_attached’ “
                “or ‘attached’.”
            )

        review_notes = creative.get(“review_notes”)

        if (
            not isinstance(review_notes, list)
            or not all(is_nonempty_string(item) for item in review_notes)
        ):
            errors.append(
                “creative.review_notes must be a list of non-empty strings.”
            )

    # Tracking.
    tracking = data.get(“tracking”)

    if not is_object(tracking):
        errors.append(“’tracking’ must be an object.”)
    else:
        for field in (
            “utm_source”,
            “utm_medium”,
            “utm_campaign”,
        ):
            if not is_nonempty_string(tracking.get(field)):
                errors.append(
                    f”tracking.{field} must be a non-empty string.”
                )

        try:
            parts = urlsplit(data.get(“destination_url”, “”))
            query = parse_qsl(
                parts.query,
                keep_blank_values=True,
            )

            query_values = {}

            for key, value in query:
                query_values.setdefault(key.lower(), []).append(value)

            for field in (
                “utm_source”,
                “utm_medium”,
                “utm_campaign”,
            ):
                expected = tracking.get(field)

                if not is_nonempty_string(expected):
                    continue

                actual = query_values.get(field, [])

                if actual != [expected]:
                    errors.append(
                        f”Destination URL must contain exactly one “
                        f”{field} matching tracking.{field}.”
                    )

        except ValueError as exc:
            errors.append(f”Cannot inspect tracking URL: {exc}”)

    return errors


def validate_campaign_file(path: Path) -> int:
    “””Read and validate a campaign file without following symlinks.”””

    path = path.expanduser()

    flags = os.O_RDONLY

    if hasattr(os, “O_NOFOLLOW”):
        flags |= os.O_NOFOLLOW

    try:
        descriptor = os.open(path, flags)

        with os.fdopen(descriptor, “rb”) as handle:
            descriptor = -1

            file_stat = os.fstat(handle.fileno())

            if not stat.S_ISREG(file_stat.st_mode):
                raise ValueError(
                    “Campaign input must be a regular file.”
                )

            if file_stat.st_size > MAX_CAMPAIGN_FILE_SIZE:
                raise ValueError(
                    “Campaign file exceeds the permitted size.”
                )

            raw = handle.read(MAX_CAMPAIGN_FILE_SIZE + 1)

        if len(raw) > MAX_CAMPAIGN_FILE_SIZE:
            raise ValueError(
                “Campaign file exceeds the permitted size.”
            )

        data = json.loads(raw.decode(“utf-8-sig”))

    except (
        OSError,
        UnicodeError,
        json.JSONDecodeError,
        ValueError,
    ) as exc:
        print(
            f”Invalid campaign file: {exc}”,
            file=sys.stderr,
        )
        return 1

    errors = validate_campaign_data(data)

    if errors:
        for message in errors:
            print(f”ERROR: {message}”, file=sys.stderr)

        return 1

    print(“[PASS] Campaign structure is valid.”)
    print(“[PASS] Safety flags are valid.”)
    print(“[PASS] Destination and tracking information are consistent.”)
    print(“[INFO] Publishing remains disabled.”)
    print(“[INFO] Compliance review is still required.”)

    return 0


# —————————————————————————
# EXAMPLE
# —————————————————————————

def build_example() -> dict[str, Any]:

    args = argparse.Namespace(
        brand=“MedOrbits”,
        offer=“Education and admission guidance”,
        audience=(
            “students and families researching education options”
        ),
        url=“https://medorbits.in/“,
        objective=“traffic”,
        cta=“learn_more”,
        campaign_name=“MedOrbits Education Guidance”,
    )

    return asdict(create_campaign(args))


# —————————————————————————
# CLI
# —————————————————————————

def build_parser() -> argparse.ArgumentParser:

    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )

    commands = parser.add_subparsers(
        dest=“command”,
        required=True,
    )

    create = commands.add_parser(
        “create”,
        help=“Create a campaign draft.”,
    )

    create.add_argument(“—brand”, default=“MedOrbits”)

    create.add_argument(
        “—offer”,
        default=“Education and admission guidance”,
    )

    create.add_argument(
        “—audience”,
        default=(
            “students and families researching education options”
        ),
    )

    create.add_argument(
        “—url”,
        default=“https://medorbits.in/“,
    )

    create.add_argument(
        “—objective”,
        choices=sorted(OBJECTIVES),
        default=“traffic”,
    )

    create.add_argument(
        “—cta”,
        choices=sorted(CTA_OPTIONS),
        default=“learn_more”,
    )

    create.add_argument(“—campaign-name”)

    create.add_argument(
        “—output”,
        type=Path,
        default=Path(“reports/meta-campaign-draft.json”),
    )

    validate = commands.add_parser(
        “validate”,
        help=“Validate an existing campaign JSON file.”,
    )

    validate.add_argument(“file”, type=Path)

    commands.add_parser(
        “example”,
        help=“Print an example campaign draft.”,
    )

    return parser


# —————————————————————————
# MAIN
# —————————————————————————

def main() -> int:

    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == “create”:

            campaign = create_campaign(args)
            output = write_json(campaign, args.output)

            print(f”Draft saved: {output}”)
            print(f”Campaign: {campaign.campaign_name}”)
            print(f”Objective: {campaign.objective}”)
            print(“Publishing enabled: false”)
            print(“Compliance review required: true”)

            return 0

        if args.command == “validate”:
            return validate_campaign_file(args.file)

        if args.command == “example”:
            print(
                json.dumps(
                    build_example(),
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 0

        parser.error(“Unsupported command.”)
        return 2

    except (OSError, ValueError) as exc:
        print(
            f”{TOOL_NAME}: {exc}”,
            file=sys.stderr,
        )
        return 2


if __name__ == “__main__”:
    raise SystemExit(main())
