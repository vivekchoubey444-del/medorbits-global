
#!/usr/bin/env python3
"""
MedOrbits Duplicate Auditor
Python 3.10+ | Standard library only

Default: read-only audit.
--apply: quarantine eligible exact duplicates; never permanently deletes.
--delete-quarantined: permanently delete files already quarantined by this tool,
                      requiring explicit confirmation.

Never deletes files based only on similar filenames.
Never changes Git history, resolves conflicts, or edits source references.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time

from collections import defaultdict
from pathlib import Path


EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", "node_modules", "vendor",
    "__pycache__", ".venv", "venv", "dist", "build",
    "coverage", ".next", ".nuxt", ".pytest_cache",
    "duplicate-quarantine", "repository-reports",
}

TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".json", ".jsonc", ".py",
    ".md", ".mdx", ".xml", ".svg", ".webmanifest",
    ".yml", ".yaml", ".toml", ".ini", ".txt", ".sh",
    ".sql", ".php", ".vue", ".svelte", ".conf",
}

IGNORED_FILENAMES = {
    ".ds_store",
    "thumbs.db",
}

QUARANTINE_NAME = "duplicate-quarantine"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def excluded(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True

    return any(part in EXCLUDED_DIRS for part in parts)


def scan_files(root: Path) -> list[Path]:
    found = []

    for current, dirs, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)

        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and not name.startswith(".")
        ]

        for filename in filenames:
            path = current_path / filename

            if path.is_symlink() or excluded(path, root):
                continue

            if filename.lower() in IGNORED_FILENAMES:
                continue

            if path.is_file():
                found.append(path)

    return sorted(found, key=lambda p: relative(p, root).lower())


def filename_key(name: str) -> str:
    """
    Normalize filenames for investigation only.
    Does not establish that two files are duplicates.
    """
    return re.sub(r"[^a-z0-9]", "", name.lower())


def possible_plural_pair(name_a: str, name_b: str) -> bool:
    a = filename_key(name_a)
    b = filename_key(name_b)

    if a == b:
        return False

    return (
        a + "s" == b
        or b + "s" == a
    )


def read_text(path: Path) -> str | None:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        return None

    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        return None


def build_reference_index(
    files: list[Path],
    root: Path,
) -> dict[str, list[str]]:
    """
    Conservative reference search:
    searches literal filenames and relative paths in readable source files.
    Dynamic imports and runtime-generated paths may not be detectable.
    """
    searchable = []

    for path in files:
        content = read_text(path)

        if content is not None:
            searchable.append((path, content))

    index: dict[str, list[str]] = defaultdict(list)

    for target in files:
        target_rel = relative(target, root)
        basename = target.name

        for source, content in searchable:
            if source == target:
                continue

            # Match both the full repository path and the basename.
            if target_rel in content or basename in content:
                index[target_rel].append(relative(source, root))

    return index


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit duplicate and suspiciously similar MedOrbits files."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory.",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Quarantine safe exact duplicates after an audit.",
    )

    parser.add_argument(
        "--delete-quarantined",
        action="store_true",
        help="Permanently delete files in this tool's quarantine.",
    )

    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm the explicitly requested operation.",
    )

    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    if not root.is_dir():
        print(f"ERROR: Not a directory: {root}")
        return 2

    if args.delete_quarantined and not args.confirm:
        print(
            "STOP: Permanent deletion requires both "
            "--delete-quarantined and --confirm."
        )
        return 2

    if args.apply and not args.confirm:
        print("STOP: Quarantine requires --apply --confirm.")
        return 2

    quarantine = root / QUARANTINE_NAME
    report_dir = root / "tools" / "repository-reports"
    report_path = report_dir / "duplicate-audit.json"

    # Permanent deletion is restricted to files explicitly listed in
    # this tool's quarantine manifest. No broad wildcard deletion.
    if args.delete_quarantined:
        manifest_path = quarantine / "manifest.json"

        if not manifest_path.is_file():
            print("No quarantine manifest found. Nothing deleted.")
            return 0

        try:
            manifest = json.loads(
                manifest_path.read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError) as exc:
            print(f"ERROR: Cannot safely read quarantine manifest: {exc}")
            return 2

        print("PERMANENT DELETION REQUESTED.")
        print("Files will be verified against their recorded hashes.")

        deleted = []
        blocked = []

        for entry in manifest.get("quarantined", []):
            stored = entry.get("quarantine_path", "")
            expected_hash = entry.get("sha256", "")

            candidate = (root / stored).resolve()

            try:
                candidate.relative_to(quarantine.resolve())
            except ValueError:
                blocked.append({"path": stored, "reason": "Outside quarantine"})
                continue

            if not candidate.is_file() or candidate.is_symlink():
                blocked.append({"path": stored, "reason": "File missing or unsafe"})
                continue

            try:
                if sha256(candidate) != expected_hash:
                    blocked.append({
                        "path": stored,
                        "reason": "Hash changed; not deleted",
                    })
                    continue

                candidate.unlink()
                deleted.append(stored)

            except OSError as exc:
                blocked.append({"path": stored, "reason": str(exc)})

        manifest["permanently_deleted"] = (
            manifest.get("permanently_deleted", []) + deleted
        )
        manifest["blocked_deletions"] = blocked

        manifest_path.write_text(
            json.dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )

        print(f"Deleted: {len(deleted)}")
        print(f"Skipped: {len(blocked)}")
        print("Review the quarantine manifest.")

        return 0

    print("MedOrbits Duplicate Auditor")
    print(f"Repository: {root}")
    print("Git operations: NONE")
    print("Filename similarity alone never authorizes deletion.")

    files = scan_files(root)
    reference_index = build_reference_index(files, root)

    hashes: dict[str, list[Path]] = defaultdict(list)

    for path in files:
        try:
            hashes[sha256(path)].append(path)
        except OSError:
            continue

    exact_groups = [
        group for group in hashes.values()
        if len(group) > 1
    ]

    plural_pairs = []
    inspected_pairs = set()

    for i, first in enumerate(files):
        for second in files[i + 1:]:
            if first.parent != second.parent:
                continue

            pair = tuple(sorted((str(first), str(second))))

            if pair in inspected_pairs:
                continue

            inspected_pairs.add(pair)

            if possible_plural_pair(first.name, second.name):
                try:
                    same_content = sha256(first) == sha256(second)
                except OSError:
                    same_content = False

                plural_pairs.append({
                    "file_a": relative(first, root),
                    "file_b": relative(second, root),
                    "same_content": same_content,
                    "references_a": reference_index.get(
                        relative(first, root), []
                    ),
                    "references_b": reference_index.get(
                        relative(second, root), []
                    ),
                    "action": "MANUAL REVIEW",
                })

    report = {
        "tool": "MedOrbits Duplicate Auditor",
        "created_at_epoch": int(time.time()),
        "repository": str(root),
        "files_scanned": len(files),
        "exact_duplicate_groups": [],
        "similar_filename_pairs": plural_pairs,
        "quarantined": [],
        "notes": [
            "Exact content does not guarantee interchangeable purpose.",
            "A file with references is not automatically safe to remove.",
            "Dynamic imports and runtime paths may evade reference detection.",
            "Filename similarity alone never authorizes deletion.",
            "Review Git status and protect uncommitted files before cleanup.",
        ],
    }

    # For every exact-content group, retain one candidate and report
    # the rest. A candidate is eligible for quarantine only when it
    # has no detected references and is not a hidden or protected file.
    for group in exact_groups:
        ordered = sorted(
            group,
            key=lambda p: (
                len(reference_index.get(relative(p, root), [])) == 0,
                len(relative(p, root)),
                relative(p, root).lower(),
            ),
        )

        keeper = ordered[0]
        duplicates = ordered[1:]

        group_report = {
            "sha256": sha256(keeper),
            "keeper_candidate": relative(keeper, root),
            "duplicates": [],
        }

        for duplicate in duplicates:
            duplicate_rel = relative(duplicate, root)
            refs = reference_index.get(duplicate_rel, [])

            item = {
                "path": duplicate_rel,
                "references": refs,
                "eligible_for_quarantine": (
                    not refs
                    and not duplicate.name.startswith(".")
                    and duplicate.name not in {
                        "package.json",
                        "package-lock.json",
                        "tsconfig.json",
                        "tsconfig.app.json",
                        "yarn.lock",
                        "pnpm-lock.yaml",
                    }
                ),
                "action": "REVIEW",
            }

            group_report["duplicates"].append(item)

        report["exact_duplicate_groups"].append(group_report)

    if args.apply:
        if not quarantine.exists():
            quarantine.mkdir(parents=True)

        manifest_path = quarantine / "manifest.json"

        if manifest_path.exists():
            try:
                manifest = json.loads(
                    manifest_path.read_text(encoding="utf-8")
                )
            except (OSError, json.JSONDecodeError):
                print(
                    "STOP: Existing quarantine manifest is invalid. "
                    "No files were moved."
                )
                return 2
        else:
            manifest = {
                "created_at_epoch": int(time.time()),
                "quarantined": [],
            }

        # Recheck every candidate immediately before moving it.
        for group in report["exact_duplicate_groups"]:
            for item in group["duplicates"]:
                if not item["eligible_for_quarantine"]:
                    continue

                source = root / item["path"]

                if not source.is_file() or source.is_symlink():
                    item["action"] = "SKIPPED: File changed or missing"
                    continue

                # Do not quarantine files with conflict markers.
                content = read_text(source)

                if content is not None and any(
                    line.startswith((
                        "<<<<<<< ", "=======", ">>>>>>> "
                    ))
                    for line in content.splitlines()
                ):
                    item["action"] = "SKIPPED: Conflict markers present"
                    continue

                digest = sha256(source)

                # Use a deterministic, collision-resistant destination.
                destination_rel = (
                    Path(QUARANTINE_NAME)
                    / digest[:12]
                    / source.name
                )

                destination = root / destination_rel

                if destination.exists():
                    item["action"] = "SKIPPED: Quarantine destination exists"
                    continue

                destination.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Move only. Never overwrite an existing destination.
                    source.rename(destination)
                except OSError as exc:
                    item["action"] = f"SKIPPED: {exc}"
                    continue

                entry = {
                    "original_path": item["path"],
                    "quarantine_path": destination_rel.as_posix(),
                    "sha256": digest,
                    "reason": "Exact content duplicate; no detected references",
                }

                manifest["quarantined"].append(entry)
                item["action"] = "QUARANTINED"
                report["quarantined"].append(entry)

        manifest_path.write_text(
            json.dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )

    report_dir.mkdir(parents=True, exist_ok=True)

    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"\nFiles scanned: {len(files)}")
    print(f"Exact duplicate groups: {len(exact_groups)}")
    print(f"Similar filename pairs: {len(plural_pairs)}")
    print(f"Report: {relative(report_path, root)}")

    if args.apply:
        print(f"Quarantine folder: {QUARANTINE_NAME}/")
        print("No files were permanently deleted.")
    else:
        print("Audit-only mode. No repository files were changed.")

    print("\nReview the report before taking further action.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
