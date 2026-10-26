
#!/usr/bin/env python3
"""
MedOrbits Repository Guard
Python 3.10+ | Standard library only

Default mode:
- Read-only checks.
- Detects suspicious test/security bypass patterns in changed files.
- Checks Git whitespace errors.
- Checks for missing test scripts and CI workflows.
- Audits GitHub Actions for unsafe permissions and skipped checks.
- Writes a JSON report.
- Never edits, deletes, commits, or pushes source files.
- Never bypasses tests.

Exit codes:
0 = no blocking findings
1 = blocking findings
2 = execution/configuration error
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time

from pathlib import Path


VERSION = "1.0.0"

EXCLUDED_PARTS = {
    ".git", "node_modules", "vendor", "dist", "build",
    "coverage", "__pycache__", ".venv", "venv",
    "duplicate-quarantine", "repository-reports",
}

SOURCE_EXTENSIONS = {
    ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx",
    ".py", ".json", ".yml", ".yaml", ".sh",
    ".html", ".htm", ".css", ".toml",
}

# These are review signals, not proof of malicious behavior.
# Matches in documentation are reported as warnings where possible.
BYPASS_PATTERNS = [
    (
        "CI_CONTINUE_ON_ERROR",
        re.compile(r"(?im)^\s*continue-on-error\s*:\s*true\b"),
        "Workflow step may ignore a failed command.",
    ),
    (
        "SHELL_FAILURE_SUPPRESSION",
        re.compile(r"(?m)(?:\|\|\s*true\b|;\s*true\s*(?:#.*)?$)"),
        "Shell command may suppress a failure.",
    ),
    (
        "TEST_SKIP_FLAG",
        re.compile(
            r"(?i)(?:pytest\s+[^;\n]*--ignore|"
            r"jest\s+[^;\n]*--passWithNoTests|"
            r"vitest\s+[^;\n]*--passWithNoTests)"
        ),
        "Test command may skip files or pass without tests.",
    ),
    (
        "DISABLED_TEST",
        re.compile(
            r"(?i)(?:\bdescribe\.skip\s*\(|\bit\.skip\s*\(|"
            r"\btest\.skip\s*\(|\bpytest\.mark\.skip\b|"
            r"\bskipif\s*\()"
        ),
        "Test may be disabled; verify that the skip is intentional.",
    ),
    (
        "TYPECHECK_SUPPRESSION",
        re.compile(
            r"(?i)(?:@ts-nocheck|@ts-ignore|"
            r"eslint-disable(?:-next-line|-line)?|"
            r"#\s*noqa\b)"
        ),
        "Static analysis suppression found; review justification.",
    ),
    (
        "VERIFY_DISABLED",
        re.compile(
            r"(?i)(?:NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0|"
            r"rejectUnauthorized\s*:\s*false|"
            r"strict-ssl\s*=\s*false)"
        ),
        "TLS verification may be disabled.",
    ),
]

SENSITIVE_FILES = {
    ".env", ".env.production", ".env.local",
    "id_rsa", "id_ed25519",
}

TEST_NAME_HINTS = (
    "test", "spec", "vitest", "jest", "pytest",
)


def run_git(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def is_git_repo(root: Path) -> bool:
    result = run_git(root, "rev-parse", "--show-toplevel")
    return result.returncode == 0


def git_changed_files(root: Path) -> list[str]:
    """
    Include staged, unstaged, and untracked files.
    Does not change Git state.
    """
    commands = [
        ["diff", "--name-only", "HEAD"],
        ["ls-files", "--others", "--exclude-standard"],
    ]

    found = set()

    for command in commands:
        result = run_git(root, *command)

        if result.returncode != 0:
            continue

        found.update(
            line.strip()
            for line in result.stdout.splitlines()
            if line.strip()
        )

    return sorted(found)


def all_source_files(root: Path) -> list[Path]:
    results = []

    for current, dirs, files in __import__("os").walk(
        root, followlinks=False
    ):
        current_path = Path(current)

        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_PARTS
            and not name.startswith(".git")
        ]

        for filename in files:
            path = current_path / filename

            if path.is_symlink():
                continue

            if any(part in EXCLUDED_PARTS for part in path.relative_to(root).parts):
                continue

            if path.suffix.lower() in SOURCE_EXTENSIONS:
                results.append(path)

    return sorted(results)


def read_text(path: Path) -> str | None:
    try:
        if path.stat().st_size > 5_000_000:
            return None

        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        return None


def add_finding(
    findings: list[dict],
    severity: str,
    code: str,
    file: str,
    line: int | None,
    message: str,
) -> None:
    findings.append({
        "severity": severity,
        "code": code,
        "file": file,
        "line": line,
        "message": message,
    })


def scan_bypass_patterns(
    root: Path,
    files: list[Path],
    findings: list[dict],
) -> None:
    for path in files:
        text = read_text(path)

        if text is None:
            continue

        relative = path.relative_to(root).as_posix()
        is_test_file = any(
            hint in path.name.lower()
            for hint in TEST_NAME_HINTS
        )

        for code, pattern, message in BYPASS_PATTERNS:
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1

                # A disabled test is a warning for manual review,
                # not an automatic assertion that it is malicious.
                severity = (
                    "warning"
                    if code in {"DISABLED_TEST", "TYPECHECK_SUPPRESSION"}
                    else "review"
                )

                # Test skip patterns inside test files are especially
                # relevant, but remain review signals.
                if is_test_file and code == "DISABLED_TEST":
                    severity = "warning"

                add_finding(
                    findings,
                    severity,
                    code,
                    relative,
                    line,
                    message,
                )


def check_sensitive_files(
    root: Path,
    findings: list[dict],
) -> None:
    result = run_git(root, "ls-files", "--cached", "--others", "--exclude-standard")

    if result.returncode != 0:
        add_finding(
            findings,
            "warning",
            "GIT_STATUS_UNAVAILABLE",
            "",
            None,
            "Could not enumerate Git-tracked and untracked files.",
        )
        return

    for item in result.stdout.splitlines():
        relative = item.strip()
        if not relative:
            continue

        path = Path(relative)
        name = path.name.lower()

        if name in SENSITIVE_FILES or (
            name.startswith(".env.") and name not in {".env.example", ".env.sample"}
        ):
            add_finding(
                findings,
                "review",
                "POTENTIAL_SECRET_FILE",
                relative,
                None,
                "Potential secret/configuration file. Verify it is not tracked or exposed.",
            )


def check_git_whitespace(
    root: Path,
    findings: list[dict],
) -> None:
    result = run_git(root, "diff", "--check")

    if result.returncode != 0:
        add_finding(
            findings,
            "error",
            "GIT_DIFF_CHECK_FAILED",
            "",
            None,
            result.stderr.strip() or "Git diff check failed.",
        )
    elif result.stdout.strip():
        add_finding(
            findings,
            "warning",
            "GIT_WHITESPACE_ISSUES",
            "",
            None,
            result.stdout.strip(),
        )


def check_test_setup(
    root: Path,
    findings: list[dict],
) -> dict:
    package_path = root / "package.json"
    package = {}

    if package_path.is_file():
        try:
            package = json.loads(package_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            add_finding(
                findings,
                "error",
                "INVALID_PACKAGE_JSON",
                "package.json",
                None,
                "package.json could not be parsed as valid JSON.",
            )

    scripts = package.get("scripts", {}) if isinstance(package, dict) else {}
    test_scripts = {
        name: command
        for name, command in scripts.items()
        if "test" in name.lower()
    }

    if package_path.is_file() and not test_scripts:
        add_finding(
            findings,
            "warning",
            "NO_NPM_TEST_SCRIPT",
            "package.json",
            None,
            "No package.json script with 'test' in its name was found.",
        )

    workflows_dir = root / ".github" / "workflows"
    workflow_files = []

    if workflows_dir.is_dir():
        workflow_files = sorted(
            p.relative_to(root).as_posix()
            for p in workflows_dir.glob("*")
            if p.is_file() and p.suffix.lower() in {".yml", ".yaml"}
        )

    if not workflow_files:
        add_finding(
            findings,
            "warning",
            "NO_GITHUB_ACTIONS_WORKFLOW",
            ".github/workflows",
            None,
            "No GitHub Actions workflow was found. Remote CI is not verified.",
        )

    return {
        "package_json_found": package_path.is_file(),
        "test_scripts": test_scripts,
        "workflow_files": workflow_files,
    }


def check_workflow_permissions(
    root: Path,
    findings: list[dict],
) -> None:
    workflows = root / ".github" / "workflows"

    if not workflows.is_dir():
        return

    for path in workflows.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".yml", ".yaml"}:
            continue

        text = read_text(path)

        if text is None:
            continue

        relative = path.relative_to(root).as_posix()

        # Broad write permissions should be reviewed. This is a
        # conservative text check, not a complete YAML parser.
        if re.search(r"(?im)^\s*permissions\s*:\s*write-all\b", text):
            add_finding(
                findings,
                "warning",
                "WORKFLOW_WRITE_ALL",
                relative,
                None,
                "Workflow uses write-all permissions. Prefer least privilege.",
            )

        if re.search(r"(?im)^\s*permissions\s*:\s*read-all\b", text):
            continue

        if not re.search(r"(?im)^\s*permissions\s*:", text):
            add_finding(
                findings,
                "warning",
                "WORKFLOW_PERMISSIONS_UNSPECIFIED",
                relative,
                None,
                "Workflow does not declare explicit permissions. Review token access.",
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit MedOrbits repository safeguards."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory.",
    )

    parser.add_argument(
        "--all-files",
        action="store_true",
        help="Scan all eligible source files, not only changed files.",
    )

    parser.add_argument(
        "--report",
        default="tools/repository-reports/repository-guard.json",
        help="Report path relative to repository root.",
    )

    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    if not root.is_dir():
        print(f"ERROR: Not a directory: {root}", file=sys.stderr)
        return 2

    if not is_git_repo(root):
        print(
            "ERROR: This directory is not recognized as a Git repository.",
            file=sys.stderr,
        )
        return 2

    findings: list[dict] = []
    files = all_source_files(root)
    changed = git_changed_files(root)

    if args.all_files:
        selected = files
    else:
        selected = [
            root / item
            for item in changed
            if (root / item).is_file()
            and (root / item).suffix.lower() in SOURCE_EXTENSIONS
            and not any(
                part in EXCLUDED_PARTS
                for part in Path(item).parts
            )
        ]

    scan_bypass_patterns(root, selected, findings)
    check_sensitive_files(root, findings)
    check_git_whitespace(root, findings)
    test_setup = check_test_setup(root, findings)
    check_workflow_permissions(root, findings)

    report = {
        "tool": "MedOrbits Repository Guard",
        "version": VERSION,
        "created_at_epoch": int(time.time()),
        "repository_root": str(root),
        "read_only": True,
        "git_operations": [],
        "files_in_repository": len(files),
        "changed_files_detected": len(changed),
        "files_checked_for_bypass_patterns": len(selected),
        "test_setup": test_setup,
        "finding_count": len(findings),
        "findings": findings,
        "limitations": [
            "Static scanning cannot prove code is safe.",
            "Patterns can produce false positives and false negatives.",
            "Local scripts can be modified by users with repository access.",
            "GitHub branch protection and required CI checks must be configured remotely.",
            "This tool does not execute the project's test suite.",
        ],
    }

    report_path = (root / args.report).resolve()

    try:
        report_path.relative_to(root)
    except ValueError:
        print("ERROR: Report path must remain inside the repository.", file=sys.stderr)
        return 2

    try:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        print(f"ERROR: Cannot write report: {exc}", file=sys.stderr)
        return 2

    counts = {}

    for finding in findings:
        severity = finding["severity"]
        counts[severity] = counts.get(severity, 0) + 1

    print("MedOrbits Repository Guard", VERSION)
    print(f"Files checked: {len(selected)}")
    print(f"Findings: {len(findings)}")
    print(f"Severity counts: {counts}")
    print(f"Report: {report_path.relative_to(root).as_posix()}")
    print("No tests were bypassed or executed by this guard.")
    print("No source files were edited or deleted.")

    blocking = any(
        finding["severity"] == "error"
        for finding in findings
    )

    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
