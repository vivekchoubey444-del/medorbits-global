
#!/usr/bin/env python3
“””
MedOrbits Master Repository Auditor
===================================
File: tools/master_repository_repair.py

Audits an existing repository and generates machine-readable reports.
Repairs are deliberately limited to verified, safe changes. Source files,
credentials, caches, databases, and existing reports are never bulk-deleted.

Usage:
    python tools/master_repository_repair.py
    python tools/master_repository_repair.py —root /path/to/repository
    python tools/master_repository_repair.py —check-only
    python tools/master_repository_repair.py —dry-run
“””

from __future__ import annotations

import argparse
import ast
import csv
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

VERSION = “1.0.0”

SKIP_DIRS = {
    “.git”, “.venv”, “venv”, “node_modules”, “__pycache__”,
    “.pytest_cache”, “.mypy_cache”, “.ruff_cache”, “.next”,
    “dist”, “build”, “coverage”, “.idea”, “.vscode”,
}

SENSITIVE_NAMES = {
    “.env”, “.env.local”, “.env.production”, “id_rsa”,
    “id_ed25519”, “credentials.json”, “service-account.json”,
}

SOURCE_EXTENSIONS = {
    “.py”, “.sh”, “.bash”, “.js”, “.mjs”, “.cjs”,
    “.json”, “.yaml”, “.yml”, “.toml”, “.xml”,
    “.html”, “.htm”, “.css”, “.sql”, “.md”,
}

def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()

def run(command: list[str], cwd: Path, timeout: int = 120) -> dict[str, Any]:
    “””Run a check without hiding its exit status.”””
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
        return {
            “command”: command,
            “status”: “PASS” if result.returncode == 0 else “FAIL”,
            “exit_code”: result.returncode,
            “output”: result.stdout[-12000:],
        }
    except FileNotFoundError:
        return {
            “command”: command,
            “status”: “SKIP”,
            “exit_code”: None,
            “output”: “Executable is unavailable.”,
        }
    except subprocess.TimeoutExpired as exc:
        return {
            “command”: command,
            “status”: “FAIL”,
            “exit_code”: 124,
            “output”: str(exc),
        }

def find_root(start: Path) -> Path:
    “””Prefer Git’s actual root; otherwise use the script’s project parent.”””
    result = run([“git”, “rev-parse”, “—show-toplevel”], start)
    if result[“status”] == “PASS”:
        return Path(result[“output”].strip()).resolve()
    return start.resolve()

def safe_relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.name

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open(“rb”) as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b””):
            digest.update(chunk)
    return digest.hexdigest()

def inventory(root: Path) -> tuple[list[dict], list[Path]]:
    records: list[dict] = []
    files: list[Path] = []

    for current, dirs, names in os.walk(root, followlinks=False):
        base = Path(current)
        dirs[:] = sorted(
            d for d in dirs
            if d not in SKIP_DIRS and not (base / d).is_symlink()
        )

        for name in sorted(names):
            path = base / name
            try:
                stat = path.lstat()
                rel = safe_relative(path, root)
                record = {
                    “path”: rel,
                    “type”: “symlink” if path.is_symlink() else “file”,
                    “size_bytes”: stat.st_size,
                    “extension”: path.suffix.lower(),
                    “hidden”: any(part.startswith(“.”) for part in path.parts),
                    “sensitive_name”: name.lower() in SENSITIVE_NAMES,
                }
                if path.is_file() and not path.is_symlink():
                    record[“sha256”] = sha256_file(path)
                    files.append(path)
                records.append(record)
            except OSError as exc:
                records.append({
                    “path”: safe_relative(path, root),
                    “type”: “unknown”,
                    “status”: “WARN”,
                    “error”: str(exc),
                })

    return records, files

