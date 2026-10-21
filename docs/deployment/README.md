
# Deployment Documentation

**Project:** MedOrbits  
**Purpose:** Provide a central reference for local development, staging validation, production deployment, and release recovery.

## 1. Overview

This documentation describes the MedOrbits deployment lifecycle, from local development through pre-production validation to production release.

Deployment procedures must reflect the actual repository configuration, runtime requirements, package scripts, environment variables, database migration process, and configured Render service.

This documentation serves as an index and coordination guide. Detailed operational procedures belong in their respective documents to avoid duplication and conflicting instructions.

**Accuracy requirement:** Examples are illustrative unless explicitly verified. Do not assume that a particular command, environment variable, health endpoint, migration mechanism, monitoring service, or recovery capability exists.

## 2. Documentation Index

| Document | Purpose |
|—|—|
| `local-development.md` | Developer setup, dependency installation, environment configuration, database preparation, and local validation. |
| `staging.md` | Pre-production deployment, integration testing, security validation, and release approval. |
| `production.md` | Production release preparation, deployment, post-release verification, monitoring, and recovery. |

These files should reside in the deployment documentation directory if that matches the repository’s established structure.

Recommended directory layout:

```text
docs/
└── deployment/
    ├── README.md
    ├── local-development.md
    ├── staging.md
    └── production.md
```

This is a recommended structure, not a verified inventory of the current repository. Update the filenames and links if the actual paths differ.

## 3. Local Development

Use `local-development.md` to configure a safe and reproducible development environment.

Before following its commands:

- Verify the supported Node.js version.
- Confirm the package manager and committed lockfile.
- Inspect the available scripts in `package.json`.
- Review `.env.example`, if present, and identify required environment variables.
- Confirm whether MySQL or another database engine is required by the current implementation.
- Identify required external services and local dependencies.
- Use isolated development resources and synthetic data.
- Run the documented tests and validation checks.

Never copy production credentials or private user records into local development.

Local development should provide a safe environment for implementing changes without unintentionally modifying production resources or triggering live external operations.

## 4. Staging Validation

Use `staging.md` to validate the intended release before production deployment.

Staging should use isolated resources, staging-specific credentials, and sandbox integrations wherever available.

Validation should cover the workflows affected by the release, including relevant:

- Authentication and authorization.
- Database migrations and data integrity.
- Course, college, and admissions workflows.
- Application submission and status retrieval.
- Document uploads and private-file access.
- Search and filtering.
- Career and recruitment workflows.
- Notifications and background processing.
- Payments and subscriptions, where implemented.
- Monitoring, error handling, and recovery.

Payment testing must use sandbox mode. Prevent staging from modifying production records, sending unintended live communications, or triggering real financial transactions.

Record the tested commit or artifact, migration status, test results, known issues, exceptions, and release approval.

A successful application startup alone is not sufficient evidence for production readiness.

## 5. Production Deployment

Use `production.md` for the approved production release process.

Before deployment:

- Complete required code reviews and automated checks.
- Identify the approved commit or immutable build artifact.
- Verify Render service configuration and required environment variables.
- Review database migration compatibility and recovery requirements.
- Confirm backup and recovery arrangements appropriate to the release.
- Identify the release owner and previous known-good application version.
- Confirm the release acceptance criteria and incident contacts.
- Verify that production integrations use the intended live configuration.

After deployment:

- Verify application startup and readiness.
- Run approved, non-destructive smoke tests.
- Review deployment and application logs.
- Check relevant application and dependency metrics.
- Confirm database integrity where relevant.
- Monitor the release against the agreed acceptance criteria.
- Record the final outcome, known issues, and incidents.

Follow the documented recovery procedure if release acceptance criteria are breached.

## 6. Render Configuration

MedOrbits uses Render as its deployment platform. Operational instructions in this section must match the actual configured Render service and repository.

Before documenting exact commands or behavior, verify the following.

| Area | Required verification |
|—|—|
| Service type | Confirm the configured service type and its responsibilities. |
| Runtime | Match the deployed Node.js version to the repository’s runtime policy. |
| Build command | Document the build command configured in Render and supported by the project. |
| Start command | Verify the configured start command and the corresponding application entry point or package script. |
| Dependencies | Confirm the installation workflow and lockfile used by the deployment. |
| Environment variables | Document variable names, purposes, and whether they are required. Never document secret values. |
| Database | Confirm the actual database engine, connection configuration, credentials, and network access. |
| Migrations | Verify how migrations are executed, whether execution is automated, and how failures are handled. |
| Health checks | Document an endpoint only after confirming that it exists and is configured for the service. |
| Deployment triggers | Verify the connected branch, automatic deployment settings, and approval process. |
| Logs | Document how to access build, deployment, and runtime logs. |
| Recovery | Verify deployment history and supported rollback or recovery options. |
| Background processing | Confirm whether workers, scheduled jobs, or separate services are configured. |
| Storage | Verify whether uploads use persistent storage, an external object store, or another supported mechanism. |

### 6.1 Deployment Configuration Rules

