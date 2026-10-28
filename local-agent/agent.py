
#!/usr/bin/env python3
"""
MedOrbits Local Agent
=====================

Safe repository manager for inspecting, validating, cataloguing, and generating
files from an explicit JSON specification.

Python: 3.10+
Dependencies: Python standard library only.

Safety:
- Read-only by default.
- No shell execution, network access, package installation, or deployment.
- File generation requires explicit --apply or create without --dry-run.
- Existing files are skipped unless --force is supplied.
- Replacements are backed up under .local-agent/backups/.
- Repository paths and symlinks are checked before file operations.
"""

from __future__ import annotations

import argparse
import ast
import datetime
import html
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

VERSION = "1.1.0"
MAX_SPEC_BYTES = 2_000_000
MAX_FILES_PER_SPEC = 500
MAX_FILE_BYTES = 5_000_000
MAX_INVENTORY_FILES = 100_000

SKIP = {
    ".git", ".hg", ".svn", "node_modules", "vendor", ".venv", "venv",
    "__pycache__", "dist", "build", ".next", ".local-agent",
    "coverage", ".pytest_cache", ".mypy_cache",
}

KINDS = {
    "text", "json", "html", "css", "js", "python", "markdown", "env"
}

SENSITIVE_NAMES = {
    ".env", ".env.local", ".env.production", "credentials.json",
    "secrets.json", "id_rsa", "id_ed25519",
}

TEXT_EXTENSIONS = {
    ".json", ".py", ".html", ".htm", ".js", ".cjs", ".mjs", ".css",
    ".md", ".txt", ".yml", ".yaml", ".toml", ".xml", ".svg", ".sh",
}


class AgentError(ValueError):
    """Raised when an agent operation is invalid or unsafe."""


def safe_root(value: str | Path) -> Path:
    """Resolve and validate the repository root."""
    path = Path(value).expanduser().resolve(strict=True)
    if not path.is_dir():
        raise AgentError(f"Not a repository directory: {path}")
    return path


def safe_target(root: Path, relative: str) -> Path:
    """Resolve a repository-relative path and reject traversal and symlinks."""
    if not isinstance(relative, str) or not relative.strip():
        raise AgentError("A non-empty relative path is required.")

    candidate = Path(relative)

    if candidate.is_absolute():
        raise AgentError(f"Absolute paths are not allowed: {relative}")

    if ".." in candidate.parts:
        raise AgentError(f"Parent-directory traversal is not allowed: {relative}")

    resolved_root = root.resolve(strict=True)
    output = (resolved_root / candidate).resolve(strict=False)

    try:
        output.relative_to(resolved_root)
    except ValueError as exc:
        raise AgentError(f"Path escapes repository root: {relative}") from exc

    current = resolved_root
    for part in candidate.parts:
        current = current / part
        if current.is_symlink():
            raise AgentError(f"Symbolic-link paths are not allowed: {relative}")

    return output


def is_sensitive(path: Path) -> bool:
    """Identify common secret and credential filenames."""
    name = path.name.lower()
    return (
        name in SENSITIVE_NAMES
        or name.startswith(".env.")
        or name.endswith((".pem", ".key", ".p12", ".pfx", ".keystore"))
    )


def load_spec(path: Path) -> dict[str, Any]:
    """Load and validate a bounded JSON generation specification."""
    if not path.is_file():
        raise AgentError(f"Specification file not found: {path}")

    if path.stat().st_size > MAX_SPEC_BYTES:
        raise AgentError("Specification exceeds the maximum allowed size.")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AgentError(f"Could not read valid JSON specification: {exc}") from exc

    if not isinstance(data, dict):
        raise AgentError("Specification must be a JSON object.")

    entries = data.get("files")
    if not isinstance(entries, list):
        raise AgentError("Specification must contain a files array.")

    if len(entries) > MAX_FILES_PER_SPEC:
        raise AgentError(
            f"Specification exceeds {MAX_FILES_PER_SPEC} file entries."
        )

    seen: set[str] = set()

    for item in entries:
        if not isinstance(item, dict):
            raise AgentError("Every specification entry must be an object.")

        relative = item.get("path")
        if not isinstance(relative, str) or not relative.strip():
            raise AgentError("Every entry needs a non-empty string path.")

        # Validate paths now, before planning any writes.
        Path(relative)
        key = relative.replace("\\", "/").casefold()

        if key in seen:
            raise AgentError(f"Duplicate path in specification: {relative}")
        seen.add(key)

        kind = item.get("kind", "text")
        if not isinstance(kind, str) or kind.lower() not in KINDS:
            raise AgentError(f"Unsupported file kind for {relative}: {kind}")

    return data


