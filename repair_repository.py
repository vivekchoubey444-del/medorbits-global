#!/usr/bin/env python3
"""MedOrbits root repository audit and conservative repair tool.

Usage:
  python repair_repository.py --dry-run
  python repair_repository.py
  python repair_repository.py --root /path/to/repository
  python repair_repository.py --strict

Audits HTML, CSS, JavaScript, Python, JSON and project configuration.
Only performs low-risk whitespace cleanup by default. It does not install
packages, delete files, rewrite whole pages, or execute deployment scripts.
Backups and a JSON report are created before/after repairs.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "coverage",
    ".next", ".nuxt", ".cache", "__pycache__", ".venv", "venv",
    ".pytest_cache", ".mypy_cache", ".tox", "bower_components",
    ".repository-repair", ".repository-repair-backups",
}
SKIP_FILES = {
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock",
    "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock",
}
TEXT_EXTS = {
    ".html", ".htm", ".css", ".scss", ".less", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".py", ".json", ".yaml", ".yml", ".toml",
    ".xml", ".svg", ".md", ".txt", ".sh", ".sql",
}
REPORT_DIR = ".repository-repair"
BACKUP_DIR = ".repository-repair-backups"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root))


def skipped(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True
    if any(part in SKIP_DIRS for part in parts) or path.name in SKIP_FILES:
        return True
    if path.name.startswith(".env") and path.name != ".env.example":
        return True
    return False


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def backup(path: Path, root: Path) -> Path:
    dest = root / BACKUP_DIR / path.relative_to(root)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    return dest


def write_change(path: Path, new: str, root: Path, dry_run: bool,
                 changes: list, reason: str) -> None:
    old = read(path)
    if old == new:
        return
    entry = {
        "file": rel(path, root), "reason": reason,
        "before_sha256": digest(old), "after_sha256": digest(new),
        "status": "would_change" if dry_run else "changed",
    }
    if not dry_run:
        backup(path, root)
        path.write_text(new, encoding="utf-8", newline="")
    changes.append(entry)


class HTMLAudit(HTMLParser):
    VOID = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.ids = {}
        self.img_alt_missing = []
        self.anchor_href_missing = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs = dict(attrs)
        line = self.getpos()[0]
        if tag not in self.VOID:
            self.stack.append((tag, line))
        if tag == "img" and "alt" not in attrs:
            self.img_alt_missing.append(line)
        if tag == "a" and not attrs.get("href"):
            self.anchor_href_missing.append(line)
        if attrs.get("id"):
            self.ids[attrs["id"]] = self.ids.get(attrs["id"], 0) + 1

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in self.VOID:
            return
        names = [x[0] for x in self.stack]
        if tag not in names:
            self.errors.append(
                f"Unmatched closing tag </{tag}> at line {self.getpos()[0]}"
            )
            return
        while self.stack:
            name, _ = self.stack.pop()
            if name == tag:
                break


def findings_for(path: Path, source: str) -> list[dict]:
    ext = path.suffix.lower()
    out = []

    def add(level, message):
        out.append({"severity": level, "message": message})

    if ext == ".json":
        try:
            json.loads(source)
        except json.JSONDecodeError as exc:
            add("error", f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")

    elif ext == ".py":
        try:
            ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            add("error", f"Python syntax error at line {exc.lineno}: {exc.msg}")

    elif ext in {".html", ".htm"}:
        parser = HTMLAudit()
        try:
            parser.feed(source)
            parser.close()
        except Exception as exc:
            add("error", f"HTML parser error: {exc}")
        for error in parser.errors:
            add("warning", error)
        for ident, count in parser.ids.items():
            if count > 1:
                add("warning", f"Duplicate id={ident!r} appears {count} times")
        for line in parser.img_alt_missing:
            add("warning", f"Image has no alt attribute at line {line}")
        for line in parser.anchor_href_missing:
            add("warning", f"Anchor has no href at line {line}")
        low = source.lower()
        if "<!doctype html" not in low:
            add("warning", "Missing HTML5 doctype")
        if not re.search(r"<title\b[^>]*>.*?</title>", source, re.I | re.S):
            add("warning", "Missing or empty title element")
        if not re.search(r'<meta\b[^>]*name=["\\\']viewport["\\\']', source, re.I):
            add("warning", "Missing viewport meta tag")
        if not re.search(r"<html\b[^>]*\blang\s*=", source, re.I):
            add("warning", "Missing lang attribute on html element")

    elif ext in {".css", ".scss", ".less"}:
        if source.count("{") != source.count("}"):
            add("warning", f"Brace count mismatch: {source.count('{')} opening, {source.count('}')} closing")
        if source.count("/*") > source.count("*/"):
            add("warning", "Possible unterminated CSS block comment")

    elif ext in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}:
        if source.count("{") != source.count("}"):
            add("warning", f"Brace count mismatch: {source.count('{')} opening, {source.count('}')} closing")
        if source.count("/*") > source.count("*/"):
            add("warning", "Possible unterminated block comment")

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit and safely repair a MedOrbits repository.")
    parser.add_argument("--root", default=".", help="Repository root; defaults to current directory")
    parser.add_argument("--dry-run", action="store_true", help="Report only; do not modify project files")
    parser.add_argument("--strict", action="store_true", help="Return exit code 1 if any warning/error remains")
    parser.add_argument("--no-backup", action="store_true", help="Disable backups (not recommended)")
    parser.add_argument("--normalize-json", action="store_true", help="Pretty-print valid JSON with backups")
    parser.add_argument("--skip-node", action="store_true", help="Skip optional Node.js syntax checks")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: repository root does not exist: {root}", file=sys.stderr)
        return 2

    files = sorted(p for p in root.rglob("*") if p.is_file() and not skipped(p, root))
    findings, changes = [], []
    checked = 0

    for path in files:
        ext = path.suffix.lower()
        if ext not in TEXT_EXTS and path.name.lower() not in {"dockerfile", "makefile", "procfile"}:
            continue
        try:
            source = read(path)
        except OSError as exc:
            findings.append({"file": rel(path, root), "severity": "error", "message": str(exc)})
            continue

        checked += 1
        for item in findings_for(path, source):
            findings.append({"file": rel(path, root), **item})

        if args.normalize_json and ext == ".json":
            try:
                normalized = json.dumps(json.loads(source), indent=2, ensure_ascii=False) + "\n"
                if normalized != source:
                    if args.dry_run:
                        changes.append({"file": rel(path, root), "reason": "Would normalize valid JSON", "status": "would_change"})
                    elif args.no_backup:
                        path.write_text(normalized, encoding="utf-8")
                        changes.append({"file": rel(path, root), "reason": "Normalized JSON without backup", "status": "changed"})
                    else:
                        write_change(path, normalized, root, False, changes, "Normalized valid JSON formatting")
            except json.JSONDecodeError:
                pass

        # Conservative, deterministic cleanup only. Never changes code logic.
        if ext in {".html", ".htm", ".css", ".scss", ".less", ".js", ".mjs",
                   ".cjs", ".jsx", ".ts", ".tsx", ".py", ".md", ".txt",
                   ".yaml", ".yml", ".toml", ".xml", ".sql", ".sh"}:
            cleaned = "\n".join(line.rstrip(" \t") for line in source.splitlines())
            if source.endswith(("\n", "\r")):
                cleaned += "\n"
            if cleaned != source:
                if args.dry_run:
                    changes.append({"file": rel(path, root), "reason": "Would remove trailing whitespace", "status": "would_change"})
                elif args.no_backup:
                    path.write_text(cleaned, encoding="utf-8")
                    changes.append({"file": rel(path, root), "reason": "Removed trailing whitespace without backup", "status": "changed"})
                else:
                    write_change(path, cleaned, root, False, changes, "Removed trailing horizontal whitespace")

    tooling = {}
    if not args.skip_node and shutil.which("node"):
        js_files = [
            p for p in files
            if p.suffix.lower() in {".js", ".mjs", ".cjs"} and not skipped(p, root)
        ]
        node_errors = []
        for path in js_files:
            try:
                result = subprocess.run(
                    ["node", "--check", str(path)], cwd=root,
                    text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    timeout=20, check=False,
                )
                if result.returncode:
                    node_errors.append({
                        "file": rel(path, root),
                        "output": result.stdout[-5000:],
                    })
            except (OSError, subprocess.TimeoutExpired) as exc:
                node_errors.append({"file": rel(path, root), "output": str(exc)})
        tooling["node_files_checked"] = len(js_files)
        tooling["node_syntax_errors"] = node_errors

    if (root / "package.json").exists():
        try:
            package = json.loads(read(root / "package.json"))
            tooling["package_json_valid"] = True
            tooling["package_scripts"] = sorted(package.get("scripts", {}).keys()) if isinstance(package, dict) else []
        except Exception as exc:
            tooling["package_json_valid"] = False
            tooling["package_json_error"] = str(exc)

    report = {
        "project": "MedOrbits",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "mode": "dry-run" if args.dry_run else "repair-and-audit",
        "files_discovered": len(files),
        "text_files_checked": checked,
        "finding_count": len(findings),
        "errors": sum(x["severity"] == "error" for x in findings),
        "warnings": sum(x["severity"] == "warning" for x in findings),
        "changes": changes,
        "findings": findings,
        "tooling": tooling,
        "safety": [
            "No project files were deleted.",
            "Dependencies were not installed or upgraded.",
            "Application and deployment scripts were not executed.",
            "Only deterministic whitespace cleanup is automatic by default.",
            "HTML/CSS/JS checks are heuristic; review findings before deployment.",
        ],
    }

    report_dir = root / REPORT_DIR
    report_path = report_dir / "report.json"
    if not args.dry_run:
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 64)
    print("MEDORBITS ROOT REPOSITORY REPAIR")
    print("=" * 64)
    print(f"Root:                {root}")
    print(f"Files discovered:    {len(files)}")
    print(f"Text files checked:  {checked}")
    print(f"Findings:            {len(findings)}")
    print(f"Errors:              {report['errors']}")
    print(f"Warnings:            {report['warnings']}")
    print(f"Proposed/applied edits: {len(changes)}")
    if args.dry_run:
        print("DRY RUN: no project files were modified.")
    else:
        print(f"Report: {report_path}")
        if not args.no_backup:
            print(f"Backups: {root / BACKUP_DIR}")
    for item in findings[:80]:
        print(f"[{item['severity'].upper()}] {item['file']}: {item['message']}")
    if len(findings) > 80:
        print(f"... {len(findings) - 80} additional findings are recorded in the JSON report.")
    if args.strict and (report["errors"] or report["warnings"] or tooling.get("node_syntax_errors")):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
