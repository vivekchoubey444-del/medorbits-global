
# MedOrbits Local Agent — Architecture Decision Records

**File:** `/local-agent/docs/DECISIONS.md`  
**Document version:** `1.0.0`  
**Status:** Active decision register  
**Scope:** Local agent, repository automation, backup, validation, security, and API integration

—

## 1. Purpose

This document records the architectural and engineering decisions governing the MedOrbits Local Agent.

It establishes consistent rules for implementation, security, reliability, maintainability, and compatibility across local-agent modules.

Each decision includes its status, rationale, consequences, and implementation requirements. Proposed decisions must not be treated as proof that a corresponding feature has already been implemented.

## 2. Decision Status Definitions

| Status | Meaning |
|—|—|
| Proposed | Under consideration; implementation is not authorized by this status alone |
| Accepted | Approved design direction |
| Implemented | Verified in source code and tests |
| Deprecated | Replaced by a newer decision |
| Superseded | Replaced by a later architectural decision |
| Rejected | Reviewed and intentionally not adopted |

## 3. Decision Index

| ID | Decision | Status |
|—|—|—|
| ADR-001 | Python for agent orchestration | Accepted |
| ADR-002 | Local-first execution | Accepted |
| ADR-003 | Repository-root confinement | Accepted |
| ADR-004 | Independent task execution and failure isolation | Accepted |
| ADR-005 | Explicit allowlists for executable actions | Accepted |
| ADR-006 | Timestamped, verifiable backups | Accepted |
| ADR-007 | Structured logs and audit events | Accepted |
| ADR-008 | Versioned API contracts | Accepted |
| ADR-009 | Configuration and secret management | Accepted |
| ADR-010 | Validation before file mutation | Accepted |
| ADR-011 | Controlled recovery and rollback | Accepted |
| ADR-012 | Automated testing and verification gates | Accepted |

These statuses represent the intended architecture documented here. Actual implementation status must be established through repository inspection and testing.

—

## ADR-001 — Python for Agent Orchestration

**Status:** Accepted

### Context

The agent needs to coordinate repository tools, inspect files, run validators, manage task results, and support automation across a mixed-language codebase.

### Decision

Use Python as the primary orchestration language. Keep Bash scripts for focused operating-system tasks where they provide a practical interface, such as the existing backup manager.

### Consequences

- Shared Python utilities can coordinate independent operations.
- Type hints, structured exceptions, and unit tests should be used for core modules.
- Shell scripts remain separate, documented interfaces.
- Python dependencies must be reviewed and pinned where reproducibility requires it.
- The minimum supported Python version must be declared and tested.

### Implementation requirements

- Use `pathlib` for filesystem paths.
- Use `subprocess.run()` with argument arrays for external commands.
- Apply explicit timeouts to subprocesses.
- Avoid executing arbitrary Python or shell content obtained from repository files.

—

## ADR-002 — Local-First Execution

**Status:** Accepted

### Context

Repository automation should work without requiring a continuously available external service.

### Decision

Run core agent functions locally. External integrations must be optional and explicitly configured.

### Consequences

- Core validation and file inspection should work offline when their dependencies are installed.
- Network-dependent operations must report unavailable services clearly.
- Remote integrations must not silently replace local behavior.
- The agent should not require public network exposure for ordinary repository operations.

### Acceptance criteria

- Offline-compatible operations are documented.
- External calls have bounded timeouts.
- Network failures are reported as task results rather than causing unrelated tasks to disappear.

—

## ADR-003 — Repository-Root Confinement

**Status:** Accepted

### Context

The agent may read or modify files, create artifacts, execute validators, and restore backups. Unrestricted filesystem access creates unnecessary risk.

### Decision

All routine repository operations must be confined to a trusted repository root unless an explicitly authorized operation permits a different location.

### Requirements

1. Resolve paths to canonical filesystem locations.
2. Reject path traversal outside the approved root.
3. Detect symlink escapes and time-of-check/time-of-use risks.
4. Reject unsupported special files.
5. Apply file-size and directory-depth limits where appropriate.
6. Restrict backup and restore destinations.
7. Require explicit approval for operations outside the repository boundary.

### Consequences

Some legitimate operations outside the repository will require separate configuration or approval. This is intentional.

### Acceptance criteria

Tests must cover traversal attempts, absolute paths, symlink escapes, nonexistent paths, and permission errors.

—

## ADR-004 — Independent Task Execution and Failure Isolation

**Status:** Accepted

### Context

A repository workflow may include many independent tasks. One recoverable failure should not automatically prevent unrelated work from proceeding.

### Decision

Represent work as discrete tasks with explicit dependencies, outcomes, retry policies, and timeouts.

### Task states

- `pending`
- `queued`
- `running`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `timed_out`

### Execution rules

