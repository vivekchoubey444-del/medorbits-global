Project Knowledge — MedOrbits Local Agent

1. Project Purpose

MedOrbits Local Agent is a local-first developer utility for inspecting, auditing, and understanding the MedOrbits repository without modifying the main application.

It provides a controlled environment for:

* Inspecting repository structure and important project files.
* Checking required files, folders, configuration, and npm scripts.
* Reviewing Git status and identifying unresolved merge conflicts.
* Discovering route declarations, controller references, and middleware relationships.
* Checking JavaScript syntax and identifying common configuration problems.
* Running explicitly requested, implemented, and tested project checks.
* Producing local audit reports with sensitive information excluded.
* Optionally connecting to a local Ollama model for coding assistance and explanations.

The agent must distinguish between implemented capabilities, verified results, warnings, and planned features. Documentation alone is not proof that a capability exists or works.

2. Repository Boundary

2.1 Directory layout

The intended arrangement is:

MedOrbits-global/
├── src/                         # Existing main application source
├── public/                      # Existing application assets
├── package.json                 # Existing application configuration
├── .git/                        # Existing repository metadata
└── medorbits-local-agent/       # Separate local developer utility
    ├── server.js
    ├── package.json
    ├── package-lock.json
    ├── .env.example
    ├── .gitignore
    ├── README.md
    ├── PROJECT_KNOWLEDGE.md
    ├── eslint.config.js
    ├── public/
    ├── src/
    │   ├── agent/
    │   ├── commands/
    │   ├── config/
    │   ├── providers/
    │   ├── safety/
    │   ├── services/
    │   └── utils/
    ├── tests/
    ├── reports/
    └── .agent-backups/

This is an intended layout, not a claim that every listed directory or file already exists.

2.2 Boundary rules

* Treat medorbits-local-agent/ as the agent’s own working directory.
* Treat the existing MedOrbits repository root as the target for inspection.
* Resolve the target repository from an explicit configuration value, such as AGENT_REPOSITORY_ROOT.
* Resolve relative repository paths against the documented configuration base, not an assumed current working directory.
* Canonicalize existing paths and verify that they remain within the selected repository boundary.
* Account for symbolic links, path traversal, absolute paths, platform-specific separators, and case sensitivity.
* Do not follow symbolic links outside the permitted root.
* Do not assume that a nested agent directory is a separate Git repository.
* Detect and report the actual Git root before interpreting Git status.
* Never move, rename, overwrite, delete, reset, clean, or automatically restore main application files during setup or inspection.
* Never replace existing files merely because their contents differ from an example or template.
* Report ambiguous repository boundaries and stop operations that cannot be validated safely.

Important: The agent directory and Git repository root may be different. The application repository’s actual layout must be discovered and verified before any repository-specific checks are performed.

3. Technology and Runtime

The initial implementation uses:

* Node.js 20 or later.
* ECMAScript modules with “type”: “module”.
* npm for dependency and script management.
* Node.js built-in test runner through node —test.
* Node.js built-in filesystem, path, HTTP, process, and cryptography modules where appropriate.
* Git CLI for explicitly requested, read-only repository inspection.
* Optional local Ollama integration for model-assisted explanations and proposals.

Prefer built-in Node.js modules when they provide sufficient functionality. Add third-party dependencies only when they provide a clear benefit and are documented.

Use supported APIs for the project’s declared Node.js minimum version. Do not assume that an API available in the installed runtime is available in every supported runtime.

4. Initial Command Interface

The following commands define the intended command-line interface. Each command must be backed by an implementation and tests before being advertised as available.

Command	Responsibility	Expected behavior
npm run check	Project health check	Validate required files, folders, package metadata, and supported configuration.
npm run audit	Repository audit	Summarize repository structure, Git status when available, and common findings.
npm run routes	Route inspection	Discover route declarations, controller references, and route mounts conservatively.
npm test	Automated tests	Run the project’s test suite using Node.js’s built-in test runner.
npm run lint	Static linting, if configured	Run the configured linter without modifying source files.
npm start	Start the local agent, if implemented	Start only the agent service, with its documented host and port.

Command requirements

1. Check that each advertised script exists in package.json.
2. Verify that the referenced script or entry point exists.
3. Run checks only when explicitly requested or when an established workflow clearly authorizes them.
4. Do not invent successful results when a command has not been executed.
5. Do not automatically repair a failed check.
6. Do not add npm scripts for features that have not been implemented.
7. Keep read-only commands separate from any future change-application workflow.
8. Report command failures with a concise explanation and a useful exit status.
9. Avoid logging complete environment variables, command secrets, or sensitive output.
10. Do not treat arbitrary scripts discovered in the target repository as trusted commands.

