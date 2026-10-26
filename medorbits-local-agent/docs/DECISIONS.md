# Architecture Decisions — MedOrbits Local Agent

This file records deliberate design decisions. Update it when a decision changes.

## ADR-001: Read-only by default
**Status:** Accepted

The agent inspects files and Git metadata but does not modify the target repository by default. Any future write capability must be opt-in, narrowly scoped, and require explicit confirmation.

## ADR-002: Repository-root boundary
**Status:** Accepted

Every inspected path must resolve inside the selected repository root. Reject path traversal and symbolic-link escapes. Never inspect `.env` contents or credential files.

## ADR-003: No arbitrary command execution
**Status:** Accepted

Do not execute shell commands constructed from repository contents, user-supplied strings, or file contents. Use narrowly defined commands and fixed argument arrays only.

## ADR-004: Keep the agent separate
**Status:** Accepted

The local agent lives in `/medorbits-local-agent/` and does not replace or duplicate the main MedOrbits Express application.

## ADR-005: Reports are local artifacts
**Status:** Accepted

Reports should omit secrets and sensitive file contents. Generated reports are excluded from version control by default.

## ADR-006: Tests before expansion
**Status:** Accepted

New checks must include tests. Destructive operations, automated commits, Git resets, cleanup and deployments are out of scope unless separately designed with safeguards.
