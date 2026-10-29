
# MedOrbits Health API

**File:** `app/api/health/README.md`  
**Version:** 2.1.1  
**Runtime:** Next.js App Router with Node.js

## 1. Purpose

The Health API provides a lightweight endpoint for monitoring application availability. Monitoring systems, deployment platforms, and uptime checks can use it to verify that the route is responding.

**Endpoint:** `GET /api/health`

Recommended implementation path: `app/api/health/route.js`

## 2. Supported methods

| Method | Behavior |
|—|—|
| `GET` | Returns the health status |
| `HEAD` | Optional; implement if required by the monitoring platform |
| Other methods | Return `405 Method Not Allowed` |

## 3. Example request

Local development:

```bash
curl -i http://localhost:3000/api/health
```

Production:

```bash
curl -i https://your-domain.example/api/health
```

## 4. Example response

A basic liveness endpoint can return:

```json
{
  “status”: “ok”,
  “service”: “medorbits-api”
}
```

Expected HTTP status: `200 OK`.

The exact response depends on the implementation in `route.js`. Do not assume database connectivity or other dependencies are checked unless the handler explicitly performs those checks.

## 5. Health-check types

### Liveness

Indicates whether the application process can respond to requests.

- Should be fast and lightweight.
- Should not depend on every external service being available.
- Can be used to detect an unresponsive application instance.

### Readiness

Indicates whether the application is ready to serve normal traffic.

- May verify essential dependencies, such as database connectivity.
- Should return a failure status when a required dependency is unavailable.
- Should not expose credentials, SQL details, internal hostnames, or stack traces.

For production deployments, consider separate endpoints:

- `/api/health` — liveness.
- `/api/health/ready` — readiness and required dependency checks.

Implement separate handlers only if they fit the application’s existing architecture and deployment requirements.

## 6. Security and operational guidance

- Return only the minimum status information required by monitoring.
- Do not include environment variables, secrets, database connection strings, or stack traces.
- Avoid expensive database queries or external API calls on every liveness request.
- Use short timeouts for readiness checks.
- Apply appropriate network access controls if dependency details could be sensitive.
- Ensure the monitoring platform checks the expected HTTP status code.
- Configure alerts for sustained failures rather than relying on a single failed request.

A public liveness endpoint may be appropriate. A readiness endpoint that reveals dependency details may need additional restrictions.

## 7. Monitoring example

A basic availability check can use:

```bash
curl —fail —silent —show-error \
  —max-time 5 \
  https://your-domain.example/api/health
```

A non-zero exit code indicates a failed request or an HTTP error response.

For scheduled monitoring, configure the hosting platform or monitoring service to check the endpoint at a suitable interval and alert on repeated failures.

## 8. Validation checklist

- [ ] `GET /api/health` returns the expected status code.
- [ ] The response is valid JSON if JSON is the documented format.
- [ ] The handler responds within the monitoring timeout.
- [ ] No secrets or internal diagnostic details are exposed.
- [ ] Liveness does not fail merely because an optional dependency is unavailable.
- [ ] Readiness checks required dependencies when implemented.
- [ ] Unsupported HTTP methods return the documented behavior.
- [ ] The endpoint works in the actual deployment environment.

## 9. Limitations

A successful health response proves only what the handler actually checks. A basic `200 OK` response does not establish that PostgreSQL, authentication, payment processing, email delivery, or other application features are working.

Test the health route and its monitoring integration in the deployed environment before relying on it for operational alerts.
