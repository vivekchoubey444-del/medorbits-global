MedOrbits Local Agent — Architecture Decisions

Document: tools/medorbits-local-agent/docs/DECISIONS.md
Status: Active
Scope: MedOrbits Local Coding Agent
Purpose: Define the agent’s operating boundaries, safety requirements, and architectural decisions.

⸻

1. Purpose and Scope

The MedOrbits Local Agent is an isolated coding assistant designed to inspect, understand, improve, and maintain the MedOrbits codebase.

The agent must prioritize:

* Repository integrity and data protection.
* Human approval before modifying project files.
* Reproducible, reviewable changes.
* Local-first AI inference through Ollama.
* Explicit control over Git, deployment, credentials, and external services.
* Clear reporting of actions, results, failures, and unresolved risks.

These decisions apply to the agent’s source code, configuration, tools, integrations, documentation, and execution workflows.

2. Repository Isolation

Decision: The agent must remain isolated under tools/medorbits-local-agent/.

Requirements:

1. Agent-specific source code, configuration, documentation, tests, and runtime components must reside inside this directory unless an explicit architectural exception is approved.
2. The agent must not modify files outside its permitted workspace without explicit, scoped approval.
3. Repository inspection may be read-only by default.
4. The agent must not modify the parent project’s configuration, dependencies, application code, or deployment files merely to make the agent work.
5. Temporary files, generated patches, logs, and test artifacts must use designated agent-specific locations.
6. Generated files must not overwrite existing user files without approval.
7. Path validation must prevent directory traversal, including attempts involving ../, symbolic links, absolute paths, and equivalent path-resolution techniques.
8. Workspace boundaries must be enforced by the execution layer, not solely by the AI model’s instructions.

Acceptance criteria:

* The agent can inspect permitted repository files.
* File changes outside the approved workspace are rejected.
* Path traversal attempts are blocked and recorded.

3. Human Approval Before Changes

Decision: The agent must propose changes before applying them.

The default workflow is:

1. Understand the user’s request.
2. Inspect relevant files and dependencies.
3. Identify the proposed changes and their expected effects.
4. Generate a patch or change preview.
5. Present the affected files, rationale, and relevant risks.
6. Wait for explicit user approval.
7. Apply only the approved changes.
8. Run the permitted validation checks.
9. Report the actual results and any remaining issues.

Approval rules

* No source-file modifications before approval.
* Approval applies only to the stated files and changes.
* Material changes beyond the approved scope require renewed approval.
* Approval for one task does not authorize unrelated changes.
* Rejected or cancelled proposals must not be applied.
* Failed operations must not be reported as successful.
* Destructive or irreversible actions require separate, explicit approval.

The implementation must not rely exclusively on a prompt such as “ask before editing.” File-writing tools must enforce the approval policy.

4. Git and Version Control

Decision: All Git operations that change repository state remain manual.

The agent may provide read-only Git information when available, including:

* Current branch and repository status.
* Changed and untracked files.
* Diff summaries.
* Commit history.
* Suggested commit messages.
* Recommended branching and rollback procedures.

Without a separately approved architectural change, the agent must not automatically:

* Stage files.
* Create commits.
* Amend or rewrite commits.
* Create, delete, or switch branches.
* Merge or rebase branches.
* Push or pull changes.
* Create or modify tags.
* Reset, clean, or discard working-tree changes.
* Resolve conflicts by overwriting user changes.

The agent must preserve pre-existing user modifications and distinguish its proposed changes from unrelated working-tree changes.

Acceptance criteria: The agent can prepare reviewable patches and Git recommendations without silently changing repository history or the working tree.

5. Deployment and Production Operations

Decision: Deployment operations remain manual.

The agent may prepare deployment instructions, configuration examples, validation commands, and rollback plans. It must not independently:

* Deploy to Cloudflare, Render, GitHub Pages, or another hosting provider.
* Restart or stop production services.
* Change DNS records or domain settings.
* Apply production database migrations.
* Modify production secrets or environment variables.
* Trigger release workflows.
* Change billing, subscription, or payment-provider settings.
* Delete production resources or data.