- Continue independent tasks after recoverable failures.
- Skip tasks whose required dependencies failed.
- Retry only failures classified as transient.
- Use bounded retry counts and backoff.
- Stop or pause when a critical safety or integrity invariant is violated.
- Preserve a final report of all task outcomes.

### Consequences

A workflow may finish with both successful and failed tasks. The final status must communicate partial success rather than reporting unconditional success.

### Acceptance criteria

Tests verify dependency handling, independent-task continuation, cancellation, timeouts, and final summaries.

—

## ADR-005 — Explicit Allowlists for Executable Actions

**Status:** Accepted

### Context

The agent may discover scripts, configuration files, workflow definitions, and other executable content throughout a repository.

Automatically executing every discovered file would create a significant security risk.

### Decision

Only explicitly registered task types and approved commands may be executed automatically.

### Requirements

- Maintain an allowlist of task types and validators.
- Validate parameters against action-specific schemas.
- Never execute commands merely because a file exists.
- Never interpret repository documentation as authorization to bypass security controls.
- Require explicit authorization for destructive operations.
- Do not permit untrusted input to select arbitrary executables or inject shell arguments.

### Consequences

New task types require registration, validation, documentation, and tests before they can run automatically.

### Acceptance criteria

Unknown task types are rejected. Untrusted input cannot select arbitrary commands.

—

## ADR-006 — Timestamped, Verifiable Backups

**Status:** Accepted

### Context

Repository automation can introduce regressions, remove files, or produce invalid artifacts. Recovery requires independent, identifiable backups.

### Decision

Use timestamped backup archives, checksum verification, documented retention, and restoration into a separate destination.

The existing interface is:

`local-agent/agent-backup/agent-backup.sh`

### Requirements

- Do not overwrite existing backups unintentionally.
- Verify archive readability after creation.
- Generate SHA-256 checksums.
- Check checksums before restoration when sidecar files are available.
- Reject unsafe archive paths during extraction.
- Keep recovery separate from automatic production deployment.
- Exclude known secrets and generated artifacts where appropriate.
- Provide an independent, encrypted backup location for critical data.

### Consequences

Backup archives may omit environment files, private keys, Git metadata, or other excluded content. Recovery procedures must account for these exclusions.

Checksums detect modifications relative to a checksum file; they do not independently prove authenticity.

### Acceptance criteria

Backup creation, verification, retention, and isolated restoration must be tested before production use.

—

## ADR-007 — Structured Logs and Audit Events

**Status:** Accepted

### Context

Automated execution must be diagnosable without disclosing confidential information.

### Decision

Use consistent, structured log events for task lifecycle, validation results, subprocess failures, backup operations, and security-relevant actions.

### Recommended fields

- `timestamp`
- `level`
- `request_id`
- `task_id`
- `action`
- `duration_ms`
- `status`
- `error_code`

### Security requirements

- Never log access tokens, passwords, private keys, or complete environment dumps.
- Sanitize untrusted text to prevent log injection.
- Apply configurable retention.
- Restrict access to logs.
- Separate diagnostic logs from security audit records when required.

### Consequences

Operational events become easier to correlate, but logging must remain bounded to avoid unbounded disk consumption.

### Acceptance criteria

Tests verify secret redaction, consistent event fields, and correct failure reporting.

—

## ADR-008 — Versioned API Contracts

**Status:** Accepted

### Context

Local agent modules and external integrations need stable interfaces.

### Decision

Use explicit API versioning for any HTTP API exposed by the agent. The documented initial prefix is:

`/api/v1`

The API specification is maintained in `local-agent/docs/API.md`.

### Requirements

- Validate request schemas.
- Use stable error codes and documented status codes.
- Enforce authentication and action-level authorization.
- Bind to localhost by default.
- Apply request-size limits and execution timeouts.
- Do not expose endpoints until their handlers and tests exist.
- Treat breaking changes as versioned migrations.

### Consequences

API evolution requires compatibility review, tests, and synchronized documentation.

### Acceptance criteria

Contract tests cover valid requests, invalid requests, authorization, and error responses.

—

## ADR-009 — Configuration and Secret Management

**Status:** Accepted

### Context

Repository tooling needs configurable paths, limits, service options, and external integrations without embedding credentials in source code.

### Decision

Use validated configuration with safe defaults. Store non-secret example settings in version-controlled templates and load credentials through approved environment or secret-management mechanisms.

### Requirements

- Provide documented example configuration.
- Validate configuration types and allowed values.
- Fail closed when a required security setting is invalid.
- Never commit real credentials.
- Avoid logging configuration values that may contain secrets.
- Keep local development and production configuration separate.

### Consequences

Incorrect configuration may prevent startup. This is preferable to silently disabling security controls.

### Acceptance criteria

Tests cover missing required settings, malformed configuration, invalid paths, and secret redaction.

