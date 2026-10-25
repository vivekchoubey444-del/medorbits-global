
# MedOrbits Scripts Directory

**Directory:** `/scripts/`  
**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Runtime:** Node.js 20+  
**Module system:** ECMAScript Modules (ESM)  
**Purpose:** Repository maintenance, validation, quality assurance, automation, and deployment support.

—

## 1. Overview

The `scripts/` directory contains reusable command-line utilities that help maintain the quality, consistency, security, and reliability of the MedOrbits website and backend.

Scripts should be:

- Compatible with the supported Node.js runtime.
- Safe to execute from the project root.
- Explicit about their inputs, outputs, and exit codes.
- Designed to avoid modifying files unless that behavior is documented.
- Suitable for local development and continuous integration (CI).
- Free from hard-coded credentials, API keys, and private environment values.
- Documented with command-line help and meaningful error messages.

## 2. Current validation scripts

### `validate-data.mjs`

Validates JSON data files used by MedOrbits.

**Responsibilities**

- Check JSON syntax.
- Identify malformed or empty data files.
- Apply collection-specific validation rules.
- Detect missing required fields and duplicate identifiers.
- Check common URL, date, array, and numeric field conventions.
- Optionally check references between data records.
- Optionally validate data against JSON Schema files when Ajv is installed.
- Generate a machine-readable validation report.

**Commands**

```bash
node scripts/validate-data.mjs
node scripts/validate-data.mjs —dir assets/data
node scripts/validate-data.mjs —file career/data/jobs.json
node scripts/validate-data.mjs —strict
node scripts/validate-data.mjs —check-references
node scripts/validate-data.mjs —validate-schemas
node scripts/validate-data.mjs —report-json reports/data-validation.json
```

**Important:** The schema-validation option requires Ajv and matching schema files. Reference checking is heuristic and may report legitimate references that cannot be resolved by the available identifier index.

### `validate-html.mjs`

Performs static checks on HTML pages.

**Responsibilities**

- Detect common markup and document-structure problems.
- Find duplicate IDs and suspicious tag structures.
- Check image alternative text and basic accessibility conventions.
- Check page titles, descriptions, character encoding, and viewport metadata.
- Inspect local image, script, stylesheet, and resource paths.
- Optionally check local hyperlinks and HTML fragment targets.
- Flag common link-security concerns.
- Produce a JSON report for CI workflows.

**Commands**

```bash
node scripts/validate-html.mjs
node scripts/validate-html.mjs —dir career
node scripts/validate-html.mjs —file index.html
node scripts/validate-html.mjs —check-links
node scripts/validate-html.mjs —strict
node scripts/validate-html.mjs —report-json reports/html-validation.json
```

**Important:** This is a dependency-free static checker, not a complete HTML5 conformance validator. Use the W3C Nu HTML Checker when standards-level validation is required.

—

## 3. Recommended directory structure

The following is a suggested structure. Add directories and scripts as the corresponding utilities are implemented.

```text
scripts/
├── README.md
├── validate-data.mjs
├── validate-html.mjs
├── validate-css.mjs
├── validate-js.mjs
├── validate-links.mjs
├── validate-schemas.mjs
├── validate-translations.mjs
├── validate-accessibility.mjs
├── validate-security.mjs
├── check-environment.mjs
├── check-routes.mjs
├── check-assets.mjs
├── check-dependencies.mjs
├── generate-sitemap.mjs
├── generate-robots.mjs
├── generate-manifest.mjs
├── build-search-index.mjs
├── optimize-images.mjs
├── clean-build.mjs
├── verify-build.mjs
└── utils/
    ├── filesystem.mjs
    ├── logger.mjs
    ├── paths.mjs
    └── report.mjs
```

This is a planning structure, not a declaration that every listed file already exists. Keep the directory aligned with the scripts actually maintained in the repository.

## 4. Prerequisites

Verify the Node.js runtime and npm installation:

```bash
node —version
npm —version
```

The project requires Node.js 20 or later. Confirm the version used by local development, CI, and the deployment environment.

If the repository uses `package.json`, document script commands there rather than requiring developers to remember long CLI commands.

Example:

```json
{
  “scripts”: {
    “validate:data”: “node scripts/validate-data.mjs”,
    “validate:html”: “node scripts/validate-html.mjs”,
    “validate:html:strict”: “node scripts/validate-html.mjs —strict —check-links”
  }
}
```

Merge these entries into the existing `scripts` object; do not replace unrelated package scripts.

## 5. Running the validators

Run commands from the repository root unless `—root` is explicitly provided.

### Validate JSON data

```bash
npm run validate:data
```

### Validate HTML

```bash
npm run validate:html
```

### Run strict HTML checks

```bash
npm run validate:html:strict
```

