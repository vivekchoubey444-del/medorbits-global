
# MedOrbits — Repository Reports

**Directory:** `/tools/repository-reports/`  
**Project:** MedOrbits  
**Documentation Version:** 1.0.0  
**Report Format:** JSON and CSV  
**Default Mode:** Read-only  
**Status:** Repository scan required

—

## 1. Purpose

The `repository-reports` directory contains structured reports used to inspect, validate, understand, and maintain the MedOrbits codebase.

These reports help identify:

- Missing files and directories.
- Broken internal references and navigation links.
- Invalid imports and unresolved dependencies.
- JavaScript, Python, JSON, HTML, CSS, YAML, and shell parsing issues.
- Duplicate files, configurations, and code patterns.
- Git conflict markers.
- Dependency relationships and potential cycles.
- Sensitive files and credential exposure risks.
- Page connections and navigation opportunities.
- Proposed repairs and their validation status.

The reports are designed to support repository-wide analysis without unnecessarily changing existing application files.

## 2. Directory Structure

```text
tools/
└── repository-reports/
    ├── README.md
    │
    ├── api-routes.json
    ├── broken-references.csv
    ├── broken-references.json
    ├── conflict-markers.json
    │
    ├── dependency-edges.csv
    ├── dependency-edges.json
    ├── duplicate-findings.json
    │
    ├── file-inventory.csv
    ├── file-inventory.json
    ├── folder-index-map.json
    │
    ├── page-connection-suggestions.csv
    ├── page-connection-suggestions.json
    │
    ├── parse-warnings.csv
    ├── parse-warnings.json
    │
    ├── references.csv
    ├── references.json
    ├── reference-graph.json
    │
    ├── repair-manifest.csv
    ├── repair-manifest.json
    ├── repair-plan.json
    ├── repair-history.json
    │
    ├── sensitive-file-review.csv
    ├── sensitive-file-review.json
    │
    ├── unresolved-references.json
    ├── summary.json
    │
    ├── backups/
    │
    ├── evidence/
    │   └── sensitive-files/
    │
    ├── logs/
    │
    └── patches/
        └── parse-warnings/
```

**Important:** This structure describes the intended report layout. Create optional directories and files only when the corresponding scanner or workflow requires them.

## 3. Report Catalogue

| Report | Purpose |
|—|—|
| `summary.json` | Central repository health summary |
| `api-routes.json` | API route inventory and relationships |
| `references.json` | Central reference inventory |
| `references.csv` | Spreadsheet-friendly reference inventory |
| `reference-graph.json` | Reference relationship graph |
| `broken-references.json` | Broken paths, imports, and links |
| `broken-references.csv` | Tabular broken-reference findings |
| `unresolved-references.json` | References that could not be resolved |
| `conflict-markers.json` | Git merge conflict marker findings |
| `dependency-edges.json` | Dependency graph and relationships |
| `dependency-edges.csv` | Tabular dependency relationships |
| `duplicate-findings.json` | Duplicate file and code findings |
| `file-inventory.json` | Repository file inventory |
| `file-inventory.csv` | Tabular file inventory |
| `folder-index-map.json` | Repository directory map |
| `page-connection-suggestions.json` | Website navigation recommendations |
| `page-connection-suggestions.csv` | Tabular page connection suggestions |
| `parse-warnings.json` | Parsing and syntax findings |
| `parse-warnings.csv` | Tabular parsing findings |
| `repair-manifest.json` | Controlled repair authorization and execution manifest |
| `repair-manifest.csv` | Tabular repair register |
| `repair-plan.json` | Proposed repair sequence |
| `repair-history.json` | Historical repair records |
| `sensitive-file-review.json` | Sensitive file and credential review |
| `sensitive-file-review.csv` | Tabular sensitive-file findings |

A report must not be treated as complete merely because its file exists.

## 4. Report Lifecycle

Every generated report should follow this lifecycle:

1. **Initialize:** Create the report using the documented structure.
2. **Discover:** Scan the relevant repository files.
3. **Collect:** Record findings with source locations and evidence.
4. **Classify:** Assign severity, category, and confidence.
5. **Validate:** Confirm findings against actual repository contents.
6. **Review:** Identify false positives and unresolved items.
7. **Report:** Update the JSON and CSV outputs.
8. **Integrate:** Update the central summary.
9. **Archive:** Preserve previous scan results when appropriate.