def write_json(path: Path, data: Any) -> None:
    “””Atomically replace only the named report, never a source file.”””
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=f”.{path.name}.”,
        suffix=“.tmp”,
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, “w”, encoding=“utf-8”) as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.write(“\n”)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = sorted({key for row in rows for key in row})
    with path.open(“w”, newline=“”, encoding=“utf-8”) as stream:
        writer = csv.DictWriter(stream, fieldnames=columns or [“status”])
        writer.writeheader()
        for row in rows:
            writer.writerow({
                key: json.dumps(value, ensure_ascii=False)
                if isinstance(value, (dict, list)) else value
                for key, value in row.items()
            })

def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding=“utf-8”)
    except (OSError, UnicodeDecodeError):
        return None

def check_json(path: Path) -> dict | None:
    content = read_text(path)
    if content is None:
        return None
    try:
        json.loads(content)
        return None
    except json.JSONDecodeError as exc:
        return {
            “path”: path.as_posix(),
            “status”: “FAIL”,
            “line”: exc.lineno,
            “column”: exc.colno,
            “message”: exc.msg,
        }

def classify_text_files(root: Path, files: list[Path]) -> dict[str, list[dict]]:
    parse_errors: list[dict] = []
    conflicts: list[dict] = []
    warnings: list[dict] = []
    broken_refs: list[dict] = []
    routes: list[dict] = []
    page_map: list[dict] = []
    duplicates: list[dict] = []

    content_cache: dict[Path, str] = {}

    for path in files:
        rel = safe_relative(path, root)
        ext = path.suffix.lower()

        if ext not in SOURCE_EXTENSIONS:
            continue

        text = read_text(path)
        if text is None:
            warnings.append({
                “path”: rel,
                “status”: “WARN”,
                “message”: “Unreadable or non-UTF-8 text file; not parsed.”,
            })
            continue

        content_cache[path] = text

        if ext == “.json”:
            finding = check_json(path)
            if finding:
                finding[“path”] = rel
                parse_errors.append(finding)

        elif ext == “.toml”:
            try:
                import tomllib
                tomllib.loads(text)
            except ImportError:
                warnings.append({
                    “path”: rel,
                    “status”: “SKIP”,
                    “message”: “tomllib unavailable; requires Python 3.11+.”,
                })
            except Exception as exc:
                parse_errors.append({
                    “path”: rel, “status”: “FAIL”, “message”: str(exc),
                })

        elif ext == “.xml”:
            try:
                ET.fromstring(text)
            except ET.ParseError as exc:
                parse_errors.append({
                    “path”: rel, “status”: “FAIL”, “message”: str(exc),
                })

        elif ext in {“.py”}:
            try:
                ast.parse(text, filename=rel)
            except SyntaxError as exc:
                parse_errors.append({
                    “path”: rel, “status”: “FAIL”,
                    “line”: exc.lineno, “message”: exc.msg,
                })

        for match in re.finditer(
            r”^(?:<<<<<<< .+|=======|>>>>>>> .+)$”,
            text,
            re.MULTILINE,
        ):
            conflicts.append({
                “path”: rel,
                “line”: text.count(“\n”, 0, match.start()) + 1,
                “marker”: match.group(0),
                “status”: “FAIL”,
            })

        if path.name.lower() == “index.html”:
            page_map.append({
                “directory”: safe_relative(path.parent, root) or “.”,
                “index”: rel,
                “status”: “FOUND”,
            })

        if ext in {“.html”, “.htm”}:
            for match in re.finditer(
                r”””(?:href|src|poster)\s*=\s*[“’]([^”’#]+)[“’]”””,
                text,
                re.IGNORECASE,
            ):
                target = match.group(1).strip()
                if (
                    not target
                    or target.startswith((“http://“, “https://“, “mailto:”,
                                          “tel:”, “data:”, “javascript:”))
                    or target.startswith(“//“)
                ):
                    continue

                # Ignore query strings, preserve URL path semantics.
                target_path = target.split(“?”, 1)[0]
                if not target_path:
                    continue

                # Root-relative web URLs are resolved from repository root
                # as a useful static approximation; deployment routing can
                # differ and must be reviewed separately.
                if target_path.startswith(“/“):
                    candidate = root / target_path.lstrip(“/“)
                else:
                    candidate = path.parent / target_path

                candidate = Path(os.path.normpath(str(candidate)))
                if not candidate.exists():
                    broken_refs.append({
                        “source”: rel,
                        “target”: target,
                        “status”: “WARN”,
                        “message”: “Local reference not found; runtime routing may differ.”,
                    })

        if ext in {“.js”, “.mjs”, “.cjs”}:
            for match in re.finditer(
                r”””(?:from\s*|import\s*\(|require\s*\()\s*[“’]([^”’]+)[“’]”””,
                text,
            ):
                target = match.group(1)
                if not target.startswith(“.”):
                    continue
                candidate = path.parent / target
                possibilities = [
                    candidate,
                    candidate.with_suffix(“.js”),
                    candidate.with_suffix(“.mjs”),
                    candidate.with_suffix(“.cjs”),
                    candidate / “index.js”,
                    candidate / “index.mjs”,
                ]
                if not any(item.exists() for item in possibilities):
                    broken_refs.append({
                        “source”: rel,
                        “target”: target,
                        “status”: “WARN”,
                        “message”: “Relative JavaScript import not found.”,
                    })

        if path.name in {“server.js”, “app.js”}:
            for match in re.finditer(
                r”””(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(\s*[“’`]([^”’`]+)”””,
                text,
            ):
                routes.append({
                    “source”: rel,
                    “route”: match.group(1),
                    “status”: “FOUND”,
                })

    # Detect byte-identical source files without deleting or merging them.
    digest_map: dict[str, list[str]] = {}
    for path in files:
        if path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        try:
            digest_map.setdefault(sha256_file(path), []).append(
                safe_relative(path, root)
            )
        except OSError:
            continue

    for digest, paths in digest_map.items():
        if len(paths) > 1:
            duplicates.append({
                “sha256”: digest,
                “paths”: paths,
                “status”: “REVIEW”,
                “message”: “Identical file contents; determine whether duplication is intentional.”,
            })

    return {
        “parse_warnings”: parse_errors + warnings,
        “conflict_markers”: conflicts,
        “broken_references”: broken_refs,
        “api_routes”: routes,
        “folder_index_map”: page_map,
        “duplicate_findings”: duplicates,
    }

def check_commands(root: Path, files: list[Path]) -> list[dict]:
    results: list[dict] = []
    python_files = [p for p in files if p.suffix.lower() == “.py”]
    shell_files = [
        p for p in files if p.suffix.lower() in {“.sh”, “.bash”}
    ]
    js_files = [
        p for p in files
        if p.suffix.lower() in {“.js”, “.mjs”, “.cjs”}
    ]

    # compile() checks Python syntax without generating __pycache__.
    for path in python_files:
        try:
            source = path.read_bytes()
            compile(source, str(path), “exec”)
            results.append({
                “path”: safe_relative(path, root),
                “check”: “python-syntax”,
                “status”: “PASS”,
                “exit_code”: 0,
            })
        except (SyntaxError, UnicodeDecodeError, OSError, ValueError) as exc:
            results.append({
                “path”: safe_relative(path, root),
                “check”: “python-syntax”,
                “status”: “FAIL”,
                “exit_code”: 1,
                “message”: str(exc),
            })

    for path in shell_files:
        result = run([“bash”, “-n”, str(path)], root)
        result[“path”] = safe_relative(path, root)
        result[“check”] = “bash-syntax”
        results.append(result)

    for path in js_files:
        if shutil.which(“node”) is None:
            results.append({
                “path”: safe_relative(path, root),
                “check”: “javascript-syntax”,
                “status”: “SKIP”,
                “exit_code”: None,
                “message”: “Node.js is unavailable.”,
            })
            continue

        result = run([“node”, “—check”, str(path)], root)
        result[“path”] = safe_relative(path, root)
        result[“check”] = “javascript-syntax”
        results.append(result)

    return results

def git_status(root: Path) -> dict:
    if not shutil.which(“git”):
        return {“status”: “SKIP”, “message”: “Git unavailable.”}

    result = run([“git”, “status”, “—short”, “—branch”], root)
    return {
        “status”: result[“status”],
        “exit_code”: result[“exit_code”],
        “output”: result[“output”],
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(“—root”, type=Path, help=“Repository root.”)
    parser.add_argument(“—check-only”, action=“store_true”,
                        help=“Alias for a read-only audit.”)
    parser.add_argument(“—dry-run”, action=“store_true”,
                        help=“Audit only; never repair source files.”)
    args = parser.parse_args()

    script_root = Path(__file__).resolve().parent.parent
    root = find_root(args.root.resolve() if args.root else script_root)

    if not root.is_dir():
        print(f”ERROR: Repository root does not exist: {root}”, file=sys.stderr)
        return 2

    # Exclude reports from the scan only if they are generated artifacts;
    # they remain on disk and are not deleted.
    report_dir = root / “repository-reports”
    report_dir.mkdir(parents=True, exist_ok=True)

    stamp = now()
    print(f”MedOrbits audit {VERSION}”)
    print(f”Repository: {root}”)
    print(f”Started: {stamp}”)
    print(“Mode: read-only source audit; source files will not be rewritten.”)

    git = git_status(root)
    records, files = inventory(root)
    findings = classify_text_files(root, files)
    commands = check_commands(root, files)

    # Never include file contents or secret values in reports.
    sensitive = [
        {
            “path”: row[“path”],
            “status”: “REVIEW”,
            “message”: “Sensitive-looking filename; contents were not recorded.”,
        }
        for row in records if row.get(“sensitive_name”)
    ]

    edges: list[dict] = []
    for item in findings[“broken_references”]:
        edges.append({
            “source”: item.get(“source”),
            “target”: item.get(“target”),
            “edge_type”: “unresolved-local-reference”,
            “status”: item.get(“status”, “WARN”),
        })

    suggestions: list[dict] = []
    for item in findings[“broken_references”]:
        suggestions.append({
            “source”: item.get(“source”),
            “target”: item.get(“target”),
            “suggestion”: “Verify deployment base path, case, and target existence before changing.”,
            “status”: “REVIEW”,
        })

    # Repair manifest records what this auditor did and did not change.
    manifest = {
        “version”: VERSION,
        “generated_at”: now(),
        “repository_root”: str(root),
        “mode”: “read-only-audit”,
        “source_files_modified”: [],
        “files_created”: [],
        “reports_written”: [],
        “repairs_applied”: [],
        “limitations”: [
            “This script does not automatically repair source files.”,
            “Static HTML reference checks may flag server-side routes or deployment base paths.”,
            “JavaScript route/controller relationships require framework-aware validation.”,
            “Ignored files are inventoried if present, except excluded generated directories.”,
            “Ignored files not present in the working tree cannot be inspected.”,
            “Git tracked-file status is reported separately from filesystem inventory.”,
        ],
    }

    reports = {
        “file-inventory.json”: {
            “generated_at”: stamp, “status”: “PASS”, “files”: records,
        },
        “broken-references.json”: {
            “generated_at”: stamp,
            “status”: “WARN” if findings[“broken_references”] else “PASS”,
            “findings”: findings[“broken_references”],
        },
        “unresolved-references.json”: {
            “generated_at”: stamp,
            “status”: “PENDING_REVIEW” if findings[“broken_references”] else “PASS”,
            “is_template”: False,
            “findings”: findings[“broken_references”],
            “note”: “Generated from this scan; inspect warnings for runtime routing false positives.”,
        },
        “dependency-edges.json”: {
            “generated_at”: stamp, “status”: “PASS”, “edges”: edges,
        },
        “api-routes.json”: {
            “generated_at”: stamp, “status”: “PARTIAL”,
            “routes”: findings[“api_routes”],
            “note”: “Static extraction only; not a complete router/controller consistency proof.”,
        },
        “conflict-markers.json”: {
            “generated_at”: stamp,
            “status”: “FAIL” if findings[“conflict_markers”] else “PASS”,
            “findings”: findings[“conflict_markers”],
        },
        “parse-warnings.json”: {
            “generated_at”: stamp,
            “status”: “FAIL” if any(
                x.get(“status”) == “FAIL”
                for x in findings[“parse_warnings”]
            ) else “PASS”,
            “findings”: findings[“parse_warnings”],
        },
        “page-connection-suggestions.json”: {
            “generated_at”: stamp, “status”: “REVIEW_REQUIRED”,
            “suggestions”: suggestions,
        },
        “duplicate-findings.json”: {
            “generated_at”: stamp,
            “status”: “REVIEW_REQUIRED” if findings[“duplicate_findings”] else “PASS”,
            “findings”: findings[“duplicate_findings”],
        },
        “folder-index-map.json”: {
            “generated_at”: stamp, “status”: “PARTIAL”,
            “indexes”: findings[“folder_index_map”],
            “note”: “Only existing index.html files are mapped; public/private folder classification requires review.”,
        },
        “repair-manifest.json”: manifest,
    }

    inventory_csv = [
        {k: v for k, v in item.items() if not isinstance(v, (list, dict))}
        for item in records
    ]
    reference_csv = findings[“broken_references”]
    edges_csv = edges

    for name, data in reports.items():
        target = report_dir / name
        write_json(target, data)
        manifest[“reports_written”].append(target.relative_to(root).as_posix())

    write_csv(report_dir / “file-inventory.csv”, inventory_csv)
    write_csv(report_dir / “broken-references.csv”, reference_csv)
    write_csv(report_dir / “dependency-edges.csv”, edges_csv)

    # Include report files in the manifest after creation, then rewrite it.
    manifest[“reports_written”].extend([
        “repository-reports/file-inventory.csv”,
        “repository-reports/broken-references.csv”,
        “repository-reports/dependency-edges.csv”,
    ])
    write_json(report_dir / “repair-manifest.json”, manifest)

    failures = sum(1 for x in commands if x.get(“status”) == “FAIL”)
    failures += len(findings[“parse_warnings”]) - sum(
        1 for x in findings[“parse_warnings”] if x.get(“status”) != “FAIL”
    )
    failures += len(findings[“conflict_markers”])

    summary = {
        “version”: VERSION,
        “generated_at”: now(),
        “repository_root”: str(root),
        “git_status”: git,
        “files_inventoried”: len(records),
        “python_shell_javascript_checks”: {
            “total”: len(commands),
            “pass”: sum(1 for x in commands if x.get(“status”) == “PASS”),
            “fail”: sum(1 for x in commands if x.get(“status”) == “FAIL”),
            “skip”: sum(1 for x in commands if x.get(“status”) == “SKIP”),
        },
        “parse_findings”: len(findings[“parse_warnings”]),
        “conflict_markers”: len(findings[“conflict_markers”]),
        “broken_reference_candidates”: len(findings[“broken_references”]),
        “duplicate_file_groups”: len(findings[“duplicate_findings”]),
        “sensitive_filename_reviews”: len(sensitive),
        “status”: “FAIL” if failures else “REVIEW_REQUIRED”,
        “limitations”: [
            “No source repairs were applied.”,
            “No tests, builds, database migrations, or deployments were executed.”,
            “A static scan is not proof of runtime correctness.”,
        ],
    }

    write_json(report_dir / “summary.json”, summary)
    write_json(report_dir / “sensitive-file-review.json”, {
        “generated_at”: now(),
        “status”: “REVIEW_REQUIRED” if sensitive else “PASS”,
        “findings”: sensitive,
        “note”: “Only names and paths are included; file contents are never copied.”,
    })

    print(f”Inventory: {len(records)} files”)
    print(f”Syntax checks: {summary[‘python_shell_javascript_checks’]}”)
    print(f”Broken-reference candidates: {len(findings[‘broken_references’])}”)
    print(f”Conflict markers: {len(findings[‘conflict_markers’])}”)
    print(f”Reports: {report_dir}”)
    print(f”Summary status: {summary[‘status’]}”)
    print(“Source repairs: none; review findings before applying modifications.”)

    return 1 if failures else 0

if __name__ == “__main__”:
    raise SystemExit(main())