def render(item: dict[str, Any]) -> bytes:
    """Render one specification item into bounded UTF-8 bytes."""
    relative = item["path"]
    kind = item.get("kind", "text")

    if not isinstance(kind, str):
        raise AgentError(f"Invalid kind for {relative}")

    kind = kind.lower()
    if kind not in KINDS:
        raise AgentError(f"Unsupported kind: {kind}")

    if kind == "json":
        if "data" not in item:
            raise AgentError(f"JSON entry needs a data field: {relative}")
        content = json.dumps(
            item["data"], ensure_ascii=False, indent=2
        ) + "\n"

    elif "content" in item:
        if not isinstance(item["content"], str):
            raise AgentError(f"content must be text: {relative}")
        content = item["content"]

    elif kind == "html":
        data = item.get("data", {})
        if not isinstance(data, dict):
            raise AgentError(f"HTML data must be an object: {relative}")

        title = html.escape(str(data.get(
            "title", Path(relative).stem.replace("-", " ").title()
        )), quote=True)
        description = html.escape(str(data.get(
            "description", "Education and career guidance from MedOrbits."
        )), quote=True)
        css = html.escape(str(data.get(
            "css", "/assets/css/main.css"
        )), quote=True)
        js = html.escape(str(data.get(
            "js", "/assets/js/main.js"
        )), quote=True)

        content = (
            "<!doctype html>\n"
            '<html lang="en">\n'
            "<head>\n"
            '  <meta charset="utf-8">\n'
            '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'  <meta name="description" content="{description}">\n'
            f"  <title>{title}</title>\n"
            f'  <link rel="stylesheet" href="{css}">\n'
            "</head>\n"
            "<body>\n"
            f"  <main><h1>{title}</h1></main>\n"
            f'  <script src="{js}" defer></script>\n'
            "</body>\n"
            "</html>\n"
        )

    else:
        templates = {
            "text": "",
            "markdown": f"# {Path(relative).stem.replace('-', ' ').title()}\n\n",
            "python": (
                '"""Generated Python module."""\n'
                "from __future__ import annotations\n\n"
                "def main() -> int:\n"
                "    return 0\n\n"
                'if __name__ == "__main__":\n'
                "    raise SystemExit(main())\n"
            ),
            "js": '"use strict";\n',
            "css": (
                "/* Generated stylesheet */\n"
                ":root {\n"
                "  color-scheme: dark;\n"
                "}\n"
            ),
            "env": "# Template only; never commit secrets.\n",
        }
        content = templates[kind]

    raw = content.encode("utf-8")
    if len(raw) > MAX_FILE_BYTES:
        raise AgentError(f"Generated output exceeds size limit: {relative}")

    return raw


def atomic_write(path: Path, payload: bytes) -> None:
    """Atomically replace a destination using a temporary file in its directory."""
    path.parent.mkdir(parents=True, exist_ok=True)

    # Revalidate the destination after parent directories have been created.
    fd, temporary = tempfile.mkstemp(
        prefix=".local-agent-", dir=str(path.parent)
    )

    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def backup_existing(root: Path, target: Path) -> Path:
    """Create a timestamped backup for a file that is about to be replaced."""
    relative = target.relative_to(root)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_relative = Path(".local-agent") / "backups" / stamp / relative

    backup = safe_target(root, backup_relative.as_posix())
    backup.parent.mkdir(parents=True, exist_ok=True)

    # Refuse symlink files and re-check after creating the backup directory.
    if target.is_symlink() or not target.is_file():
        raise AgentError(f"Refusing to back up a non-regular file: {relative}")

    backup = safe_target(root, backup_relative.as_posix())
    shutil.copy2(target, backup)
    return backup


