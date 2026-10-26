Save as tools/free_promotion.py. This MedOrbits promotion toolkit generates free marketing campaigns, social media captions, SEO suggestions, community outreach plans, and a posting calendar. It does not automatically publish content, send unsolicited messages, or purchase advertising.

#!/usr/bin/env python3
"""
MedOrbits Free Promotion Toolkit
================================
Generate organic marketing assets without paid advertising.
Features:
- Social media captions for Instagram, Facebook, LinkedIn, and YouTube.
- SEO metadata and keyword suggestions.
- Community outreach and partnership ideas.
- A 7-day organic promotion calendar.
- Referral and content repurposing ideas.
- JSON export for campaign planning.
Safety:
- No paid ads or spending.
- No automated posting, scraping, or unsolicited messaging.
- No fabricated testimonials, rankings, statistics, or guarantees.
- No collection of personal information.
- Drafts require human review before publication.
Usage:
    python tools/free_promotion.py campaign
    python tools/free_promotion.py captions
    python tools/free_promotion.py seo
    python tools/free_promotion.py calendar
    python tools/free_promotion.py ideas
    python tools/free_promotion.py all
    python tools/free_promotion.py all --output reports/free-promotion.json
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
TOOL_NAME = "MedOrbits Free Promotion Toolkit"
DEFAULT_BRAND = "MedOrbits"
DEFAULT_WEBSITE = "https://medorbits.in/"
DEFAULT_OFFER = "Education, admission, and career guidance"
PLATFORMS = ("Instagram", "Facebook", "LinkedIn", "YouTube")
def clean_text(value: str, field: str, limit: int = 300) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field} cannot be empty.")
    if len(value) > limit:
        raise ValueError(f"{field} cannot exceed {limit} characters.")
    if "\x00" in value:
        raise ValueError(f"{field} contains an invalid character.")
    return value
def validate_website(value: str) -> str:
    value = clean_text(value, "Website URL", 2048)
    parsed = urlsplit(value)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise ValueError("Website must be a valid HTTP or HTTPS URL.")
    if parsed.username or parsed.password:
        raise ValueError("Website URL must not contain embedded credentials.")
    if any(char.isspace() for char in value):
        raise ValueError("Website URL cannot contain whitespace.")
    return value
def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:70]
def build_captions(brand: str, offer: str, website: str) -> dict[str, str]:
    """Generate platform-specific organic social drafts."""
    return {
        "Instagram": (
            f"Planning your next education or career step? 🎓\n\n"
            f"Explore useful information and guidance with {brand}. "
            f"Research your options, understand eligibility, and check "
            f"official requirements before making a decision.\n\n"
            f"Explore more: {website}\n\n"
            f"#Education #CareerGuidance #Admissions #StudentResources "
            f"#MedOrbits"
        ),
        "Facebook": (
            f"Looking for reliable information about your next step?\n\n"
            f"{brand} helps you explore {offer.lower()} resources. "
            f"Compare available options, review eligibility, and verify "
            f"important details with official institutions.\n\n"
            f"Visit: {website}\n\n"
            f"Save this post or share it with someone who may find it useful."
        ),
        "LinkedIn": (
            f"Making an informed education or career decision starts with "
            f"good research.\n\n"
            f"{brand} shares resources related to {offer.lower()}. "
            f"Review entry requirements, timelines, and official sources "
            f"before taking action.\n\n"
            f"Explore the resources: {website}\n\n"
            f"#Education #CareerDevelopment #StudentSuccess"
        ),
        "YouTube": (
            f"Explore education and career resources with {brand}.\n\n"
            f"In this video, we discuss {offer.lower()}. Always confirm "
            f"eligibility, deadlines, fees, and admission requirements "
            f"with the relevant official institution.\n\n"
            f"More resources: {website}\n\n"
            f"Subscribe for more educational guides and useful updates."
        ),
    }
def build_seo(brand: str, offer: str, website: str) -> dict[str, Any]:
    keywords = [
        "education guidance",
        "admission information",
        "career guidance",
        "college research",
        "student resources",
        "education planning",
    ]
    title = f"{brand} | Education and Career Guidance"
    description = (
        f"Explore {offer.lower()} resources with {brand}. "
        "Review eligibility, compare options, and verify details "
        "with official sources."
    )
    return {
        "website": website,
        "suggested_title": title[:60],
        "suggested_meta_description": description[:160],
        "keyword_ideas": keywords,
        "on_page_actions": [
            "Give every important page a unique title and meta description.",
            "Use clear headings that accurately describe page content.",
            "Add useful internal links between related guides.",
            "Compress images and provide descriptive alt text.",
            "Ensure mobile usability and accessible navigation.",
            "Keep course fees, deadlines, and eligibility information current.",
            "Add structured data only when it accurately describes page content.",
            "Connect the site to Google Search Console and submit a sitemap.",
        ],
        "note": "Keyword suggestions are ideas, not rankings or traffic guarantees.",
    }
def build_promotion_ideas(brand: str, offer: str, website: str) -> list[dict[str, str]]:
    return [
        {
            "channel": "Organic social media",
            "action": (
                f"Publish useful short videos and carousels about {offer.lower()}. "
                "Use clear captions and a link to the relevant page."
            ),
            "frequency": "2–4 useful posts per week",
            "cost": "Free",
        },
        {
            "channel": "YouTube",
            "action": (
                "Create explainers, FAQs, application checklists, and "
                "step-by-step guides. Add the relevant website link."
            ),
            "frequency": "1 helpful video per week",
            "cost": "Free with existing equipment",
        },
        {
            "channel": "Community participation",
            "action": (
                "Answer relevant questions in student communities where "
                "promotion is permitted. Disclose your affiliation and "
                "share links only when useful and allowed."
            ),
            "frequency": "A few meaningful contributions per week",
            "cost": "Free",
        },
        {
            "channel": "Partnership outreach",
            "action": (
                "Approach colleges, educators, student clubs, and career "
                "communities with a specific collaboration proposal."
            ),
            "frequency": "Personalized outreach each week",
            "cost": "Free to contact; partnerships may have costs",
        },
        {
            "channel": "Website content",
            "action": (
                "Publish accurate guides, checklists, FAQs, and comparison "
                "pages. Cite official sources and update expired information."
            ),
            "frequency": "1–2 substantial resources per week",
            "cost": "Free if written in-house",
        },
        {
            "channel": "Customer referrals",
            "action": (
                "Invite satisfied users to voluntarily share helpful "
                "resources. Do not invent reviews or offer undisclosed "
                "incentives for positive testimonials."
            ),
            "frequency": "Include a simple invitation where appropriate",
            "cost": "Free without incentives",
        },
        {
            "channel": "Google Business Profile",
            "action": (
                "If eligible as a real business, keep business details, "
                "hours, contact information, and updates accurate."
            ),
            "frequency": "Review details monthly",
            "cost": "Free profile; eligibility rules apply",
        },
    ]
def build_calendar(brand: str, website: str) -> list[dict[str, str]]:
    """Build a seven-day plan starting today."""
    today = date.today()
    tasks = [
        (
            "Educational carousel",
            "Explain one common admission or career question with verified facts.",
            "Instagram and Facebook",
        ),
        (
            "Short video",
            "Answer one frequently asked question in 30–60 seconds.",
            "Instagram Reels and YouTube Shorts",
        ),
        (
            "Useful guide",
            "Publish a checklist or explainer with links to official sources.",
            "Website and LinkedIn",
        ),
        (
            "Community engagement",
            "Answer relevant questions in communities that permit participation.",
            "Student communities",
        ),
        (
            "Myth versus fact",
            "Correct one common misconception and cite an authoritative source.",
            "Instagram and Facebook",
        ),
        (
            "Partnership outreach",
            "Contact one relevant educator or organization with a tailored proposal.",
            "Email or professional network",
        ),
        (
            "Review and improve",
            "Review available analytics and plan next week's useful content.",
            "All channels",
        ),
    ]
    return [
        {
            "date": (today + timedelta(days=index)).isoformat(),
            "day": f"Day {index + 1}",
            "brand": brand,
            "content": title,
            "action": action,
            "channel": channel,
            "destination": website,
        }
        for index, (title, action, channel) in enumerate(tasks)
    ]
def build_campaign(brand: str, offer: str, website: str) -> dict[str, Any]:
    captions = build_captions(brand, offer, website)
    return {
        "tool": TOOL_NAME,
        "schema_version": "1.0",
        "campaign_name": f"{slugify(brand)}-organic-promotion",
        "status": "draft",
        "promotion_type": "organic",
        "paid_ad_spend": 0,
        "brand": brand,
        "offer": offer,
        "website": website,
        "captions": captions,
        "seo": build_seo(brand, offer, website),
        "promotion_ideas": build_promotion_ideas(brand, offer, website),
        "calendar": build_calendar(brand, website),
        "publishing_enabled": False,
        "safety_review_required": True,
        "review_checklist": [
            "Verify facts, fees, deadlines, eligibility, and links.",
            "Check platform rules and community promotion policies.",
            "Obtain permission to use third-party images, logos, and music.",
            "Do not promise guaranteed admission, jobs, visas, or outcomes.",
            "Do not send unsolicited bulk messages or scrape contact details.",
            "Review analytics without collecting unnecessary personal data.",
        ],
    }
def save_json(data: dict[str, Any], output: Path) -> Path:
    """Create a new JSON file without overwriting existing work."""
    output = output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    return output
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )
    parser.add_argument("--brand", default=DEFAULT_BRAND)
    parser.add_argument("--offer", default=DEFAULT_OFFER)
    parser.add_argument("--website", default=DEFAULT_WEBSITE)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("reports/free-promotion.json"),
        help="Output JSON path; existing files are never overwritten.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("campaign", "captions", "seo", "calendar", "ideas", "all"):
        subparsers.add_parser(command, help=f"Generate {command} content.")
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    try:
        brand = clean_text(args.brand, "Brand", 100)
        offer = clean_text(args.offer, "Offer", 200)
        website = validate_website(args.website)
        campaign = build_campaign(brand, offer, website)
        if args.command == "campaign":
            result: Any = {
                "campaign_name": campaign["campaign_name"],
                "brand": brand,
                "offer": offer,
                "website": website,
                "promotion_type": "organic",
                "paid_ad_spend": 0,
                "publishing_enabled": False,
                "review_checklist": campaign["review_checklist"],
            }
        elif args.command == "captions":
            result = campaign["captions"]
        elif args.command == "seo":
            result = campaign["seo"]
        elif args.command == "calendar":
            result = campaign["calendar"]
        elif args.command == "ideas":
            result = campaign["promotion_ideas"]
        elif args.command == "all":
            result = campaign
        else:
            raise ValueError("Unsupported command.")
        if args.command in {"campaign", "all"}:
            saved = save_json(result, args.output)
            print(f"Draft saved to: {saved}")
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (OSError, ValueError) as exc:
        print(f"{TOOL_NAME}: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())

Run it

Generate a complete organic promotion plan:

python tools/free_promotion.py all

Generate only Instagram, Facebook, LinkedIn, and YouTube caption drafts:

python tools/free_promotion.py captions

Customize it for an MBBS admission campaign:

python tools/free_promotion.py all \
  --brand MedOrbits \
  --offer "MBBS admission guidance" \
  --website https://medorbits.in/ \
  --output reports/mbbs-organic-promotion.json

Safety: The script creates drafts only. It does not guarantee reach, followers, leads, or search rankings, and it will refuse to overwrite an existing output file.