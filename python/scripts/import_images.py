#!/usr/bin/env python3
"""
MedOrbits Image Importer
========================

Imports images into a project asset directory and generates a JSON manifest.

Features:
- Bulk import images from files or directories.
- Supports JPG, JPEG, PNG, GIF, WEBP, SVG, BMP, TIFF, ICO and AVIF.
- Validates file signatures for common raster image formats.
- Performs basic SVG safety checks.
- Generates safe, normalized filenames.
- Detects duplicate content using SHA-256.
- Prevents accidental overwrites by default.
- Supports dry-run mode.
- Optional resizing for raster images when Pillow is installed.
- Generates a JSON manifest containing paths, sizes, hashes and metadata.
- Never deletes source files.

Python: 3.12+
Core dependencies: Python standard library.
Optional dependency: Pillow for resizing raster images.

Exit codes:
    0 = Import completed successfully.
    1 = One or more images could not be imported.
    2 = Invalid arguments or execution error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import shutil
import sys

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VERSION = "1.0.0"

SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".tif",
    ".tiff",
    ".ico",
    ".avif",
}

RASTER_SIGNATURES = {
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".webp": (b"RIFF",),
    ".bmp": (b"BM",),
    ".tif": (b"II*\x00", b"MM\x00*"),
    ".tiff": (b"II*\x00", b"MM\x00*"),
    ".ico": (b"\x00\x00\x01\x00",),
    ".avif": (b"\x00\x00\x00",),
}

SVG_FORBIDDEN_PATTERNS = [
    re.compile(r"<\s*script\b", re.IGNORECASE),
    re.compile(r"\bon\w+\s*=", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"<\s*foreignObject\b", re.IGNORECASE),
    re.compile(r"\b(?:href|src)\s*=\s*['\"]?\s*(?:https?:)?//", re.IGNORECASE),
]

DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    "dist",
    "build",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import and organize images for MedOrbits."
    )

    parser.add_argument(
        "sources",
        nargs="+",
        type=Path,
        help="One or more image files or directories to import.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/images/imported"),
        help="Destination image directory. Default: assets/images/imported.",
    )

    parser.add_argument(
        "--manifest",
        type=Path,
        default=None,
        help="Manifest JSON path. Default: <output>/image-manifest.json.",
    )

    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recursively scan source directories.",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview actions without writing files.",
    )

    parser.add_argument(
        "--rename",
        choices=("safe", "original"),
        default="safe",
        help="Filename policy. Default: safe.",
    )

    parser.add_argument(
        "--duplicates",
        choices=("skip", "rename", "error"),
        default="skip",
        help="Handle identical image content. Default: skip.",
    )

    parser.add_argument(
        "--resize",
        type=int,
        default=None,
        help="Optional maximum image dimension in pixels; requires Pillow.",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing destination file.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden source files and directories.",
    )

    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Directory name to exclude. May be specified more than once.",
    )

    parser.add_argument(
        "--max-size-mb",
        type=float,
        default=50,
        help="Maximum source image size in MB. Default: 50.",
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )

    args = parser.parse_args()

    if args.resize is not None and args.resize < 1:
        parser.error("--resize must be greater than zero.")

    if args.max_size_mb <= 0:
        parser.error("--max-size-mb must be greater than zero.")

    return args


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def is_hidden(path: Path) -> bool:
    return any(part.startswith(".") for part in path.parts)


def discover_images(
    sources: list[Path],
    recursive: bool,
    include_hidden: bool,
    excluded_dirs: set[str],
) -> list[Path]:
    found: set[Path] = set()

    for source in sources:
        source = source.expanduser().resolve()

        if not source.exists():
            raise FileNotFoundError(f"Source does not exist: {source}")

        if source.is_file():
            if source.suffix.lower() in SUPPORTED_EXTENSIONS:
                if include_hidden or not is_hidden(source):
                    found.add(source)
            continue

        if not source.is_dir():
            continue

        iterator = source.rglob("*") if recursive else source.iterdir()

        for path in iterator:
            try:
                if not path.is_file():
                    continue

                if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                relative = path.relative_to(source)

                if any(part in excluded_dirs for part in relative.parts):
                    continue

                if not include_hidden and is_hidden(relative):
                    continue

                found.add(path.resolve())

            except (OSError, ValueError):
                continue

    return sorted(found)


def safe_filename(filename: str) -> str:
    path = Path(filename)
    stem = path.stem.strip().lower()
    suffix = path.suffix.lower()

    stem = re.sub(r"[^a-z0-9_-]+", "-", stem)
    stem = re.sub(r"-{2,}", "-", stem).strip("-_")

    if not stem:
        stem = "image"

    return f"{stem}{suffix}"


def validate_svg(path: Path, max_size_bytes: int) -> tuple[bool, str]:
    if path.stat().st_size > max_size_bytes:
        return False, "File exceeds the configured size limit."

    try:
        content = path.read_text(
            encoding="utf-8-sig",
            errors="strict",
        )
    except (OSError, UnicodeError) as exc:
        return False, f"Unable to read SVG: {exc}"

    if "<svg" not in content[:8192].lower():
        return False, "SVG root element was not found near the start of the file."

    for pattern in SVG_FORBIDDEN_PATTERNS:
        if pattern.search(content):
            return False, (
                "SVG contains potentially unsafe active content or external references."
            )

    return True, "SVG basic checks passed."


def validate_raster_signature(path: Path) -> tuple[bool, str]:
    extension = path.suffix.lower()

    if extension == ".avif":
        # AVIF is an ISO Base Media File Format. Its "ftyp" box usually
        # contains an avif or avis brand. Inspect a small header.
        try:
            with path.open("rb") as file:
                header = file.read(64)

            if (
                len(header) >= 12
                and header[4:8] == b"ftyp"
                and (
                    b"avif" in header[8:]
                    or b"avis" in header[8:]
                )
            ):
                return True, "AVIF signature passed."

            return False, "Invalid or unrecognized AVIF file signature."

        except OSError as exc:
            return False, f"Unable to read image: {exc}"

    signatures = RASTER_SIGNATURES.get(extension)

    if not signatures:
        return False, "No signature validator is available for this format."

    try:
        with path.open("rb") as file:
            header = file.read(16)

        if not any(header.startswith(signature) for signature in signatures):
            return False, "File extension does not match the expected image signature."

        if extension == ".webp" and header[8:12] != b"WEBP":
            return False, "Invalid WEBP file signature."

        return True, "Image signature passed."

    except OSError as exc:
        return False, f"Unable to read image: {exc}"


def validate_image(
    path: Path,
    max_size_bytes: int,
) -> tuple[bool, str]:
    try:
        size = path.stat().st_size
    except OSError as exc:
        return False, f"Unable to inspect file: {exc}"

    if size == 0:
        return False, "File is empty."

    if size > max_size_bytes:
        return False, (
            f"File is too large: {size / (1024 * 1024):.2f} MB."
        )

    if path.suffix.lower() == ".svg":
        return validate_svg(path, max_size_bytes)

    return validate_raster_signature(path)


def resize_image(
    source: Path,
    destination: Path,
    maximum_dimension: int,
) -> tuple[bool, str]:
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return False, (
            "Pillow is required for resizing. Install it with: "
            "python -m pip install Pillow"
        )

    try:
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail(
                (maximum_dimension, maximum_dimension),
                Image.Resampling.LANCZOS,
            )

            suffix = destination.suffix.lower()

            if suffix in {".jpg", ".jpeg"}:
                if image.mode not in {"RGB", "L"}:
                    if "A" in image.getbands():
                        background = Image.new("RGB", image.size, (255, 255, 255))
                        background.paste(image, mask=image.getchannel("A"))
                        image = background
                    else:
                        image = image.convert("RGB")

                image.save(destination, quality=90, optimize=True)

            elif suffix == ".png":
                image.save(destination, optimize=True)

            elif suffix == ".webp":
                image.save(destination, quality=90, method=6)

            else:
                image.save(destination)

        return True, "Image resized successfully."

    except Exception as exc:
        return False, f"Image resizing failed: {exc}"


def unique_destination(
    destination: Path,
    used_hashes: dict[str, Path],
    digest: str,
    duplicate_policy: str,
) -> tuple[Path | None, str]:
    if digest in used_hashes:
        existing = used_hashes[digest]

        if duplicate_policy == "skip":
            return None, f"Duplicate content; already imported as {existing.name}."

        if duplicate_policy == "error":
            return None, "Duplicate content detected."

        candidate = destination
        counter = 2

        while candidate.exists():
            candidate = destination.with_name(
                f"{destination.stem}-{counter}{destination.suffix}"
            )
            counter += 1

        return candidate, "Duplicate content renamed."

    candidate = destination
    counter = 2

    while candidate.exists():
        candidate = destination.with_name(
            f"{destination.stem}-{counter}{destination.suffix}"
        )
        counter += 1

    return candidate, "New image."

 
def load_existing_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))

        if isinstance(data, dict) and isinstance(data.get("images"), list):
            return [
                item for item in data["images"]
                if isinstance(item, dict)
            ]

    except (OSError, json.JSONDecodeError):
        pass

    return []


def write_manifest(
    path: Path,
    images: list[dict[str, Any]],
    dry_run: bool,
) -> None:
    if dry_run:
        return

    path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "metadata": {
            "schemaVersion": "1.0.0",
            "dataset": "medorbits-image-manifest",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "imageCount": len(images),
        },
        "images": images,
    }

    temporary = path.with_name(path.name + ".tmp")

    try:
        temporary.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    args = parse_args()

    output = args.output.expanduser().resolve()
    manifest_path = (
        args.manifest.expanduser().resolve()
        if args.manifest
        else output / "image-manifest.json"
    )

    if manifest_path == output or output in manifest_path.parents:
        if manifest_path.suffix.lower() != ".json":
            print(
                "ERROR: Manifest must be a JSON file.",
                file=sys.stderr,
            )
            return 2

    excluded_dirs = DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir)

    try:
        sources = [path.expanduser().resolve() for path in args.sources]
        images = discover_images(
            sources,
            args.recursive,
            args.include_hidden,
            excluded_dirs,
        )
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if not images:
        print("No supported image files found.")
        return 0

    max_size_bytes = int(args.max_size_mb * 1024 * 1024)

    if args.resize is not None:
        try:
            import PIL  # noqa: F401
        except ImportError:
            print(
                "ERROR: --resize requires Pillow. "
                "Install it with: python -m pip install Pillow",
                file=sys.stderr,
            )
            return 2

    if not args.dry_run:
        try:
            output.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            print(f"ERROR: Cannot create output directory: {exc}", file=sys.stderr)
            return 2

    existing_manifest = load_existing_manifest(manifest_path)
    manifest_entries: list[dict[str, Any]] = list(existing_manifest)
    known_hashes: dict[str, Path] = {}

    for entry in existing_manifest:
        digest = entry.get("sha256")
        relative_path = entry.get("path")

        if isinstance(digest, str) and isinstance(relative_path, str):
            known_hashes[digest] = output / relative_path

    imported = 0
    skipped = 0
    errors = 0

    print("MedOrbits Image Importer")
    print("=" * 26)
    print(f"Images discovered: {len(images)}")
    print(f"Output directory:  {output}")
    print(f"Dry run:           {'yes' if args.dry_run else 'no'}")
    print()

    for source in images:
        valid, message = validate_image(source, max_size_bytes)

        if not valid:
            errors += 1
            print(f"[ERROR] {source}: {message}")
            continue

        try:
            digest = sha256_file(source)
        except OSError as exc:
            errors += 1
            print(f"[ERROR] {source}: {exc}")
            continue

        filename = (
            safe_filename(source.name)
            if args.rename == "safe"
            else source.name
        )

        destination = output / filename

        if digest in known_hashes:
            if args.duplicates == "skip":
                skipped += 1
                print(
                    f"[SKIP] {source.name}: identical content already imported."
                )
                continue

            if args.duplicates == "error":
                errors += 1
                print(
                    f"[ERROR] {source.name}: duplicate content detected."
                )
                continue

        if destination.exists() and not args.overwrite:
            if args.duplicates == "rename":
                counter = 2
                while destination.exists():
                    destination = output / (
                        f"{Path(filename).stem}-{counter}{Path(filename).suffix}"
                    )
                    counter += 1
            else:
                skipped += 1
                print(
                    f"[SKIP] {source.name}: destination already exists: "
                    f"{destination.name}"
                )
                continue

        print(f"[IMPORT] {source} -> {destination}")

        if not args.dry_run:
            try:
                if args.resize is not None and source.suffix.lower() != ".svg":
                    success, resize_message = resize_image(
                        source,
                        destination,
                        args.resize,
                    )

                    if not success:
                        errors += 1
                        print(f"  [ERROR] {resize_message}")
                        continue

                else:
                    # Copy without altering the source file.
                    if destination.exists() and args.overwrite:
                        destination.unlink()

                    shutil.copy2(source, destination)

                destination_hash = sha256_file(destination)
                mime_type, _ = mimetypes.guess_type(destination.name)

                entry = {
                    "filename": destination.name,
                    "path": destination.relative_to(output).as_posix(),
                    "source": str(source),
                    "mimeType": mime_type or "application/octet-stream",
                    "extension": destination.suffix.lower(),
                    "sizeBytes": destination.stat().st_size,
                    "sha256": destination_hash,
                    "importedAt": datetime.now(timezone.utc).isoformat(),
                }

                manifest_entries = [
                    old for old in manifest_entries
                    if old.get("path") != entry["path"]
                ]
                manifest_entries.append(entry)
                known_hashes[digest] = destination

            except OSError as exc:
                errors += 1
                print(f"  [ERROR] Could not import image: {exc}")
                continue

        imported += 1

    if not args.dry_run:
        try:
            write_manifest(manifest_path, manifest_entries, dry_run=False)
            print(f"\nManifest: {manifest_path}")
        except OSError as exc:
            errors += 1
            print(f"\n[ERROR] Could not write manifest: {exc}")

    print("\nSummary")
    print("-------")
    print(f"Imported/planned: {imported}")
    print(f"Skipped:          {skipped}")
    print(f"Errors:           {errors}")

    if errors:
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())