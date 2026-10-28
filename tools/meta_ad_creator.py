
#!/usr/bin/env python3
"""
MedOrbits Meta Ad Creator
=========================

Create safe, review-ready campaign drafts for Facebook and Instagram.

Features:
- Generate primary text, headlines, descriptions, and CTAs.
- Suggest objectives and audience targeting.
- Add UTM parameters without discarding duplicate query parameters.
- Validate campaign JSON structure and safety flags.
- Export campaign drafts without overwriting existing files.
- Reject malformed URLs and obvious private/local destinations.

Safety:
- Draft generation only.
- No Meta API connection.
- No ad publishing or account modification.
- No advertising spend.
- Public destination validation is a local safeguard, not a guarantee
  against DNS rebinding, redirects, or unsafe downstream destinations.

Usage:
    python tools/meta_ad_creator.py create
    python tools/meta_ad_creator.py create --brand "MedOrbits"
    python tools/meta_ad_creator.py validate reports/meta-campaign-draft.json
    python tools/meta_ad_creator.py example
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
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


TOOL_NAME = "MedOrbits Meta Ad Creator"
SCHEMA_VERSION = "1.0"

OBJECTIVES = {
    "awareness": "Awareness",
    "traffic": "Traffic",
    "leads": "Leads",
    "engagement": "Engagement",
    "sales": "Sales",
    "app_promotion": "App promotion",
}

CTA_OPTIONS = {
    "learn_more": "Learn More",
    "sign_up": "Sign Up",
    "contact_us": "Contact Us",
    "apply_now": "Apply Now",
    "get_quote": "Get Quote",
    "send_message": "Send Message",
}

DEFAULT_AUDIENCE = {
    "locations": [
        "Select eligible locations in Meta Ads Manager."
    ],
    "age_range": (
        "Configure an age range appropriate to the service "
        "and applicable advertising rules."
    ),
    "interests": [
        "Education",
        "Higher education",
        "Career development",
    ],
    "exclusions": [
        "Do not infer sensitive personal attributes.",
        "Review current Meta advertising and targeting restrictions.",
    ],
}

SENSITIVE_TARGETING_TERMS = {
    "religion",
    "religious belief",
    "race",
    "ethnicity",
    "sexual orientation",
    "medical condition",
    "disability",
    "political affiliation",
    "financial hardship",
}

MAX_URL_LENGTH = 2048
MAX_CAMPAIGN_FILE_SIZE = 2_000_000


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


def clean_text(
    value: str,
    field_name: str,
    max_length: int = 500,
) -> str:
    """Validate and normalize required text fields."""
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string.")

    value = value.strip()

    if not value:
        raise ValueError(f"{field_name} cannot be empty.")

    if len(value) > max_length:
        raise ValueError(
            f"{field_name} must be no longer than "
            f"{max_length} characters."
        )

    if any(ord(char) < 32 and char not in "\t\n\r" for char in value):
        raise ValueError(
            f"{field_name} contains an invalid control character."
        )

    return value


def validate_http_url(
    value: str,
    *,
    require_public_host: bool = True,
) -> str:
    """
    Validate an HTTP(S) URL.

    Rejects malformed hostnames, credentials, whitespace, local hostnames,
    and literal IP addresses that are not globally routable.

    This does not perform DNS resolution and cannot guarantee that a
    hostname resolves only to public addresses.
    """
    value = clean_text(
        value,
        "Destination URL",
        MAX_URL_LENGTH,
    )

    if any(char.isspace() for char in value):
        raise ValueError(
            "Destination URL cannot contain whitespace."
        )

    try:
        parts = urlsplit(value)
        hostname = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise ValueError(
            f"Malformed destination URL: {exc}"
        ) from exc

    if parts.scheme.lower() not in {"http", "https"}:
        raise ValueError(
            "Destination URL must use HTTP or HTTPS."
        )

    if not parts.netloc or not hostname:
        raise ValueError(
            "Destination URL must include a hostname."
        )

    if parts.username is not None or parts.password is not None:
        raise ValueError(
            "Destination URL must not contain embedded credentials."
        )

    if port is not None and not 1 <= port <= 65535:
        raise ValueError("Destination URL contains an invalid port.")

    if "%" in hostname:
        raise ValueError(
            "Destination hostname must not contain percent encoding."
        )

    normalized_host = hostname.rstrip(".").lower()

    if not normalized_host:
        raise ValueError("Destination hostname is invalid.")

    if require_public_host:
        if normalized_host == "localhost":
            raise ValueError(
                "Localhost is not allowed as a campaign destination."
            )

        if (
            normalized_host.endswith(".localhost")
            or normalized_host.endswith(".local")
            or normalized_host.endswith(".internal")
            or normalized_host.endswith(".test")
            or normalized_host.endswith(".invalid")
        ):
            raise ValueError(
                "Local or reserved hostnames are not allowed."
            )

        try:
            address = ipaddress.ip_address(normalized_host)
        except ValueError:
            address = None

        if address is not None and not address.is_global:
            raise ValueError(
                "Destination IP address must be globally routable."
            )

        if address is None:
            if "." not in normalized_host:
                raise ValueError(
                    "Destination must use a fully qualified hostname."
                )

            if len(normalized_host) > 253:
                raise ValueError(
                    "Destination hostname is too long."
                )

            labels = normalized_host.split(".")

            for label in labels:
                if (
                    not label
                    or len(label) > 63
                    or label.startswith("-")
                    or label.endswith("-")
                    or not re.fullmatch(
                        r"[a-z0-9-]+",
                        label,
                    )
                ):
                    raise ValueError(
                        "Destination hostname is malformed."
                    )

    return value


def add_utm_parameters(
    destination_url: str,
    campaign_name: str,
    source: str = "meta",
    medium: str = "paid_social",
) -> str:
    """
    Add UTM parameters while preserving unrelated parameters and fragments.

    Existing UTM values are preserved rather than silently overwritten.
    Duplicate query keys unrelated to UTM are retained.
    """
    destination_url = validate_http_url(destination_url)

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
        "utm_source": source,
        "utm_medium": medium,
        "utm_campaign": campaign_name,
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
    """Create a stable URL-safe campaign identifier."""
    slug = re.sub(
        r"[^a-zA-Z0-9]+",
        "-",
        value.strip().lower(),
    ).strip("-")

    return slug[:80] or "medorbits-campaign"


def build_creative(
    brand: str,
    product: str,
    audience_description: str,
    destination_url: str,
    cta_key: str,
) -> dict[str, Any]:
    """Generate a conservative, review-ready creative draft."""
    brand = clean_text(brand, "Brand", 100)
    product = clean_text(product, "Service or offer", 160)
    audience_description = clean_text(
        audience_description,
        "Audience description",
        200,
    )

    if cta_key not in CTA_OPTIONS:
        raise ValueError(
            f"Unsupported CTA '{cta_key}'. Choose: "
            f"{', '.join(CTA_OPTIONS)}"
        )

    destination_url = validate_http_url(destination_url)

    primary_text = (
        f"Explore {product} with {brand}. "
        f"Find useful information and guidance for "
        f"{audience_description}. "
        "Review eligibility, requirements, timelines, and "
        "official sources before making a decision."
    )

    return {
        "format": "single_image_or_video",
        "primary_text": primary_text,
        "headline": f"Explore {product}",
        "description": (
            "Get clear information and explore your next steps."
        ),
        "call_to_action": CTA_OPTIONS[cta_key],
        "destination_url": destination_url,
        "creative_asset": {
            "status": "not_attached",
            "note": (
                "Attach an approved image or video in Meta Ads Manager."
            ),
        },
        "review_notes": [
            "Verify factual claims and service descriptions.",
            (
                "Do not imply guaranteed admission, employment, "
                "scholarships, visa approval, or financial outcomes."
            ),
            (
                "Use only images, music, logos, and testimonials "
                "for which appropriate rights are available."
            ),
            (
                "Check landing-page accuracy, privacy disclosures, "
                "and consent flows."
            ),
            (
                "Review the current advertising policies applicable "
                "to education and any regulated services."
            ),
        ],
    }


def create_campaign(args: argparse.Namespace) -> CampaignDraft:
    """Build a campaign draft from CLI arguments."""
    brand = clean_text(args.brand, "Brand", 100)
    product = clean_text(args.offer, "Service or offer", 160)
    audience_description = clean_text(
        args.audience,
        "Audience description",
        200,
    )

    destination = validate_http_url(args.url)

    if args.objective not in OBJECTIVES:
        raise ValueError(
            f"Unsupported objective '{args.objective}'. "
            f"Choose: {', '.join(OBJECTIVES)}"
        )

    name = clean_text(
        args.campaign_name
        or f"{brand}-{args.objective}-{product}",
        "Campaign name",
        120,
    )

    slug = campaign_slug(name)
    tracked_url = add_utm_parameters(destination, slug)

    audience = {
        **DEFAULT_AUDIENCE,
        "audience_description": audience_description,
        "targeting_mode": (
            "Draft suggestion; configure and review in Meta Ads Manager."
        ),
    }

    creative = build_creative(
        brand=brand,
        product=product,
        audience_description=audience_description,
        destination_url=tracked_url,
        cta_key=args.cta,
    )

    return CampaignDraft(
        schema_version=SCHEMA_VERSION,
        status="draft",
        platform="Meta Ads (Facebook and Instagram)",
        brand=brand,
        campaign_name=name,
        objective=OBJECTIVES[args.objective],
        destination_url=tracked_url,
        audience=audience,
        creative=creative,
        tracking={
            "utm_source": "meta",
            "utm_medium": "paid_social",
            "utm_campaign": slug,
        },
        compliance_review_required=True,
        publishing_enabled=False,
    )


def write_json(data: Any, output: Path) -> Path:
    """
    Write a new JSON file without overwriting an existing file.

    Uses exclusive creation mode ('x') to prevent accidental replacement.
    """
    output = output.expanduser()

    if output.exists():
        raise FileExistsError(
            f"Output already exists; refusing to overwrite: {output}"
        )

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    payload = (
        asdict(data)
        if hasattr(data, "__dataclass_fields__")
        else data
    )

    with output.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(
            payload,
            handle,
            indent=2,
            ensure_ascii=False,
        )
        handle.write("\n")

    return output.resolve()


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_campaign_data(data: Any) -> list[str]:
    """Validate required campaign fields and safety invariants."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["Campaign JSON must contain an object."]

    required = {
        "schema_version",
        "status",
        "platform",
        "brand",
        "campaign_name",
        "objective",
        "destination_url",
        "audience",
        "creative",
        "tracking",
        "compliance_review_required",
        "publishing_enabled",
    }

    missing = sorted(required - data.keys())

    if missing:
        errors.append(
            "Missing required fields: " + ", ".join(missing)
        )
        return errors

    for field in (
        "schema_version",
        "status",
        "platform",
        "brand",
        "campaign_name",
        "objective",
    ):
        if not is_nonempty_string(data.get(field)):
            errors.append(
                f"Field '{field}' must be a non-empty string."
            )

    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(
            f"schema_version must be '{SCHEMA_VERSION}'."
        )

    if data.get("status") != "draft":
        errors.append(
            "Safety validation failed: status must be 'draft'."
        )

    if data.get("publishing_enabled") is not False:
        errors.append(
            "Safety validation failed: publishing_enabled must be false."
        )

    if data.get("compliance_review_required") is not True:
        errors.append(
            "compliance_review_required must be true."
        )

    if data.get("objective") not in OBJECTIVES.values():
        errors.append("Objective is not supported.")

    try:
        validate_http_url(data.get("destination_url"))
    except (ValueError, TypeError) as exc:
        errors.append(f"Invalid destination URL: {exc}")

    audience = data.get("audience")

    if not isinstance(audience, dict):
        errors.append("'audience' must be an object.")
    else:
        if not is_nonempty_string(
            audience.get("audience_description")
        ):
            errors.append(
                "audience.audience_description is required."
            )

        for field in ("locations", "interests", "exclusions"):
            if (
                not isinstance(audience.get(field), list)
                or not all(
                    is_nonempty_string(item)
                    for item in audience.get(field, [])
                )
            ):
                errors.append(
                    f"audience.{field} must be a list of non-empty strings."
                )

    creative = data.get("creative")

    if not isinstance(creative, dict):
        errors.append("'creative' must be an object.")
    else:
        for field in (
            "format",
            "primary_text",
            "headline",
            "description",
            "call_to_action",
            "destination_url",
        ):
            if not is_nonempty_string(creative.get(field)):
                errors.append(
                    f"creative.{field} must be a non-empty string."
                )

        if creative.get("call_to_action") not in CTA_OPTIONS.values():
            errors.append("Creative CTA is not supported.")

        try:
            validate_http_url(creative.get("destination_url"))
        except (ValueError, TypeError) as exc:
            errors.append(
                f"Invalid creative destination URL: {exc}"
            )

        if isinstance(creative.get("creative_asset"), dict):
            asset_status = creative["creative_asset"].get("status")
            if asset_status not in {"not_attached", "attached"}:
                errors.append(
                    "creative_asset.status must be 'not_attached' "
                    "or 'attached'."
                )
        else:
            errors.append(
                "creative.creative_asset must be an object."
            )

    tracking = data.get("tracking")

    if not isinstance(tracking, dict):
        errors.append("'tracking' must be an object.")
    else:
        for field in (
            "utm_source",
            "utm_medium",
            "utm_campaign",
        ):
            if not is_nonempty_string(tracking.get(field)):
                errors.append(
                    f"tracking.{field} must be a non-empty string."
                )

    return errors


