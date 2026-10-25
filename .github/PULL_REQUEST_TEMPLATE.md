
# MedOrbits — Pull Request

Thank you for contributing to **MedOrbits**.

This pull request (PR) should explain the purpose of the change, document the validation actually performed, disclose known risks, and provide reviewers with sufficient information to assess correctness, security, compatibility, and deployment impact.

> **Review standard:** Do not mark a checklist item complete unless it has been verified. Explicitly document skipped tests, unresolved failures, and outstanding risks.

—

## 1. Summary

### Problem or motivation

<!— Describe the problem, why the change is needed, and who or what it affects. —>

### Proposed solution

<!— Summarize the approach and how it addresses the problem. —>

### Expected impact

<!— Describe user, operational, performance, reliability, or security impact. —>

—

## 2. Related Issues and References

- **Closes:** <!— Issue number or URL, if applicable —>
- **Related issues:** <!— Related issues, discussions, PRs, or design documents —>
- **External references:** <!— Official documentation, specifications, or technical references —>

Use closing keywords such as `Closes #123` only when this PR should close the referenced issue after merging.

—

## 3. Type and Scope of Change

Select all applicable categories.

- [ ] Bug fix
- [ ] New feature or capability
- [ ] Refactoring or code cleanup
- [ ] Documentation or content update
- [ ] Security or privacy improvement
- [ ] Performance or reliability improvement
- [ ] Accessibility or usability improvement
- [ ] API or integration change
- [ ] Database, schema, or migration change
- [ ] Dependency or lockfile update
- [ ] Build, CI/CD, or infrastructure change
- [ ] Configuration or environment change
- [ ] Release or deployment change
- [ ] Breaking change

### Scope and compatibility

- [ ] Backward-compatible
- [ ] Requires coordinated changes
- [ ] Changes externally visible behavior
- [ ] Requires a migration or operational procedure
- [ ] Requires additional specialist review

**Scope notes:**

<!— Explain significant scope, compatibility, and coordination requirements. —>

—

## 4. Implementation Details

### Key changes

<!— Summarize the implementation rather than repeating the diff. —>

-
-
-

### Important design decisions

<!— Explain architectural choices, alternatives considered, and trade-offs. —>

### Files or components affected

<!— Identify important paths, modules, endpoints, datasets, or workflows. —>

### Out of scope

<!— Identify related work intentionally excluded from this PR. —>

—

## 5. Testing and Validation

Select only checks actually performed.

- [ ] Unit tests
- [ ] Integration tests
- [ ] API contract or endpoint tests
- [ ] End-to-end tests
- [ ] JavaScript syntax validation
- [ ] JSON, YAML, or schema validation
- [ ] Linting and formatting checks
- [ ] Build and repository validation
- [ ] Database migration and recovery checks
- [ ] Accessibility checks
- [ ] Performance or load checks
- [ ] Security checks
- [ ] Manual testing
- [ ] No tests required — justification provided below

### Commands and actual results

Replace these examples with commands actually executed. Remove irrelevant rows and add project-specific checks.

| Command or check | Actual result | Notes |
|—|—|—|
| `npm ci` | <!— Pass / Fail / Skipped / Not run —> | <!— Details —> |
| `npm test` | <!— Pass / Fail / Skipped / Not run —> | <!— Details —> |
| `npm run lint` | <!— Pass / Fail / Skipped / Not run —> | <!— Details —> |
| Additional check | <!— Actual result —> | <!— Details —> |

### Automated CI results

- **Workflow run:** <!— Link, if available —>
- **Commit tested:** <!— Commit SHA, if known —>
- **Status:** <!— Passed / Failed / Pending / Not run —>

### Testing limitations and outstanding failures

<!—
Document untested scenarios, unavailable environments, skipped checks,
known failures, flaky tests, and required follow-up validation.
Write “None known” only after reviewing the limitations.
—>

—

## 6. Security and Privacy Review

Select statements that have been verified or reviewed, where applicable.

- [ ] No credentials, private keys, tokens, or secret values were added.
- [ ] No confidential or unnecessary personal data was introduced.
- [ ] Input validation and output encoding were reviewed.
- [ ] Authentication, authorization, and access-control behavior were reviewed.
- [ ] Session management, token handling, and account recovery were reviewed.
- [ ] File uploads, document access, and storage permissions were reviewed.
- [ ] Database queries and data-access permissions were reviewed.
- [ ] Payment flows, webhook authentication, and sensitive financial data were reviewed, where applicable.
- [ ] Dependency and supply-chain implications were considered.
- [ ] Logging and error handling do not expose sensitive information.
- [ ] Security documentation was updated where necessary.
- [ ] Remaining risks and required mitigations are documented.

### Security impact

- **Risk level:** <!— Low / Moderate / High / Requires security review —>
- **Affected trust boundaries or data:** <!— Accounts, permissions, APIs, records, documents, integrations —>
- **Mitigations and remaining risks:** <!— Controls, residual risk, additional review required —>

> For suspected vulnerabilities, follow the reporting procedure in `SECURITY.md`. Do not disclose exploitable details in a public PR.

—

## 7. Database, Data Integrity, and Configuration

Select applicable statements.

- [ ] No database, schema, or data migration changes.
- [ ] Database schema changes are included and documented.
- [ ] Migration ordering and compatibility have been reviewed.
- [ ] Backup and recovery requirements have been considered.
- [ ] Rollback or forward-recovery procedures have been reviewed.
- [ ] Data integrity and validation requirements have been considered.
- [ ] New or changed environment variables are documented.
- [ ] Configuration examples contain no real secret values.
- [ ] Existing deployments remain compatible, or incompatibilities are documented.

### Migration and configuration notes

<!—
Include migration commands, prerequisites, deployment order, environment variable
names (never secret values), compatibility requirements, and recovery steps.
—>

