# MedOrbits VS Code Workspace

## Purpose

This workspace supports:

- HTML, CSS and JavaScript development.
- Python tooling and repository maintenance.
- JSON, JSON Schema, YAML and OpenAPI authoring.
- Automated tests and debugging.
- Markdown documentation.
- Git-based review and repository security.

## Setup

1. Open the repository root in VS Code.
2. Install the recommended extensions.
3. Select the Python interpreter for the project.
4. Create a virtual environment if required.
5. Run `MedOrbits: Inspect repository`.
6. Run `MedOrbits: Validate repository`.
7. Run `MedOrbits: Discover HTML pages`.

## Safety

- Review diffs before committing.
- Do not store credentials in workspace settings.
- Do not enable automatic source-code rewrites without review.
- Review all generated HTML before publishing.
- Do not commit student documents or production secrets.
- Treat downloaded files and external workspace content as untrusted.

## Formatting

Python formatting and linting use Ruff when installed.
HTML, CSS, JavaScript, JSON and Markdown formatting use Prettier.
YAML validation uses the recommended YAML extension.

Extensions must be installed separately.