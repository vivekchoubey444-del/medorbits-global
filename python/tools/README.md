Updated the README to include repository_scaffolder.py, correct the command-line flags to use standard — syntax, and document the recommended workflow for creating, connecting, and validating repository files safely.

MedOrbits Repository Tools

Directory: python/tools/

A collection of Python utilities for auditing repository integrity, analyzing architecture, mapping dependencies, accessing JSON datasets, and scaffolding missing project files across the MedOrbits codebase.

These tools help identify broken references, inconsistent module relationships, invalid JSON datasets, missing Python imports, duplicate data sources, and potential architectural issues before deployment. The scaffolding utility also creates designated HTML, CSS, JavaScript, and JSON files and integrates explicitly declared frontend references.

1. Directory Structure

python/
└── tools/
    ├── README.md
    ├── repository_integrity.py
    ├── structure_adapter.py
    ├── dependency_binder.py
    ├── data_source_manager.py
    └── repository_scaffolder.py

Generated reports are stored in the repository’s reports/ directory by default, where supported by each tool.

reports/
├── repository-integrity.json
├── repository-integrity.txt
├── structure-adaptation.json
├── adaptation-plan.json
├── dependency-map.json
├── dependency-map.mmd
├── data-catalog.json
└── scaffold-report.json

Reports are generated only when the relevant tools run. Some report paths are configurable.

2. Available Tools

2.1 repository_integrity.py

Audits repository files and references.

Responsibilities

* Detect Python syntax errors.
* Validate JSON syntax.
* Identify broken local HTML, CSS, and JavaScript references.
* Check potential Python import problems.
* Identify missing documentation and expected integration modules.
* Optionally create missing Python package markers.

Run

python python/tools/repository_integrity.py

Create missing package markers:

python python/tools/repository_integrity.py —create-init

Treat warnings as a failed audit:

python python/tools/repository_integrity.py —fail-on-warning

Outputs

* reports/repository-integrity.json
* reports/repository-integrity.txt

2.2 structure_adapter.py

Compares related files and reports potential architectural inconsistencies.

Responsibilities

* Profile Python imports, classes, and functions.
* Extract likely API paths and HTTP route declarations.
* Compare reference and target files.
* Inspect JSON top-level types and keys.
* Group related files by directory and filename.
* Generate a reviewable adaptation plan.

Run

python python/tools/structure_adapter.py

Compare two files:

python python/tools/structure_adapter.py \
  —reference python/integrations/base.py \
  —target python/integrations/registry.py

Generate an adaptation plan:

python python/tools/structure_adapter.py \
  —reference python/integrations/base.py \
  —target python/integrations/registry.py \
  —apply-safe

Outputs

* reports/structure-adaptation.json
* reports/adaptation-plan.json when —apply-safe is used.

Important: —apply-safe creates a reviewable plan. It does not automatically rewrite application source code.

2.3 dependency_binder.py

Maps detected relationships between project files.

Responsibilities

* Analyze Python import relationships.
* Identify potential unresolved local imports.
* Detect potential circular Python imports.
* Inspect frontend asset references.
* Validate JSON files.
* Identify Python modules with no detected incoming dependencies.
* Generate a Mermaid dependency diagram.
* Optionally create missing Python package markers.

Run

python python/tools/dependency_binder.py

Generate a JSON report only:

python python/tools/dependency_binder.py —format json

Generate a Mermaid diagram only:

python python/tools/dependency_binder.py —format mermaid

Create missing package markers:

python python/tools/dependency_binder.py —create-init

Outputs

* reports/dependency-map.json
* reports/dependency-map.mmd

A file with no detected incoming dependency is not necessarily unused. It may be an application entry point, scheduled task, dynamically loaded module, or externally invoked script.

2.4 data_source_manager.py

Provides centralized discovery and access to local JSON datasets.

Responsibilities

