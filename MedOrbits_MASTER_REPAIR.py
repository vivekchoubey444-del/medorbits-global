#!/usr/bin/env python3
"""MedOrbits Master Repository Auditor and Conservative Repair Tool.

Python 3.10+; standard library only.

Examples:
  python MedOrbits_MASTER_REPAIR.py --root . --dry-run
  python MedOrbits_MASTER_REPAIR.py --root . --repair
  python MedOrbits_MASTER_REPAIR.py --root . --repair --tests
  python MedOrbits_MASTER_REPAIR.py --root . --strict

Safety:
- Never deletes project files or installs/upgrades dependencies.
- Never executes discovered Python files.
- Never reads or modifies .env/secret files.
- Backs up each file before an automatic edit.
- Only automatically repairs smart-quote corruption in Python files when
  the repaired candidate successfully parses; all other findings are reported.
- Test execution is opt-in (--tests) and runs the repository's declared
  npm test script or pytest command, not every Python file.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "coverage",
    ".next", ".nuxt", ".cache", "__pycache__", ".venv", "venv",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox",
    "bower_components", ".repository-repair", ".repository-repair-backups",
    "repository-reports", "storage", "uploads", "backups",
}
SKIP_NAMES = {
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock",
    "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock",
}
SECRET_NAMES = {".env", ".env.local", ".env.production", ".env.development"}
TEXT_EXTS = {
    ".html", ".htm", ".css", ".scss", ".less", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".py", ".json", ".yaml", ".yml", ".toml",
    ".xml", ".svg", ".md", ".txt", ".sh", ".sql", ".conf", ".ini",
}
SMART_QUOTES = str.maketrans({
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
})


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_excluded(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True
    if any(part in SKIP_DIRS for part in parts):
        return True
    if path.name in SKIP_NAMES or path.name in SECRET_NAMES:
        return True
    if path.name.startswith(".env") and path.name != ".env.example":
        return True
    if path.is_symlink():
        return True
    return False


def discover(root: Path) -> list[Path]:
    found: list[Path] = []
    for current, dirs, names in os.walk(root, followlinks=False):
        base = Path(current)
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (base / d).is_symlink()]
        for name in names:
            p = base / name
            if is_excluded(p, root):
                continue
            try:
                if p.is_file() and p.stat().st_size <= 10 * 1024 * 1024:
                    found.append(p)
            except OSError:
                pass
    return sorted(found)


def backup_file(path: Path, root: Path) -> Path:
    destination = root / ".repository-repair-backups" / path.relative_to(root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(path, destination)
    else:
        # Preserve an earlier backup; create a timestamped second copy.
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        destination = destination.with_name(destination.name + "." + stamp + ".bak")
        shutil.copy2(path, destination)
    return destination


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


class HTMLRefs(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str, int]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        line = self.getpos()[0]
        for key in ("href", "src", "poster", "action"):
            value = attrs_map.get(key)
            if value:
                self.refs.append((tag, value.strip(), line))


def local_target(source: Path, raw: str, root: Path) -> Path | None:
    parts = urlsplit(raw)
    if parts.scheme or parts.netloc or raw.startswith(("#", "//", "data:", "mailto:", "tel:", "javascript:")):
        return None
    value = unquote(parts.path)
    if not value:
        return None
    candidate = root / value.lstrip("/") if value.startswith("/") else source.parent / value
    candidate = Path(os.path.abspath(candidate))
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate


def run_command(command: list[str], cwd: Path, timeout: int = 180) -> dict[str, Any]:
    try:
        proc = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, timeout=timeout, check=False)
        return {"command": command, "returncode": proc.returncode,
                "output": proc.stdout[-12000:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"command": command, "returncode": 127, "output": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="MedOrbits master audit and conservative repair")
    parser.add_argument("--root", default=".", help="Repository root (default: current directory)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Audit and preview; do not modify source")
    mode.add_argument("--repair", action="store_true", help="Apply safe repairs with backups")
    parser.add_argument("--tests", action="store_true", help="Run declared project tests after checks")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero if errors or warnings remain")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: repository directory not found: {root}", file=sys.stderr)
        return 2
    repair = bool(args.repair)
    files = discover(root)
    report: dict[str, Any] = {
        "project": "MedOrbits", "root": str(root),
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "mode": "repair" if repair else "audit",
        "files_discovered": len(files), "files_checked": 0,
        "repairs": [], "findings": [], "checks": {}, "tests": None,
        "safety": [
            "No files deleted; no dependencies installed or upgraded.",
            "Environment and secret files excluded from scanning and editing.",
            "Discovered Python files are parsed, never executed.",
            "Only verified smart-quote Python syntax repair is automatic.",
            "Application workflows and external integrations require functional tests.",
        ],
    }
    findings: list[dict[str, Any]] = report["findings"]
    repairs: list[dict[str, Any]] = report["repairs"]

    # 1) Python syntax; smart-quote repair only when it produces valid AST.
    py_files = [p for p in files if p.suffix.lower() == ".py"]
    python_bad = []
    for path in py_files:
        report["files_checked"] += 1
        try:
            source = read_text(path)
            ast.parse(source, filename=str(path))
        except (SyntaxError, UnicodeError) as exc:
            fixed = source.translate(SMART_QUOTES) if 'source' in locals() else ""
            fixed_ok = False
            if fixed and fixed != source:
                try:
                    ast.parse(fixed, filename=str(path))
                    fixed_ok = True
                except SyntaxError:
                    pass
            if fixed_ok and repair:
                backup = backup_file(path, root)
                path.write_text(fixed, encoding="utf-8", newline="\n")
                repairs.append({"file": str(path.relative_to(root)),
                                "repair": "Normalized smart quotation marks after successful AST validation",
                                "backup": str(backup.relative_to(root))})
            else:
                python_bad.append(str(path.relative_to(root)))
                findings.append({"severity": "error", "category": "python-syntax",
                                 "file": str(path.relative_to(root)), "message": str(exc),
                                 "safe_repair_available": fixed_ok})

    if repair:
        repaired_python = {item["file"] for item in repairs if "smart quotation" in item["repair"].lower()}
        if repaired_python:
            findings[:] = [item for item in findings
                           if not (item.get("category") == "python-syntax"
                                   and item.get("file") in repaired_python)]
            python_bad = [name for name in python_bad if name not in repaired_python]

    report["checks"]["python"] = {
        "files": len(py_files), "syntax_errors_remaining": python_bad,
        "status": "pass" if not python_bad or (repair and all(
            (root / p).exists() and _parses_python(root / p) for p in python_bad
        )) else "fail",
    }

    # 2) JSON parse validation (never rewrites invalid JSON).
    json_files = [p for p in files if p.suffix.lower() == ".json"]
    json_bad = []
    for path in json_files:
        report["files_checked"] += 1
        try:
            json.loads(read_text(path))
        except Exception as exc:
            rel = str(path.relative_to(root)); json_bad.append(rel)
            findings.append({"severity": "error", "category": "json", "file": rel, "message": str(exc)})
    report["checks"]["json"] = {"files": len(json_files), "invalid": json_bad,
                                 "status": "pass" if not json_bad else "fail"}

    # 3) JavaScript syntax checks using Node, where supported.
    js_files = [p for p in files if p.suffix.lower() in {".js", ".mjs", ".cjs"}]
    js_bad = []
    if shutil.which("node"):
        for path in js_files:
            result = run_command(["node", "--check", str(path)], root, timeout=30)
            if result["returncode"] and repair:
                # A shebang is only valid at byte zero. Some generated files
                # have a leading blank line; normalize it only if Node accepts it.
                original = path.read_bytes()
                candidate = original.lstrip(b"\r\n")
                if candidate.startswith(b"#!") and candidate != original:
                    temp = path.with_name("." + path.stem + ".repair-check" + path.suffix)
                    try:
                        temp.write_bytes(candidate)
                        trial = run_command(["node", "--check", str(temp)], root, timeout=30)
                        if trial["returncode"] == 0:
                            backup = backup_file(path, root)
                            path.write_bytes(candidate)
                            repairs.append({"file": str(path.relative_to(root)),
                                            "repair": "Removed leading blank line before Node.js shebang after syntax validation",
                                            "backup": str(backup.relative_to(root))})
                            result = run_command(["node", "--check", str(path)], root, timeout=30)
                    finally:
                        try:
                            temp.unlink()
                        except FileNotFoundError:
                            pass
            if result["returncode"]:
                rel = str(path.relative_to(root)); js_bad.append(rel)
                findings.append({"severity": "error", "category": "javascript-syntax",
                                 "file": rel, "message": result["output"][-3000:]})
        js_status = "pass" if not js_bad else "fail"
    else:
        js_status = "unavailable"
        findings.append({"severity": "warning", "category": "tooling", "file": "",
                         "message": "Node.js not installed; JavaScript syntax checks skipped"})
    report["checks"]["javascript"] = {"files": len(js_files), "invalid": js_bad, "status": js_status}

    # 4) HTML local references (reports only; never fabricates blank assets/pages).
    html_files = [p for p in files if p.suffix.lower() in {".html", ".htm"}]
    broken_refs = []
    for path in html_files:
        report["files_checked"] += 1
        try:
            parser_html = HTMLRefs()
            parser_html.feed(read_text(path))
            for tag, raw, line in parser_html.refs:
                target = local_target(path, raw, root)
                if target is not None and not target.exists():
                    entry = {"file": str(path.relative_to(root)), "line": line,
                             "reference": raw, "tag": tag}
                    broken_refs.append(entry)
                    findings.append({"severity": "warning", "category": "broken-local-reference",
                                     "file": entry["file"], "line": line,
                                     "message": f"Missing local reference: {raw}"})
        except Exception as exc:
            findings.append({"severity": "warning", "category": "html-parser",
                             "file": str(path.relative_to(root)), "message": str(exc)})
    report["checks"]["html_references"] = {"files": len(html_files),
                                           "broken_count": len(broken_refs),
                                           "broken": broken_refs,
                                           "status": "pass" if not broken_refs else "review"}

    # 5) CSS brace/comment heuristics (not a full CSS parser).
    css_files = [p for p in files if p.suffix.lower() in {".css", ".scss", ".less"}]
    css_issues = []
    for path in css_files:
        text = read_text(path)
        if text.count("{") != text.count("}") or text.count("/*") > text.count("*/"):
            entry = {"file": str(path.relative_to(root)),
                     "message": "Possible unbalanced braces or unterminated comment (heuristic)"}
            css_issues.append(entry)
            findings.append({"severity": "warning", "category": "css-structure", **entry})
    report["checks"]["css"] = {"files": len(css_files), "issues": css_issues,
                                "status": "review" if css_issues else "pass"}

    # 6) package.json scripts and references.
    package_path = root / "package.json"
    if package_path.exists():
        try:
            package = json.loads(read_text(package_path))
            scripts = package.get("scripts", {}) if isinstance(package, dict) else {}
            missing_script_targets = []
            for name, command in scripts.items():
                if not isinstance(command, str):
                    continue
                # Report only simple local script path references; avoid shell parsing guesses.
                for match in re.findall(r"(?:node|python(?:3)?|bash|sh)\s+([\w./-]+\.(?:mjs|cjs|js|py|sh))", command):
                    target = root / match
                    if not target.exists():
                        missing_script_targets.append({"script": name, "target": match})
            for item in missing_script_targets:
                findings.append({"severity": "warning", "category": "package-script",
                                 "file": "package.json", "message": f"Script {item['script']} references missing file {item['target']}"})
            report["checks"]["package"] = {"status": "pass" if not missing_script_targets else "review",
                                            "scripts": sorted(scripts),
                                            "missing_targets": missing_script_targets}
        except Exception as exc:
            report["checks"]["package"] = {"status": "fail", "error": str(exc)}
            findings.append({"severity": "error", "category": "package-json",
                             "file": "package.json", "message": str(exc)})
    else:
        report["checks"]["package"] = {"status": "missing"}
        findings.append({"severity": "warning", "category": "package-json",
                         "file": "package.json", "message": "Root package.json not found"})

    # 7) Optional declared test command; no test runs unless user opts in.
    if args.tests:
        if package_path.exists() and shutil.which("npm"):
            try:
                package = json.loads(read_text(package_path))
                if "test" in package.get("scripts", {}):
                    report["tests"] = run_command(["npm", "test"], root, timeout=900)
                else:
                    report["tests"] = {"returncode": 2, "output": "No npm test script declared."}
            except Exception as exc:
                report["tests"] = {"returncode": 2, "output": str(exc)}
        elif shutil.which("pytest"):
            report["tests"] = run_command([sys.executable, "-m", "pytest", "-q"], root, timeout=900)
        else:
            report["tests"] = {"returncode": 127, "output": "No supported test runner available."}

    # 8) Persist report. It does not contain environment file contents.
    report["summary"] = {
        "errors": sum(x["severity"] == "error" for x in findings),
        "warnings": sum(x["severity"] == "warning" for x in findings),
        "repairs_applied": len(repairs),
    }
    report_dir = root / ".repository-repair"
    report_dir.mkdir(exist_ok=True)
    report_json = report_dir / "master-repair-report.json"
    report_md = report_dir / "master-repair-report.md"
    report_json.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md = ["# MedOrbits Master Repair Report", "",
          f"- Timestamp: {report['timestamp_utc']}",
          f"- Mode: {report['mode']}",
          f"- Files discovered: {report['files_discovered']}",
          f"- Files checked: {report['files_checked']}",
          f"- Repairs applied: {len(repairs)}",
          f"- Errors: {report['summary']['errors']}",
          f"- Warnings: {report['summary']['warnings']}", "", "## Checks", ""]
    for name, result in report["checks"].items():
        md.append(f"- **{name}:** {result.get('status', 'unknown')}")
    md.extend(["", "## Repairs", ""])
    md.extend([f"- `{x['file']}` — {x['repair']} (backup: `{x['backup']}`)" for x in repairs] or ["- None"])
    md.extend(["", "## Findings", ""])
    md.extend([f"- **{x['severity'].upper()}** `{x.get('file','')}`: {x['message']}" for x in findings] or ["- No findings"])
    report_md.write_text("\n".join(md) + "\n", encoding="utf-8")

    print("\n========== MEDORBITS MASTER REPAIR ==========")
    print(f"Repository : {root}")
    print(f"Files      : {report['files_discovered']}")
    print(f"Repairs    : {len(repairs)}")
    print(f"Errors     : {report['summary']['errors']}")
    print(f"Warnings   : {report['summary']['warnings']}")
    print(f"JSON report: {report_json}")
    print(f"MD report  : {report_md}")
    if repairs:
        print("Backups    :", root / ".repository-repair-backups")
    if report["tests"] is not None:
        print("Tests exit :", report["tests"].get("returncode"))
        print(report["tests"].get("output", "")[-4000:])
    print("=============================================\n")

    failed = report["summary"]["errors"] > 0
    if report["tests"] is not None and report["tests"].get("returncode") != 0:
        failed = True
    if args.strict and (failed or report["summary"]["warnings"] > 0):
        return 1
    return 1 if failed else 0


def _parses_python(path: Path) -> bool:
    try:
        ast.parse(read_text(path), filename=str(path))
        return True
    except (SyntaxError, OSError, UnicodeError):
        return False


if __name__ == "__main__":
    raise SystemExit(main())
