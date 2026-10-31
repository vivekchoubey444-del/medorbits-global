
#!/usr/bin/env python3
“””
===============================================================================
MEDORBITS — REPOSITORY STRUCTURE VALIDATOR
File: .github/scripts/validate-repository.py
Version: 2.1.3

Purpose:
    Validate the MedOrbits repository structure, essential configuration,
    directory organization and required project files.

Features:
    - Required directory validation
    - Required file validation
    - Package configuration validation
    - Git repository detection
    - JSON configuration validation
    - GitHub workflow presence checks
    - Environment example validation
    - Repository path safety checks
    - CI-friendly reporting
    - Configurable validation profiles

Usage:
    python .github/scripts/validate-repository.py
    python .github/scripts/validate-repository.py —strict
    python .github/scripts/validate-repository.py —profile github
    python .github/scripts/validate-repository.py —help

Exit codes:
    0 = Repository validation passed
    1 = Validation errors detected
    2 = Execution or configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import json
import subprocess
import sys

from pathlib import Path


# =============================================================================
# CONFIGURATION
# =============================================================================

VERSION = “2.1.3”

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = {
    “package.json”,
    “package-lock.json”,
    “.gitignore”,
    “README.md”,
}

REQUIRED_DIRECTORIES = {
    “.github”,
    “.github/workflows”,
    “.github/scripts”,
}

GITHUB_REQUIRED_FILES = {
    “.github/dependabot.yml”,
    “.github/workflows/ci.yml”,
    “.github/workflows/codeql.yml”,
}

OPTIONAL_FILES = {
    “.env.example”,
    “SECURITY.md”,
    “CONTRIBUTING.md”,
    “LICENSE”,
    “CHANGELOG.md”,
}


# =============================================================================
# DATA MODEL
# =============================================================================

class RepositoryReport:
    “””Collect repository validation results.”””

    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []

    @property
    def success(self) -> bool:
        return not self.errors

    def add_error(self, message: str) -> None:
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def add_pass(self, message: str) -> None:
        self.passed.append(message)


# =============================================================================
# PATH VALIDATION
# =============================================================================

def safe_path(relative_path: str) -> Path:
    “””Resolve a repository path without allowing traversal outside ROOT.”””

    candidate = (ROOT / relative_path).resolve()

    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise ValueError(
            f”Path escapes repository root: {relative_path}”
        ) from exc

    return candidate


def validate_required_paths(
    report: RepositoryReport,
    strict: bool,
    github_profile: bool,
) -> None:
    “””Validate required files and directories.”””

    for relative_path in sorted(REQUIRED_DIRECTORIES):

        path = safe_path(relative_path)

        if path.is_dir():
            report.add_pass(
                f”Directory exists: {relative_path}”
            )
        else:
            report.add_error(
                f”Required directory missing: {relative_path}”
            )

    for relative_path in sorted(REQUIRED_FILES):

        path = safe_path(relative_path)

        if path.is_file():
            report.add_pass(
                f”Required file exists: {relative_path}”
            )
        else:
            report.add_error(
                f”Required file missing: {relative_path}”
            )

    if github_profile:

        for relative_path in sorted(GITHUB_REQUIRED_FILES):

            path = safe_path(relative_path)

            if path.is_file():
                report.add_pass(
                    f”GitHub configuration exists: {relative_path}”
                )
            else:
                report.add_error(
                    f”GitHub configuration missing: {relative_path}”
                )

    for relative_path in sorted(OPTIONAL_FILES):

        path = safe_path(relative_path)

        if path.exists():
            report.add_pass(
                f”Optional file exists: {relative_path}”
            )
        elif strict:
            report.add_error(
                f”Strict mode: recommended file missing: {relative_path}”
            )
        else:
            report.add_warning(
                f”Recommended file missing: {relative_path}”
            )


# =============================================================================
# GIT VALIDATION
# =============================================================================