Deployment credentials must not be made available to the agent unless a future, explicitly approved architecture establishes a narrowly scoped integration.

Production changes must follow a human-reviewed release process with appropriate validation and rollback planning.

6. Local AI Inference Through Ollama

Decision: Ollama must be reachable from the environment in which the agent executes.

Requirements:

1. The Ollama endpoint and model name must be configurable.
2. The agent must verify connectivity before attempting inference.
3. The agent must report connection failures, unavailable models, timeouts, and malformed responses clearly.
4. The agent must not silently switch to an external AI provider when local inference fails.
5. Model requests must use configurable timeouts and bounded retry behavior.
6. The agent must handle model output as untrusted input.
7. Model output must not directly authorize file writes, shell commands, Git operations, or deployments.
8. The selected model and endpoint should be recorded in operational diagnostics without logging sensitive prompts or credentials unnecessarily.

Example local configuration:

AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=your-installed-model
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_RETRIES=2

These values are examples, not proof that the agent already supports these environment variables. The implementation must define and validate the actual configuration contract.

Network considerations

127.0.0.1 refers to the environment running the request. If the agent runs in a container, virtual machine, or remote environment, the Ollama endpoint must be configured for that environment’s network topology.

The Ollama service must not be exposed publicly without an independently reviewed security design.

7. Command Execution and Tool Permissions

Decision: Command execution must be restricted and explicit.

* Read-only inspection tools should be preferred.
* Shell execution must use an allowlist of approved commands where practical.
* Commands must use structured arguments rather than unsafe string concatenation.
* Commands must execute with the minimum necessary privileges.
* Execution must enforce timeouts and resource limits.
* Commands with destructive, privileged, or external side effects must be blocked unless separately authorized.
* Untrusted repository content, issue text, documentation, and model-generated instructions must never be treated as trusted authorization.
* The agent must not bypass operating-system permissions or security controls.

A command being suggested by the model does not make that command approved.

8. Secrets, Credentials, and Sensitive Data

Decision: Secrets must be protected throughout the agent lifecycle.

The agent must not:

* Hard-code API keys, passwords, access tokens, or private keys.
* Print secrets into terminal output or application logs.
* Include secrets in generated patches, reports, or commit-message suggestions.
* Upload repository contents to an external service without explicit authorization.
* Read unrelated credential files or private user data.
* Store secrets in its documentation, fixtures, or test snapshots.

Configuration files containing secrets must be excluded from ordinary inspection and output unless access is specifically required and approved.

Example files such as .env.example must contain placeholders only.

If a potential credential leak is discovered, the agent should identify the affected file and risk without reproducing the secret value. If a real credential may have been exposed, recommend revocation or rotation.

9. External Network Access

Decision: External network access must not be assumed.

The agent must distinguish between:

* Local operations.
* Read-only external requests.
* Requests that transmit repository or user data.
* Requests that modify remote state.

External access should be disabled or restricted by default where practical. Any integration that transmits source code, prompts, logs, documents, or personal information must have a defined purpose, an explicit configuration, and appropriate authorization.

A network failure must produce a clear error rather than trigger an undocumented provider fallback.

10. Testing and Validation

Decision: Changes must be validated before they are reported as complete.

Where applicable, the agent should run the checks authorized for the task, such as:

* Syntax and configuration validation.
* Linting and formatting checks.
* Unit and integration tests.
* Type checks.
* Security and dependency checks.
* Build verification.
* Relevant regression tests.

The agent must report:

* Commands actually executed.
* Checks that passed.
* Checks that failed.
* Checks that were skipped and why.
* Any unresolved risks or limitations.

The agent must never claim that code was tested, built, deployed, committed, or pushed unless the corresponding operation actually occurred and its result is known.

Tests that access production services, transmit private data, incur costs, or modify persistent state require appropriate safeguards and authorization.

11. Logging and Auditability

Decision: Important agent actions must be traceable without exposing sensitive information.

