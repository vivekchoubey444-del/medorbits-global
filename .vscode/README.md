MedOrbits — VS Code Workspace

Workspace configuration and developer tooling

Version: 1.0.0
Project: MedOrbits
Purpose: Standardize development, testing, documentation, debugging, and repository maintenance.

⸻

1. Overview

The .vscode/ directory contains shared Visual Studio Code workspace configuration for the MedOrbits repository.

It provides:

* Consistent formatting and editor settings.
* Recommended extensions for Python, HTML, CSS, JavaScript, JSON, YAML, and Markdown.
* Repeatable repository validation and page-generation tasks.
* Python debugging configurations.
* Reusable code snippets and documentation templates.
* A consistent development workflow for contributors.

These configurations are development aids. They do not replace application-level security controls, CI checks, or code review.

2. Directory Structure

.vscode/
├── README.md
├── extensions.json
├── settings.json
├── tasks.json
├── launch.json
├── extensions-recommendations.md
├── markdown.code-snippets
├── html.code-snippets
├── javascript.code-snippets
├── python.code-snippets
├── css.code-snippets
├── json.code-snippets
├── yaml.code-snippets
└── profiles/
    ├── frontend.code-profile
    └── python.code-profile

Optional files should be created only when needed. The workspace can function without the profile files.

3. Configuration Reference

File	Responsibility
extensions.json	Recommended and unwanted extension identifiers
settings.json	Formatting, editor behavior, language tooling, and exclusions
tasks.json	Repeatable repository commands
launch.json	Python debugging configurations
extensions-recommendations.md	Setup instructions and workspace conventions
markdown.code-snippets	Documentation, API, security, and decision-record templates
html.code-snippets	Accessible HTML page templates
javascript.code-snippets	DOM interaction and JSON-fetching templates
python.code-snippets	Python modules, tests, and issue reporting
css.code-snippets	Responsive layouts and premium design sections
json.code-snippets	Schema properties and illustrative API responses
yaml.code-snippets	GitHub Actions workflow starters

4. Prerequisites

Install the following tools as required by your project:

* Visual Studio Code.
* Python 3.10 or later for the repository manager.
* Node.js if JavaScript syntax validation is required.
* Git for version control.
* Pytest and Ruff if Python testing and linting are enabled.
* Prettier and the appropriate VS Code extensions for supported file formatting.

The repository manager itself uses the Python standard library.

Create a Python virtual environment

Linux or macOS:

python3 -m venv .venv
source .venv/bin/activate
python -m pip install —upgrade pip

Windows PowerShell:

py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install —upgrade pip

Install only the development dependencies declared by the repository. Do not assume that every recommended extension or optional Python package is already installed.

5. Getting Started

1. Open the repository root in VS Code.
2. Install the recommended extensions.
3. Select the correct Python interpreter using Python: Select Interpreter.
4. Review settings.json for operating-system-specific paths.
5. Open Terminal → Run Task.
6. Run the repository inspection task.
7. Run validation and page discovery before generating files.

Initial verification

python tools/repository_manager.py inspect
python tools/repository_manager.py validate
python tools/repository_manager.py pages —discover
python tools/repository_manager.py audit-pages

Run commands from the repository root unless a different root is explicitly provided.

6. Available Workspace Tasks

The task names depend on the contents of tasks.json.

Task	Purpose
MedOrbits: Inspect repository	Inventory files by extension
MedOrbits: Validate repository	Check supported source files and local HTML references
MedOrbits: Discover HTML pages	Inspect existing pages and navigation
MedOrbits: Preview page generation	Preview missing-page creation
MedOrbits: Generate missing pages	Create missing pages from the manifest
MedOrbits: Audit pages	Report page completeness and orphaned pages
MedOrbits: Preview asset organization	Preview safe organization proposals
MedOrbits: Python compile check	Check Python compilation
MedOrbits: Run pytest	Run the configured test suite
MedOrbits: Run Ruff	Run Python lint checks

Some tasks require optional tools or directories. Confirm their availability before treating a failed task as an application defect.

7. Page Generation and Updates

The repository manager can generate HTML pages from a page manifest and reuse supported shared assets.

Default manifest:

tools/site-pages.json

Preview page generation:

python tools/repository_manager.py pages

Create the manifest and generate missing pages:

python tools/repository_manager.py pages —apply

Preview replacement of existing pages:

python tools/repository_manager.py pages —update

Apply updates:

python tools/repository_manager.py pages —apply —update

Important: Updating an existing page replaces its HTML with generated template content. A backup is created first, but custom content may not be preserved. Review the generated output and your Git changes before using —update.

Page generation does not automatically retrieve verified live admission data, connect forms to a backend, or supply genuine contact details.

8. Snippet Usage

Open a file matching the snippet’s language, then type its prefix in the editor.

Prefix	Intended use
mo-doc	Technical documentation
mo-readme	Project README
mo-api-doc	API endpoint documentation
mo-changelog	Changelog entry
mo-security	Security advisory
mo-adr	Architecture decision record
mo-tasks	Task and acceptance checklist
mo-html	Accessible HTML page
mo-module	Python module
mo-test	Pytest test
mo-section	Premium CSS section
mo-grid	Responsive CSS grid
mo-fetch	Fetch JSON with HTTP error handling

Snippet content is a starting point. Verify paths, API contracts, security requirements, and project-specific values before committing.

9. Formatting and Quality Standards

* Use UTF-8 encoding and LF line endings.
* Preserve meaningful existing project conventions.
* Format Python with Ruff when configured.
* Format supported web files with Prettier when installed.
* Keep HTML semantic and accessible.
* Use labels for form controls and meaningful alternative text for informative images.
* Validate JSON and YAML after editing.
* Keep generated files and build outputs out of source directories where appropriate.
* Avoid broad automatic rewrites without reviewing the diff.

10. Security and Privacy

* Never store API keys, passwords, tokens, or production credentials in workspace settings.
* Do not commit applicant records, identity documents, or confidential business data.
* Treat external files, downloaded assets, and untrusted repositories as potentially unsafe.
* Do not enable automatic execution of untrusted workspace tasks.
* Review task commands before running them.
* Do not disable workspace trust to bypass security warnings.
* Apply least-privilege permissions to development and deployment credentials.
* Review generated code before deployment.
* Keep production secrets in approved environment or secret-management systems.

Workspace configuration is not a security boundary. Application code and CI pipelines must enforce their own controls.

11. Troubleshooting

Python interpreter not found

Select the correct interpreter and confirm the virtual environment exists.

Formatting does not run

Verify the required formatter extension is installed and selected for the current language.

Repository tasks fail

Run the equivalent command directly in the terminal and inspect its exit status and output.

HTML references are missing

Run repository validation and correct the relevant paths. Remember that root-relative URL behavior can differ between local file previews and deployed hosting.

Page updates replace custom content

Restore from the generated backup or version control, then update the manifest or generation logic before retrying.

Tests cannot be discovered

Confirm the test directory exists, install the declared development dependencies, and check the configured test paths.

12. Maintenance

When adding or changing workspace files:

1. Update this README.
2. Verify JSON syntax for settings.json, tasks.json, and launch.json.
3. Confirm recommended extension identifiers are valid.
4. Check task paths against the current repository structure.
5. Run relevant validation and tests.
6. Review the Git diff before committing.

Keep shared workspace settings portable across supported operating systems.

13. Related Documentation

* Repository README
* Repository Manager
* Pre-commit Configuration
* GitHub Workflows
* Project Documentation

Links should be updated if the repository structure changes.

⸻

Maintainer: MedOrbits
Document status: Workspace documentation template
Last updated: 2026-10-27