
# MedOrbits Local Agent

**Version:** 1.1.0  
**Python:** 3.10+  
**Node.js:** 20+ for optional JavaScript utilities  
**Dependencies:** Python standard library for the core agent

The MedOrbits Local Agent provides repository inventory, file validation, security checks, and controlled file generation from a JSON specification.

It is designed to operate locally with safe defaults. It does not automatically install packages, download resources, execute generated code, execute SQL, deploy applications, push Git changes, or modify Git history.

## Features

- Inspect repository structure and report available project files.
- Generate a bounded inventory of repository files.
- Validate JSON syntax and Python source syntax.
- Check HTML for missing local references.
- Plan file-generation operations without writing files.
- Generate files from an explicit JSON specification.
- Skip existing files by default.
- Back up existing files before intentional replacement.
- Restrict file operations to the configured repository root.
- Exclude common dependency directories, caches, and generated outputs.
- Provide command-line error messages and meaningful exit codes.

## Directory structure

```text
local-agent/
├── agent.py
├── package.json
├── package-lock.json
├── pyproject.toml
├── requirements.txt
├── README.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
├── COMMIT.sh
├── config/
│   └── spec.json
├── public/
│   ├── index.html
│   ├── dashboard.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── agent/
│   ├── commands/
│   ├── config/
│   ├── safety/
│   ├── services/
│   └── tests/
└── tools/
    ├── README.md
    ├── repository_manager.py
    ├── repository_connector.py
    ├── compatible_share.js
    ├── validate_repository.py
    ├── security_audit.py
    ├── syntax_check.py
    ├── file_catalog.py
    └── task_runner.py
```

This is a reference layout. Individual optional components must exist before their associated commands can be used.

## Requirements

- Python 3.10 or newer.
- A writable local repository for file-generation operations.
- Node.js 20 or newer only for the optional JavaScript components.
- Git only if you use the Git helper script.

The core Python agent uses only the Python standard library.

## Quick start

Run commands from the repository root.

### 1. Check agent status

```bash
python local-agent/agent.py —root . status
```

### 2. Inspect repository files

```bash
python local-agent/agent.py —root . inventory
```

### 3. Validate repository files

```bash
python local-agent/agent.py —root . validate
```

The validator checks JSON parsing, Python syntax, and selected HTML references. It is not a replacement for the project’s complete test suite.

### 4. Preview file-generation operations

```bash
python local-agent/agent.py \
  —root . \
  plan \
  —spec local-agent/config/spec.json
```

Planning validates the specification and reports proposed actions without writing files.

### 5. Create missing files

```bash
python local-agent/agent.py \
  —root . \
  create \
  —spec local-agent/config/spec.json \
  —dry-run
```

Remove `—dry-run` only after reviewing the proposed changes:

```bash
python local-agent/agent.py \
  —root . \
  create \
  —spec local-agent/config/spec.json
```

### 6. Scaffold files

Scaffolding defaults to preview mode:

```bash
python local-agent/agent.py \
  —root . \
  scaffold \
  —spec local-agent/config/spec.json
```

Apply the proposed operations explicitly:

```bash
python local-agent/agent.py \
  —root . \
  scaffold \
  —spec local-agent/config/spec.json \
  —apply
```

## Command reference

| Command | Purpose |
|—|—|
| `status` | Display agent and repository status. |
| `inventory` | List repository-relative file paths. |
| `validate` | Validate supported file formats and HTML references. |
| `plan —spec FILE` | Preview proposed file-generation operations. |
| `create —spec FILE` | Generate files from a specification. |
| `create —spec FILE —dry-run` | Preview generation without writing. |
| `scaffold —spec FILE` | Preview scaffolding operations. |
| `scaffold —spec FILE —apply` | Apply scaffolding operations. |
| `—force` | Permit replacement of existing files after backup. |

Use `—help` to view available arguments:

```bash
python local-agent/agent.py —help
python local-agent/agent.py create —help
```

## JSON specification

A specification contains a `files` array. Each entry describes a repository-relative path, a supported kind, and either content or structured data.

Example:

```json
{
  “version”: “1.0.0”,
  “files”: [
    {
      “path”: “generated/example.json”,
      “kind”: “json”,
      “data”: {
        “name”: “MedOrbits”,
        “mode”: “safe”
      }
    },
    {
      “path”: “generated/README.md”,
      “kind”: “markdown”,
      “content”: “# Generated documentation\n”
    },
    {
      “path”: “generated/example.py”,
      “kind”: “python”,
      “content”: “def main():\n    return 0\n”
    }
  ]
}
```

Supported kinds:

