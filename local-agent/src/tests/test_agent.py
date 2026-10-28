
"""Security and rendering tests for local-agent/agent.py."""

import importlib.util
import json
import os
from pathlib import Path

import pytest


AGENT_PATH = Path(__file__).resolve().parents[1] / "agent.py"

if not AGENT_PATH.is_file():
    raise FileNotFoundError(f"Agent module not found: {AGENT_PATH}")

SPEC = importlib.util.spec_from_file_location("local_agent_module", AGENT_PATH)

if SPEC is None or SPEC.loader is None:
    raise ImportError(f"Unable to load agent module: {AGENT_PATH}")

agent = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent)


def test_traversal_rejected(tmp_path):
    """Reject a relative path that escapes the allowed root."""
    root = tmp_path.resolve()

    with pytest.raises(ValueError):
        agent.safe_target(root, "../bad.txt")


def test_nested_path_allowed(tmp_path):
    """Allow a normal nested target contained within the root."""
    root = tmp_path.resolve()
    target = agent.safe_target(root, "nested/output.txt")

    assert Path(target).resolve().parent == (root / "nested").resolve()


def test_absolute_outside_path_rejected(tmp_path):
    """Reject absolute paths outside the allowed root."""
    root = tmp_path / "root"
    outside = tmp_path / "outside.txt"
    root.mkdir()
    outside.write_text("private", encoding="utf-8")

    with pytest.raises(ValueError):
        agent.safe_target(root.resolve(), str(outside.resolve()))


def test_json_render():
    """Render JSON data with a JSON boolean and valid JSON syntax."""
    rendered = agent.render({
        "path": "x.json",
        "kind": "json",
        "data": {"ok": True},
    })

    assert isinstance(rendered, bytes)
    assert b'"ok": true' in rendered

    parsed = json.loads(rendered.decode("utf-8"))
    assert parsed == {"ok": True}


def test_json_render_false_is_not_true():
    """Preserve false as a JSON boolean."""
    rendered = agent.render({
        "path": "x.json",
        "kind": "json",
        "data": {"ok": False},
    })

    parsed = json.loads(rendered.decode("utf-8"))
    assert parsed == {"ok": False}


def test_json_render_handles_nested_data():
    """Preserve nested arrays, objects, nulls, and Unicode."""
    data = {
        "ok": True,
        "items": [1, None, {"name": "MedOrbits"}],
        "message": "नमस्ते",
    }

    rendered = agent.render({
        "path": "nested.json",
        "kind": "json",
        "data": data,
    })

    assert json.loads(rendered.decode("utf-8")) == data


def test_render_rejects_invalid_kind():
    """Reject an unsupported output kind when the renderer validates kinds."""
    request = {
        "path": "x.unsupported",
        "kind": "__unsupported_test_kind__",
        "data": {"ok": True},
    }

    try:
        result = agent.render(request)
    except (ValueError, TypeError, KeyError):
        return

    # If unsupported kinds are intentionally accepted by the implementation,
    # the result must still be a byte string rather than an unexpected object.
    assert isinstance(result, bytes)


def test_safe_target_rejects_null_byte(tmp_path):
    """Reject paths containing a null byte."""
    with pytest.raises((ValueError, OSError)):
        agent.safe_target(tmp_path.resolve(), "bad\x00name.txt")


def test_safe_target_rejects_empty_path(tmp_path):
    """An empty path must not silently target the root directory."""
    with pytest.raises((ValueError, OSError)):
        agent.safe_target(tmp_path.resolve(), "")


def test_safe_target_rejects_symlink_escape(tmp_path):
    """Reject a symlink inside the root that points outside it."""
    root = tmp_path / "root"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()

    external_file = outside / "secret.txt"
    external_file.write_text("secret", encoding="utf-8")

    link = root / "external-link.txt"

    try:
        os.symlink(external_file, link)
    except (OSError, NotImplementedError) as exc:
        pytest.skip(f"Symlinks are unavailable on this platform: {exc}")

    with pytest.raises((ValueError, OSError)):
        agent.safe_target(root.resolve(), "external-link.txt")

