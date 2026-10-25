
# MedOrbits Health API

**File:** `app/api/health/README.md`  
**Endpoint:** `/api/health`  
**Runtime:** Node.js 20+  
**Framework:** Next.js App Router  
**Purpose:** Application liveness and optional database readiness monitoring.

—

## 1. Overview

The MedOrbits Health API provides a lightweight endpoint for monitoring application availability and deployment health.

It supports:

- Application liveness checks.
- Optional PostgreSQL readiness checks.
- HTTP status codes suitable for monitoring systems.
- Cache-disabled health responses.
- Safe error handling without exposing credentials or database connection details.
- `GET`, `HEAD`, and `OPTIONS` methods.

The endpoint is intended for deployment health checks, uptime monitoring, and operational diagnostics.

## 2. Directory Structure

```text
app/
└── api/
    └── health/
        ├── route.js
        └── README.md
```

## 3. Available Endpoints

| Method | Endpoint | Purpose |
|—|—|—|
| `GET` | `/api/health` | Application liveness check |
| `GET` | `/api/health?check=live` | Explicit liveness check |
| `GET` | `/api/health?check=readiness` | Optional dependency readiness check |
| `HEAD` | `/api/health` | Status and headers without a response body |
| `OPTIONS` | `/api/health` | Advertises supported HTTP methods |

Unsupported `check` query values return `400 Bad Request`.

## 4. Liveness Check

Request:

```http
GET /api/health
```

Example response:

```json
{
  “success”: true,
  “status”: “ok”,
  “service”: “medorbits-api”,
  “timestamp”: “2026-10-25T12:00:00.000Z”,
  “uptimeSeconds”: 120,
  “checks”: {
    “application”: “ok”
  }
}
```

The timestamp and uptime above are illustrative.

A successful liveness check indicates that the route handler is executing. It does not prove that PostgreSQL, WhatsApp, or other external dependencies are available.

## 5. Readiness Check

Request:

```http
GET /api/health?check=readiness
```

The handler checks PostgreSQL only when the following environment variable is enabled:

```dotenv
HEALTH_CHECK_DATABASE=true
```

When database checking is disabled, the response reports:

```json
{
  “success”: true,
  “status”: “ok”,
  “checks”: {
    “application”: “ok”,
    “database”: “not_checked”
  },
  “readiness”: “ok”
}
```

When database checking is enabled and the connection succeeds:

```json
{
  “success”: true,
  “status”: “ok”,
  “checks”: {
    “application”: “ok”,
    “database”: “ok”
  },
  “readiness”: “ready”
}
```

When the database check fails:

```json
{
  “success”: false,
  “status”: “degraded”,
  “checks”: {
    “application”: “ok”,
    “database”: “error”
  },
  “readiness”: “not_ready”
}
```

A failed readiness check returns HTTP `503 Service Unavailable`.

The exact response may contain additional fields, such as a timestamp, uptime, or request ID.

## 6. Environment Variables

Configure environment variables in the local development environment or deployment provider.

| Variable | Required | Description |
|—|—|—|
| `DATABASE_URL` | Conditional | PostgreSQL connection string |
| `HEALTH_CHECK_DATABASE` | No | Set to `true` to enable database checks |
| `HEALTH_CHECK_TIMEOUT_MS` | No | Database connection/query timeout, capped at 10,000 ms |
| `DATABASE_SSL` | No | Set to `true` to enable the handler’s configured TLS option |