### Save reports

```bash
node scripts/validate-data.mjs \
  —report-json reports/data-validation.json

node scripts/validate-html.mjs \
  —check-links \
  —report-json reports/html-validation.json
```

Create the `reports/` directory only if required by the chosen reporting workflow. Generated reports should not contain secrets or sensitive user data.

## 6. Exit codes and automation

Validation scripts should follow a consistent exit-code contract.

| Exit code | Meaning |
|—|—|
| `0` | Validation passed under the selected rules |
| `1` | Validation errors or configured failure conditions were found |
| `2` | Invalid command-line arguments or execution failure |

A successful exit code does not mean every possible quality or security issue has been ruled out. It means the checks implemented by that script passed under the selected options.

Example CI step:

```yaml
- name: Validate JSON data
  run: node scripts/validate-data.mjs —strict

- name: Validate HTML
  run: node scripts/validate-html.mjs —strict —check-links
```

Adjust the commands to the repository’s actual validation requirements. Do not enable strict mode blindly if the project intentionally permits warnings that still need to be reviewed.

## 7. Implementation standards

### Command-line behavior

Every CLI script should:

1. Support `—help` when appropriate.
2. Validate its arguments before doing work.
3. Resolve paths against a documented root.
4. Avoid silently overwriting source files.
5. Print actionable errors and identify the affected file.
6. Return a reliable exit code.
7. Support automation without interactive prompts.

### File-system safety

- Do not traverse symbolic links without a deliberate security review.
- Reject paths that resolve outside the intended project root when appropriate.
- Do not delete or rewrite source files by default.
- Use temporary files and atomic replacement for generated outputs when practical.
- Never treat an inaccessible directory as an empty directory.
- Avoid scanning generated output, dependency directories, or caches unless explicitly requested.

### Security

- Never commit credentials, private keys, access tokens, or production secrets.
- Avoid logging full environment variables.
- Do not execute source files merely to inspect them.
- Do not fetch external URLs unless network access is an explicit feature.
- Treat JSON, HTML, paths, and configuration as untrusted input.
- Review generated files before publishing them.

### Reporting

Where a script supports JSON reports, include:

- Start and finish timestamps.
- A summary of scanned, passed, and failed items.
- Errors and warnings with file paths and line numbers where available.
- The relevant validation options.
- A stable, machine-readable structure.

Do not include credentials, session tokens, personal records, or other sensitive values in reports.

## 8. Testing scripts

For each script, test the following cases where applicable:

- Valid input.
- Invalid syntax.
- Missing input files.
- Empty files.
- Unexpected data types.
- Duplicate identifiers or HTML IDs.
- Broken local references.
- Paths outside the project root.
- Permission errors.
- Large input files.
- Invalid CLI options.
- Report output failures.
- Correct process exit codes.

Test both normal and strict modes. A validator should not report success after failing to inspect the files it was asked to validate.

## 9. Troubleshooting

### No files found

Confirm the current working directory and the supplied path:

```bash
pwd
node scripts/validate-data.mjs —help
node scripts/validate-html.mjs —help
```

### Missing local assets

Check whether the path is relative to the HTML file or the website root. Root-relative paths such as `/assets/example.css` may resolve differently in local file previews and in production hosting.

### JSON Schema validation unavailable

Install Ajv as a development dependency if schema validation is required:

```bash
npm install —save-dev ajv
```

Then ensure that the schema filenames match the data collections being validated.

### Warnings in strict mode

Review each warning before suppressing or changing the data. Strict mode deliberately converts warnings into failures and may reveal conventions that need to be standardized.

### Reports cannot be written

Verify the output path, directory permissions, and whether the report destination is within the configured project root.

## 10. Maintenance checklist

Before merging changes to scripts:

- [ ] Confirm compatibility with Node.js 20+.
- [ ] Test against representative project files.
- [ ] Verify exit codes for pass and failure cases.
- [ ] Confirm that existing source files are not unexpectedly modified.
- [ ] Check path traversal and symlink behavior.
- [ ] Confirm that logs and reports do not expose secrets.
- [ ] Update this README when commands or behavior change.
- [ ] Run relevant scripts in CI before deployment.

## 11. Scope and limitations

These utilities complement, rather than replace:

- Full HTML standards validation.
- Browser-based integration and end-to-end tests.
- Accessibility audits using assistive technology.
- Security testing and dependency auditing.
- Backend API integration tests.
- Production monitoring and deployment health checks.

A passing static validation report is one quality gate in the MedOrbits engineering workflow, not a guarantee that the website is error-free.

—

**Maintainer guidance:** Keep this README synchronized with the scripts that actually exist in the repository. Do not document planned utilities as implemented until their files and tests have been added.