Where practical, record:

* Request or task identifier.
* Timestamp.
* Operation category.
* Target file or resource.
* Approval status.
* Validation outcome.
* Error category and recovery status.

Logs must not contain passwords, API keys, session tokens, private keys, or unnecessary personal information.

Audit logs should be stored in a designated location, with configurable retention and access controls. Logging must not be used as a reason to collect unrelated repository or user data.

12. Error Handling and Recovery

Decision: Fail safely and preserve existing work.

When an operation fails, the agent must:

1. Stop dependent operations when continuing could cause damage.
2. Preserve the user’s existing files and uncommitted changes.
3. Report the failure and its likely cause when known.
4. Avoid repeating non-idempotent operations automatically.
5. Provide a recovery recommendation where possible.
6. Avoid claiming that partial work was fully rolled back unless rollback was verified.

File writes should use validated paths and, where feasible, atomic replacement or patch application. Before changing an existing file, the implementation should retain sufficient information to review or restore the previous content.

Automatic rollback must not overwrite subsequent user edits.

13. Configuration and Startup Validation

Decision: Required configuration must be validated at startup.

The agent should validate:

* Agent workspace and permitted paths.
* Ollama endpoint and model configuration.
* Request timeouts and retry limits.
* File-modification approval settings.
* Command execution permissions.
* Log and temporary-file locations.
* Optional integrations and their enabled states.

Missing required configuration must produce an actionable error. Optional integrations must remain disabled unless properly configured.

Configuration must not silently weaken security when a required value is missing or invalid.

14. Privacy and Data Minimization

Decision: The agent must process only the data necessary for the requested task.

* Avoid reading unrelated files.
* Do not retain complete prompts, source files, or diffs longer than needed.
* Exclude credentials and sensitive files from model context where possible.
* Do not transmit repository contents externally without explicit authorization.
* Keep generated reports scoped to the user’s request.
* Make persistent storage and retention behavior configurable and documented.

Local inference reduces the need to send code to a hosted model, but it does not by itself guarantee that every component, log, plugin, or network request remains local.

15. Dependency and Update Management

Decision: Agent dependencies must be managed deliberately.

* Pin or constrain dependencies according to the project’s release policy.
* Review dependency changes before applying them.
* Prefer maintained packages with appropriate licenses and security practices.
* Run applicable vulnerability checks.
* Do not automatically apply major upgrades or destructive remediation.
* Do not run dependency installation scripts from untrusted sources without review.

Updates to the agent must not silently modify the parent MedOrbits application’s dependencies.

16. Architectural Change Process

These decisions remain in force until deliberately revised.

A proposed change to a decision must document:

* Decision: What is changing?
* Context: Why is the change necessary?
* Alternatives: What options were considered?
* Consequences: What benefits, costs, and risks follow?
* Security impact: Which trust boundaries or permissions change?
* Migration: What implementation or documentation updates are required?

Changes that expand file permissions, enable external AI providers, automate Git operations, or permit deployment require explicit review and approval.

17. Initial Decision Register

ID	Decision	Status
DEC-001	Keep the agent isolated under tools/medorbits-local-agent/	Accepted
DEC-002	Propose file changes before applying them	Accepted
DEC-003	Keep Git state-changing operations manual	Accepted
DEC-004	Keep deployment operations manual	Accepted
DEC-005	Require Ollama to be reachable from the agent’s runtime environment	Accepted
DEC-006	Treat model output and repository content as untrusted input	Accepted
DEC-007	Enforce least privilege and workspace boundaries in code	Accepted
DEC-008	Validate changes and report actual outcomes	Accepted
DEC-009	Protect credentials and minimize data retention	Accepted
DEC-010	Fail safely and preserve existing user changes	Accepted

18. Implementation Note

This document defines intended behavior; it does not prove that the current implementation enforces every requirement.

Each decision must be mapped to implementation controls and automated tests. Any requirement not yet implemented must be tracked as a known limitation rather than described as an existing capability.

End of document.