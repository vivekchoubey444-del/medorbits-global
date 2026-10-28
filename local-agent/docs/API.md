
# MedOrbits Local Agent API Documentation

**File:** `/local-agent/docs/API.md`  
**Version:** `1.0.0`  
**Status:** API specification  
**Runtime:** Python 3.12+ recommended  
**Integration:** MedOrbits repository tools and local-agent services

—

## 1. Overview

The MedOrbits Local Agent API defines the interface for local automation, repository inspection, file management, validation, backup operations, and task execution.

The API is designed to support modular components that can be integrated without requiring every utility to run as a network service.

**Important:** This document specifies the intended interface. An endpoint or function is not considered implemented until it exists in the corresponding source file and passes its tests.

## 2. Design Principles

- **Local-first:** Run repository operations locally whenever possible.
- **Modular:** Keep API handlers, task runners, validators, and file operations separate.
- **Safe by default:** Validate paths, reject traversal attempts, and avoid destructive actions without explicit authorization.
- **Auditable:** Record task status, execution results, and relevant errors.
- **Recoverable:** Integrate with the agent backup subsystem.
- **Fail independently:** A failed optional task should not prevent unrelated eligible tasks from running.
- **Least privilege:** Restrict filesystem access and subprocess execution.
- **Explicit execution:** Never treat repository content as trusted executable instructions.

## 3. Proposed Directory Structure

```text
local-agent/
├── docs/
│   └── API.md
├── agent-backup/
│   ├── README.md
│   ├── agent-backup.md
│   └── agent-backup.sh
├── api/
│   ├── __init__.py
│   ├── app.py
│   ├── routes.py
│   ├── schemas.py
│   └── errors.py
├── core/
│   ├── __init__.py
│   ├── agent.py
│   ├── task_runner.py
│   └── permissions.py
├── services/
│   ├── __init__.py
│   ├── repository.py
│   ├── backup.py
│   └── validation.py
├── tests/
│   ├── test_api.py
│   ├── test_permissions.py
│   └── test_validation.py
└── config/
    └── agent.example.json
```

This is a proposed structure; create files only where they do not already exist or where an intentional migration is planned.

## 4. API Base and Transport

The default implementation should use an authenticated local HTTP interface if an HTTP API is required.

| Setting | Recommended value |
|—|—|
| Base URL | `http://127.0.0.1:8765/api/v1` |
| Bind address | `127.0.0.1` |
| API prefix | `/api/v1` |
| Content type | `application/json` |
| Character encoding | UTF-8 |
| Authentication | Local access token |
| Default network exposure | Localhost only |

The port and base URL are configuration defaults, not evidence that a server is currently running.

Do not expose the agent to a public interface without authentication, authorization, rate limiting, and a reviewed deployment configuration.

## 5. Common Request and Response Format

### Request

```json
{
  “request_id”: “req-001”,
  “action”: “repository.status”,
  “parameters”: {}
}
```

`request_id` should be unique per request. `action` identifies an explicitly supported operation. `parameters` contains action-specific input.

### Successful response

```json
{
  “ok”: true,
  “request_id”: “req-001”,
  “data”: {},
  “error”: null
}
```

### Error response

```json
{
  “ok”: false,
  “request_id”: “req-001”,
  “data”: null,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The supplied parameters are invalid.”
  }
}
```

Do not expose stack traces, access tokens, environment variables, or secret configuration values in API responses.

## 6. Endpoint Specification

The following endpoints are proposed contracts for implementation.

### 6.1 Health

`GET /api/v1/health`

Purpose: Check whether the local API process is responsive.

Example response:

```json
{
  “ok”: true,
  “data”: {
    “status”: “healthy”,
    “service”: “medorbits-local-agent”
  },
  “error”: null
}
```

Health checks must not expose filesystem listings, credentials, or internal configuration.

### 6.2 Agent Status

`GET /api/v1/agent/status`

Purpose: Retrieve the agent’s operational status.

Suggested fields:

- `status`
- `version`
- `uptime_seconds`
- `active_tasks`
- `last_successful_run`

Return only fields supported by the actual implementation.

### 6.3 Repository Status

`GET /api/v1/repository/status`

Purpose: Inspect basic repository metadata.

Suggested response:

```json
{
  “ok”: true,
  “data”: {
    “repository_detected”: true,
    “git_available”: true,
    “working_tree”: “unknown”
  },
  “error”: null
}
```

The working-tree status must be obtained from a validated repository inspection operation. Do not infer it from directory existence.

### 6.4 Repository Validation