—

## 8. User Interface, Accessibility, and Content

Select applicable statements.

- [ ] Responsive behavior was checked on relevant screen sizes.
- [ ] Keyboard navigation and focus behavior were reviewed.
- [ ] Semantic HTML and accessible form labels were reviewed.
- [ ] Color contrast and text readability were considered.
- [ ] Screen-reader usability was considered.
- [ ] Loading, empty, error, and success states were reviewed.
- [ ] Links, navigation, and user-facing content were checked.
- [ ] Educational, admission, career, or official-document claims were checked against appropriate sources, where applicable.
- [ ] Screenshots or recordings are attached where useful.
- [ ] Not applicable to this change.

### Visual evidence and content references

<!— Add before/after screenshots, relevant URLs, source references, or accessibility findings. Avoid uploading sensitive user data. —>

—

## 9. API, Integration, and Data Contracts

Complete this section when the change affects APIs, external services, or structured data.

- [ ] No API or integration contract changes.
- [ ] Request and response formats remain compatible.
- [ ] Validation and error responses are documented.
- [ ] Authentication and authorization requirements are documented.
- [ ] Timeouts, retries, and failure handling have been considered.
- [ ] External service assumptions and rate limits have been considered.
- [ ] JSON schemas, datasets, or resource manifests have been updated.
- [ ] Backward compatibility or versioning requirements are documented.

### Contract changes

<!— Describe affected endpoints, payloads, schemas, consumers, and migration requirements. —>

—

## 10. Dependencies and Supply-Chain Impact

- [ ] No dependency changes.
- [ ] Dependency changes are limited to the intended packages.
- [ ] `package.json` and the applicable lockfile are synchronized.
- [ ] New dependencies were reviewed for maintenance, licensing, and security.
- [ ] Runtime and development dependencies are correctly classified.
- [ ] Node.js and npm compatibility have been considered.
- [ ] GitHub Actions and third-party integrations were reviewed, where applicable.
- [ ] Major-version changes and breaking changes are documented.

### Dependency notes

<!— Identify important updates, reasons, compatibility concerns, and known advisories. —>

—

## 11. Documentation and Legal Considerations

- [ ] Relevant README or technical documentation was updated.
- [ ] API specifications and usage examples were updated, where applicable.
- [ ] Configuration examples and setup instructions were updated.
- [ ] Security and operational documentation were updated, where applicable.
- [ ] Changelog or release notes were updated, where required.
- [ ] Licensing and attribution requirements were considered for third-party material.
- [ ] Relevant notices, consent language, or privacy documentation were reviewed, where applicable.
- [ ] No documentation changes are required.

### Documentation references

<!— Link updated files, official sources, license notices, or policy changes. —>

—

## 12. Deployment and Operations

- **Deployment impact:** <!— None / Routine / Requires coordination / High risk —>
- **Feature flags:** <!— None or describe —>
- **Environment configuration:** <!— None or list required variable names —>
- **Migration or deployment order:** <!— None or describe —>
- **Monitoring and health checks:** <!— Applicable checks —>
- **Rollback or recovery:** <!— Tested procedure or outstanding work —>

### Operational notes

<!—
Include restart requirements, cache invalidation, scheduled jobs, background
workers, external integrations, deployment dependencies, and expected downtime.
Never include credentials or secret values.
—>

—

## 13. Known Issues and Follow-up Work

<!— List unresolved defects, technical debt, deferred improvements, and follow-up issues. —>

- **Known issue:** <!— Description or None known —>
- **Follow-up issue:** <!— Issue link or None —>
- **Owner or responsible team:** <!— If established —>
- **Target milestone:** <!— If established —>

If no issues remain after review, enter **None known**.

—

## 14. Reviewer Guidance

Help reviewers focus on the most important parts of the change.

### Suggested review order

1. <!— Key file or design decision —>
2. <!— Important logic or security boundary —>
3. <!— Tests, migration, or deployment impact —>

### Review requirements

- [ ] Standard code review
- [ ] Security review
- [ ] Database or migration review
- [ ] Infrastructure or deployment review
- [ ] Accessibility review
- [ ] Legal, privacy, or licensing review
- [ ] Additional specialist review
- [ ] No additional specialist review identified

These selections communicate requested review areas. They do not automatically assign reviewers or enforce approval requirements.

—

## 15. Author Declaration and Final Checklist

Before requesting review, confirm the applicable statements.

- [ ] I have reviewed the complete diff and removed unrelated changes.
- [ ] The implementation follows applicable project conventions.
- [ ] I have recorded actual test results and disclosed skipped checks.
- [ ] Known failures and material limitations are documented.
- [ ] Security and privacy implications have been considered.
- [ ] Relevant documentation and configuration examples are updated.
- [ ] Dependency and lockfile changes have been reviewed.
- [ ] Database, deployment, and recovery implications are documented where applicable.
- [ ] No unintended credentials, confidential data, or generated artifacts are included.
- [ ] I have reviewed `CONTRIBUTING.md` and `SECURITY.md`, where applicable.
- [ ] Related issues and required follow-up work are linked.
- [ ] I have the right to submit this contribution under the repository’s applicable contribution terms and license.
- [ ] Required attribution and third-party license obligations have been addressed.

—

## 16. Additional Context

<!—
Include design references, decisions, dependencies on other PRs, rollout plans,
support considerations, or other information necessary for review.
—>

—

### Maintainer Use

<!— Maintainers may use this section during review. —>

- [ ] Scope and implementation reviewed.
- [ ] Required checks verified.
- [ ] Outstanding risks accepted or addressed.
- [ ] Required specialist approvals obtained.
- [ ] Documentation and release requirements satisfied.
- [ ] Merge conditions satisfied.
