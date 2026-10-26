Render Deployment Guide — MedOrbits

Path: infrastructure/deployment/render.md
Platform: Render
Runtime: Node.js 20+
Backend: Express.js, ECMAScript modules
Database: PostgreSQL
Status: Deployment instructions; verify all settings against the actual repository and Render dashboard.

1. Purpose

This guide documents the deployment of MedOrbits to Render, including application configuration, dependency installation, database connectivity, health checks, release verification, troubleshooting, and rollback.

Render supports Node.js web services with configurable build commands, start commands, environment variables, and health-check paths. <Cite refs={[“turn528254search0”,“turn528254search1”]}/>

This guide does not deploy the application or confirm that the required infrastructure already exists.

2. Deployment Architecture

The intended architecture is:

Browser
   |
   | HTTPS
   v
Render Web Service
   |
   +-— Express.js API
   |
   +-— PostgreSQL database
   |
   +-— Persistent document storage, if required
   |
   +-— Approved external services

Keep the application and PostgreSQL in the same Render region when practical to reduce network latency. Use private networking for service-to-service communication where supported.

3. Pre-deployment Checklist

Before creating or updating a Render service, verify:

* [ ]	The correct Git repository is connected.
* [ ]	The intended deployment branch is selected.
* [ ]	The application root directory is correct.
* [ ]	package.json exists in the selected application root.
* [ ]	package-lock.json is present and consistent with package.json.
* [ ]	The production start script exists.
* [ ]	The application listens on the configured port.
* [ ]	PostgreSQL requirements are documented.
* [ ]	Required environment variables are known.
* [ ]	No unresolved merge conflicts remain.
* [ ]	Tests and relevant syntax checks have been run.
* [ ]	No credentials or private user documents are committed.
* [ ]	A recovery plan exists for production data and configuration.

Do not deploy a guessed branch, overwrite repository files, or change database schemas merely to make deployment succeed.

4. Create the Web Service

In the Render Dashboard:

1. Connect the Git provider containing the MedOrbits repository.
2. Select New → Web Service.
3. Select the intended repository.
4. Choose the correct branch.
5. Select the application root directory if the repository contains multiple projects.
6. Choose the Node runtime.
7. Configure the build and start commands.
8. Configure environment variables and health checks.
9. Review the service settings before creating it.

Render’s official deployment guide documents these settings and the initial deployment workflow. <Cite refs={[“turn528254search0”,“turn528254search1”]}/>

Suggested service settings

Setting	Suggested value	Important condition
Service type	Web Service	Appropriate for a continuously running Express server.
Runtime	Node	Confirm the app uses Node.js.
Branch	Your approved release branch	Do not assume the branch is main.
Root directory	Application directory	Set only if required by the repository layout.
Build command	npm ci	Requires a valid, committed npm lockfile.
Start command	npm start	Requires a working start script.
Health-check path	/api/health	Use only if this endpoint actually exists and returns the expected status.
Auto-deploy	Based on release policy	Enable only when the selected branch and CI workflow are trusted.

These are recommendations, not verified settings for your current Render service.

5. Configure the Node.js Runtime

The application should declare its Node.js requirement in package.json.

Example:

{
  “engines”: {
    “node”: “>=20”
  }
}

Keep the declared engine requirement consistent with the code and dependencies. Verify the actual runtime in the Render build and runtime logs.

Build command

For an application with a valid npm lockfile:

npm ci

If the project requires compilation or asset generation, use its verified build script, for example:

npm ci && npm run build

Do not include npm run build unless that script exists and is required.

Start command

For a project with a working start script:

npm start

Otherwise, use the correct application entry point documented by the repository.

Render runs the configured start command to launch the service. An invalid command or a process that exits during startup will prevent the service from becoming healthy. <Cite refs={[“turn528254search2”,“turn528254search4”]}/>

6. Configure the Listening Port

The Express application must listen on the port supplied by its hosting environment.

Example:

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(“Invalid server port configuration”);
}
app.listen(port, “0.0.0.0”, () => {
  console.log(`Server listening on port ${port}`);
});

Adapt this example to the existing server implementation; do not add a second listener if the application already starts its server elsewhere.

Important: Render web services need to bind to an appropriate network interface so that the platform can route requests to the application. A server bound only to 127.0.0.1 inside its container will generally not be reachable through the service’s public endpoint.

Avoid printing secrets or environment variable values during startup.

7. Configure Environment Variables

Set production environment variables in the Render Dashboard under the service’s environment settings. Do not depend on a local .env file being present in the deployed service. <Cite refs={[“turn528254search1”,“turn528254search4”]}/>

Potential settings include:

Variable	Purpose
NODE_ENV	Runtime environment; normally production.
PORT	Port provided by the hosting environment.
DATABASE_URL	PostgreSQL connection string, if required by the application.
SESSION_SECRET	Session signing secret, if session authentication is used.
CORS_ORIGINS	Approved frontend origins, if supported by the application.
LOG_LEVEL	Logging verbosity, if configurable.
AI_API_KEY	Secret for an approved AI provider, if used.
AI_API_URL	AI provider endpoint, if used.
AI_MODEL	Configured model identifier, if used.