* Discover JSON files in assets/data/ and other configured data directories.
* Load dictionaries, lists, and other valid JSON values.
* Track dataset paths, modification times, file sizes, and SHA-256 hashes.
* Detect malformed JSON and ambiguous duplicate dataset names.
* Support explicit dataset aliases.
* Validate required datasets and expected top-level data types.
* Generate a catalog of available datasets.
* Cache loaded datasets and refresh the catalog when requested.
* Read data without modifying the original JSON files.

Run

python python/tools/data_source_manager.py

List discovered datasets:

python python/tools/data_source_manager.py —list

Validate JSON datasets:

python python/tools/data_source_manager.py —validate

Export the dataset catalog:

python python/tools/data_source_manager.py —catalog

Specify a custom repository root:

python python/tools/data_source_manager.py —root .

Output

* reports/data-catalog.json

Default search locations include:

* assets/data/
* assets/
* data/
* datasets/
* python/data/
* config/data/

Additional data directories can be configured with MEDORBITS_DATA_DIRS, using the platform-specific path separator.

Example: Access a dataset from another Python module

from python.tools.data_source_manager import get_manager
data = get_manager()
colleges = data.load(“colleges”)
courses = data.load(“courses”)
jobs = data.load(“jobs”)
faqs = data.load(“faqs”)

If duplicate dataset names exist, specify the intended source:

colleges = data.load(
    “colleges”,
    source=“assets/data/medical/colleges.json”,
)

The selected file must exist and contain valid JSON.

Important: The manager provides a Python interface to local JSON data. Frontend pages, APIs, databases, and external services must explicitly integrate with it or use appropriate adapters. It does not automatically connect every source.

2.5 repository_scaffolder.py

Creates missing project files in designated locations and integrates explicitly declared frontend dependencies.

Responsibilities

* Create missing HTML, CSS, JavaScript, and JSON files.
* Create parent directories when required.
* Preserve the existing directory structure.
* Generate starter templates for supported file types.
* Use manifest-defined content when custom templates are required.
* Add declared stylesheet and JavaScript references to HTML pages.
* Add declared navigation links to HTML pages.
* Avoid replacing existing files by default.
* Back up existing files before explicitly permitted overwrites.
* Validate repository JSON and Python syntax.
* Detect many missing local HTML, CSS, and JavaScript references.
* Produce a machine-readable report of created, modified, skipped, and problematic files.

Important limitations

* It creates files declared in a manifest; it does not infer every missing feature in the whole repository.
* It does not automatically invent API contracts, database schemas, or authentication behavior.
* It cannot guarantee runtime correctness merely because files and references exist.
* Existing application files should not be replaced without reviewing the proposed changes.

Create a scaffold manifest

Create scaffold.json in the repository root:

{
  “files”: [
    {
      “path”: “pages/example.html”,
      “type”: “html”,
      “title”: “Example Page”,
      “description”: “A new MedOrbits page.”,
      “css”: [
        “assets/css/example.css”
      ],
      “js”: [
        “assets/js/example.js”
      ],
      “navigation”: [
        {
          “label”: “Example”,
          “href”: “/pages/example.html”
        }
      ]
    },
    {
      “path”: “assets/css/example.css”,
      “type”: “css”
    },
    {
      “path”: “assets/js/example.js”,
      “type”: “js”
    },
    {
      “path”: “assets/data/example.json”,
      “type”: “json”
    }
  ]
}

Every file path should match the actual project architecture. Replace example paths with the intended destinations.

Preview changes

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json

Without —apply, the tool runs in dry-run mode and does not create or modify project files.

Create missing files and integrate declared references

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json \
  —apply

Generate a report

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json \
  —apply \
  —report reports/scaffold-report.json

Explicitly allow replacement of existing manifest files

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json \
  —apply \
  —overwrite \
  —report reports/scaffold-report.json

Existing files replaced through —overwrite are backed up under .scaffold_backups/.

Do not use —overwrite indiscriminately on production pages. Review the manifest and back up important work before applying changes.