def generate(
    root: Path,
    specfile: Path,
    apply: bool = False,
    force: bool = False,
) -> int:
    """Plan or apply a complete specification after validating every entry."""
    spec = load_spec(specfile)
    plan: list[tuple[Path, bytes, str]] = []
    errors: list[str] = []

    for item in spec["files"]:
        try:
            target = safe_target(root, item["path"])

            if is_sensitive(target):
                raise AgentError(
                    "Refusing to generate a file at a sensitive path."
                )

            payload = render(item)

            if target.exists() and not target.is_file():
                raise AgentError("Destination exists but is not a regular file.")

            action = (
                "SKIP" if target.exists() and not force
                else "REPLACE" if target.exists()
                else "CREATE"
            )
            plan.append((target, payload, action))
        except (AgentError, OSError, TypeError, ValueError) as exc:
            errors.append(f"ERROR {item.get('path', '?')}: {exc}")

    for error in errors:
        print(error, file=sys.stderr)

    if errors:
        print("No writes performed: correct the specification first.")
        return 2

    if not apply:
        for target, payload, action in plan:
            relative = target.relative_to(root)
            if action == "SKIP":
                print(f"SKIP {relative} (exists; use --force to replace)")
            else:
                print(f"WOULD_{action} {relative} ({len(payload)} bytes)")
        print(f"{len(plan)} item(s); dry-run only.")
        return 0

    # Check all paths again before the first write. This reduces, but cannot
    # eliminate, races with another process changing filesystem entries.
    try:
        for target, _, action in plan:
            safe_target(root, target.relative_to(root).as_posix())
            if action == "REPLACE" and not target.is_file():
                raise AgentError(f"Replacement target changed: {target}")

        for target, payload, action in plan:
            relative = target.relative_to(root)

            if action == "SKIP":
                print(f"SKIP {relative} (already exists)")
                continue

            safe_target(root, relative.as_posix())

            if action == "REPLACE":
                backup = backup_existing(root, target)
                print(f"BACKUP {backup.relative_to(root)}")

            atomic_write(target, payload)
            print(f"{action} {relative}")

    except (AgentError, OSError, ValueError) as exc:
        print(f"ERROR during generation: {exc}", file=sys.stderr)
        print("Some earlier files may already have been written.")
        return 2

    print(f"{len(plan)} item(s); applied.")
    return 0


def iter_files(root: Path):
    """Yield regular files while excluding generated and dependency directories."""
    yielded = 0

    for current, directories, names in os.walk(root, followlinks=False):
        base = Path(current)
        directories[:] = sorted(
            name for name in directories
            if name not in SKIP and not (base / name).is_symlink()
        )

        for name in sorted(names):
            path = base / name

            if path.is_symlink() or not path.is_file():
                continue

            yield path
            yielded += 1

            if yielded >= MAX_INVENTORY_FILES:
                return