The actual variable names must match the application code. Do not add variables solely because they appear in this table.

Security requirements

* Never commit production credentials.
* Never paste secret values into source files or documentation.
* Do not print process.env in logs.
* Use separate credentials for staging and production.
* Grant database access using least privilege.
* Rotate any credential that has been exposed.
* Fail clearly when essential configuration is missing.
* Verify that the application reads and validates each required setting.

8. PostgreSQL Configuration

If MedOrbits uses Render PostgreSQL:

1. Create or identify the correct PostgreSQL instance.
2. Select a region compatible with the application service.
3. Configure database access using the connection method supported by Render.
4. Use the internal connection address when the application and database can communicate over Render’s private network.
5. Store the connection string in the service’s environment configuration.
6. Verify SSL and connection settings against the actual database configuration.
7. Restrict database access to authorized services and operators.
8. Confirm backups and recovery procedures.

Use the database provider’s documented connection information rather than guessing a hostname or port.

Migration policy

* Review migration scripts before production execution.
* Test migrations against a non-production database.
* Back up important data before risky schema changes.
* Use the migration mechanism already established by the project.
* Avoid destructive migrations without an explicit recovery plan.
* Verify schema compatibility with the deployed application.
* Record migration outcomes.

Render supports pre-deploy commands for certain service types and plans. These commands run separately from the deployed service instance, so do not rely on a pre-deploy command to modify the running instance’s local filesystem or access its attached persistent disk. <Cite refs={[“turn528254search2”]}/>

Do not configure a production migration command until the migration tool, script, database connection, and execution behavior have been verified.

9. Health Checks

Configure a Render health-check path only after confirming that the application implements it.

A health endpoint should:

* Return an appropriate successful HTTP status when healthy.
* Respond within a bounded period.
* Avoid exposing secrets or stack traces.
* Report readiness accurately.
* Avoid performing expensive repository scans.
* Handle required dependency failures appropriately.

Example endpoint, only if it fits the existing Express application:

app.get(“/api/health”, (_req, res) => {
  res.status(200).json({
    status: “ok”,
    timestamp: new Date().toISOString()
  });
});

Do not add a duplicate route if an equivalent health endpoint already exists.

A simple liveness endpoint does not prove PostgreSQL or every external service is healthy. If dependency health is needed, implement and test a separate readiness check.

Render uses health checks to help determine whether a new instance is ready to receive traffic. <Cite refs={[“turn528254search0”,“turn528254search4”]}/>

10. Persistent Files and Uploaded Documents

Do not assume that files written to a deployed service’s ordinary filesystem will persist across deployments or instance replacement.

If MedOrbits stores uploaded documents, generated reports, or user files:

* Select an appropriate persistent storage solution.
* Review Render persistent-disk requirements and limitations.
* Use object storage where suitable.
* Keep private documents outside public web directories.
* Enforce authentication and authorization for document access.
* Validate file types and size limits.
* Avoid logging document contents.
* Define backup, retention, and deletion procedures.

Render documents that attaching a persistent disk affects zero-downtime deployment behavior. Evaluate that trade-off before using disks for production file storage. <Cite refs={[“turn528254search2”,“turn528254search9”]}/>

11. Deployment Procedure

Phase A — Prepare the release

1. Confirm the intended Git commit and branch.
2. Review the diff and verify that no unrelated changes are included.
3. Check for unresolved merge conflicts.
4. Run applicable tests and syntax checks.
5. Verify the lockfile and npm scripts.
6. Review production environment requirements.
7. Confirm database migration safety.
8. Verify backup and rollback readiness.

Phase B — Deploy

1. Push the reviewed release to the configured repository and branch using the normal approved Git workflow.
2. Allow Render to build the selected commit, or initiate a manual deployment.
3. Inspect the build logs.
4. Verify dependency installation.
5. Verify the start command and startup logs.
6. Wait for the deployment to become live.
7. Review health-check results.

Do not stage, commit, push, or deploy unreviewed changes automatically.

Phase C — Verify

* [ ]	The Render service reports a successful deployment.
* [ ]	The public service URL responds.
* [ ]	HTTPS works.
* [ ]	The homepage loads, if served by this service.
* [ ]	Expected API endpoints return the correct responses.
* [ ]	PostgreSQL-backed operations work.
* [ ]	Authentication and authorization behave correctly.
* [ ]	No secrets are exposed in responses or logs.
* [ ]	File uploads work if implemented.
* [ ]	Monitoring and alerts work where configured.

A service marked live does not guarantee that every business workflow is functioning correctly.

12. Custom Domain and HTTPS

If the service uses www.medorbits.in or another custom domain:

1. Add the domain in the Render service settings.
2. Follow Render’s displayed DNS configuration instructions.
3. Verify DNS records with the appropriate DNS provider.
4. Wait for domain verification and TLS certificate provisioning.
5. Confirm that HTTPS works.
6. Verify canonical URLs and redirects.
7. Update the application’s CORS allowlist if necessary.
8. Confirm that authentication cookies and callback URLs use the intended domain.