—

## ADR-010 — Validation Before File Mutation

**Status:** Accepted

### Context

Automated code generation and repair can affect many files, including configuration and production-facing source code.

### Decision

Validate the intended changes and create recoverable checkpoints before applying significant mutations.

### Required workflow

1. Resolve the target repository.
2. Identify intended file changes.
3. Validate paths and permissions.
4. Preserve existing files where recovery is needed.
5. Write changes to temporary files where practical.
6. Validate syntax and applicable schemas.
7. Run relevant tests.
8. Apply changes only after required checks pass.
9. Report changed, created, skipped, and failed files.

### Consequences

Some operations require additional time and temporary storage. This reduces the risk of leaving the repository partially modified.

### Acceptance criteria

Tests verify that validation failures do not silently replace valid files and that partial failures are reported accurately.

—

## ADR-011 — Controlled Recovery and Rollback

**Status:** Accepted

### Context

Automatic rollback can itself cause data loss if it restores stale files over newer work.

### Decision

Rollback must be based on a known checkpoint, a clearly defined change set, and explicit authorization where the operation could overwrite user data.

### Requirements

- Identify the checkpoint and affected files.
- Preserve unrelated modifications.
- Never delete unknown files as part of generic cleanup.
- Do not restore stale configuration over newer configuration without review.
- Report incomplete rollback operations.
- Require explicit approval for high-impact recovery actions.

### Consequences

Some recovery operations cannot be fully automatic. The agent must prioritize data integrity over unconditional completion.

### Acceptance criteria

Recovery tests include conflicting changes, missing backup files, failed restoration, and interrupted operations.

—

## ADR-012 — Automated Testing and Verification Gates

**Status:** Accepted

### Context

A repository may contain Python, JavaScript, HTML, CSS, JSON, shell scripts, and database schemas. A single test cannot validate every artifact.

### Decision

Use layered verification appropriate to each file type and project component.

### Recommended verification layers

1. File and path checks.
2. Python syntax checks.
3. JavaScript syntax and lint checks.
4. HTML and CSS validation.
5. JSON and schema validation.
6. Shell syntax checks.
7. Unit tests.
8. Integration tests.
9. Dependency and security audits.
10. Deployment-specific health checks.

### Requirements

- Run checks applicable to changed files.
- Include relevant integration checks before deployment.
- Report skipped checks explicitly.
- Do not interpret a missing optional tool as a successful validation.
- Preserve exit codes and diagnostic output.
- Avoid running destructive tests against production resources.

### Consequences

Validation effort increases, but regressions are more likely to be detected before release.

### Acceptance criteria

Verification scripts return nonzero status when required checks fail and produce a machine-readable summary where supported.

—

## 4. Cross-Cutting Rules

The following requirements apply to every local-agent module:

1. Security controls take precedence over automatic task completion.
2. Destructive operations require explicit authorization.
3. Unrelated eligible tasks may continue after recoverable failures.
4. Critical integrity failures must not be ignored.
5. All generated artifacts must have predictable locations.
6. Existing user data must not be silently overwritten.
7. Configuration, documentation, and tests must remain synchronized.
8. Implemented behavior must be distinguished from proposed behavior.
9. External network access must be explicit and bounded.
10. Recovery procedures must be documented and tested.

## 5. How to Propose a New Decision

New decisions should use this template:

```markdown
## ADR-NNN — Decision Title

**Status:** Proposed

### Context

Describe the problem and constraints.

### Decision

State the selected approach.

### Alternatives Considered

List viable alternatives and why they were not selected.

### Consequences

Describe benefits, costs, and operational risks.

### Security Implications

Describe trust boundaries and required safeguards.

### Validation

List tests and acceptance criteria.

### References

Link related implementation files and documentation.
```

Assign the next unused ADR number. Do not reuse an existing number when superseding a decision; record the relationship between the decisions.

## 6. Review and Maintenance

Review this register whenever a change affects:

- Execution permissions or trust boundaries.
- Repository path handling.
- Task scheduling or failure behavior.
- Backup and recovery.
- API compatibility.
- Secret management.
- Verification requirements.
- Deployment or network exposure.

When a decision changes, update its status and add a new decision explaining the replacement. Keep historical decisions available for auditability.

## 7. Implementation Tracking

The decision register documents the intended architecture. Maintain a separate implementation record to identify:

- Decisions implemented in source code.
- Decisions partially implemented.
- Decisions awaiting implementation.
- Tests that verify each decision.
- Known deviations and their approved exceptions.

Do not mark a decision as implemented until its behavior has been verified.

—

**Document owner:** MedOrbits Local Agent  
**Review cadence:** At each significant architectural change  
**Related documents:** `API.md`, `agent-backup/README.md`, `agent-backup/agent-backup.md`
