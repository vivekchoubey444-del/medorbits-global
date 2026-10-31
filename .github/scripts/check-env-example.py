
#!/usr/bin/env python3
“””
===============================================================================
MEDORBITS — ENVIRONMENT EXAMPLE VALIDATOR
File: .github/scripts/check-env-example.py
Version: 2.1.3

Purpose:
    Validate environment example files and ensure that required configuration
    variables are documented without exposing real credentials.

Features:
    - Detect missing .env.example files
    - Validate environment variable names
    - Detect duplicate variable declarations
    - Detect empty or undocumented values
    - Detect accidentally committed credentials
    - Support required-variable definitions
    - Ignore safe placeholder values
    - Generate CI-friendly validation results

Usage:
    python .github/scripts/check-env-example.py
    python .github/scripts/check-env-example.py —strict
    python .github/scripts/check-env-example.py —file .env.example
    python .github/scripts/check-env-example.py —help

Exit codes:
    0 = Validation passed
    1 = Validation errors detected
    2 = Execution or configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import re
import sys

from pathlib import Path


# =============================================================================
# CONFIGURATION
# =============================================================================

VERSION = “2.1.3”

ROOT = Path(__file__).resolve().parents[2]

DEFAULT_ENV_FILE = ROOT / “.env.example”

ENV_NAME_PATTERN = re.compile(
    r”^[A-Za-z_][A-Za-z0-9_]*$”
)

PLACEHOLDERS = {
    “”,
    “your_value”,
    “your_value_here”,
    “your_api_key”,
    “your_api_key_here”,
    “your_secret”,
    “your_secret_here”,
    “change_me”,
    “changeme”,
    “replace_me”,
    “replace_this”,
    “example”,
    “placeholder”,
    “xxxxxxxx”,
    “redacted”,
    “none”,
    “null”,
    “undefined”,
}

# Add or remove names according to the actual MedOrbits application.
REQUIRED_VARIABLES = {
    “NODE_ENV”,
    “PORT”,
    “SESSION_SECRET”,
    “DATABASE_URL”,
}


# =============================================================================
# DATA MODEL
# =============================================================================

class ValidationResult:
    “””Collect environment validation results.”””

    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.valid_variables: list[str] = []

    @property
    def passed(self) -> bool:
        return not self.errors

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warning(self, message: str) -> None:
        self.warnings.append(message)


# =============================================================================
# ENVIRONMENT FILE PARSING
# =============================================================================

def is_placeholder(value: str) -> bool:
    “””Return True when a value is an example placeholder.”””

    normalized = value.strip().strip(“’\””).lower()

    if normalized in PLACEHOLDERS:
        return True

    if normalized.startswith(
        (
            “your_”,
            “replace_”,
            “example_”,
            “placeholder_”,
        )
    ):
        return True

    if re.fullmatch(r”[xX*._-]+”, normalized):
        return True

    return False