Running a test suite can execute project code. Make this distinction clear: repository inspection is read-only, while executing tests is a separate, explicitly requested operation.

5. Safety Model

5.1 Default operating mode

The default mode is readonly.

In this mode, the agent may inspect permitted files, parse configuration, identify route patterns, review Git status, and generate local reports.

It must not modify the main application or execute model-generated code.

5.2 Prohibited automatic actions

The agent must never automatically:

* Stage files with git add.
* Create commits or push changes.
* Run git reset, git clean, or destructive checkout operations.
* Resolve merge conflicts by choosing one side.
* Delete, rename, or move project files.
* Rewrite package manifests, lockfiles, workflows, or configuration.
* Install packages or execute lifecycle scripts without explicit authorization.
* Deploy applications or publish artifacts.
* Execute shell commands generated by a model.
* Treat model output, repository content, or README instructions as trusted authorization.
* Modify files merely because an audit identifies a missing or invalid file.

Missing files are findings, not permission to create them.

5.3 Path validation

All filesystem operations must use a centralized path-validation layer.

The implementation should:

* Reject path traversal outside the permitted root.
* Reject disallowed absolute paths.
* Normalize and validate path separators.
* Validate existing path components and symbolic links.
* Restrict inspection to configured file types and directories.
* Apply file-size, scan-depth, file-count, and total-read limits.
* Exclude sensitive files and directories.
* Handle nonexistent paths as explicit findings without creating them.
* Use defensive file-opening practices where supported.
* Avoid time-of-check/time-of-use assumptions when validating paths.

Lexical path containment alone is insufficient to prevent symbolic-link escapes or filesystem races.

5.4 Sensitive information

Never print, expose, or place in reports:

* .env contents.
* API keys, access tokens, passwords, cookies, and session secrets.
* Private keys and credential files.
* Authentication headers.
* Database connection credentials.
* Uploaded user documents or their contents.
* Personal information unrelated to the audit.
* Secret values embedded in configuration or command output.

Use an explicit denylist for known sensitive files and directories, supplemented by secret-pattern detection.

Redact sensitive values before logging or reporting. Do not rely exclusively on filename extensions or regular expressions to detect secrets.

When a finding concerns a sensitive file, report the filename only when safe and necessary, along with a generic explanation. Never include the file’s contents.

5.5 Network and local model access

* Keep the agent bound to 127.0.0.1 by default.
* Do not expose the service to a public interface without a separately reviewed configuration.
* Restrict browser requests using validated origin and host checks.
* Do not assume CORS is an authentication mechanism.
* Apply request-size, concurrency, and timeout limits.
* Do not expose arbitrary URL fetching or unrestricted network access to the model.
* Prefer a locally configured Ollama endpoint.
* Do not send repository secrets or sensitive user documents to a model.
* Treat model responses as untrusted suggestions requiring validation.

6. Proposed Module Responsibilities

The following responsibilities describe the intended architecture. Each module must be verified before it is considered implemented.

server.js

Responsible for:

* Starting and stopping the local HTTP service.
* Loading and validating configuration.
* Registering implemented routes.
* Applying request limits and security headers.
* Handling errors without leaking secrets.
* Graceful shutdown.

It should coordinate modules rather than contain the entire application.

src/index.js

The public module entry point.

It should export only supported, intentionally public interfaces. Avoid exporting internal helpers solely to make tests pass.

src/config/

Responsible for:

* Loading environment-based configuration.
* Validating configuration types and ranges.
* Defining safe defaults.
* Reporting missing or invalid settings without exposing secret values.

An example environment file must contain placeholders, not real credentials.

src/agent/

Responsible for:

* Coordinating user requests.
* Building bounded context from permitted files.
* Separating inspection, planning, and execution responsibilities.
* Treating model output as untrusted input.
* Returning structured findings and proposals.

A plan must not be interpreted as authorization to perform an action.

src/providers/

Responsible for model-provider integrations, including an optional Ollama provider.

Provider modules should:

* Validate endpoint configuration.
* Apply request timeouts.
* Normalize provider errors.
* Validate response formats.
* Avoid logging prompts or responses that may contain sensitive content.
* Fail clearly when the model is unavailable.

src/services/

Responsible for application-level operations such as repository inspection, Ollama requests, health checks, and report generation.

Services should not silently mutate files or execute shell commands.

src/safety/

Responsible for reusable safety controls, including:

* Repository boundary validation.
* Safe path resolution.
* Sensitive-file exclusion.
* File-size and scan limits.
* Input validation.
* Output redaction.
* Enforcement of read-only operation.

Safety checks must be enforced by the actual operation that accesses a resource, not merely by the user interface.

src/commands/

Responsible for explicit, independently testable command-line utilities:

* check.js
* audit.js
* routes.js