`POST /api/v1/repository/validate`

Purpose: Run approved repository checks.

Example request:

```json
{
  “checks”: [
    “python.syntax”,
    “json.syntax”,
    “javascript.syntax”
  ],
  “continue_on_error”: true
}
```

Requirements:

- Accept only registered check identifiers.
- Validate file extensions and repository boundaries.
- Return individual check results.
- Preserve failures for the final summary.
- Never execute arbitrary code merely because a file was discovered.

Example response:

```json
{
  “ok”: true,
  “data”: {
    “status”: “completed”,
    “checks”: [],
    “passed”: 0,
    “failed”: 0,
    “skipped”: 0
  },
  “error”: null
}
```

An empty `checks` array is illustrative; the implementation should return actual results.

### 6.5 Task Submission

`POST /api/v1/tasks`

Purpose: Submit an approved task to the local task runner.

Example request:

```json
{
  “task_type”: “repository.validate”,
  “parameters”: {
    “scope”: “changed-files”
  }
}
```

Suggested response:

```json
{
  “ok”: true,
  “data”: {
    “task_id”: “task-example”,
    “status”: “queued”
  },
  “error”: null
}
```

Task identifiers must be generated by the application. The example identifier is illustrative.

Requirements:

- Allowlist task types.
- Validate parameters against the task schema.
- Apply execution timeouts and resource limits.
- Persist task status if persistent tracking is supported.
- Do not automatically execute arbitrary shell commands supplied by clients.

### 6.6 Task Status

`GET /api/v1/tasks/{task_id}`

Purpose: Retrieve the state of a submitted task.

Recommended status values:

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `timed_out`

Return `404` for unknown task identifiers and avoid disclosing tasks belonging to unauthorized clients.

### 6.7 Backup Creation

`POST /api/v1/backups`

Purpose: Request an approved backup operation.

Example request:

```json
{
  “scope”: “local-agent”
}
```

Supported scopes should be limited to explicitly implemented values, such as:

- `local-agent`
- `repository`

The handler may invoke the backup service or a validated wrapper around `agent-backup.sh`.

Requirements:

- Resolve the repository root from trusted configuration.
- Restrict backup destinations to approved locations.
- Avoid concurrent backup conflicts.
- Return the actual archive path and verification result only after the operation completes.
- Do not claim that a backup succeeded before the subprocess reports success.

### 6.8 Backup Listing

`GET /api/v1/backups`

Purpose: List archives from the configured backup directory.

Suggested fields:

- Archive filename
- Archive size
- Creation or modification timestamp
- Checksum availability
- Verification status, if verified

Do not allow clients to use this endpoint to list arbitrary filesystem directories.

### 6.9 Backup Verification

`POST /api/v1/backups/verify`

Purpose: Verify one approved archive or all recognized archives.

Example request:

```json
{
  “scope”: “all”
}
```

Verification should include checksum validation where available and archive readability checks.

A checksum alone does not establish the authenticity of an archive if an attacker can modify both the archive and its checksum file.

### 6.10 File Inspection

`POST /api/v1/files/inspect`

Purpose: Inspect metadata for a file inside the permitted repository.

Example request:

```json
{
  “path”: “local-agent/docs/API.md”
}
```

The handler must reject:

- Absolute paths outside the approved root.
- `..` traversal.
- Symlink escapes.
- Device files, sockets, and unsupported file types.
- Requests exceeding configured file-size limits.

File inspection must not automatically execute or interpret the target file as trusted instructions.

## 7. HTTP Status Codes

| Status | Meaning |
|—|—|
| `200` | Request completed successfully |
| `202` | Task accepted for asynchronous execution |
| `400` | Malformed request |
| `401` | Authentication required |
| `403` | Operation not permitted |
| `404` | Resource not found |
| `409` | Conflicting operation |
| `413` | Request or upload too large |
| `422` | Valid JSON but invalid parameters |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal error |
| `503` | Service temporarily unavailable |

Use status codes consistently and do not return `200` for failed operations.

## 8. Security Requirements

### Authentication and authorization

- Use a high-entropy token for authenticated local clients.
- Never hardcode credentials in source code.
- Compare tokens using a suitable constant-time comparison.
- Keep credentials out of logs and error messages.
- Enforce action-level permissions.

### Filesystem security

- Resolve requested paths against a configured root.
- Reject traversal and symlink escapes.
- Use restrictive filesystem permissions.
- Avoid unsafe archive extraction.
- Write generated files atomically when practical.

### Process execution