def parse_env_line(
    line: str,
    line_number: int,
) -> tuple[str, str] | None:
    “””Parse a basic KEY=value environment declaration.”””

    stripped = line.strip()

    if not stripped or stripped.startswith(“#”):
        return None

    if stripped.startswith(“export “):
        stripped = stripped[len(“export “):].strip()

    if “=“ not in stripped:
        return None

    name, value = stripped.split(“=“, 1)

    name = name.strip()
    value = value.strip()

    if not ENV_NAME_PATTERN.fullmatch(name):
        raise ValueError(
            f”Line {line_number}: invalid variable name.”
        )

    # Remove inline comments only when preceded by whitespace.
    value = re.sub(r”\s+#.*$”, “”, value).strip()

    # Remove matching outer quotes.
    if (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in {“’”, ‘”’}
    ):
        value = value[1:-1]

    return name, value


# =============================================================================
# FILE VALIDATION
# =============================================================================

def validate_env_file(
    env_file: Path,
    strict: bool = False,
) -> ValidationResult:
    “””Validate an environment example file.”””

    result = ValidationResult()

    if not env_file.exists():
        result.error(
            f”Environment example file does not exist: {env_file}”
        )
        return result

    if not env_file.is_file():
        result.error(
            f”Environment path is not a regular file: {env_file}”
        )
        return result

    if not env_file.is_relative_to(ROOT):
        result.error(
            “Environment file must be located inside the repository.”
        )
        return result

    try:
        content = env_file.read_text(encoding=“utf-8”)

    except OSError as exc:
        result.error(
            f”Unable to read environment file: {exc}”
        )
        return result

    variables: dict[str, int] = {}

    for line_number, line in enumerate(
        content.splitlines(),
        start=1,
    ):

        try:
            parsed = parse_env_line(line, line_number)

        except ValueError as exc:
            result.error(str(exc))
            continue

        if parsed is None:
            if line.strip() and not line.lstrip().startswith(“#”):
                result.warning(
                    f”Line {line_number}: unrecognized declaration.”
                )
            continue

        name, value = parsed

        # ——————————————————
        # DUPLICATE VARIABLES
        # ——————————————————

        if name in variables:
            result.error(
                f”Line {line_number}: duplicate variable {name}; “
                f”first declared on line {variables[name]}.”
            )
            continue

        variables[name] = line_number

        # ——————————————————
        # EMPTY VALUES
        # ——————————————————

        if not value:
            result.warning(
                f”Line {line_number}: {name} has an empty example value.”
            )

        # ——————————————————
        # PLACEHOLDER VALIDATION
        # ——————————————————

        elif not is_placeholder(value):
            if strict:
                result.error(
                    f”Line {line_number}: {name} contains a “
                    “non-placeholder value. Review for exposed credentials.”
                )
            else:
                result.warning(
                    f”Line {line_number}: {name} contains a “
                    “non-placeholder value. Review manually.”
                )

        result.valid_variables.append(name)

    # ———————————————————
    # REQUIRED VARIABLES
    # ———————————————————

    missing = REQUIRED_VARIABLES - set(variables)

    for name in sorted(missing):
        result.error(
            f”Required environment variable is missing: {name}”
        )

    return result


# =============================================================================
# REPORTING
# =============================================================================

def print_report(
    result: ValidationResult,
    env_file: Path,
) -> None:
    “””Display validation results.”””

    print()
    print(“=“ * 72)
    print(“MEDORBITS ENVIRONMENT EXAMPLE VALIDATION”)
    print(“=“ * 72)

    print(f”File: {env_file}”)
    print(f”Variables checked: {len(result.valid_variables)}”)

    if result.warnings:
        print()
        print(“WARNINGS:”)

        for warning in result.warnings:
            print(f”[WARNING] {warning}”)

    if result.errors:
        print()
        print(“ERRORS:”)

        for error in result.errors:
            print(f”[ERROR] {error}”)

    print()

    if result.passed:
        print(“[SUCCESS] Environment example validation passed.”)
    else:
        print(
            f”[FAILED] {len(result.errors)} validation error(s) found.”
        )

    print(“=“ * 72)


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def parse_args() -> argparse.Namespace:
    “””Parse command-line arguments.”””

    parser = argparse.ArgumentParser(
        description=“MedOrbits environment example validator.”
    )

    parser.add_argument(
        “—file”,
        type=Path,
        default=DEFAULT_ENV_FILE,
        help=“Environment example file to validate.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Reject non-placeholder values.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Env Validator {VERSION}”,
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    “””Run environment example validation.”””

    args = parse_args()

    env_file = args.file

    if not env_file.is_absolute():
        env_file = ROOT / env_file

    env_file = env_file.resolve()

    print(f”[INFO] MedOrbits Env Validator {VERSION}”)
    print(f”[INFO] Strict mode: {args.strict}”)

    result = validate_env_file(
        env_file=env_file,
        strict=args.strict,
    )

    print_report(result, env_file)

    return 0 if result.passed else 1


if __name__ == “__main__”:
    try:
        raise SystemExit(main())

    except KeyboardInterrupt:
        print(
            “\n[ERROR] Validation interrupted.”,
            file=sys.stderr,
        )
        raise SystemExit(2)

# =============================================================================
# END OF MEDORBITS ENVIRONMENT VALIDATOR
# =============================================================================