- Keep required environment variables synchronized with the application’s actual configuration.
- Do not commit production secrets to the repository.
- Do not assume Render automatically applies database migrations.
- Do not assume that a health endpoint exists merely because the platform supports health checks.
- Do not assume that a previous application deployment can safely operate against a newer database schema.
- Verify whether application uploads survive redeployment and restart before relying on local filesystem storage.
- Confirm that database and storage resources are appropriately isolated between staging and production.
- Document the actual configured service behavior rather than relying on generic platform defaults.

Where a deployment setting has not been verified, mark it as requiring verification rather than documenting an inferred value as fact.

## 7. Release Consistency and Traceability

Maintain traceability throughout the deployment lifecycle.

1. Identify the reviewed commit or immutable artifact.
2. Complete the required automated checks.
3. Deploy the intended version to staging.
4. Record staging test results and migration outcomes.
5. Obtain the required release approval.
6. Deploy the approved version to production through the configured workflow.
7. Verify the deployed version and critical workflows.
8. Monitor the release against the acceptance criteria.
9. Record the final outcome, exceptions, and incidents.

Where the platform rebuilds from source rather than promoting the same artifact, verify that the production build corresponds to the approved commit and dependency lockfile.

If staging and production use different environment configurations, record material differences that could affect application behavior.

The release record should identify what was deployed, where it was deployed, when it was deployed, who approved it, and what verification was performed.

## 8. Failure and Recovery

Deployment recovery must account for both application state and data state.

When a deployment fails:

1. Identify the affected release and failure scope.
2. Review relevant deployment logs and monitoring results.
3. Determine whether the issue originates in code, configuration, database changes, infrastructure, or an external dependency.
4. Identify the last known-good application version.
5. Assess database compatibility before rolling back application code.
6. Determine whether migrations are reversible or require a forward fix.
7. Consider external side effects, including payments, emails, notifications, and third-party updates.
8. Execute the approved recovery procedure.
9. Verify application health, critical workflows, and data integrity.
10. Record the incident, mitigation, final outcome, and follow-up actions.

An application rollback does not automatically reverse database changes or external transactions. Restoring a database backup can also discard legitimate writes made after the recovery point.

Do not perform a destructive recovery operation without understanding its expected data-loss impact and obtaining the required authorization.

For detailed procedures, refer to `production.md` and the applicable database migration documentation.

## 9. Security and Operational Controls

Deployment documentation must support the following controls:

- **Access control:** Restrict deployment permissions to authorized personnel and automation.
- **Secret management:** Store credentials using the approved environment or secret-management mechanism.
- **Environment isolation:** Prevent staging and development resources from modifying production data.
- **Database safety:** Use controlled migrations, least-privilege credentials, and verified recovery procedures.
- **Artifact integrity:** Deploy reviewed commits or identifiable build artifacts.
- **Observability:** Use configured logs, metrics, and alerts without exposing secrets or unnecessary personal information.
- **Change management:** Record approvals, release outcomes, exceptions, and follow-up actions.
- **Incident response:** Maintain an accessible procedure for investigating and recovering from failed releases.

Do not describe a control as implemented until the configuration or behavior has been verified.

## 10. Documentation Maintenance

Update the deployment documentation when any of the following changes:

- Node.js or package-manager requirements.
- Available `package.json` scripts.
- Environment-variable requirements.
- Render service configuration or connected deployment branches.
- Database engine, connection configuration, migration tooling, or recovery procedures.
- Staging validation and release-approval requirements.
- Production deployment, monitoring, or alerting procedures.
- Storage and background-processing infrastructure.
- Release traceability or incident-handling processes.

When a deployment-related file is moved or renamed:

1. Update references in this index.
2. Update relative links in related documents.
3. Check for duplicate or conflicting instructions.
4. Confirm that referenced commands and configuration remain valid.
5. Record any material changes to the deployment workflow.

## 11. Related Documentation

Update the relative paths below to match the actual repository structure.

- `local-development.md` — Local setup and validation.
- `staging.md` — Pre-production validation and release approval.
- `production.md` — Production release and recovery.
- `../database/README.md` — Database documentation, if present.
- `../database/schema.md` — Database schema overview, if present.
- `../database/migrations.md` — Migration and recovery safeguards, if present.
- `../architecture/system-architecture.md` — Application architecture, if present.
- `../architecture/application-data-flow.md` — Request and processing flows, if present.
- `../api/README.md` — API documentation standards, if present.
- `../api/openapi.yaml` — OpenAPI specification, if present.
- Render’s official documentation — Platform-specific deployment and recovery procedures.

Prefer linking to canonical documentation rather than duplicating complete procedures across multiple files.

## 12. Definition of Done

The deployment documentation is ready for operational use when:

- [ ] The documentation index matches the actual repository structure.
- [ ] Local, staging, and production procedures are documented.
- [ ] Commands and scripts have been checked against the current repository.
- [ ] Render configuration has been verified against the deployed service.
- [ ] Database migration and recovery references are accurate.
- [ ] Security requirements and environment-isolation safeguards are documented.
- [ ] Release traceability and approval requirements are defined.
- [ ] Failure handling and recovery limitations are explicit.
- [ ] Relative links have been checked.
- [ ] Unverified features and capabilities are clearly identified.

**Accuracy rule:** The repository configuration and deployed Render service are authoritative. Document verified commands, endpoints, integrations, and recovery behavior. This index defines the intended deployment workflow; it does not prove that every listed capability is currently implemented.