Recommended status values:

| Status | Meaning |
|—|—|
| `not-scanned` | No scan has been performed |
| `scanning` | Scan is currently running |
| `completed` | Scan completed successfully |
| `completed-with-warnings` | Scan completed with warnings |
| `failed` | Scanner failed |
| `requires-review` | Manual review is necessary |
| `baseline` | Initial template or baseline report |

## 5. Severity Classification

Use consistent severity levels across reports.

| Severity | Meaning |
|—|—|
| Critical | Severe security exposure or application-blocking defect |
| High | Major functionality, security, or configuration problem |
| Medium | Significant reliability or maintainability issue |
| Low | Minor non-blocking issue |
| Info | Informational observation |

Severity must be based on evidence, not assumptions.

## 6. JSON Report Standards

Every JSON report should contain, where applicable:

- `reportType`
- `reportVersion`
- `project`
- `reportPath`
- `metadata`
- `summary`
- `scanConfiguration`
- `findings`
- `scanErrors`
- `integration`
- `outputs`
- `exitPolicy`

Recommended metadata:

```json
{
  “status”: “not-scanned”,
  “generatedAt”: null,
  “lastScannedAt”: null,
  “verifiedAgainstRepository”: false,
  “readOnly”: true
}
```

Use `null` for unknown values rather than inventing data.

Use empty arrays for collections that have not yet been populated.

Do not report zero defects as proof of a healthy repository unless the scan actually ran and completed.

## 7. CSV Report Standards

CSV files should:

- Use UTF-8 encoding.
- Include a header row.
- Use consistent column names.
- Quote values containing commas, quotation marks, or line breaks.
- Represent missing values as empty fields.
- Avoid storing passwords, tokens, or other secrets.
- Match the corresponding JSON report records.

Suggested standard columns:

```csv
id,type,severity,status,source_file,line,target,description,evidence,verified_at
```

Individual reports may use more specific columns where necessary.

## 8. Repository Scan Coverage

The scanner should inspect relevant source and configuration files.

### JavaScript and Node.js

- `.js`
- `.mjs`
- `.cjs`
- `.json`

Checks:

- Syntax validity.
- Module imports.
- Package dependencies.
- API route references.
- Configuration loading.
- Environment variable references.

### Python

- `.py`
- `.toml`
- `.ini`

Checks:

- Python syntax.
- Local imports.
- Dependency declarations.
- Configuration validity.
- Test and lint compatibility.

### Frontend

- `.html`
- `.css`
- `.js`
- `.json`

Checks:

- Navigation references.
- Asset paths.
- CSS imports.
- Image and font references.
- Form actions.
- API integration.

### Infrastructure

- `.yml`
- `.yaml`
- `.sh`
- `.toml`
- `.xml`

Checks:

- Workflow syntax.
- Shell syntax.
- Configuration validity.
- Deployment references.
- Environment configuration.

### Database

Check relevant:

- SQL files.
- Migration scripts.
- Schema definitions.
- Models.
- Database configuration.
- Application queries.

Do not execute migrations during a repository report scan.

## 9. Sensitive File Protection

Sensitive file review is mandatory before any broad repair or public release.

The scanner should look for:

- `.env` files.
- API keys and access tokens.
- Private keys and certificates.
- Database credentials.
- Personal application documents.
- Student and applicant records.
- Payment credentials.
- Production configuration.
- Database backups.

Security rules:

1. Never print secret values in terminal output.
2. Never place credentials inside JSON or CSV reports.
3. Never upload private files to external scanning services without authorization.
4. Never automatically delete sensitive files.
5. Never assume `.gitignore` removes files from Git history.
6. Require credential rotation when a real production secret is confirmed exposed.
7. Review public directory exposure separately from Git tracking.

## 10. Repair Manifest and Approval

All modifications discovered through reports must be managed through:

`/tools/repository-reports/repair-manifest.json`

The repair workflow must:

1. Identify a confirmed finding.
2. Create a repair proposal.
3. Identify affected files.
4. Generate a reviewable diff.
5. Obtain explicit approval.
6. Back up affected files.
7. Apply only the approved change.
8. Run relevant validation.
9. Record checksums and execution results.
10. Preserve rollback information.

### Repair restrictions

Do not automatically:

- Delete source files.
- Overwrite user-created content.
- Rewrite Git history.
- Modify production database records.
- Replace credentials.
- Regenerate lockfiles without approval.
- Rewrite database migrations.
- Change deployment settings without approval.

