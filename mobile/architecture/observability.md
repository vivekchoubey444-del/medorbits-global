# Observability and Diagnostics

## 1. Goals

Use telemetry to diagnose reliability and performance without collecting unnecessary personal information.

## 2. Logs

Structured logs may include:
- Event name
- Timestamp
- App version and build
- Environment
- Safe request/correlation ID
- Endpoint template, not a URL containing sensitive query data
- HTTP status
- Duration
- Safe error category

Never log passwords, OTPs, tokens, private document contents, signed download URLs, raw payment credentials, or unnecessary applicant details.

## 3. Metrics

Useful aggregate metrics include:
- API latency and error rate
- Authentication failure rate
- Crash-free sessions
- Upload failure rate
- Application submission failure rate
- Offline/sync failure rate
- Notification processing failures

Do not include direct identifiers or sensitive admissions data in metric labels.

## 4. Crash reports

Review crash reporting SDK data collection and redact sensitive fields. Do not attach full request bodies or local database contents. Provide a way to disable or limit optional analytics according to product policy.

## 5. Alerting

Alerts should focus on sustained service failures, elevated error rates, upload/payment integration failures, and release regressions. Avoid alert payloads that contain applicant information.

## 6. Privacy and retention

Document purpose, access, retention, deletion, and vendor sharing for telemetry. Apply role-based access to diagnostic systems.