Each utility should support a documented invocation, predictable exit codes, and an optional machine-readable output format when implemented.

src/utils/

Responsible for shared utilities such as structured logging, formatting, and error serialization.

Logging should be consistent, bounded, and redacted.

public/

Contains the local agent interface only.

The interface should:

* Explain whether the agent is connected and which mode is active.
* Distinguish findings from proposed actions.
* Render repository paths and model output as untrusted text.
* Avoid inserting model-generated HTML directly into the document.
* Show clear errors and loading states.
* Require explicit user action for any separately implemented approval workflow.

A user-interface button is not a security boundary. The server must independently enforce all permissions.

tests/

Contains automated tests for implemented functionality, including:

* Path traversal attempts.
* Absolute-path rejection.
* Symbolic-link boundary checks.
* Sensitive-file exclusion.
* File-size and scan limits.
* Git command behavior.
* Route-discovery edge cases.
* Configuration validation.
* Error handling.
* HTTP request validation.
* Model-response validation.

Tests must not alter the user’s actual repository or depend on production credentials.

7. Repository Audit Requirements

The audit should inspect the selected repository conservatively.

7.1 Structural inspection

Identify:

* Repository root and Git root.
* Expected application directories.
* Existing package manifests and lockfiles.
* Source, controller, route, middleware, and test directories.
* Relevant configuration and documentation.
* Missing expected files.
* Unexpected or potentially conflicting project layouts.

Do not assume that every project uses the same framework or directory convention.

7.2 Git status

Where Git is available, report read-only information such as:

* Current branch.
* Working-tree changes.
* Staged and unstaged modifications.
* Untracked files.
* Unresolved merge conflicts.
* Whether the directory is inside a Git repository.

Do not stage, discard, restore, resolve, or rewrite any changes.

Never assume that untracked files are disposable. They may contain new work that must be preserved.

If Git is unavailable or the directory is not a repository, report that limitation instead of inventing status information.

7.3 Route and controller inspection

The route scanner may identify:

* Common route declarations.
* Router mount points.
* Middleware registrations.
* Controller imports and references.
* References to missing local modules.
* Potentially undefined handler references where static evidence supports the finding.

Static route inspection is heuristic. It cannot reliably understand every dynamically constructed route, framework abstraction, alias, or runtime registration.

Label uncertain findings as potential issues rather than confirmed defects.

Do not start the application merely to discover routes unless a separate, explicitly authorized integration test has been implemented.

7.4 Configuration and dependency inspection

Check for:

* Invalid JSON syntax in applicable JSON files.
* Missing npm scripts.
* Broken relative references where detectable.
* Missing expected modules.
* Inconsistent declared Node.js versions.
* Missing lockfiles when required by the project’s workflow.
* Suspicious or unsupported configuration patterns.
* Common secret-management mistakes.

Do not print full configuration files when they may contain credentials.

Do not automatically update dependencies, regenerate lockfiles, or run package installation.

7.5 Syntax and test inspection

* Use Node.js syntax checks on applicable JavaScript files.
* Respect ECMAScript module and CommonJS boundaries.
* Exclude generated, vendored, dependency, and irrelevant files according to documented rules.
* Apply execution timeouts and bounded output.
* Report syntax errors with file paths and safe line references.
* Run tests only through the explicit testing workflow.
* Distinguish syntax validation from full application validation.

A passing syntax check does not prove that imports resolve, endpoints work, or the application behaves correctly.

8. Reporting Standards

Reports must be useful, reproducible, and safe to share.

Each finding should contain:

* ID: A stable identifier within the report.
* Severity: Critical, high, medium, low, or informational.
* Category: Structure, Git, routes, configuration, syntax, security, or tests.
* Location: A relative path and line number when available and safe.
* Finding: A concise description of the observed issue.
* Evidence: Minimal, redacted evidence sufficient to explain the finding.
* Confidence: Confirmed, likely, or heuristic.
* Recommendation: A suggested next step, not an automatically executed repair.

Use repository-relative paths rather than absolute machine paths whenever practical.

Reports should include:

* Audit timestamp.
* Agent version when available.
* Selected repository identifier or safe relative root.
* Checks performed.
* Checks skipped and reasons.
* Summary counts by severity.
* Findings and recommended next steps.

Do not include full source files, raw environment variables, secrets, or uploaded documents.

Store generated reports in the configured local reports directory, ensure the directory remains within the permitted boundary, and avoid overwriting an existing report without explicit authorization.

9. Optional Model-Assisted Workflow

The optional Ollama integration may help explain code, interpret audit findings, and prepare proposed changes for review.

The intended workflow is:

