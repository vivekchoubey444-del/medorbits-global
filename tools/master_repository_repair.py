
#!/usr/bin/env python3
“””
MEDORBITS - MASTER REPOSITORY AUDITOR
File: tools/master_repository_repair.py
Version: 1.1.0

Purpose:
    Comprehensive read-only repository audit and reporting.

Checks:
    - Recursive file inventory and SHA-256 hashes.
    - Python, JavaScript and shell syntax.
    - JSON and JSONC syntax.
    - YAML, TOML and XML parsing.
    - HTML structure and duplicate IDs.
    - CSS delimiter consistency.
    - Local HTML, CSS and JavaScript references.
    - Git conflict markers.
    - Duplicate file content.
    - package.json structure.
    - Sensitive-looking filenames.
    - API route discovery.
    - Folder index mapping.
    - Optional npm dependency inspection.

Reports:
    repository-reports/

Safety:
    - Does not modify source files.
    - Does not delete files.
    - Does not install dependencies.
    - Does not execute application code.
    - Does not deploy or run migrations.
    - Replaces only its own named report files.
    - Does not include file contents or credentials in reports.

Requirements:
    Python >= 3.10
    Node.js optional
    Bash optional
    PyYAML optional
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
import tomllib
import xml.etree.ElementTree as ET

from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


VERSION = “1.1.0”

SKIP_DIRS = {
    “.git”, “.venv”, “venv”, “node_modules”,
    “__pycache__”, “.pytest_cache”, “.mypy_cache”,
    “.ruff_cache”, “.next”, “.nuxt”, “.cache”,
    “dist”, “build”, “coverage”, “.idea”, “.vscode”,
    “.repair-backups”, “.turbo”, “vendor”, “target”,
}

SENSITIVE_NAMES = {
    “.env”, “.env.local”, “.env.production”,
    “id_rsa”, “id_ed25519”,
    “credentials.json”, “service-account.json”,
}

SOURCE_EXTENSIONS = {
    “.py”, “.sh”, “.bash”, “.js”, “.mjs”, “.cjs”,
    “.jsx”, “.ts”, “.tsx”, “.json”, “.jsonc”,
    “.yaml”, “.yml”, “.toml”, “.xml”,
    “.html”, “.htm”, “.css”, “.scss”, “.sass”,
    “.sql”, “.md”, “.txt”, “.svg”, “.webmanifest”,
}

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_REPORT_SIZE = 50 * 1024 * 1024

REPORT_DIRECTORY = “repository-reports”


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def is_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def run_command(
    command: list[str],
    cwd: Path,
    timeout: int = 120,
) -> dict[str, Any]:
    “””Execute a validation command without a shell.”””
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

    except subprocess.TimeoutExpired:
        return {
            “command”: command,
            “status”: “FAIL”,
            “exit_code”: 124,
            “output”: f”Command exceeded {timeout} seconds.”,
        }


def find_root(start: Path) -> Path:
    “””Find Git root, falling back to the supplied directory.”””
    if not start.is_dir():
        raise ValueError(f”Repository directory does not exist: {start}”)

    if shutil.which(“git”):
        result = run_command(
            [“git”, “rev-parse”, “—show-toplevel”],
            start,
            timeout=10,
        )

        if result[“status”] == “PASS”:
            candidate = Path(result[“output”].strip()).resolve()

            if candidate.is_dir():
                return candidate

    return start.resolve()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open(“rb”) as stream:
        for chunk in iter(
            lambda: stream.read(1024 * 1024),
            b””,
        ):
            digest.update(chunk)

    return digest.hexdigest()