- Prefer subprocess argument arrays over shell command strings.
- Use fixed executable paths where practical.
- Restrict command names and arguments.
- Apply timeouts and output limits.
- Capture exit codes and stderr safely.
- Do not use `shell=True` with untrusted input.

### Network security

- Bind to localhost by default.
- Apply request-size limits and rate limiting.
- Use HTTPS and an appropriate authentication design if remote access is introduced.
- Validate origins and host headers where relevant.
- Do not treat CORS as authentication.

### Audit logging

Record:

- Request identifier
- Timestamp
- Action identifier
- Outcome
- Duration
- Task identifier, where applicable

Do not log secrets, full environment dumps, or unnecessary personal information.

## 9. Error Codes

| Code | Meaning |
|—|—|
| `VALIDATION_ERROR` | Invalid input or parameters |
| `AUTHENTICATION_REQUIRED` | Missing or invalid credentials |
| `PERMISSION_DENIED` | Action not authorized |
| `RESOURCE_NOT_FOUND` | Requested resource does not exist |
| `PATH_NOT_ALLOWED` | Path is outside the permitted scope |
| `TASK_NOT_FOUND` | Task identifier is unknown |
| `TASK_TIMEOUT` | Task exceeded its execution limit |
| `BACKUP_FAILED` | Backup operation failed |
| `VERIFICATION_FAILED` | Integrity verification failed |
| `CONFLICT` | Operation conflicts with an existing task |
| `INTERNAL_ERROR` | Unexpected internal failure |

Return a stable error code separately from the human-readable message.

## 10. Execution and Failure Isolation

The local agent should distinguish required operations from optional operations.

Recommended workflow:

1. Load and validate configuration.
2. Resolve the permitted repository root.
3. Register supported task handlers.
4. Validate each task before execution.
5. Execute independent eligible tasks.
6. Record each task’s outcome.
7. Continue after recoverable task failures.
8. Stop when a critical security or integrity invariant is violated.
9. Generate a final summary with successes, failures, and skipped tasks.

**Do not override security controls to force progress.** Authentication failures, path violations, corrupted backups, and destructive-operation safeguards must remain enforced.

## 11. Configuration Example

Illustrative configuration for `config/agent.example.json`:

```json
{
  “service”: {
    “name”: “medorbits-local-agent”,
    “version”: “1.0.0”,
    “host”: “127.0.0.1”,
    “port”: 8765
  },
  “repository”: {
    “root”: “.”,
    “allow_external_paths”: false
  },
  “tasks”: {
    “max_concurrent”: 2,
    “default_timeout_seconds”: 300,
    “continue_on_recoverable_error”: true
  },
  “security”: {
    “require_authentication”: true,
    “allow_arbitrary_commands”: false
  },
  “logging”: {
    “level”: “INFO”,
    “redact_secrets”: true
  }
}
```

The configuration is a template, not an active runtime configuration. Validate every field and choose a secure credential-loading mechanism before enabling authentication.

## 12. Testing Requirements

Minimum test coverage should include:

- Valid and invalid request schemas.
- Authentication and authorization failures.
- Path traversal and symlink attacks.
- Unknown task types.
- Task timeouts and subprocess failures.
- Concurrent backup attempts.
- Missing and corrupted checksum files.
- Invalid archive contents.
- Large request rejection.
- Error-response consistency.
- Logging redaction.
- Recovery into a separate destination.

Use temporary directories and isolated fixtures for filesystem and restoration tests. Do not test destructive operations against a production repository.

## 13. Implementation Checklist

- [ ] API application and routing implemented.
- [ ] Request and response schemas validated.
- [ ] Authentication and action permissions implemented.
- [ ] Repository path boundaries enforced.
- [ ] Task registry and execution timeouts implemented.
- [ ] Backup service integrated with `agent-backup.sh`.
- [ ] Archive verification implemented.
- [ ] Audit logging and secret redaction implemented.
- [ ] Unit and integration tests passing.
- [ ] API documentation synchronized with implemented behavior.

## 14. Compatibility Policy

Use `/api/v1` for backward-compatible API contracts.

Changes that remove fields, alter existing semantics, or change required request parameters should be treated as breaking changes and reviewed for a versioned API migration.

## 15. Related Documentation

- `local-agent/agent-backup/README.md`
- `local-agent/agent-backup/agent-backup.md`
- `local-agent/agent-backup/agent-backup.sh`

—

**Document owner:** MedOrbits Local Agent  
**Document status:** Proposed API contract  
**Next step:** Implement the handlers, schemas, authorization checks, and tests before advertising these endpoints as available.