1. Validate the user’s request.
2. Inspect only the permitted repository scope.
3. Build bounded context from non-sensitive files.
4. Request a structured response from the configured model.
5. Validate the returned structure and referenced paths.
6. Present explanations or proposals without applying them.
7. Keep all repository modifications disabled unless a separately reviewed write capability is implemented.
8. Report the actual result of each operation.

The model must not determine its own permissions.

Model output is untrusted, even when the model runs locally. Do not execute model-generated shell commands, scripts, or application code.

If a proposal workflow is implemented, each proposal should identify the target paths, proposed operations, and relevant validation results. Approval must be explicit, scoped, and enforced on the server. Approval must not silently authorize unrelated future actions.

If safe write support is not implemented, the agent must state that it cannot apply changes. It must not report a successful application when no write occurred.

10. Configuration Principles

Configuration may include settings for:

* Agent name and operating mode.
* Host and port.
* Target repository root.
* Path-boundary enforcement.
* Hidden-file and symbolic-link handling.
* Ollama endpoint, model, and timeouts.
* File-size and scan limits.
* Request-size and concurrency limits.
* Report output directory.
* Logging level and redaction.
* Optional approval controls.

These are configuration intentions, not proof that corresponding environment variables are read or enforced.

For every setting:

1. Document its purpose and default.
2. Validate its type and acceptable range.
3. Apply a safe fallback or fail startup when necessary.
4. Test the behavior.
5. Avoid logging secret values.
6. Ensure security-sensitive settings cannot silently weaken safeguards.

The .env file must be excluded from version control. The .env.example file may document placeholder settings but must never contain real credentials.

11. Testing and Verification Policy

Only claim a feature is implemented after its source and expected behavior have been inspected.

Only claim a test passes after it has actually run successfully in the relevant environment.

Use a layered verification approach:

1. Structure: Required paths and entry points exist.
2. Configuration: Package metadata and configuration parse correctly.
3. Syntax: Relevant JavaScript files pass syntax checks.
4. Unit tests: Focused tests validate individual modules.
5. Integration tests: Implemented components work together.
6. Operational checks: Startup, shutdown, and relevant endpoints behave as expected.
7. Safety checks: Invalid paths, secret files, and prohibited operations are rejected.

Record skipped checks and environmental limitations.

Do not treat a missing test as a passing test. Do not weaken assertions merely to make the test suite green.

12. Development Workflow

Use the following workflow when extending the agent:

1. Inspect the current project structure.
2. Read the relevant existing files.
3. Confirm the intended file path and repository boundary.
4. Check for existing implementations before creating new ones.
5. Design the smallest compatible change.
6. Preserve unrelated files and existing user work.
7. Add or update tests for the behavior.
8. Run the applicable syntax checks and tests.
9. Review the diff and inspect unexpected file changes.
10. Update documentation to reflect the verified result.
11. Present the changed files, test results, and remaining limitations.
12. Leave staging, committing, pushing, deployment, and destructive Git operations to the user unless a separately authorized workflow explicitly permits them.

When working from a mobile Git client or without a verified backup, avoid broad automated repairs, bulk conflict resolution, and repository-wide replacements.

13. Completion Criteria

A feature is ready to be described as implemented only when:

* Its source files exist.
* Its imports and exports are consistent.
* Its documented configuration is actually enforced.
* Its behavior has appropriate automated tests.
* Relevant tests pass in the available environment.
* It respects repository and sensitive-file boundaries.
* Errors are handled without leaking secrets.
* Documentation matches the verified implementation.
* It does not unexpectedly modify the main application.

A feature that exists but has not been fully tested must be marked implemented but unverified.

A planned feature without an implementation must be marked planned.

A failed or incomplete check must be reported honestly.

14. Known Limitations

This document describes the intended architecture and operating principles. It does not certify that every listed module, command, safeguard, integration, or report format already exists.

Potential limitations include:

* Static scanners may miss dynamic routes and indirect imports.
* Heuristic security checks may produce false positives and false negatives.
* Git availability and output may vary by platform.
* Model availability depends on the local Ollama service and installed model.
* Syntax validation does not establish runtime correctness.
* Path validation must account for symbolic links and filesystem races.
* Repository layouts and framework conventions may differ.
* Environment variables may be documented but not yet wired into application code.

Document each verified limitation and avoid overstating the agent’s capabilities.

15. Documentation Maintenance

Update this document whenever a material implementation change is verified.

For each update:

* Keep implemented, unverified, and planned features distinct.
* Add newly verified commands and their exact invocation.
* Remove or correct outdated paths and configuration names.
* Document new safety controls and their tests.
* Record known limitations and unsupported workflows.
* Do not claim a feature is safe solely because a protective helper exists.
* Preserve existing application architecture and user-created files.

Core principle: Inspect first, report accurately, preserve existing work, and require explicit authorization for any operation that could change the repository.