def inventory(
    root: Path,
) -> tuple[list[dict[str, Any]], list[Path]]:
    records: list[dict[str, Any]] = []
    files: list[Path] = []

    for current, dirs, names in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        base = Path(current)

        dirs[:] = sorted(
            name
            for name in dirs
            if name not in SKIP_DIRS
            and not (base / name).is_symlink()
        )

        for name in sorted(names):
            path = base / name

            try:
                info = path.lstat()
                rel = relative(path, root)
                is_link = path.is_symlink()

                record: dict[str, Any] = {
                    “path”: rel,
                    “type”: “symlink” if is_link else “file”,
                    “size_bytes”: info.st_size,
                    “extension”: path.suffix.lower(),
                    “hidden”: any(
                        part.startswith(“.”)
                        for part in Path(rel).parts
                    ),
                    “sensitive_name”: name.lower() in SENSITIVE_NAMES,
                }

                if is_link:
                    record[“status”] = “SKIPPED_SYMLINK”

                elif path.is_file():
                    if info.st_size <= MAX_FILE_SIZE:
                        record[“sha256”] = sha256_file(path)
                    else:
                        record[“status”] = “HASH_SKIPPED_SIZE_LIMIT”

                    files.append(path)

                records.append(record)

            except OSError as exc:
                records.append({
                    “path”: relative(path, root),
                    “type”: “unknown”,
                    “status”: “WARN”,
                    “error”: str(exc),
                })

    return records, files


def read_text(path: Path) -> str | None:
    try:
        if path.is_symlink() or path.stat().st_size > MAX_FILE_SIZE:
            return None

        return path.read_text(encoding=“utf-8-sig”)

    except (OSError, UnicodeError):
        return None


class HTMLInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.duplicates: set[str] = set()
        self.references: list[str] = []
        self.missing_alt = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        self.process(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list) -> None:
        self.process(tag, attrs)

    def process(self, tag: str, attrs: list) -> None:
        values = dict(attrs)

        identifier = values.get(“id”)

        if identifier:
            if identifier in self.ids:
                self.duplicates.add(identifier)
            self.ids.add(identifier)

        if tag.lower() == “img” and “alt” not in values:
            self.missing_alt += 1

        for attribute in (
            “href”, “src”, “poster”, “action”,
            “data-src”, “data-href”,
        ):
            value = values.get(attribute)

            if value:
                self.references.append(value)

        srcset = values.get(“srcset”, “”)

        for item in srcset.split(“,”):
            parts = item.strip().split()

            if parts:
                self.references.append(parts[0])


def validate_css(content: str) -> list[str]:
    errors: list[str] = []
    stack: list[tuple[str, int]] = []

    pairs = {
        “}”: “{“,
        “)”: “(“,
        “]”: “[“,
    }

    quote: str | None = None
    escaped = False
    comment = False
    index = 0

    while index < len(content):
        char = content[index]
        following = (
            content[index + 1]
            if index + 1 < len(content)
            else “”
        )

        if comment:
            if char == “*” and following == “/“:
                comment = False
                index += 2
                continue

            index += 1
            continue

        if quote:
            if escaped:
                escaped = False
            elif char == “\\”:
                escaped = True
            elif char == quote:
                quote = None

            index += 1
            continue

        if char == “/“ and following == “*”:
            comment = True
            index += 2
            continue

        if char in {“’”, ‘”’}:
            quote = char
            index += 1
            continue

        if char in “{([“:
            stack.append((char, index))

        elif char in “})]”:
            if not stack or stack[-1][0] != pairs[char]:
                errors.append(
                    f”Unexpected closing delimiter {char} at offset {index}.”
                )
                return errors

            stack.pop()

        index += 1

    if comment:
        errors.append(“Unterminated CSS comment.”)

    if quote:
        errors.append(“Unterminated CSS string.”)

    if stack:
        errors.append(
            f”Unclosed delimiter {stack[-1][0]} at offset {stack[-1][1]}.”
        )

    return errors


