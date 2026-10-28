File: /monitoring/README.md

# MedOrbits Monitoring Module
**Version:** 3.0.0
**Runtime:** Node.js >= 20
**Integration:** Express.js
**Primary database:** PostgreSQL
**Deployment:** Render
## 1. Purpose
The `monitoring/` module provides application observability, health checks, request metrics, structured logging, alerting, and operational diagnostics for MedOrbits.
It is designed to integrate with the root `server.js` without exposing internal application details or sensitive information to public endpoints.
### Core objectives
- Monitor HTTP request volume, response status, and latency.
- Provide liveness and readiness checks.
- Detect slow requests and elevated server error rates.
- Monitor database connectivity and background jobs.
- Record structured operational and security events.
- Generate alerts for configured operational failures.
- Support health reports and operational dashboards.
- Provide a foundation for external monitoring integrations.
- Preserve compatibility with Node.js 20+ and supported Express versions.
## 2. Directory structure
```text
monitoring/
├── README.md
├── index.js
├── config.js
├── logger.js
├── request-monitor.js
├── metrics.js
├── health.js
├── readiness.js
├── alerts.js
├── error-tracker.js
├── uptime-monitor.js
├── database-monitor.js
├── job-monitor.js
├── security-events.js
├── audit-log.js
├── retention.js
├── report-generator.js
├── middleware/
│   ├── monitoring-middleware.js
│   └── request-context.js
├── collectors/
│   ├── process-collector.js
│   ├── system-collector.js
│   └── http-collector.js
├── storage/
│   └── jsonl-store.js
├── schemas/
│   ├── alert.schema.json
│   └── monitoring-event.schema.json
├── dashboards/
│   ├── overview.json
│   ├── api-performance.json
│   └── database-health.json
├── alerts/
│   └── alert-rules.json
├── reports/
│   └── .gitkeep
├── logs/
│   └── .gitkeep
└── tests/
    ├── health.test.js
    ├── metrics.test.js
    └── logger.test.js
```
Create only the files that are implemented and tested. An empty placeholder file does not provide monitoring functionality.
## 3. Module responsibilities
| File or directory | Responsibility |
|—|—|
| `index.js` | Public module interface and Express integration |
| `config.js` | Read and validate monitoring configuration |
| `logger.js` | Structured logging and sensitive-field redaction |
| `request-monitor.js` | Collect request counts, status codes, and latency |
| `metrics.js` | Maintain and expose supported application metrics |
| `health.js` | Process liveness and dependency health checks |
| `readiness.js` | Determine whether the application can accept traffic |
| `alerts.js` | Send rate-limited operational alerts |
| `error-tracker.js` | Normalize and report application errors |
| `uptime-monitor.js` | Track process availability and health-check results |
| `database-monitor.js` | Monitor database connectivity and query failures |
| `job-monitor.js` | Track background job execution and failures |
| `security-events.js` | Record relevant security events |
| `audit-log.js` | Record attributable administrative actions |
| `retention.js` | Apply configured log and event retention policies |
| `report-generator.js` | Produce operational summaries |
| `middleware/` | Express request context and monitoring middleware |
| `collectors/` | Collect process, system, and HTTP measurements |
| `storage/` | Persist supported monitoring events |
| `schemas/` | Validate event and alert structures |
| `dashboards/` | Store dashboard configuration |
| `alerts/` | Store declarative alert rules |
| `tests/` | Automated module tests |
## 4. Environment configuration
Add monitoring configuration to the root `/.env.example`.
```dotenv
MONITORING_ENABLED=true
MONITORING_SERVICE_NAME=medorbits-api
MONITORING_METRICS_ENABLED=true
MONITORING_METRICS_TOKEN=
MONITORING_SLOW_REQUEST_MS=2000
MONITORING_HEALTH_TIMEOUT_MS=3000
MONITORING_ALERT_COOLDOWN_MS=300000
MONITORING_RETENTION_DAYS=14
LOG_LEVEL=info
LOG_FORMAT=json
LOG_REDACT_SENSITIVE=true
LOG_INCLUDE_STACKS=false
ENABLE_REQUEST_LOGS=true
```
### Configuration rules
- Monitoring can be disabled with `MONITORING_ENABLED=false`.
- Metrics should remain disabled or inaccessible until their access controls are verified.
- Generate a strong random metrics token before enabling protected metrics.
- Use a finite timeout for health checks and external integrations.
- Validate numeric configuration values during startup.
- Do not log secrets, credentials, authorization headers, cookies, or sensitive document contents.
- Do not enable integrations that have not been implemented and tested.
Environment variables only affect behavior when the relevant code reads and enforces them.
## 5. Integration with `server.js`
The server should initialize monitoring before API routes and before 404 handlers.
Expected public interface:
```javascript
const { createMonitoring } = require(‘./monitoring’);
const monitoring = createMonitoring({
  serviceName: ‘medorbits-api’,
  version: ‘3.0.0’,
  environment: process.env.NODE_ENV || ‘development’,
  checks: {
    database: async () => {
      if (!databasePool) {
        return;
      }
      await databasePool.query(‘SELECT 1’);
    },
  },
});
monitoring.mount(app);
```
**Integration requirements:**
1. `monitoring/index.js` must export `createMonitoring(options)`.
2. The factory must return an object with a `mount(app)` method.
3. Mount monitoring middleware before API routes to capture their requests.
4. Avoid registering duplicate `/health`, `/health/live`, or `/health/ready` endpoints.
5. Do not expose a metrics endpoint before authentication and access controls are active.
6. Keep monitoring failures from silently producing false healthy status.
The example assumes `databasePool` is available in the surrounding server module. Adapt the check to the actual database integration rather than copying an undefined variable.
## 6. Health endpoints
Use the following endpoint responsibilities consistently.
| Endpoint | Purpose | Expected response |
|—|—|—|
| `/health` | Compatibility health check | HTTP 200 when the process responds |
| `/health/live` | Liveness probe | HTTP 200 while the process is alive |
| `/health/ready` | Readiness probe | HTTP 200 when required dependencies are ready |
| `/internal/metrics` | Internal metrics | Protected metrics response when enabled |
### Liveness
Liveness indicates whether the process is running. It should not fail merely because an optional dependency is unavailable.
### Readiness
Readiness should check only dependencies required to serve traffic. If PostgreSQL is mandatory for the active deployment, a failed database check should produce HTTP 503.
Use bounded timeouts so an unavailable database cannot indefinitely block health checks.
### Metrics
Metrics may contain operational details. Protect the endpoint with authentication and, where possible, network-level restrictions. Do not expose tokens, connection strings, personal data, or raw request payloads.
## 7. Metrics
Recommended measurements include:
- Total HTTP requests.
- Requests grouped by HTTP method and status class.
- Request duration and latency distributions.
- Slow-request count.
- HTTP 5xx response count.
- Database connectivity and failure counts.
- Background job success and failure counts.
- Process uptime.
- Memory usage and event-loop health, when implemented.
### Metrics design requirements
- Use bounded labels; never use arbitrary URLs, user IDs, emails, or tokens as metric labels.
- Use monotonic timing for elapsed request duration.
- Avoid unbounded in-memory collections.
- Clearly distinguish unavailable measurements from zero measurements.
- Document the metric format and units.
- Account for process restarts and multiple application instances.
In-memory metrics reset when the process restarts and are not shared between instances. Use a suitable external metrics backend for durable, cross-instance monitoring.
## 8. Structured logging
Logs should be machine-readable and suitable for centralized collection.
Recommended event fields:
```json
{
  “timestamp”: “2026-01-01T00:00:00.000Z”,
  “level”: “info”,
  “service”: “medorbits-api”,
  “environment”: “production”,
  “event”: “http_request_completed”,
  “requestId”: “example-request-id”,
  “method”: “GET”,
  “path”: “/api/health”,
  “status”: 200,
  “durationMs”: 12.5
}
```
The example is illustrative, not a real request record.
### Logging safeguards
- Redact secrets recursively where appropriate.
- Do not log passwords, authentication tokens, cookies, or encryption keys.
- Avoid request and response body logging by default.
- Do not include raw database connection strings.
- Keep stack traces out of client responses.
- Restrict access to operational logs.
- Apply retention and deletion policies appropriate to the deployment.
## 9. Alerting
Potential alert conditions include:
- Repeated HTTP 5xx responses.
- Slow-request rates above a configured threshold.
- Database connectivity failures.
- Repeated background job failures.
- Readiness failures.
- Unexpected monitoring collector failures.
Alerts should include a timestamp, service name, severity, event type, and a concise diagnostic summary.
### Alert safeguards
- Apply a cooldown or deduplication policy.
- Use finite network timeouts.
- Avoid including credentials or personal data in alert payloads.
- Validate configured webhook destinations.
- Restrict webhook URLs to trusted HTTPS endpoints.
- Do not retry indefinitely.
- Avoid triggering alerts for every individual failed request.
Webhook alerting must remain inactive until the destination, request format, timeout, and failure handling have been tested.
## 10. Database and job monitoring
### PostgreSQL
Monitor:
- Connection availability.
- Connection acquisition failures.
- Query timeouts.
- Pool exhaustion where measurable.
- Database readiness failures.
Do not log SQL parameters or sensitive query results.
### Background jobs
Where workers are implemented, record:
- Job type.
- Start and completion timestamps.
- Execution duration.
- Attempt count.
- Success or failure status.
- A sanitized failure classification.
Avoid recording private document contents or sensitive user data in job telemetry.
## 11. Security events and audit logging
Security-event monitoring may record:
- Authentication failures.
- Authorization denials.
- Rate-limit events.
- Rejected requests.
- Suspicious input-validation failures.
- Administrative security-sensitive actions.
Audit logs should capture attributable actions, timestamps, outcomes, and relevant record identifiers where permitted.
Security logs must not contain passwords, full tokens, session secrets, or unnecessary personal data. Protect audit records against unauthorized modification and deletion.
Monitoring records are not a substitute for application authorization or a security audit.
## 12. Storage and retention
Use `storage/jsonl-store.js` only if the implementation provides safe, bounded, and validated persistence.
For local JSON Lines storage:
- Use an explicitly configured directory.
- Prevent traversal outside the configured directory.
- Set restrictive filesystem permissions.
- Handle disk-full and write failures.
- Avoid writing secrets or private document contents.
- Rotate files and enforce retention.
- Define behavior for concurrent writes and multiple processes.
For production on Render, do not assume the application filesystem provides durable storage. Use an explicitly configured persistent disk or an external logging and monitoring service when persistence is required.
Never store logs or monitoring files in a publicly served asset directory.
## 13. Testing
Run the repository’s configured test commands. If the project uses Node’s built-in test runner, monitoring tests can follow this pattern:
```bash
node —test monitoring/tests/*.test.js
```
The test files must exist and be valid before this command can pass.
### Required test coverage
**Health checks**
- Liveness succeeds while the process is running.
- Readiness succeeds when required dependencies are healthy.
- Readiness fails when a required dependency is unavailable.
- Timeouts do not hang indefinitely.
- Shutdown state is handled correctly.
**Metrics**
- Request counters increment correctly.
- Latency measurements use consistent units.
- HTTP status classifications are correct.
- Sensitive or high-cardinality labels are rejected or avoided.
- Disabled metrics cannot be accessed.
**Logging**
- Structured records contain required fields.
- Sensitive values are redacted.
- Logging failures do not expose internal errors to clients.
**Alerts**
- Cooldowns suppress repeated alerts.
- Network requests time out.
- Failed delivery is handled safely.
- Webhook configuration is validated.
**Integration**
- Middleware is mounted before routes.
- Existing API routes continue to work.
- Missing optional monitoring files are handled according to the documented startup policy.
- Duplicate health routes are not registered.
## 14. Operational commands
Inspect installed dependencies:
```bash
npm ls express helmet cors express-rate-limit dotenv pg
```
Check server syntax:
```bash
node —check server.js
```
Check the monitoring entry point:
```bash
node —check monitoring/index.js
```
Start the application:
```bash
node server.js
```
Test the local health endpoint:
```bash
curl -i http://localhost:3000/health
```
Test liveness:
```bash
curl -i http://localhost:3000/health/live
```
Test readiness:
```bash
curl -i http://localhost:3000/health/ready
```
Only test the metrics endpoint using the authentication method actually implemented by the monitoring module.
## 15. Deployment on Render
Before deployment:
1. Set `NODE_ENV=production`.
2. Configure the production PostgreSQL connection string.
3. Configure database TLS as required by the provider.
4. Set exact CORS origins.
5. Configure trusted proxy behavior for the actual deployment topology.
6. Set a strong metrics token if protected metrics are enabled.
7. Verify monitoring middleware is mounted before application routes.
8. Confirm health endpoints use the intended readiness policy.
9. Configure centralized log collection and alert delivery where needed.
10. Test graceful shutdown and database pool cleanup.
11. Verify that test routes and debug stack traces are disabled.
12. Confirm that no monitoring data is exposed through static-file delivery.
Do not assume that a successful HTTP health response proves database readiness or complete application functionality.
## 16. Known limitations
The module must document the following limitations whenever applicable:
- In-memory metrics are lost on restart.
- Metrics are not automatically aggregated across instances.
- A local log directory is not automatically durable on a hosted platform.
- Health checks only validate dependencies explicitly registered with them.
- Alerts do not work until a delivery provider is configured and tested.
- Dashboards are configuration files, not automatically rendered dashboards.
- Error tracking and distributed tracing require separate implementations or providers.
- Environment variables do not enable functionality that has not been implemented.
- A monitoring endpoint does not replace authentication, authorization, rate limiting, or network security.
## 17. Implementation status
Treat each component as implemented only after its source file, tests, and integration have been verified.
Recommended statuses:
- `planned` — design documented, implementation not available.
- `implemented` — source code exists.
- `tested` — automated tests pass.
- `integrated` — connected to the application.
- `production_verified` — validated in the deployed environment.
Do not describe a planned component as operational.
## 18. Change management
When updating the monitoring module:
1. Preserve compatibility with the application’s supported Node.js runtime.
2. Validate configuration during initialization.
3. Add tests for new behavior.
4. Review sensitive-data handling.
5. Update this README and related schemas.
6. Check middleware and route registration order.
7. Verify failure handling and shutdown behavior.
8. Test in a non-production environment before release.
—
**Maintainer:** MedOrbits Engineering
**Module:** `monitoring/`
**Configuration reference:** `/.env.example`
**Application entry point:** `/server.js`