- `text`
- `json`
- `html`
- `css`
- `js`
- `python`
- `markdown`
- `env`

The current generator supports a maximum of 500 specification entries, a 2 MB specification file, and a 5 MB generated file. Validate all paths and content before applying a specification.

## File replacement and backups

By default, existing files are skipped.

Use `—force` only when replacement is intentional. Existing files are copied to a timestamped directory beneath:

```text
.local-agent/backups/
```

Review backups and generated changes before committing them. Backups are recovery aids, not a substitute for version control.

A multi-file generation is not a transactional operation: if a filesystem error occurs partway through, some earlier files may already have been written.

## Safety model

The agent is intended for controlled local repository work.

- Repository paths must remain inside the selected root.
- Absolute paths and parent-directory traversal are rejected.
- Symbolic-link paths are rejected by the generator.
- Specification entry counts and generated file sizes are bounded.
- Existing files are not replaced without explicit `—force`.
- File generation requires an explicit command and is not automatic.
- The standard agent does not execute generated Python or JavaScript.
- The core agent does not install dependencies or download remote resources.
- The core agent does not execute shell commands or SQL statements.
- The core agent does not deploy applications or push Git commits.
- Secret detection and filename exclusions are safeguards, not guarantees.

Filesystem checks cannot eliminate every race condition caused by another process modifying paths concurrently. Use operating-system permissions and version control for additional protection.

## Dashboard and API

The optional dashboard files are located in `public/`. A working dashboard requires a compatible server and implemented API routes.

The presence of a dashboard or environment template does not mean that the backend endpoints, authentication, task cancellation, persistence, or AI integration are implemented. Verify those components independently before exposing the service.

For local development, bind to loopback by default. Do not expose an agent API publicly without reviewing authentication, authorization, request validation, rate limiting, logging, and network access.

## Development and validation

Optional Python development tools are listed in `requirements.txt` and `pyproject.toml`.

Install development dependencies only when needed:

```bash
python -m pip install -r local-agent/requirements.txt
```

Run the basic validator:

```bash
python local-agent/agent.py —root . validate
```

Run optional tests when the corresponding test suite is present:

```bash
python -m pytest local-agent/src/tests
```

For the optional JavaScript utilities, install the Node.js development dependencies from the directory containing `package.json`, then run ESLint with the project’s configured flat configuration.

## Troubleshooting

### Specification not found

Check the path passed to `—spec`. Relative specification paths are resolved from the current working directory.

### Existing files are skipped

This is expected. Review the plan and use `—force` only when replacement is intentional.

### Missing HTML references

Check whether the referenced file exists and whether its path is correct relative to the HTML file or repository root.

### Invalid JSON

Check commas, quotation marks, brackets, and JSON value types. JSON does not permit comments or trailing commas.

### Permission errors

Check filesystem permissions and whether another process has locked or replaced the target path. Do not bypass operating-system permissions to force a write.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for recorded changes and known limitations.

## License

This software is intended for the MedOrbits project. Refer to the project’s licensing and ownership terms before redistribution.

## Dashboard and API (current implementation)

The supported dashboard is served by `server.js` from `public/index.html`. Start it from this directory:

```bash
npm start
```

Then open `http://127.0.0.1:4173/`. The dashboard polls the implemented API endpoints (`/api/agent/status`, `/config`, `/tasks`) and submits only the four allowlisted read-only operations: `validate`, `audit`, `check`, and `catalog`. It can request cancellation of queued or running tasks and displays the backend-returned task output. It does not use Server-Sent Events.

### Runtime requirements

- Node.js 22 or newer and npm 10 or newer (as declared in `package.json`).
- Python 3.10 or newer, plus any dependencies required by the selected Python utility scripts.
- Run from the extracted `local-agent` directory. By default, the repository root is the parent directory (`MEDORBITS_REPO_ROOT` can override it).

### Network safety

The server binds to `127.0.0.1` by default. Keep it local unless you have placed it behind an authenticated reverse proxy and reviewed the deployment security. Binding to a non-loopback interface requires a strong `API_TOKEN` of at least 32 characters; this dashboard intentionally does not embed or collect that shared secret. Do not expose the raw API directly to the public internet.

### Actual capability boundary

This release performs repository validation, security audit, syntax checking, and file cataloguing through a fixed script allowlist. `MEDORBITS_READ_ONLY` defaults to `true`. The dashboard does not claim to perform AI planning, automatic code generation, file repair, package installation, deployment, Git push, or arbitrary shell execution. The older root-level demonstration screen has been replaced with the API-connected dashboard; opening `index.html` directly as a `file://` page is not supported—use `npm start`.