def validate(root: Path) -> int:
    """Validate JSON/Python syntax and check relative HTML references."""
    errors: list[str] = []
    warnings: list[str] = []
    counts = {"JSON": 0, "Python": 0, "HTML": 0}
    reference_pattern = re.compile(
        r"""(?:src|href)\s*=\s*['"]([^'"]+)['"]""", re.IGNORECASE
    )

    for path in iter_files(root):
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue

            relative = path.relative_to(root).as_posix()
            suffix = path.suffix.lower()

            if suffix == ".json":
                counts["JSON"] += 1
                try:
                    json.loads(path.read_text(encoding="utf-8"))
                except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                    errors.append(f"JSON {relative}: {exc}")

            elif suffix == ".py":
                counts["Python"] += 1
                try:
                    ast.parse(
                        path.read_text(encoding="utf-8"),
                        filename=relative,
                    )
                except (OSError, UnicodeError, SyntaxError) as exc:
                    errors.append(f"PYTHON {relative}: {exc}")

            elif suffix in {".html", ".htm"}:
                counts["HTML"] += 1

                try:
                    body = path.read_text(encoding="utf-8")
                except (OSError, UnicodeError) as exc:
                    warnings.append(f"READ {relative}: {exc}")
                    continue

                for reference in reference_pattern.findall(body):
                    if reference.startswith((
                        "http:", "https:", "//", "data:", "mailto:",
                        "tel:", "#", "javascript:"
                    )):
                        if reference.lower().startswith("javascript:"):
                            warnings.append(
                                f"Potential javascript URL in {relative}: "
                                f"{reference[:100]}"
                            )
                        continue

                    local = reference.split("?", 1)[0].split("#", 1)[0]
                    if not local:
                        continue

                    # Root-relative paths are interpreted from the repository
                    # root. Relative paths are interpreted from the HTML file.
                    target = (
                        root / local.lstrip("/")
                        if local.startswith("/")
                        else path.parent / local
                    )

                    try:
                        target.resolve(strict=False).relative_to(root)
                    except ValueError:
                        warnings.append(
                            f"Reference escapes repository in {relative}: "
                            f"{reference}"
                        )
                        continue

                    if not target.exists():
                        warnings.append(
                            f"Missing reference in {relative}: {reference}"
                        )

        except OSError as exc:
            warnings.append(f"READ {path}: {exc}")

    print("Counts:", json.dumps(counts))
    for error in errors:
        print("ERROR", error)
    for warning in warnings:
        print("WARN", warning)

    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


def status(root: Path) -> int:
    """Print repository and local-agent status without modifying files."""
    print(f"MedOrbits Local Agent {VERSION}")
    print(f"Root: {root}")

    for name in (
        "package.json", "requirements.txt", "pyproject.toml", "server.js",
        "index.html", "pages", "assets", "tools", "api", "tests",
        "local-agent",
    ):
        if (root / name).exists():
            print("FOUND", name)

    print("Mode: safe")
    print("No network, installs, deployment, shell tasks, or Git mutations.")
    return 0


def inventory(root: Path) -> int:
    """Print repository-relative file paths."""
    count = 0

    for path in iter_files(root):
        print(path.relative_to(root).as_posix())
        count += 1

    print(f"\n{count} file(s) listed.", file=sys.stderr)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="MedOrbits Local Agent -- safe repository utility."
    )
    parser.add_argument(
        "--root", default=".",
        help="Repository root directory (default: current directory).",
    )

    subparsers = parser.add_subparsers(dest="cmd", required=True)
    subparsers.add_parser("status", help="Show repository status.")
    subparsers.add_parser("validate", help="Validate JSON, Python and HTML.")
    subparsers.add_parser("inventory", help="List repository files.")

    for command in ("plan", "create", "scaffold"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("--spec", required=True)
        if command == "create":
            subparser.add_argument(
                "--dry-run", action="store_true",
                help="Preview only; do not write files.",
            )
            subparser.add_argument("--force", action="store_true")
        elif command == "scaffold":
            subparser.add_argument(
                "--apply", action="store_true",
                help="Apply the scaffold. Default is preview only.",
            )
            subparser.add_argument("--force", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        root = safe_root(args.root)

        if args.cmd == "status":
            return status(root)

        if args.cmd == "validate":
            return validate(root)

        if args.cmd == "inventory":
            return inventory(root)

        specfile = Path(args.spec).expanduser().resolve(strict=True)

        if args.cmd == "plan":
            return generate(root, specfile, apply=False)

        if args.cmd == "create":
            return generate(
                root,
                specfile,
                apply=not args.dry_run,
                force=args.force,
            )

        if args.cmd == "scaffold":
            return generate(
                root,
                specfile,
                apply=args.apply,
                force=args.force,
            )

    except (AgentError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
