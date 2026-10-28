MEDORBITS — MASTER REPOSITORY REPAIR, ENFORCEMENT AND EXPANSION

Mission

Audit, repair, consolidate, expand, and validate the entire MedOrbits repository. Resolve genuine errors, unify duplicate instructions, connect every relevant page and asset, and ensure every website folder has a correct parent/child navigation relationship and an appropriate index page.

Work directly with the existing repository. Inspect existing files before changing them. Preserve working functionality, established architecture, branding, content, routes, integrations, and project-specific design requirements.

Do not merely produce a report or a proposed plan. Implement verified corrections, create genuinely required missing files, and deliver a final audit report.

1. Establish the source of truth

1. Detect the actual repository root using Git when available.
2. Inventory all tracked, untracked, hidden, and relevant ignored files without scanning generated dependencies unnecessarily.
3. Read the existing README files, manifests, environment templates, schemas, route declarations, scripts, tests, and folder-level index pages.
4. Identify the existing canonical architecture and reuse it instead of creating a competing structure.
5. Treat actual source files as authoritative; report templates and generated summaries are not proof of completed scans.
6. Preserve user changes and inspect Git status before applying modifications.
7. Record the original state and generate a machine-readable change manifest.

2. Consolidate duplicate instructions and tooling

Audit overlapping scripts and consolidate responsibilities into a documented command interface.

Review at least:

* ENFORCE.sh
* RUN.sh
* TEST.sh
* UPDATE.sh
* APPLY.sh
* repository_manager.py
* medorbits_repo_toolkit.py
* repository_connector.py
* repository_connector_extra.py
* repository_completer.py
* complete_repozitory.py
* repository_guard.py
* repository_autofill.py
* sync_pages_from_reference.py
* duplicate_auditor.py
* tool_factory.py
* build_education_repository.py
* enhance_catalogs.py
* real_data_importer_and_exporter.py
* all other existing repository tools and their documentation

Create one canonical entry point, preferably the existing RUN.sh or an appropriately designed replacement. Keep specialized tools separate when their functions genuinely differ.

Requirements:

* Use one consistent naming convention, command syntax, exit-code policy, logging format, and report directory.
* Remove duplicated checks only after proving equivalent coverage.
* Preserve compatibility wrappers where existing workflows depend on them.
* Correct stale paths, misspelled filenames, missing commands, inconsistent flags, and outdated usage examples.
* Never silently remove a tool merely because another tool looks similar.
* Document each retained tool’s purpose, inputs, outputs, side effects, and safe invocation.

3. Repair errors at their source

Check and fix:

* Python syntax, imports, undefined names, incorrect paths, exception handling, and unsafe file operations.
* Bash syntax, quoting, error propagation, portability, and invalid command references.
* JavaScript syntax, module format, missing imports, undefined variables, and runtime assumptions.
* JSON, YAML, TOML, XML, HTML, CSS, SQL, and applicable schema validity.
* Broken local links, asset references, stylesheet imports, script imports, API paths, and route/controller relationships.
* Invalid configuration, inconsistent dependency versions, missing lockfiles, and incompatible runtime requirements.
* Merge-conflict markers, duplicate IDs, duplicate routes, accidental duplicate files, and inconsistent naming.
* Incorrect documentation, commands that reference nonexistent files, and reports that present placeholder values as actual results.

Never hide errors by disabling checks, changing failing commands to always return success, broadly suppressing exceptions, or inventing successful test results.

4. Use safe and fast repair operations

Prioritize work in this order:

1. Syntax and parsing errors.
2. Missing files, broken paths, invalid imports, and configuration errors.
3. Duplicate instructions and conflicting tool responsibilities.
4. Folder indexes, navigation, page relationships, and asset connections.
5. Tests, accessibility, responsive layout, security, and performance.
6. Documentation, generated reports, and final verification.

Use parallel checks only when they cannot conflict. Serialize modifications to the same files.

Requirements:

* Prefer targeted, minimal patches and atomic writes.
* Create a recoverable backup or Git checkpoint before substantial modifications.
* Never run destructive Git commands such as git reset —hard, git clean -fd, or blanket restore operations.
* Never delete user files, existing caches, reports, or generated content without a specific, justified requirement and approval.
* Do not install or upgrade dependencies automatically without checking compatibility and obtaining authorization when the operation is consequential.
* Keep .env, credentials, private keys, and production secrets out of reports, logs, public pages, and Git.
* Use dry-run mode for broad changes when available.
* Do not overwrite a working file with an empty placeholder, speculative content, or an unverified generated template.

5. Expand the repository correctly

Use existing manifests, routes, references, navigation menus, schemas, tests, and documentation to identify genuinely missing files.

For every missing file:

1. Confirm that the file is required.
2. Determine its intended folder, naming convention, dependencies, and consumers.
3. Create a complete implementation compatible with the existing architecture.
4. Add correct imports, metadata, navigation, validation, and error handling where applicable.
5. Add or update relevant tests and documentation.
6. Verify that the file is referenced correctly and is not a duplicate of an existing implementation.

For HTML pages, preserve the MedOrbits visual system: premium dark navy/teal styling, readable contrast, responsive layouts, accessible navigation, and existing shared CSS/JavaScript conventions. Do not introduce pure-white sections where the established design system prohibits them.

Do not fabricate real-world admissions information, official deadlines, prices, institutional recognition, API credentials, or external data. Clearly identify data that requires verification.

6. Match folders, indexes, and pages

Build a complete folder-to-page relationship inventory.

For every relevant public website directory:

* Identify its intended parent page and child pages.
* Check whether an index.html exists and whether it serves the correct purpose.
* Create a missing index only when appropriate for that directory.
* Do not create public indexes inside private, internal, build, dependency, or sensitive directories.
* Ensure parent indexes link to intended child pages.
* Ensure child pages link back to their parent and relevant category pages.
* Verify breadcrumbs, navigation menus, footer links, canonical URLs, metadata, and relative paths.
* Verify image, font, CSS, JavaScript, PDF, JSON, and other referenced assets.
* Detect orphan pages, dead links, self-links, case-sensitive path mismatches, duplicate canonical URLs, and unintended circular navigation.
* Preserve valid existing routes and deployment conventions.
* Distinguish public pages from internal tools, reports, tests, and administrative endpoints.

Use repository-relative paths in reports. Resolve references according to their actual runtime base; do not assume every relative URL is relative to the repository root.

Do not replace a valid folder-specific index with a generic landing page simply to make every directory look uniform.

7. Validate all relevant file types

Run every available appropriate validator without installing tools automatically.

Minimum checks:

* Python compilation and applicable tests.
* Bash syntax validation.
* JavaScript syntax validation.
* JSON parsing and JSON Schema validation where schemas exist.
* YAML/TOML/XML validation when applicable validators are available.
* HTML validation and local-reference checks.
* CSS parsing or linting when supported.
* API route and controller consistency.
* Dependency and lockfile consistency.
* Secret exposure and environment-file protection.
* Accessibility and responsive-layout checks.
* Link integrity, navigation integrity, and index coverage.
* Build and test scripts already configured in the project.

Clearly distinguish PASS, FAIL, WARN, SKIP, and NOT VERIFIED. A missing optional tool is not proof of a source-code defect.

Do not execute production deployments, live database migrations, destructive scripts, or external write operations as part of routine verification.

8. Fix the current tools archive findings

Specifically:

* Repair repository-reports/unresolved-references-2.json so it parses as valid JSON and explicitly identifies itself as a pending template until a real scan runs.
* Remove the repository-wide __pycache__ deletion from the Python syntax check in ENFORCE.sh. Validation must not delete unrelated directories.
* Check whether tools/check_repository.py exists in the full repository. If it does not, correct the reference in silent-wrapler.sh to the selected canonical checker and update its documentation.
* Reconcile the overlapping repository-management tools without removing distinct capabilities.
* Ensure report counts and timestamps come from actual scan results.
* Review whitespace-fix behavior so files are changed only when requested and modifications can be recovered.
* Verify all command examples, relative paths, flags, and report locations.

9. Generate fresh reports

Write reports under the established repository reporting directory, reusing existing report formats when practical.

Generate:

* summary.json
* file-inventory.json and CSV equivalent where supported
* broken-references.json and CSV equivalent
* unresolved-references.json
* dependency-edges.json and CSV equivalent
* api-routes.json
* conflict-markers.json
* parse-warnings.json
* page-connection-suggestions.json
* duplicate-findings.json
* folder-index-map.json
* repair-manifest.json

Each report must contain appropriate metadata, scan status, actual findings, and limitations. Never overwrite a valid report with an empty template after a failed scan.

10. Final acceptance criteria

The task is complete only when:

1. Every changed source file has passed its applicable syntax or parsing check.
2. All verified critical and high-priority defects are fixed or explicitly documented with a reason they remain unresolved.
3. All broken local references have been fixed or classified with evidence.
4. Relevant public folders have verified index and navigation relationships.
5. Duplicate tools and instructions have a documented canonical ownership model.
6. All available tests and build checks have been run and their actual results recorded.
7. No user changes or sensitive files have been accidentally overwritten or exposed.
8. Generated reports reflect the current repository rather than stale template data.
9. A final summary lists modified, created, preserved, skipped, and unresolved files.
10. The final report includes exact validation commands and their real exit statuses.

Begin by auditing the actual repository and the existing tools. Then apply safe, targeted repairs, expand verified missing files, reconnect pages and indexes, and rerun validation. Do not stop after producing recommendations; complete all safe work that the available repository and environment support.