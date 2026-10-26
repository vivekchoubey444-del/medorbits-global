#!/usr/bin/env python3
"""
MedOrbits Meta Ad Creator
-------------------------
Create branded Meta ad image creatives in common placements using Pillow.

Features:
- Square feed: 1080x1080
- Portrait feed: 1080x1350
- Story/Reel: 1080x1920
- Landscape/link: 1200x628
- Optional background image and logo
- Headline, body copy, CTA, brand name, accent color
- Writes a JSON manifest describing generated files
- Optional cleanup of old generated files; dry-run by default
- Never uploads ads or accesses Meta accounts

Python 3.10+
Dependency: Pillow (pip install Pillow)

Example:
  python tools/meta_ad_creator.py --headline "Your Future Starts Here" \
    --body "Explore education and career guidance with MedOrbits." \
    --cta "Get Guidance" --brand MedOrbits --out generated/meta-ads

With a background and logo:
  python tools/meta_ad_creator.py --background assets/images/campus.jpg \
    --logo assets/images/medorbits-logo.png --headline "Study Smarter" \
    --body "Explore courses, colleges and career opportunities." \
    --cta "Learn More" --out generated/meta-ads

Cleanup is deliberately opt-in and dry-run by default:
  python tools/meta_ad_creator.py --cleanup-unused --out generated/meta-ads
  python tools/meta_ad_creator.py --cleanup-unused --confirm-delete --out generated/meta-ads
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ImportError:
    print(
        "ERROR: Pillow is required. Install it with: python -m pip install Pillow",
        file=sys.stderr,
    )
    raise SystemExit(2)

VERSION = "1.0.0"
FORMATS = {
    "square": (1080, 1080),
    "portrait": (1080, 1350),
    "story": (1080, 1920),
    "landscape": (1200, 628),
}
DEFAULT_ACCENT = "#D9B66F"
DEFAULT_BACKGROUND = "#102C23"
DEFAULT_FOREGROUND = "#FFF8E8"


def parse_color(value: str) -> tuple[int, int, int]:
    """Parse #RGB or #RRGGBB into an RGB tuple."""
    value = value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        raise argparse.ArgumentTypeError("Color must be #RGB or #RRGGBB.")
    try:
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Color contains non-hexadecimal characters.") from exc