Do not guess DNS records or remove existing records without understanding their purpose.

Use Render’s current custom-domain documentation and the instructions shown for the actual service.

13. Logs and Monitoring

Use Render’s service logs and deployment logs to investigate startup failures, application errors, and failed deployments.

Monitor, where supported:

* Deployment status.
* Application availability.
* HTTP error rates.
* Response latency.
* Database connection errors.
* Memory and resource usage.
* Repeated restarts.
* External provider failures.

Keep logs sanitized. Never expose authentication headers, session secrets, database credentials, or private user documents.

Render provides deployment logs and troubleshooting guidance for diagnosing build and runtime failures. <Cite refs={[“turn528254search1”,“turn528254search4”]}/>

14. Troubleshooting

Build failure

Check:

* Whether the configured root directory is correct.
* Whether package.json and package-lock.json are present.
* Whether npm ci succeeds locally with the same lockfile.
* Whether the required Node.js version is supported.
* Whether the build command refers to a real npm script.
* Whether a dependency is missing or incompatible.

Do not regenerate the lockfile in production as a first response.

Application fails to start

Check:

* The configured start command.
* The application entry point.
* Missing environment variables.
* Import or export errors.
* Syntax errors.
* Database initialization failures.
* Port configuration.
* Startup logs.

Health check fails

Check:

* Whether the configured path exists.
* Whether the endpoint returns the expected HTTP status.
* Whether the server binds to the correct interface and port.
* Whether startup takes longer than expected.
* Whether required dependencies are unavailable.

Database connection fails

Check:

* The configured database service.
* The connection string without exposing its value.
* Private-network compatibility and hostname.
* SSL requirements.
* Database credentials and permissions.
* Connection limits and timeouts.
* Database availability.

Static assets or uploads disappear

Check whether files were written to ephemeral storage and whether the application requires persistent storage.

Do not assume that redeploying will recover missing files.

15. Rollback

If a deployment causes a production failure:

1. Identify the failing deploy and its commit.
2. Review the relevant logs and user impact.
3. Select a known-good deployment.
4. Verify that the old application version is compatible with the current database schema.
5. Use Render’s supported rollback workflow where appropriate.
6. Recheck health, authentication, database operations, and critical endpoints.
7. Record the incident and corrective action.

Render supports rolling back to a previous deployment. However, a rollback does not automatically reverse database changes or restore the state of persistent disks. <Cite refs={[“turn528254search5”]}/>

Never use database restoration or destructive Git commands as an automatic rollback strategy.

16. CI/CD and Auto-deploy

Automatic deployments can be useful when the repository’s release branch and CI checks are reliable.

Before enabling auto-deploy:

* Verify the connected repository and branch.
* Ensure only reviewed changes reach the production branch.
* Run the required tests before release.
* Keep secrets in protected environment settings.
* Confirm deployment permissions.
* Decide whether deployment should occur after every commit or only after checks pass.
* Test rollback procedures.

For critical releases, consider manual promotion from a verified staging environment.

Do not claim CI/CD is configured until the workflow has been implemented and tested.

17. Production Readiness Checklist

Configuration

* [ ]	Correct repository and branch.
* [ ]	Correct root directory.
* [ ]	Valid Node.js runtime.
* [ ]	Valid build and start commands.
* [ ]	Required environment variables configured.
* [ ]	Secrets stored securely.
* [ ]	Database connectivity verified.
* [ ]	Health-check path confirmed.

Reliability

* [ ]	Build succeeds.
* [ ]	Application starts.
* [ ]	Health check passes.
* [ ]	Critical routes tested.
* [ ]	Database-backed features tested.
* [ ]	File storage verified where applicable.
* [ ]	Logs reviewed.
* [ ]	Backup and rollback plans reviewed.

Security

* [ ]	No secrets committed.
* [ ]	Authentication and authorization verified.
* [ ]	CORS restricted appropriately.
* [ ]	Public error responses sanitized.
* [ ]	Database permissions restricted.
* [ ]	Uploaded documents protected.
* [ ]	Monitoring endpoints secured.

18. Deployment Record

Maintain a record for each production release.

Field	Record
Service name	Actual Render service name
Repository	Connected repository
Branch	Actual deployment branch
Commit	Deployed commit SHA
Deploy time	UTC timestamp
Node.js version	Version from deployment logs
Database migration	Actual migration identifier, if applicable
Health check	Pass, fail, or not run
Smoke tests	Pass, fail, or not run
Rollback readiness	Verified or unverified
Outstanding issues	Actual unresolved findings

Do not record secrets or claim tests passed without evidence.

19. Official References

* Render Web Services
* Your First Render Deploy
* Deploying on Render
* Troubleshooting Your Deploy
* Render Rollbacks
* Render Documentation

20. Maintenance

Update this guide whenever the Render service configuration, Node.js runtime, database architecture, deployment workflow, or recovery procedure changes.

Keep recommendations distinct from verified settings. Record limitations and skipped checks rather than assuming they are successful.

Core principle: Deploy reviewed code, protect production data, verify the live service, and maintain a tested recovery path.