Create files without integrating HTML references

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json \
  —apply \
  —no-integrate

Output

* Optional reports/scaffold-report.json

The report records the execution mode, files created or modified, skipped files, backups, and detected issues.

3. Requirements

* Python 3.10 or later.
* Access to the MedOrbits repository.
* Read permission for project files.
* Write permission for generated reports and any directories being modified.
* No third-party Python packages required by these five tools.

Check the installed Python version:

python —version

Alternatively:

python3 —version

Run all commands from the repository root unless an explicit —root is supplied.

4. Recommended Complete Audit and Repair Workflow

Run the following steps in order.

Step 1 — Audit repository integrity

python python/tools/repository_integrity.py

Review syntax errors, invalid JSON, missing references, and potential import problems.

Step 2 — Map dependencies

python python/tools/dependency_binder.py

Review unresolved imports, possible circular dependencies, frontend references, and unreferenced modules.

Step 3 — Validate and catalog datasets

python python/tools/data_source_manager.py —validate
python python/tools/data_source_manager.py —catalog

Review malformed datasets, duplicate names, source locations, and available data contracts.

Step 4 — Compare architectural conventions

python python/tools/structure_adapter.py \
  —reference python/integrations/base.py \
  —target python/integrations/registry.py

Replace the sample reference and target paths with existing modules that are appropriate for the change being reviewed.

Step 5 — Preview required file creation

Prepare a manifest describing the missing files and their required connections.

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json

Review the proposed changes before applying them.

Step 6 — Create and connect the approved files

python python/tools/repository_scaffolder.py \
  —root . \
  —manifest scaffold.json \
  —apply \
  —report reports/scaffold-report.json

Inspect the report and confirm that each file was created in the intended directory.

Step 7 — Run the audits again

python python/tools/repository_integrity.py
python python/tools/dependency_binder.py
python python/tools/data_source_manager.py —validate

Resolve confirmed issues. A static reference check does not prove that every page loads correctly or that every API request succeeds.

Step 8 — Run project tests

Run the repository’s available unit and integration tests, including the existing test-suite runner where applicable.

For example, if the test suite is discoverable through unittest:

python -m unittest discover -s python/tests -p “test_*.py” -v

Use the project’s actual test configuration if it differs from this example.

Step 9 — Verify runtime behavior

Test the relevant pages and workflows in the intended environment:

* Open each new HTML page.
* Confirm CSS and JavaScript files load.
* Check browser console errors.
* Verify JSON paths and expected data structures.
* Exercise relevant API routes and authentication flows.
* Check database connections where applicable.
* Confirm deployment configuration and environment variables.

5. Repository Safety Rules

* Existing source datasets must not be overwritten by audit tools.
* Missing files must be verified before creation or renaming.
* Imports should be added only when the dependency is genuinely required.
* API endpoints must come from actual application routes or documented contracts.
* Duplicate dataset names must be resolved explicitly rather than silently selecting one.
* API keys, passwords, tokens, and other secrets must not be committed.
* Generated reports should be reviewed before being committed.
* Back up important changes or use version control before applying repairs.
* Do not assume an unreferenced file is unused.
* Do not assume that successful static checks prove runtime correctness.
* Use scaffolding manifests to declare intended file locations and connections.
* Review existing files before allowing any overwrite.
* Do not assume that a generated starter template is a complete production implementation.
* Treat generated dependency maps and adaptation plans as evidence for review, not as definitive architectural truth.

6. What These Tools Do Not Guarantee

Static analysis and local data inspection cannot fully determine:

* Whether an external API is reachable or correctly authenticated.
* Whether a database schema matches application queries.
* Whether an endpoint returns the expected response.
* Whether runtime-loaded plugins are registered correctly.
* Whether dynamically generated imports resolve.
* Whether frontend and backend request/response contracts match.
* Whether a JSON dataset has the correct business meaning or current information.
* Whether every frontend page consumes the intended dataset.
* Whether generated files meet all business requirements.
* Whether every asset path works with the production server’s routing rules.
* Whether the application is operational in its production environment.