def validate_git_repository(
    report: RepositoryReport,
) -> None:
    “””Verify that ROOT is inside a Git working tree.”””

    try:

        result = subprocess.run(
            [
                “git”,
                “-C”,
                str(ROOT),
                “rev-parse”,
                “—is-inside-work-tree”,
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.stdout.strip() == “true”:
            report.add_pass(
                “Git working tree detected.”
            )
        else:
            report.add_error(
                “Directory is not a valid Git working tree.”
            )

    except FileNotFoundError:
        report.add_error(
            “Git executable is not installed.”
        )

    except subprocess.TimeoutExpired:
        report.add_error(
            “Git repository validation timed out.”
        )

    except subprocess.CalledProcessError:
        report.add_error(
            “Git repository metadata could not be verified.”
        )


# =============================================================================
# PACKAGE VALIDATION
# =============================================================================

def validate_package(
    report: RepositoryReport,
) -> None:
    “””Validate package.json and package-lock.json consistency.”””

    package_file = ROOT / “package.json”
    lock_file = ROOT / “package-lock.json”

    if not package_file.is_file():
        return

    try:

        package = json.loads(
            package_file.read_text(encoding=“utf-8”)
        )

    except (OSError, json.JSONDecodeError) as exc:

        report.add_error(
            f”Invalid package.json: {exc}”
        )

        return

    if not isinstance(package, dict):
        report.add_error(
            “package.json must contain a JSON object.”
        )
        return

    if not package.get(“name”):
        report.add_error(
            “package.json is missing its name.”
        )
    else:
        report.add_pass(
            f”Package name: {package[‘name’]}”
        )

    version = package.get(“version”)

    if not isinstance(version, str) or not version.strip():
        report.add_warning(
            “Package version is missing or invalid.”
        )
    else:
        report.add_pass(
            f”Package version: {version}”
        )

    engines = package.get(“engines”, {})
    node_requirement = engines.get(“node”) if isinstance(engines, dict) else None

    if node_requirement:
        report.add_pass(
            f”Node.js engine requirement: {node_requirement}”
        )
    else:
        report.add_warning(
            “package.json does not declare engines.node.”
        )

    scripts = package.get(“scripts”, {})

    if not isinstance(scripts, dict):
        report.add_error(
            “package.json scripts must be a JSON object.”
        )
    else:
        report.add_pass(
            f”Configured npm scripts: {len(scripts)}”
        )

    if lock_file.is_file():

        try:

            lock = json.loads(
                lock_file.read_text(encoding=“utf-8”)
            )

            if not isinstance(lock, dict):
                raise ValueError(
                    “package-lock.json must contain a JSON object.”
                )

            lock_name = lock.get(“name”)
            lock_version = lock.get(“version”)

            if lock_name and package.get(“name”) != lock_name:
                report.add_error(
                    “package.json and package-lock.json names differ.”
                )

            if lock_version and package.get(“version”) != lock_version:
                report.add_error(
                    “package.json and package-lock.json versions differ.”
                )

            lockfile_version = lock.get(“lockfileVersion”)

            if lockfile_version is None:
                report.add_error(
                    “package-lock.json is missing lockfileVersion.”
                )
            else:
                report.add_pass(
                    f”Lockfile version: {lockfile_version}”
                )

        except (OSError, json.JSONDecodeError, ValueError) as exc:

            report.add_error(
                f”Invalid package-lock.json: {exc}”
            )


# =============================================================================
# GITHUB CONFIGURATION VALIDATION
# =============================================================================

def validate_github_directory(
    report: RepositoryReport,
) -> None:
    “””Validate the presence of basic GitHub configuration.”””

    github_dir = ROOT / “.github”

    if not github_dir.is_dir():
        return

    workflows_dir = github_dir / “workflows”

    if workflows_dir.is_dir():

        workflow_files = (
            list(workflows_dir.glob(“*.yml”))
            + list(workflows_dir.glob(“*.yaml”))
        )

        report.add_pass(
            f”GitHub workflows found: {len(workflow_files)}”
        )

        if not workflow_files:
            report.add_warning(
                “No GitHub Actions workflow files found.”
            )

    else:
        report.add_error(
            “GitHub workflows directory is missing.”
        )

    scripts_dir = github_dir / “scripts”

    if scripts_dir.is_dir():

        scripts = list(scripts_dir.glob(“*.py”)) + list(
            scripts_dir.glob(“*.js”)
        )

        report.add_pass(
            f”GitHub validation scripts found: {len(scripts)}”
        )


# =============================================================================
# REPORTING
# =============================================================================

def print_report(
    report: RepositoryReport,
) -> None:
    “””Print the repository validation report.”””

    print()
    print(“=“ * 72)
    print(“MEDORBITS REPOSITORY VALIDATION REPORT”)
    print(“=“ * 72)

    for item in report.passed:
        print(f”[PASS] {item}”)

    for item in report.warnings:
        print(f”[WARNING] {item}”)

    for item in report.errors:
        print(f”[ERROR] {item}”)

    print()
    print(f”Passed   : {len(report.passed)}”)
    print(f”Warnings : {len(report.warnings)}”)
    print(f”Errors   : {len(report.errors)}”)

    print(“=“ * 72)

    if report.success:
        print(“[SUCCESS] Repository validation passed.”)
    else:
        print(“[FAILED] Repository validation found errors.”)


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def parse_args() -> argparse.Namespace:
    “””Parse CLI arguments.”””

    parser = argparse.ArgumentParser(
        description=“MedOrbits repository structure validator.”
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat missing recommended files as errors.”,
    )

    parser.add_argument(
        “—profile”,
        choices=(“standard”, “github”),
        default=“standard”,
        help=“Select the validation profile.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Repository Validator {VERSION}”,
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    “””Execute repository validation.”””

    args = parse_args()

    print(
        f”[INFO] MedOrbits Repository Validator {VERSION}”
    )

    print(
        f”[INFO] Repository root: {ROOT}”
    )

    report = RepositoryReport()

    if not ROOT.is_dir():
        print(
            “[ERROR] Repository root does not exist.”,
            file=sys.stderr,
        )
        return 2

    try:

        validate_required_paths(
            report=report,
            strict=args.strict,
            github_profile=args.profile == “github”,
        )

        validate_git_repository(report)

        validate_package(report)

        validate_github_directory(report)

        print_report(report)

        return 0 if report.success else 1

    except (OSError, ValueError) as exc:

        print(
            f”[ERROR] Repository validation failed: {exc}”,
            file=sys.stderr,
        )

        return 2

    except KeyboardInterrupt:

        print(
            “\n[ERROR] Validation interrupted.”,
            file=sys.stderr,
        )

        return 2


if __name__ == “__main__”:
    raise SystemExit(main())

# =============================================================================
# END OF MEDORBITS REPOSITORY VALIDATOR
# =============================================================================