def resolve_reference(
    source: Path,
    reference: str,
    root: Path,
) -> Path | None:
    reference = reference.strip()

    if not reference or reference.startswith(“//“):
        return None

    parsed = urlsplit(reference)

    if parsed.scheme.lower() in {
        “http”, “https”, “mailto”, “tel”,
        “data”, “javascript”, “blob”, “ftp”,
    }:
        return None

    raw_path = unquote(parsed.path)

    if not raw_path:
        return source

    target = (
        root / raw_path.lstrip(“/“)
        if raw_path.startswith(“/“)
        else source.parent / raw_path
    )

    target = Path(os.path.abspath(target))

    if not is_inside(target, root):
        return None

    return target


def classify_files(
    root: Path,
    files: list[Path],
) -> dict[str, list[dict[str, Any]]]:
    findings: dict[str, list[dict[str, Any]]] = {
        “parse_errors”: [],
        “warnings”: [],
        “conflict_markers”: [],
        “broken_references”: [],
        “duplicate_ids”: [],
        “missing_alt”: [],
        “api_routes”: [],
        “folder_index_map”: [],
        “duplicate_files”: [],
    }

    digest_map: dict[str, list[str]] = {}

    for path in files:
        rel = relative(path, root)
        ext = path.suffix.lower()

        if ext not in SOURCE_EXTENSIONS:
            continue

        content = read_text(path)

        if content is None:
            findings[“warnings”].append({
                “path”: rel,
                “status”: “SKIP”,
                “message”: “Unreadable, binary, or oversized file.”,
            })
            continue

        # JSON and JSONC.
        if ext == “.json” or ext == “.webmanifest”:
            try:
                json.loads(content)
            except json.JSONDecodeError as exc:
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “line”: exc.lineno,
                    “column”: exc.colno,
                    “message”: exc.msg,
                })

        # JSONC is not strict JSON. Report it instead of silently treating it
        # as valid JSON.
        elif ext == “.jsonc”:
            findings[“warnings”].append({
                “path”: rel,
                “status”: “REVIEW”,
                “message”: “JSONC requires a JSONC-aware parser.”,
            })

        elif ext == “.py”:
            try:
                ast.parse(content, filename=rel)
            except SyntaxError as exc:
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “line”: exc.lineno,
                    “message”: exc.msg,
                })

        elif ext == “.toml”:
            try:
                tomllib.loads(content)
            except tomllib.TOMLDecodeError as exc:
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “message”: str(exc),
                })

        elif ext == “.xml”:
            try:
                ET.fromstring(content)
            except ET.ParseError as exc:
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “message”: str(exc),
                })

        elif ext in {“.css”, “.scss”, “.sass”}:
            for error in validate_css(content):
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “message”: error,
                })

        for match in re.finditer(
            r”^(?:<<<<<<< .+|=======|>>>>>>> .+)$”,
            content,
            re.MULTILINE,
        ):
            findings[“conflict_markers”].append({
                “path”: rel,
                “line”: content.count(“\n”, 0, match.start()) + 1,
                “marker”: match.group(0),
                “status”: “FAIL”,
            })

        if path.name.lower() == “index.html”:
            findings[“folder_index_map”].append({
                “directory”: relative(path.parent, root) or “.”,
                “index”: rel,
                “status”: “FOUND”,
            })

        if ext in {“.html”, “.htm”, “.svg”, “.xml”}:
            inspector = HTMLInspector()

            try:
                inspector.feed(content)
                inspector.close()

                for identifier in sorted(inspector.duplicates):
                    findings[“duplicate_ids”].append({
                        “path”: rel,
                        “id”: identifier,
                        “status”: “WARN”,
                    })

                if inspector.missing_alt:
                    findings[“missing_alt”].append({
                        “path”: rel,
                        “count”: inspector.missing_alt,
                        “status”: “WARN”,
                    })

                for reference in inspector.references:
                    target = resolve_reference(path, reference, root)

                    if target is None:
                        continue

                    parsed = urlsplit(reference)
                    if parsed.fragment and target == path:
                        if parsed.fragment not in inspector.ids:
                            findings[“broken_references”].append({
                                “source”: rel,
                                “target”: reference,
                                “status”: “WARN”,
                                “message”: “Missing same-page fragment.”,
                            })
                        continue

                    if not target.exists():
                        findings[“broken_references”].append({
                            “source”: rel,
                            “target”: reference,
                            “status”: “WARN”,
                            “message”: “Local reference not found.”,
                        })

            except Exception as exc:
                findings[“parse_errors”].append({
                    “path”: rel,
                    “status”: “FAIL”,
                    “message”: f”HTML parsing error: {exc}”,
                })

        if ext in {“.css”, “.scss”, “.sass”}:
            pattern = re.compile(
                r”””url\(\s*([‘”]?)(.*?)\1\s*\)”””,
                re.IGNORECASE | re.DOTALL,
            )

            for match in pattern.finditer(content):
                reference = match.group(2).strip()

                if not reference:
                    continue

                target = resolve_reference(path, reference, root)

                if target is not None and not target.exists():
                    findings[“broken_references”].append({
                        “source”: rel,
                        “target”: reference,
                        “status”: “WARN”,
                        “message”: “CSS local asset not found.”,
                    })

        if ext in {“.js”, “.mjs”, “.cjs”}:
            pattern = re.compile(
                r”””(?:from\s*|import\s*\(|require\s*\()\s*[“’]([^”’]+)[“’]”””
            )

            for match in pattern.finditer(content):
                target_name = match.group(1)

                if not target_name.startswith(“.”):
                    continue

                candidate = path.parent / target_name

                possibilities = [
                    candidate,
                    candidate.with_suffix(“.js”),
                    candidate.with_suffix(“.mjs”),
                    candidate.with_suffix(“.cjs”),
                    candidate / “index.js”,
                    candidate / “index.mjs”,
                ]

                if not any(item.exists() for item in possibilities):
                    findings[“broken_references”].append({
                        “source”: rel,
                        “target”: target_name,
                        “status”: “WARN”,
                        “message”: “Relative JavaScript import not found.”,
                    })

        if path.name in {“server.js”, “app.js”}:
            route_pattern = re.compile(
                r”””(?:app|router)\.(?:get|post|put|patch|delete|use)\s*\(\s*[“’`]([^”’`]+)”””
            )

            for match in route_pattern.finditer(content):
                findings[“api_routes”].append({
                    “source”: rel,
                    “route”: match.group(1),
                    “status”: “FOUND”,
                })

        # Duplicate content detection. Only hashes and paths are reported.
        try:
            digest = sha256_file(path)
            digest_map.setdefault(digest, []).append(rel)
        except OSError:
            pass

    for digest, paths in digest_map.items():
        if len(paths) > 1:
            findings[“duplicate_files”].append({
                “sha256”: digest,
                “paths”: paths,
                “status”: “REVIEW”,
            })

    return findings


def check_commands(root: Path, files: list[Path]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for path in files:
        ext = path.suffix.lower()
        rel = relative(path, root)

        if ext == “.py”:
            try:
                compile(path.read_bytes(), str(path), “exec”)
                results.append({
                    “path”: rel,
                    “check”: “python-syntax”,
                    “status”: “PASS”,
                    “exit_code”: 0,
                })
            except (SyntaxError, UnicodeError, OSError, ValueError) as exc:
                results.append({
                    “path”: rel,
                    “check”: “python-syntax”,
                    “status”: “FAIL”,
                    “exit_code”: 1,
                    “message”: str(exc),
                })

        elif ext in {“.sh”, “.bash”}:
            result = run_command([“bash”, “-n”, str(path)], root)
            result[“path”] = rel
            result[“check”] = “bash-syntax”
            results.append(result)

        elif ext in {“.js”, “.mjs”, “.cjs”}:
            if not shutil.which(“node”):
                results.append({
                    “path”: rel,
                    “check”: “javascript-syntax”,
                    “status”: “SKIP”,
                    “exit_code”: None,
                })
            else:
                result = run_command([“node”, “—check”, str(path)], root)
                result[“path”] = rel
                result[“check”] = “javascript-syntax”
                results.append(result)

    return results


def check_package(root: Path) -> list[dict[str, Any]]:
    path = root / “package.json”

    if not path.is_file():
        return []

    try:
        data = json.loads(path.read_text(encoding=“utf-8-sig”))

        if not isinstance(data, dict):
            raise ValueError(“package.json root must be an object.”)

        for key in (“scripts”, “dependencies”, “devDependencies”, “engines”):
            if key in data and not isinstance(data[key], dict):
                raise ValueError(f”package.json {key} must be an object.”)

        return [{
            “path”: “package.json”,
            “check”: “package-json”,
            “status”: “PASS”,
        }]

    except (OSError, UnicodeError, ValueError) as exc:
        return [{
            “path”: “package.json”,
            “check”: “package-json”,
            “status”: “FAIL”,
            “message”: str(exc),
        }]


def check_yaml(root: Path, files: list[Path]) -> list[dict[str, Any]]:
    yaml_files = [
        path for path in files
        if path.suffix.lower() in {“.yaml”, “.yml”}
    ]

    if not yaml_files:
        return []

    try:
        import yaml
    except ImportError:
        return [{
            “check”: “yaml”,
            “status”: “SKIP”,
            “message”: “PyYAML is not installed.”,
        }]

    class UniqueKeyLoader(yaml.SafeLoader):
        pass

    def construct_mapping(loader, node, deep=False):
        loader.flatten_mapping(node)
        mapping = {}

        for key_node, value_node in node.value:
            key = loader.construct_object(key_node, deep=deep)

            try:
                duplicate = key in mapping
            except TypeError as exc:
                raise yaml.YAMLError(“Unhashable YAML mapping key.”) from exc

            if duplicate:
                raise yaml.YAMLError(f”Duplicate YAML key: {key!r}”)

            mapping[key] = loader.construct_object(value_node, deep=deep)

        return mapping

    UniqueKeyLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
        construct_mapping,
    )

    results = []

    for path in yaml_files:
        try:
            content = path.read_text(encoding=“utf-8-sig”)
            list(yaml.load_all(content, Loader=UniqueKeyLoader))

            results.append({
                “path”: relative(path, root),
                “check”: “yaml”,
                “status”: “PASS”,
            })

        except (OSError, UnicodeError, yaml.YAMLError, ValueError) as exc:
            results.append({
                “path”: relative(path, root),
                “check”: “yaml”,
                “status”: “FAIL”,
                “message”: str(exc),
            })

    return results


def git_status(root: Path) -> dict[str, Any]:
    if not shutil.which(“git”):
        return {“status”: “SKIP”, “message”: “Git unavailable.”}

    result = run_command(
        [“git”, “status”, “—short”, “—branch”],
        root,
        timeout=15,
    )

    return {
        “status”: result[“status”],
        “exit_code”: result[“exit_code”],
        “output”: result[“output”],
    }


def safe_report_directory(root: Path) -> Path:
    report_dir = root / REPORT_DIRECTORY

    if report_dir.is_symlink():
        raise RuntimeError(“Report directory must not be a symlink.”)

    report_dir.mkdir(exist_ok=True)

    if not report_dir.is_dir() or report_dir.is_symlink():
        raise RuntimeError(“Unsafe report directory.”)

    return report_dir.resolve(strict=True)


def atomic_write(path: Path, content: str) -> None:
    “””Atomically replace one generated report.”””
    if path.is_symlink():
        raise RuntimeError(f”Refusing report symlink: {path}”)

    data = content.encode(“utf-8”)

    if len(data) > MAX_REPORT_SIZE:
        raise RuntimeError(f”Report exceeds size limit: {path.name}”)

    fd, temporary_name = tempfile.mkstemp(
        prefix=f”.{path.name}.”,
        suffix=“.tmp”,
        dir=path.parent,
    )

    temporary = Path(temporary_name)

    try:
        with os.fdopen(fd, “wb”) as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())

        if path.is_symlink():
            raise RuntimeError(f”Report became a symlink: {path}”)

        os.replace(temporary, path)

    finally:
        temporary.unlink(missing_ok=True)


def write_json(path: Path, data: Any) -> None:
    atomic_write(
        path,
        json.dumps(data, indent=2, ensure_ascii=False) + “\n”,
    )


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    columns = sorted({
        key
        for row in rows
        for key in row
    })

    from io import StringIO

    buffer = StringIO(newline=“”)
    writer = csv.DictWriter(
        buffer,
        fieldnames=columns or [“status”],
        extrasaction=“ignore”,
    )

    writer.writeheader()

    for row in rows:
        writer.writerow({
            key: json.dumps(value, ensure_ascii=False)
            if isinstance(value, (dict, list))
            else value
            for key, value in row.items()
        })

    atomic_write(path, buffer.getvalue())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        “—root”,
        type=Path,
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—check-only”,
        action=“store_true”,
        help=“Perform an audit without writing reports.”,
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Alias for —check-only.”,
    )

    parser.add_argument(
        “—dependencies”,
        action=“store_true”,
        help=“Inspect installed npm dependencies.”,
    )

    args = parser.parse_args()

    try:
        start = (
            args.root.expanduser().resolve()
            if args.root
            else Path(__file__).resolve().parent.parent
        )

        root = find_root(start)

        print(“=“ * 58)
        print(“ MEDORBITS MASTER REPOSITORY AUDITOR”)
        print(“=“ * 58)
        print(f”Version: {VERSION}”)
        print(f”Repository: {root}”)
        print(f”Started: {now()}”)

        records, files = inventory(root)

        findings = classify_files(root, files)
        commands = check_commands(root, files)
        commands.extend(check_package(root))
        commands.extend(check_yaml(root, files))

        if args.dependencies:
            if shutil.which(“npm”):
                commands.append(
                    run_command([“npm”, “ls”, “—depth=0”], root)
                )
            else:
                commands.append({
                    “check”: “npm-dependencies”,
                    “status”: “SKIP”,
                    “message”: “npm unavailable.”,
                })

        sensitive = [
            {
                “path”: item[“path”],
                “status”: “REVIEW”,
                “message”: “Sensitive-looking filename; contents were not recorded.”,
            }
            for item in records
            if item.get(“sensitive_name”)
        ]

        failures = (
            sum(1 for item in commands if item.get(“status”) == “FAIL”)
            + len(findings[“parse_errors”])
            + len(findings[“conflict_markers”])
        )

        warnings = (
            len(findings[“warnings”])
            + len(findings[“broken_references”])
            + len(findings[“duplicate_ids”])
            + len(findings[“missing_alt”])
            + len(findings[“duplicate_files”])
            + len(sensitive)
        )

        summary = {
            “version”: VERSION,
            “generated_at”: now(),
            “repository_root”: str(root),
            “git_status”: git_status(root),
            “files_inventoried”: len(records),
            “validation”: {
                “total”: len(commands),
                “passed”: sum(
                    1 for item in commands
                    if item.get(“status”) == “PASS”
                ),
                “failed”: sum(
                    1 for item in commands
                    if item.get(“status”) == “FAIL”
                ),
                “skipped”: sum(
                    1 for item in commands
                    if item.get(“status”) == “SKIP”
                ),
            },
            “parse_errors”: len(findings[“parse_errors”]),
            “conflict_markers”: len(findings[“conflict_markers”]),
            “broken_reference_candidates”: len(findings[“broken_references”]),
            “warnings”: warnings,
            “failures”: failures,
            “status”: “FAIL” if failures else (
                “PASS_WITH_WARNINGS” if warnings else “PASS”
            ),
            “source_files_modified”: False,
            “deployment_performed”: False,
            “database_migrations_performed”: False,
        }

        print(f”\nFiles inventoried: {len(records)}”)
        print(f”Validation checks: {summary[‘validation’]}”)
        print(f”Parse errors: {len(findings[‘parse_errors’])}”)
        print(f”Conflict markers: {len(findings[‘conflict_markers’])}”)
        print(f”Broken references: {len(findings[‘broken_references’])}”)
        print(f”Warnings: {warnings}”)
        print(f”Failures: {failures}”)

        if args.check_only or args.dry_run:
            print(“\nCHECK-ONLY: No reports or source files were written.”)
        else:
            report_dir = safe_report_directory(root)

            reports = {
                “summary.json”: summary,
                “file-inventory.json”: {
                    “generated_at”: now(),
                    “files”: records,
                },
                “validation-results.json”: {
                    “generated_at”: now(),
                    “checks”: commands,
                },
                “parse-errors.json”: findings[“parse_errors”],
                “broken-references.json”: findings[“broken_references”],
                “conflict-markers.json”: findings[“conflict_markers”],
                “duplicate-ids.json”: findings[“duplicate_ids”],
                “missing-alt.json”: findings[“missing_alt”],
                “duplicate-files.json”: findings[“duplicate_files”],
                “api-routes.json”: findings[“api_routes”],
                “folder-index-map.json”: findings[“folder_index_map”],
                “sensitive-file-review.json”: {
                    “note”: “Names and paths only; file contents are not included.”,
                    “findings”: sensitive,
                },
            }

            for name, data in reports.items():
                write_json(report_dir / name, data)

            write_csv(
                report_dir / “file-inventory.csv”,
                records,
            )

            write_csv(
                report_dir / “broken-references.csv”,
                findings[“broken_references”],
            )

            print(f”\nReports written to: {report_dir}”)

        print(f”\nAUDIT STATUS: {summary[‘status’]}”)
        print(“Source files modified: NO”)
        print(“Deployment: NO”)
        print(“Database migrations: NO”)

        return 1 if failures else 0

    except (OSError, RuntimeError, ValueError) as exc:
        print(f”ERROR: {exc}”, file=sys.stderr)
        return 2


if __name__ == “__main__”:
    raise SystemExit(main())