Validate these requirements through application-specific integration tests, contract tests, database checks, browser testing, and deployment tests.

7. Version Control

Review changes before committing:

git status —short
git diff —check
git diff

Stage only the intended files:

git add python/tools/
git commit -m “Add repository integrity and data management tools”

If the README is the only file changed, stage it separately:

git add python/tools/README.md

Do not commit generated reports, scaffold backups, or sensitive configuration files unless they are intentionally maintained in version control.

8. Maintenance Guidelines

When adding a new tool:

1. Use a descriptive snake_case.py filename.
2. Document its purpose, supported Python version, and command-line options.
3. Prefer the standard library for repository maintenance utilities.
4. Use clear exit codes for success and failure.
5. Avoid destructive operations by default.
6. Generate actionable findings with filenames and explanations.
7. Keep reports deterministic where possible.
8. Add tests for path resolution, malformed inputs, duplicate datasets, and error handling.
9. Update this README whenever a tool or CLI option changes.
10. Verify compatibility with the project’s supported Python version.
11. Validate generated files after scaffolding.
12. Ensure that integration changes are idempotent where possible.
13. Keep application-specific logic separate from generic repository maintenance.
14. Review backup behavior and filesystem permissions before enabling overwrite operations.

9. Support and Troubleshooting

Repository path issues

Pass the root directory explicitly:

python python/tools/dependency_binder.py —root .

Broken local references

1. Confirm that the referenced file exists.
2. Check capitalization and extensions.
3. Verify whether the path is relative to the source file or repository root.
4. Confirm that the resource is intended to be part of the project.
5. Check whether the path is generated dynamically at runtime.
6. Verify whether the production server uses a different public asset root.

Unresolved Python imports

1. Verify the module’s actual location.
2. Confirm the intended Python import root.
3. Review package and namespace-package conventions.
4. Check the deployment working directory and PYTHONPATH.
5. Run tests in the actual supported environment.

Missing or duplicate datasets

1. Run data_source_manager.py —list.
2. Inspect reports/data-catalog.json.
3. Check the source paths of duplicate dataset names.
4. Use an explicit source argument where necessary.
5. Verify expected data types and required keys against the application’s real schema.

Missing HTML, CSS, JavaScript, or JSON files

1. Confirm the intended path in the project architecture.
2. Add the path and file type to scaffold.json.
3. Declare stylesheet, script, and navigation connections where required.
4. Run the scaffolder without —apply first.
5. Review the proposed file list and warnings.
6. Apply the manifest only after reviewing the changes.
7. Run the integrity and dependency tools again.
8. Test the new page and its data integrations in a browser or application environment.

Existing files were skipped

By default, existing files are preserved.

Inspect the report and confirm whether the existing file should remain unchanged. If replacement is necessary, review the manifest and use —overwrite only after ensuring a backup is appropriate.

Files exist but the website does not work

File creation alone does not implement business logic. Check JavaScript runtime errors, CSS paths, server routing, JSON response formats, API authentication, and backend availability. Add application-specific tests for any behavior that the generic repository tools cannot verify.

10. Summary

MedOrbits Repository Tools provide visibility into repository structure, dependencies, and local JSON datasets while supporting controlled creation and integration of missing frontend files.

Use integrity audits to detect issues, dependency maps to understand relationships, the data manager to locate and validate datasets, the structure adapter to review architectural consistency, and the scaffolder to create explicitly declared files and connections.

Recommended principle: preview, review, apply, audit again, and test at runtime. These tools support verified repairs; they are not a substitute for application-specific testing or review of the actual architecture.

Implementation note: This updates the documentation only. The README assumes that all five Python utilities exist at the listed paths and that their documented CLI options match their actual implementations. Verify those interfaces against the repository before treating this as the final published documentation.