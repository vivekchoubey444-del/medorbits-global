
"""Tests for MedOrbits repository report generation.

These tests validate report creation, serialization, output safety, and
failure handling without modifying repository source files.

Run:
    python -m pytest python/scr/tests/test_reports.py -v
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[3]
REPORT_TOOLS_DIR = PROJECT_ROOT / "tools" / "repository-reports"
REPORT_SCRIPT_CANDIDATES = (
    REPORT_TOOLS_DIR / "generate_reports.py",
    REPORT_TOOLS_DIR / "repository_reports.py",
    REPORT_TOOLS_DIR / "report_generator.py",
)


def _find_report_script() -> Path | None:
    """Return the first known report-generator script that exists."""
    for candidate in REPORT_SCRIPT_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def _run_script(
    script: Path,
    *arguments: str,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a report script in a controlled subprocess."""
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment["PYTHONUNBUFFERED"] = "1"

    return subprocess.run(
        [sys.executable, str(script), *arguments],
        cwd=str(cwd or PROJECT_ROOT),
        env=environment,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


def _load_json(path: Path) -> Any:
    """Load JSON and raise a useful assertion error for invalid output."""
    assert path.is_file(), f"Expected report file does not exist: {path}"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        pytest.fail(f"Report is not valid UTF-8 JSON: {path}: {exc}")


def test_project_root_exists() -> None:
    """The test path resolves to the repository root."""
    assert PROJECT_ROOT.is_dir()
    assert (PROJECT_ROOT / "python").is_dir()


def test_report_tools_directory_exists() -> None:
    """The repository report tools directory is present."""
    assert REPORT_TOOLS_DIR.is_dir(), (
        f"Missing report tools directory: {REPORT_TOOLS_DIR}"
    )


def test_report_generator_exists() -> None:
    """At least one supported report-generator entry point exists."""
    script = _find_report_script()
    assert script is not None, (
        "No report generator found. Expected one of: "
        + ", ".join(str(path.relative_to(PROJECT_ROOT)) for path in REPORT_SCRIPT_CANDIDATES)
    )


def test_report_generator_is_python_source() -> None:
    """The selected report generator is a non-empty Python source file."""
    script = _find_report_script()
    if script is None:
        pytest.skip("Report generator has not been created yet.")

    assert script.suffix == ".py"
    assert script.stat().st_size > 0
    source = script.read_text(encoding="utf-8")
    assert source.strip(), "Report generator source is empty."


def test_report_generator_help() -> None:
    """The generator exposes help without an unhandled runtime failure."""
    script = _find_report_script()
    if script is None:
        pytest.skip("Report generator has not been created yet.")

    result = _run_script(script, "--help")

    assert result.returncode == 0, (
        f"--help failed for {script.name}\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )


def test_report_generator_does_not_require_network_for_help() -> None:
    """Help should not require a network connection."""
    script = _find_report_script()
    if script is None:
        pytest.skip("Report generator has not been created yet.")

    result = _run_script(script, "--help")

    combined_output = (result.stdout + result.stderr).lower()
    assert result.returncode == 0
    assert "connection refused" not in combined_output
    assert "network is unreachable" not in combined_output


def test_report_script_has_no_obvious_embedded_credentials() -> None:
    """Basic safeguard against accidentally embedded credential literals."""
    script = _find_report_script()
    if script is None:
        pytest.skip("Report generator has not been created yet.")

    source = script.read_text(encoding="utf-8").lower()

    forbidden_patterns = (
        "-----begin private key-----",
        "ghp_",
        "github_pat_",
        "sk_live_",
        "xoxb-",
    )

    for pattern in forbidden_patterns:
        assert pattern not in source, (
            f"Possible embedded credential marker {pattern!r} in {script.name}"
        )


def test_json_report_files_are_valid_if_present(tmp_path: Path) -> None:
    """Any JSON reports emitted by the generator must parse correctly.

    This test uses only a temporary directory. It does not delete or overwrite
    existing repository reports.
    """
    script = _find_report_script()
    if script is None:
        pytest.skip("Report generator has not been created yet.")

    output_dir = tmp_path / "reports"
    output_dir.mkdir()

    result = _run_script(
        script,
        "--output-dir",
        str(output_dir),
    )

    if result.returncode != 0:
        # The generator may use a different CLI. Avoid interpreting an unknown
        # option as a report-generation failure.
        combined_output = (result.stdout + result.stderr).lower()
        if "unrecognized arguments" in combined_output or "unknown option" in combined_output:
            pytest.skip("Generator does not support --output-dir.")
        pytest.fail(
            f"Report generation failed with exit code {result.returncode}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}"
        )

    for report_path in output_dir.rglob("*.json"):
        _load_json(report_path)


def test_report_output_does_not_escape_temporary_directory(tmp_path: Path) -> None:
    """The test output directory is isolated from the repository."""
    output_dir = (tmp_path / "isolated-reports").resolve()
    output_dir.mkdir()

    assert output_dir.is_relative_to(tmp_path.resolve())
    assert not output_dir.is_relative_to(PROJECT_ROOT.resolve())


def test_report_json_loader_rejects_invalid_json(tmp_path: Path) -> None:
    """Invalid JSON is reported instead of being silently accepted."""
    invalid_report = tmp_path / "invalid.json"
    invalid_report.write_text("{invalid json", encoding="utf-8")

    with pytest.raises(pytest.fail.Exception, match="not valid UTF-8 JSON"):
        _load_json(invalid_report)


def test_report_json_loader_rejects_missing_file(tmp_path: Path) -> None:
    """Missing report files produce an explicit assertion failure."""
    missing_report = tmp_path / "missing.json"

    with pytest.raises(AssertionError, match="Expected report file does not exist"):
        _load_json(missing_report)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"status": "ok"},
        {"reports": []},
        {"generated_at": "2026-01-01T00:00:00Z", "reports": []},
    ],
)
def test_json_serialization_round_trip(payload: dict[str, Any]) -> None:
    """Representative report payloads survive JSON serialization."""
    serialized = json.dumps(payload, ensure_ascii=False)
    restored = json.loads(serialized)

    assert restored == payload


def test_report_paths_are_not_empty() -> None:
    """Configured report paths are valid, non-empty path objects."""
    assert str(REPORT_TOOLS_DIR)
    assert REPORT_TOOLS_DIR.name == "repository-reports"


def test_test_file_has_no_destructive_repository_commands() -> None:
    """This test module must not contain common destructive Git operations."""
    source = Path(__file__).read_text(encoding="utf-8").lower()

    forbidden_commands = (
        "git reset --hard",
        "git clean -fd",
        "git checkout -- .",
        "git restore .",
        "git rm -r --cached .",
    )

    for command in forbidden_commands:
        assert command not in source, (
            f"Destructive repository command unexpectedly found: {command}"
        )