def hex_color(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Load a commonly available font, falling back safely to Pillow's default."""
    candidates = (
        [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
        ]
        if bold else [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize and crop an image to fill the target canvas."""
    return ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))


def blend(a: tuple[int, int, int], b: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    amount = max(0.0, min(1.0, amount))
    return tuple(round(a[i] * (1 - amount) + b[i] * amount) for i in range(3))


def gradient_background(size: tuple[int, int], base: tuple[int, int, int], accent: tuple[int, int, int]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, base)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = blend(base, accent, ratio * 0.28)
        draw.line((0, y, width, y), fill=color)
    # Soft geometric decoration for depth.
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    radius = int(min(width, height) * 0.42)
    od.ellipse((width - radius, -radius // 2, width + radius, radius * 1.5),
               fill=(*accent, 30))
    od.ellipse((-radius, height - radius, radius, height + radius),
               fill=(*accent, 22))
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def open_logo(path: Optional[Path], max_size: tuple[int, int]) -> Optional[Image.Image]:
    if not path:
        return None
    if not path.is_file():
        raise FileNotFoundError(f"Logo file not found: {path}")
    with Image.open(path) as source:
        logo = source.convert("RGBA")
    logo.thumbnail(max_size, Image.Resampling.LANCZOS)
    return logo


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    """Wrap text by measured pixel width, preserving explicit newlines."""
    output: list[str] = []
    for paragraph in text.splitlines() or [""]:
        words = paragraph.split()
        if not words:
            output.append("")
            continue
        current = words[0]
        for word in words[1:]:
            trial = f"{current} {word}"
            if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
                current = trial
            else:
                output.append(current)
                current = word
        output.append(current)
    return output


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_gap: int = 12,
    max_lines: Optional[int] = None,
) -> int:
    """Draw wrapped text and return the y coordinate after the final line."""
    x, y = xy
    lines = wrap_text(draw, text, font, max_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            last = lines[-1]
            while last and draw.textbbox((0, 0), last + "…", font=font)[2] > max_width:
                last = last[:-1]
            lines[-1] = last.rstrip() + "…"
    for line in lines:
        bbox = draw.textbbox((x, y), line, font=font)
        draw.text((x, y), line, font=font, fill=fill)
        y += max(1, bbox[3] - bbox[1]) + line_gap
    return y


def render_ad(
    size: tuple[int, int],
    headline: str,
    body: str,
    cta: str,
    brand: str,
    background_path: Optional[Path],
    logo_path: Optional[Path],
    accent: tuple[int, int, int],
    base: tuple[int, int, int],
    foreground: tuple[int, int, int],
) -> Image.Image:
    width, height = size
    if background_path:
        if not background_path.is_file():
            raise FileNotFoundError(f"Background image not found: {background_path}")
        with Image.open(background_path) as source:
            canvas = fit_cover(source, size).convert("RGBA")
        # Dark translucent overlay helps text contrast.
        shade = Image.new("RGBA", size, (0, 0, 0, 0))
        shade_draw = ImageDraw.Draw(shade)
        shade_draw.rectangle((0, 0, width, height), fill=(*base, 168))
        canvas = Image.alpha_composite(canvas, shade)
    else:
        canvas = gradient_background(size, base, accent).convert("RGBA")

    draw = ImageDraw.Draw(canvas)
    margin = int(width * 0.075)
    content_width = width - margin * 2

    # Decorative accent line.
    draw.rounded_rectangle(
        (margin, int(height * 0.075), margin + int(width * 0.14), int(height * 0.075) + 10),
        radius=5, fill=accent,
    )

    # Logo or brand wordmark.
    logo = open_logo(logo_path, (int(width * 0.28), int(height * 0.11)))
    top_y = int(height * 0.105)
    if logo:
        canvas.alpha_composite(logo, (margin, top_y))
        brand_y = top_y + logo.height + int(height * 0.035)
    else:
        brand_font = load_font(max(24, int(width * 0.035)), bold=True)
        draw.text((margin, top_y), brand, font=brand_font, fill=accent)
        brand_y = top_y + int(height * 0.075)

    # Layout changes for tall Story/Reel creatives.
    is_tall = height / width > 1.45
    headline_size = int(width * (0.073 if is_tall else 0.066))
    body_size = int(width * (0.034 if is_tall else 0.031))
    headline_font = load_font(headline_size, bold=True)
    body_font = load_font(body_size)
    headline_y = max(int(height * (0.30 if is_tall else 0.29)), brand_y + int(height * 0.07))
    headline_y = min(headline_y, int(height * 0.43))

    after_headline = draw_wrapped(
        draw, headline, (margin, headline_y), headline_font, foreground,
        content_width, line_gap=int(height * 0.012),
        max_lines=4 if is_tall else 3,
    )
    body_y = after_headline + int(height * 0.025)
    body_y = min(body_y, int(height * 0.66))
    draw_wrapped(
        draw, body, (margin, body_y), body_font, foreground,
        content_width, line_gap=int(height * 0.009),
        max_lines=5 if is_tall else 4,
    )

    # CTA pill near the lower safe area.
    cta_font = load_font(max(20, int(width * 0.029)), bold=True)
    cta_bbox = draw.textbbox((0, 0), cta, font=cta_font)
    cta_text_w = cta_bbox[2] - cta_bbox[0]
    cta_text_h = cta_bbox[3] - cta_bbox[1]
    pad_x, pad_y = int(width * 0.035), int(height * 0.018)
    button_w = min(content_width, cta_text_w + pad_x * 2)
    button_h = cta_text_h + pad_y * 2
    button_x = margin
    button_y = int(height * (0.82 if is_tall else 0.80))
    button_y = min(button_y, height - margin - button_h)
    draw.rounded_rectangle(
        (button_x, button_y, button_x + button_w, button_y + button_h),
        radius=int(button_h * 0.28), fill=accent,
    )
    text_color = (18, 26, 22) if sum(accent) > 360 else foreground
    draw.text(
        (button_x + pad_x, button_y + pad_y - cta_bbox[1]),
        cta, font=cta_font, fill=text_color,
    )

    # Brand footer.
    footer_font = load_font(max(16, int(width * 0.018)))
    footer = brand.strip()
    footer_bbox = draw.textbbox((0, 0), footer, font=footer_font)
    footer_y = height - margin - (footer_bbox[3] - footer_bbox[1])
    draw.text((margin, footer_y), footer, font=footer_font, fill=foreground)

    return canvas.convert("RGB")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate static Meta ad creatives for common placements."
    )
    parser.add_argument("--headline", required=True, help="Main ad headline.")
    parser.add_argument("--body", default="", help="Supporting copy.")
    parser.add_argument("--cta", default="Learn More", help="Call-to-action label.")
    parser.add_argument("--brand", default="MedOrbits", help="Brand or business name.")
    parser.add_argument("--background", type=Path, help="Optional background image.")
    parser.add_argument("--logo", type=Path, help="Optional transparent logo image.")
    parser.add_argument("--out", type=Path, default=Path("generated/meta-ads"), help="Output directory.")
    parser.add_argument(
        "--formats", nargs="+", choices=sorted(FORMATS), default=["square", "portrait", "story", "landscape"],
        help="One or more creative sizes.",
    )
    parser.add_argument("--accent", type=parse_color, default=parse_color(DEFAULT_ACCENT), help="Accent color, e.g. #D9B66F.")
    parser.add_argument("--background-color", type=parse_color, default=parse_color(DEFAULT_BACKGROUND), help="Base background color.")
    parser.add_argument("--text-color", type=parse_color, default=parse_color(DEFAULT_FOREGROUND), help="Text color.")
    parser.add_argument("--filename-prefix", default="medorbits-meta", help="Output filename prefix.")
    parser.add_argument("--cleanup-unused", action="store_true", help="Preview cleanup of old files in the output folder.")
    parser.add_argument("--confirm-delete", action="store_true", help="Actually delete eligible old files; requires --cleanup-unused.")
    parser.add_argument("--dry-run", action="store_true", help="Preview outputs without writing images or manifest.")
    return parser


def cleanup_unused(out_dir: Path, keep: set[str], confirm: bool) -> int:
    """Only consider files in the chosen output directory; never recurse."""
    if not out_dir.exists():
        print(f"Cleanup: output directory does not exist: {out_dir}")
        return 0
    candidates = []
    for path in out_dir.iterdir():
        if path.is_symlink() or not path.is_file():
            continue
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and path.name not in keep:
            candidates.append(path)
    if not candidates:
        print("Cleanup: no unused image files found.")
        return 0
    print("Cleanup candidates:")
    for path in candidates:
        print(f"  {path}")
    if not confirm:
        print("Dry-run only: pass --confirm-delete with --cleanup-unused to delete these files.")
        return len(candidates)
    for path in candidates:
        try:
            path.unlink()
            print(f"Deleted: {path}")
        except OSError as exc:
            print(f"WARNING: Could not delete {path}: {exc}", file=sys.stderr)
    return len(candidates)


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.confirm_delete and not args.cleanup_unused:
        parser.error("--confirm-delete requires --cleanup-unused")
    if args.cleanup_unused and args.dry_run:
        print("Cleanup preview requested; --dry-run prevents all writes and deletions.")

    out_dir = args.out.expanduser().resolve()
    prefix = re.sub(r"[^A-Za-z0-9._-]+", "-", args.filename_prefix).strip(".-_") or "meta-ad"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    generated = []
    manifest_path = out_dir / f"{prefix}-{stamp}-manifest.json"

    print(f"MedOrbits Meta Ad Creator {VERSION}")
    print(f"Output directory: {out_dir}")
    print("Meta account access/upload: DISABLED")

    for fmt in args.formats:
        size = FORMATS[fmt]
        filename = f"{prefix}-{stamp}-{fmt}-{size[0]}x{size[1]}.png"
        destination = out_dir / filename
        generated.append({
            "format": fmt,
            "width": size[0],
            "height": size[1],
            "file": filename,
            "path": str(destination),
        })

    if args.dry_run:
        print("\nDRY RUN: no files written.")
        for item in generated:
            print(f"Would create: {item['path']} ({item['width']}x{item['height']})")
        print(f"Would create manifest: {manifest_path}")
        if args.cleanup_unused:
            cleanup_unused(out_dir, {item["file"] for item in generated}, confirm=False)
        return 0

    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        for item in generated:
            image = render_ad(
                (item["width"], item["height"]),
                args.headline,
                args.body,
                args.cta,
                args.brand,
                args.background.expanduser() if args.background else None,
                args.logo.expanduser() if args.logo else None,
                args.accent,
                args.background_color,
                args.text_color,
            )
            image.save(item["path"], format="PNG", optimize=True)
            print(f"Created: {item['path']}")

        manifest = {
            "tool": "MedOrbits Meta Ad Creator",
            "version": VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "headline": args.headline,
            "body": args.body,
            "cta": args.cta,
            "brand": args.brand,
            "colors": {
                "accent": hex_color(args.accent),
                "background": hex_color(args.background_color),
                "text": hex_color(args.text_color),
            },
            "source_assets": {
                "background": str(args.background.expanduser()) if args.background else None,
                "logo": str(args.logo.expanduser()) if args.logo else None,
            },
            "creatives": generated,
            "limitations": [
                "Static image creatives only; this script does not publish ads.",
                "Review text, branding, image rights, and Meta placement requirements before use.",
                "Generated assets are design drafts and are not a guarantee of ad-policy compliance.",
            ],
        }
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Manifest: {manifest_path}")

        if args.cleanup_unused:
            cleanup_unused(out_dir, {item["file"] for item in generated}, confirm=args.confirm_delete)

    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print("\nFinished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