Example:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
HEALTH_CHECK_DATABASE=true
HEALTH_CHECK_TIMEOUT_MS=3000
DATABASE_SSL=true
```

Replace the placeholder connection details with credentials from your database provider. Do not commit real secrets to source control.

**Database driver:** The readiness check dynamically imports `pg`. Install it if it is not already a project dependency:

```bash
npm install pg
```

### Database TLS considerations

The route’s current implementation enables TLS with certificate verification when `DATABASE_SSL=true`. Confirm that this configuration matches your PostgreSQL provider. Do not disable certificate verification as a workaround for certificate errors in production.

## 7. HTTP Status Codes

| Status | Meaning |
|—|—|
| `200 OK` | Application is live or readiness checks passed |
| `204 No Content` | OPTIONS preflight response |
| `400 Bad Request` | Unsupported health-check mode |
| `503 Service Unavailable` | Enabled readiness check failed |

The `HEAD` handler currently returns `200` without executing the database readiness check. Use the `GET` readiness endpoint when dependency availability must be verified.

## 8. Security and Privacy

Health endpoints should disclose only the minimum information needed by monitoring infrastructure.

The implementation is designed to:

- Avoid returning database connection strings.
- Avoid exposing database exception messages.
- Avoid returning access tokens or other secrets.
- Disable response caching.
- Limit the length of the optional `x-request-id` response value.
- Avoid performing external dependency checks during ordinary liveness requests.

### Production recommendations

1. Restrict detailed readiness checks to trusted infrastructure where practical.
2. Use network controls, gateway rules, or authentication if health diagnostics must be private.
3. Do not include environment variables, stack traces, SQL details, internal IP addresses, or credentials in health responses.
4. Monitor repeated `503` responses.
5. Configure monitoring timeouts appropriate to the deployment environment.
6. Keep liveness checks lightweight to avoid unnecessary database load.
7. Ensure the hosting platform’s health-check path matches the deployed route.

**Important:** A request ID supplied by the client is not proof of identity. The current handler echoes a truncated request ID but does not authenticate it.

## 9. Deployment Configuration

For deployment platforms such as Render or other Node.js hosting providers, configure the health-check path as:

```text
/api/health
```

Use the liveness endpoint for process availability checks.

Use the readiness endpoint only when you want database availability to influence readiness decisions and have enabled the database check.

### Deployment checklist

- [ ] `app/api/health/route.js` exists and is committed.
- [ ] The application builds successfully.
- [ ] `DATABASE_URL` is configured if PostgreSQL checks are enabled.
- [ ] The `pg` package is installed if database checks are enabled.
- [ ] Database TLS settings match the provider.
- [ ] The hosting provider points to `/api/health`.
- [ ] The route returns `200` after deployment.
- [ ] The readiness route returns `503` when a required database check fails.
- [ ] Health responses do not disclose secrets.
- [ ] Monitoring alerts are configured for persistent failures.

## 10. Local Testing

Start the development server:

```bash
npm run dev
```

Test liveness:

```bash
curl -i http://localhost:3000/api/health
```

Test explicit liveness:

```bash
curl -i “http://localhost:3000/api/health?check=live”
```

Test readiness:

```bash
curl -i “http://localhost:3000/api/health?check=readiness”
```

Test an unsupported mode:

```bash
curl -i “http://localhost:3000/api/health?check=invalid”
```

Test the HEAD response:

```bash
curl -I http://localhost:3000/api/health
```

Test OPTIONS:

```bash
curl -i -X OPTIONS http://localhost:3000/api/health
```

### Expected outcomes

- Liveness: `200 OK`.
- Readiness with database checking disabled: `200 OK`.
- Readiness with database checking enabled and a healthy database: `200 OK`.
- Readiness with database checking enabled and a failed database check: `503 Service Unavailable`.
- Unsupported mode: `400 Bad Request`.
- HEAD: `200 OK` with no response body.
- OPTIONS: `204 No Content`.

## 11. Troubleshooting

### The endpoint returns 404

Verify that the file is located at `app/api/health/route.js`, that the application is running the expected build, and that the URL is `/api/health`.

### Readiness returns 503

Check the server-side logs and verify:

- `DATABASE_URL` is correct.
- The database is reachable from the deployed application.
- The database user has permission to connect and execute `SELECT 1`.
- TLS configuration matches the database provider.
- The timeout is sufficient for the deployment environment.

The API intentionally returns a generic database error instead of exposing connection details.

### Database checking fails because `pg` is missing

Install the package and redeploy:

```bash
npm install pg
```

### The hosting platform reports a failed health check

Confirm that the deployment is listening on the configured port and that `/api/health` is reachable through the deployed service. Inspect server logs and platform health-check settings.

## 12. Operational Limitations

- This endpoint does not authenticate monitoring requests by itself.
- It does not check WhatsApp availability.
- It does not prove that lead submissions or contact notifications are functioning end to end.
- Database readiness is disabled unless explicitly enabled.
- A successful health response does not guarantee that all application features are operational.
- The handler opens a database connection for each enabled readiness check; high-frequency monitoring may require connection pooling or a dedicated monitoring strategy.
- A health check should not be used as a substitute for application metrics, error monitoring, database monitoring, or synthetic end-to-end tests.

## 13. Recommended Future Enhancements

As the MedOrbits backend grows, consider adding:

- A separate internal diagnostics endpoint.
- Structured metrics and uptime monitoring.
- A dedicated readiness policy for required dependencies.
- Rate limiting for public diagnostic endpoints where appropriate.
- Integration tests for liveness, readiness, and database failure.
- Alerts for sustained service degradation.

Keep public health responses minimal and place sensitive operational diagnostics behind appropriate access controls.

—

**Maintainer:** MedOrbits Engineering  
**Component:** Health API  
**Last reviewed:** 25 October 2026