def validate_campaign_file(path: Path) -> int:
    """Load and validate an existing campaign JSON file."""
    try:
        with path.expanduser().open("rb") as handle:
            raw = handle.read(MAX_CAMPAIGN_FILE_SIZE + 1)

        if len(raw) > MAX_CAMPAIGN_FILE_SIZE:
            print(
                "Campaign file exceeds the permitted size.",
                file=sys.stderr,
            )
            return 1

        data = json.loads(raw.decode("utf-8"))

    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"Invalid campaign file: {exc}", file=sys.stderr)
        return 1

    errors = validate_campaign_data(data)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("Campaign draft structure is valid.")
    print("Publishing remains disabled.")
    print("Compliance review is required.")
    return 0


def build_example() -> dict[str, Any]:
    """Return a complete example draft."""
    args = argparse.Namespace(
        brand="MedOrbits",
        offer="Education and admission guidance",
        audience=(
            "students and families researching education options"
        ),
        url="https://medorbits.in/",
        objective="traffic",
        cta="learn_more",
        campaign_name="MedOrbits Education Guidance",
    )

    return asdict(create_campaign(args))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )

    commands = parser.add_subparsers(
        dest="command",
        required=True,
    )

    create = commands.add_parser(
        "create",
        help="Create a campaign draft.",
    )

    create.add_argument("--brand", default="MedOrbits")
    create.add_argument(
        "--offer",
        default="Education and admission guidance",
        help="Service or offer to promote.",
    )
    create.add_argument(
        "--audience",
        default=(
            "students and families researching education options"
        ),
        help="Plain-language audience description.",
    )
    create.add_argument(
        "--url",
        default="https://medorbits.in/",
        help="Landing-page URL.",
    )
    create.add_argument(
        "--objective",
        choices=sorted(OBJECTIVES),
        default="traffic",
    )
    create.add_argument(
        "--cta",
        choices=sorted(CTA_OPTIONS),
        default="learn_more",
    )
    create.add_argument("--campaign-name")
    create.add_argument(
        "--output",
        type=Path,
        default=Path("reports/meta-campaign-draft.json"),
    )

    validate = commands.add_parser(
        "validate",
        help="Validate an existing campaign JSON file.",
    )
    validate.add_argument("file", type=Path)

    commands.add_parser(
        "example",
        help="Print a complete sample campaign draft.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "create":
            campaign = create_campaign(args)
            output = write_json(campaign, args.output)

            print(f"Draft saved: {output}")
            print(f"Campaign: {campaign.campaign_name}")
            print(f"Objective: {campaign.objective}")
            print("Publishing enabled: false")
            print("Compliance review required: true")
            print(
                "Review creative, targeting, landing page, "
                "privacy, and Meta policies."
            )
            return 0

        if args.command == "validate":
            return validate_campaign_file(args.file)

        if args.command == "example":
            print(
                json.dumps(
                    build_example(),
                    indent=2,
                    ensure_ascii=False,
                )
            )
            return 0

        parser.error("Unsupported command.")
        return 2

    except (OSError, ValueError) as exc:
        print(f"{TOOL_NAME}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