Force mode may continue independent repair tasks after an error. It must never bypass approval or security restrictions.

## 11. Offline and Online Operation

### Offline mode

Offline scans should use locally available tools.

Permitted:

- File inventory.
- JSON validation.
- Syntax checks.
- Local reference resolution.
- Dependency graph generation.
- Git status inspection.
- Local security-pattern detection.

Not available without local resources:

- External URL verification.
- Remote package metadata.
- Online vulnerability database checks.
- External API availability checks.

The scanner must report unavailable checks instead of silently marking them successful.

### Online mode

Online checks require explicit network permission.

Permitted only when authorized:

- External URL validation.
- Package registry metadata checks.
- Remote service availability checks.
- Approved vulnerability database lookups.

Never transmit secrets or private applicant data during online scans.

## 12. Suggested Validation Commands

Run commands from the repository root.

### JSON validation

```bash
find tools/repository-reports -type f -name ‘*.json’ \
  -print0 | while IFS= read -r -d ‘’ file; do
    echo “Checking: $file”
    python -m json.tool “$file” >/dev/null || exit 1
  done
```

### JavaScript syntax validation

```bash
find . \
  -path ‘./node_modules’ -prune -o \
  -path ‘./.git’ -prune -o \
  -type f \( -name ‘*.js’ -o -name ‘*.mjs’ -o -name ‘*.cjs’ \) \
  -print0 | while IFS= read -r -d ‘’ file; do
    echo “Checking: $file”
    node —check “$file” || exit 1
  done
```

### Python syntax validation

```bash
python -m compileall -q .
```

### Shell syntax validation

```bash
find . -type f -name ‘*.sh’ \
  -not -path ‘./node_modules/*’ \
  -not -path ‘./.git/*’ \
  -print0 | while IFS= read -r -d ‘’ file; do
    echo “Checking: $file”
    bash -n “$file” || exit 1
  done
```

These are example validation commands. They do not replace the repository’s complete test suite.

## 13. Recommended Scan Order

Use the following order to reduce incorrect conclusions:

1. File inventory.
2. Folder index map.
3. Parse warnings.
4. Conflict markers.
5. Sensitive file review.
6. References.
7. Broken references.
8. Unresolved references.
9. API routes.
10. Dependency edges.
11. Duplicate findings.
12. Page connection suggestions.
13. Repository summary.
14. Repair manifest.

The repair workflow should start only after findings have been reviewed.

## 14. Report Integrity

Every report generator should:

- Write valid JSON or CSV.
- Preserve previous reports when configured.
- Record scan timestamps.
- Record scanner errors.
- Distinguish missing data from zero findings.
- Avoid overwriting reports with incomplete output.
- Use temporary output files before replacing existing reports.
- Verify output integrity after writing.
- Avoid modifying application source files during scanning.

Recommended output procedure:

```text
1. Generate temporary report.
2. Validate temporary report.
3. Compare with existing report.
4. Write final report.
5. Verify final report.
6. Record scan result.
```

## 15. Integration with Other Repository Tools

The report directory may be integrated with:

- `/tools/RUN.sh`
- `/tools/TEST.sh`
- `/tools/`
- `/.github/workflows/`
- `/scripts/`
- `/node/`
- `/tests/`

Integration must be based on files and commands that actually exist.

Do not assume a scanner, workflow, script, or report generator is implemented merely because it appears in this documentation.

## 16. Completion Criteria

A repository scan is considered complete only when:

- All eligible files have been scanned or explicitly recorded as skipped.
- Parsing checks have completed.
- Reference checks have completed.
- Sensitive-file checks have completed.
- Scan errors have been recorded.
- Findings have been classified.
- Summary metrics have been updated.
- Report outputs have passed format validation.
- Unresolved critical findings have been clearly reported.

A successful scan does not automatically authorize repairs.

## 17. Final Policy

The repository reports are diagnostic and audit artifacts.

**Primary objectives:**

- Accuracy over assumed success.
- Evidence over guesses.
- Safe repairs over blind replacements.
- Complete reporting over silent failures.
- Security over convenience.
- Compatibility over unnecessary redesign.
- Preservation of existing MedOrbits functionality and structure.

All report generators must preserve the original repository unless an explicitly approved repair authorizes a specific change.
