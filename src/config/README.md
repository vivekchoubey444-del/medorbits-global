MedOrbits — Configuration Module

Directory: src/config/
Runtime: Node.js 20+
Module system: ECMAScript Modules (ESM)
Purpose: Centralized configuration, validation, and infrastructure setup for the MedOrbits backend.

Overview

The configuration module centralizes application settings and infrastructure configuration for the MedOrbits Node.js/Express backend.

It covers environment validation, database connectivity, email delivery, structured logging, payment configuration, background queues, HTTP security headers, CORS, and file storage.

Implementation principle: A configuration file is not proof that a feature is correctly configured, secure, or active. Every module must be reviewed against its actual environment variables, exports, imports, dependencies, and application startup behavior.

1. Directory Structure

src/
├── config/
│   ├── README.md
│   ├── env.js
│   ├── database.js
│   ├── email.js
│   ├── logger.js
│   ├── payment.js
│   ├── queue.js
│   ├── security.js
│   ├── cors.js
│   └── storage.js
│
├── integrations/
│   ├── email/
│   ├── payment/
│   ├── ai/
│   └── storage/
│
└── workers/
    └── ...

The structure above is a reference architecture. Keep existing files and directories aligned with the actual repository rather than creating empty directories solely to match the example.

2. Module Responsibilities

Module	Responsibility
env.js	Load, validate, normalize, and expose environment variables.
database.js	Manage database connections, pooling, queries, transactions, and shutdown.
email.js	Configure email delivery, message validation, transporter lifecycle, and delivery settings.
logger.js	Configure structured logging, log levels, output destinations, and redaction.
payment.js	Validate payment configuration, provider selection, credentials, and operating mode.
queue.js	Configure BullMQ queues, job options, Redis connectivity, and graceful shutdown.
security.js	Configure Helmet, HTTP security headers, and Content Security Policy.
cors.js	Configure trusted origins, credential policy, and permitted cross-origin requests.
storage.js	Resolve storage paths and validate storage boundaries, upload limits, and allowed MIME types.

3. Configuration Principles

3.1 Centralized environment settings

env.js is the authoritative source for shared environment variables.

Other configuration modules should import validated values:

import { env } from “./env.js”;

Use the correct relative path when importing from another directory.

Do not independently parse the same environment variable in multiple modules. Normalize values once, validate them centrally, and expose immutable configuration where appropriate.

3.2 Fail-fast validation

Validate essential configuration before initializing dependent services.

Validation should cover:

* Required and optional variables.
* Data types and permitted values.
* Numeric ranges and timeouts.
* URL, hostname, origin, and path formats.
* Secret presence without logging secret contents.
* Contradictory settings.
* Production-specific restrictions.
* Compatibility between providers and infrastructure.
* Missing or incompatible dependencies.

Optional services must follow an explicit policy: either remain disabled cleanly or prevent startup when the application requires them.

3.3 Safe defaults

Prefer disabled-by-default behavior for optional integrations such as payment processing and background queues until their configuration is complete.

Do not silently disable essential security controls to work around deployment errors. Production startup should reject invalid essential settings rather than fall back to insecure behavior.

4. Environment Variables

Maintain a committed .env.example containing variable names and safe placeholders. Never include actual credentials, production secrets, private keys, or real webhook signing secrets.

Typical configuration categories include:

Category	Example variables
Application	NODE_ENV, HOST, PORT, API_PREFIX
Database	DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
Logging	LOG_LEVEL, LOG_TO_FILE, LOG_DIRECTORY
CORS	CORS_ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS
Security	HELMET_ENABLED, CONTENT_SECURITY_POLICY_ENABLED
Email	EMAIL_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
Payments	PAYMENTS_ENABLED, PAYMENT_MODE, provider credentials
Queues	QUEUE_ENABLED, Redis connection settings
Storage	STORAGE_DRIVER, STORAGE_LOCAL_PATH, STORAGE_TEMP_PATH
Uploads	UPLOAD_MAX_FILE_SIZE_MB, UPLOAD_MAX_FILES, UPLOAD_MAX_TOTAL_SIZE_MB, UPLOAD_ALLOWED_MIME_TYPES
AI integrations	Provider selection, model configuration, and API credentials

These are examples, not a guarantee that every variable is currently implemented. The actual names and supported formats must match env.js and the consuming modules.

Example .env.example

NODE_ENV=development
HOST=127.0.0.1
PORT=3000
API_PREFIX=/api/v1
# Database: configure for the selected database engine.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=medorbits_dev
DB_USER=medorbits_app
DB_PASSWORD=replace_with_local_secret
# Logging
LOG_LEVEL=info
LOG_TO_FILE=false
LOG_DIRECTORY=storage/logs
# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000
CORS_ALLOW_CREDENTIALS=false
# Security
HELMET_ENABLED=true
CONTENT_SECURITY_POLICY_ENABLED=true
# Email
EMAIL_ENABLED=false
# Payments
PAYMENTS_ENABLED=false
PAYMENT_MODE=test
PAYMENT_CURRENCY=INR
# Background queues
QUEUE_ENABLED=false
# Storage
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=storage/private
STORAGE_TEMP_PATH=storage/tmp
# Upload limits
UPLOAD_MAX_FILE_SIZE_MB=25
UPLOAD_MAX_FILES=10
UPLOAD_MAX_TOTAL_SIZE_MB=100
UPLOAD_ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png

Important: Adapt the example to the parsing rules in the actual env.js. For example, an array-valued setting may require JSON syntax rather than a comma-separated string. The database port above is illustrative of MySQL; use the correct port and driver for your chosen database.

5. Database Configuration

The database configuration must agree with the actual database engine and installed driver.

Before deployment, verify:

1. The selected database engine.
2. The installed driver and its version.
3. Connection-string or individual credential formats.
4. Connection-pool limits and connection timeouts.
5. Transaction behavior and isolation requirements.
6. Startup health checks and failure behavior.
7. Graceful pool shutdown.
8. Migration and backup procedures.

Database consistency requirement: Do not mix PostgreSQL configuration and a PostgreSQL pg dependency with a MySQL adapter requiring mysql2 without an intentional, documented multi-database design.

Use least-privilege database accounts. Do not expose connection credentials in logs, error responses, health endpoints, or client-side configuration.

6. Email Configuration

Email configuration should define transport settings, sender identity, optional reply-to information, timeouts, and delivery behavior.

Operational requirements:

* Validate recipient addresses and message input.
* Use TLS settings appropriate to the SMTP provider.
* Keep credentials in secure environment settings.
* Avoid logging message bodies or sensitive recipient data.
* Handle provider failures and timeouts.
* Support graceful transporter shutdown.
* Use a verified sender domain and provider-supported sender address.

Email transport configuration does not guarantee inbox delivery. Production systems should monitor delivery failures, bounces, provider limits, and authentication configuration.

7. Logging Configuration

Use structured logs with consistent severity levels and useful operational context.

Recommended practices:

* Use fatal, error, warn, info, debug, and trace only as supported by the configured logger.
* Keep production log levels appropriate for operational needs.
* Redact passwords, authorization headers, tokens, session identifiers, API keys, database credentials, and sensitive personal information.
* Avoid logging complete requests, uploaded files, payment payloads, authentication credentials, or raw webhook bodies.
* Apply file permissions and log-retention policies where local logging is enabled.
* Ensure log output can be flushed or closed during graceful shutdown.

Redaction rules cannot reliably remove secrets from every arbitrary string. Do not pass secrets to logging functions in the first place.

8. CORS and HTTP Security

CORS

Restrict browser cross-origin access to explicitly trusted origins.

Verify:

* Allowed origins.
* Allowed methods and request headers.
* Credential requirements.
* Preflight behavior.
* Middleware ordering.
* Development and production differences.

CORS is a browser access policy, not an authentication or authorization mechanism.

HTTP security headers

Configure Helmet and Content Security Policy according to the actual frontend and integrations.

Review:

* Content Security Policy directives.
* Frame restrictions.
* Referrer policy.
* MIME-sniffing protection.
* Cross-origin resource policies.
* HTTPS and HSTS requirements.

Enable HSTS only when the relevant domain and subdomains are ready for HTTPS. Test CSP changes in staging and resolve browser violations by allowing only verified, necessary resources.

Do not add broad wildcard sources or unsafe script permissions simply to silence errors.

9. Payment Configuration

Payment configuration defines supported providers, operating mode, currency, credential requirements, and provider-specific settings.

Before enabling payments:

1. Select the intended provider.
2. Validate required credentials.
3. Confirm test or live mode consistency.
4. Validate supported currencies and provider restrictions.
5. Keep API secrets and webhook signing secrets private.
6. Verify webhook signatures using the provider’s documented procedure.
7. Validate order IDs, amounts, currencies, and transaction states.
8. Implement idempotency and replay protection.
9. Reconcile payment states with provider records.
10. Monitor failed webhooks and payment discrepancies.

Configuration validation alone does not implement a secure payment lifecycle. Never treat a client-side success response as proof of payment.

Use test credentials in development and staging. Enable live processing only through an explicit production deployment procedure.

10. Background Queues

The queue module uses BullMQ with a compatible Redis connection.

Verify:

* Redis client compatibility.
* Queue enablement and initialization.
* Worker process startup.
* Retry and backoff policies.
* Job retention settings.
* Job payload size and serialization.
* Concurrency and rate limits.
* Failed-job handling and observability.
* Graceful shutdown ordering.

Queue payloads should contain opaque identifiers and minimal necessary metadata. Do not place passwords, OTPs, payment secrets, session tokens, or raw document contents in job payloads.

A configured queue does not automatically process jobs. Ensure that the corresponding workers are started in the appropriate process.

11. File Storage and Uploads

Keep private uploads outside the public web root.

The storage module should validate:

* Storage driver and configured paths.
* Separation between private and temporary directories.
* Directory boundaries and symbolic links.
* Directory permissions.
* Maximum individual file size.
* Maximum file count and total request size.
* Allowed MIME types.

The upload service must additionally:

* Validate file signatures and actual content.
* Treat client-supplied filenames and MIME types as untrusted.
* Generate safe server-side filenames.
* Enforce ownership and access permissions.
* Prevent path traversal.
* Clean up abandoned temporary files.
* Apply malware scanning where appropriate.
* Enforce storage quotas and monitor disk capacity.

For object storage, configure private access, least-privilege credentials, encryption, retention, and signed access URLs where required.

Filesystem checks reduce risk but cannot eliminate every race condition when untrusted processes can modify parent directories concurrently.

12. Integration Boundaries

Keep application-wide configuration in src/config/ and provider-specific implementations in src/integrations/.

Example:

src/
├── config/
│   ├── env.js
│   ├── database.js
│   ├── email.js
│   ├── logger.js
│   ├── payment.js
│   ├── queue.js
│   ├── security.js
│   ├── cors.js
│   └── storage.js
│
└── integrations/
    ├── email/
    ├── payment/
    ├── ai/
    └── storage/

Configuration modules define and validate settings. Integration modules communicate with external providers. Service modules implement application use cases and business rules.

Avoid duplicating credentials, independently parsing shared environment variables, or placing business logic inside configuration modules.

13. Application Startup and Shutdown

The actual startup sequence must follow the dependency graph of server.js, the Express application, and the worker entry points.

Recommended startup sequence:

1. Load environment variables.
2. Validate essential environment configuration.
3. Initialize logging.
4. Initialize and verify required infrastructure.
5. Configure security headers and CORS.
6. Initialize required provider integrations.
7. Register routes and error-handling middleware.
8. Start required background workers.
9. Start accepting HTTP requests after required startup checks succeed.

Do not initialize all optional integrations unconditionally. Disabled integrations should remain inactive; required integrations should fail clearly when they cannot initialize.

Graceful shutdown

On supported shutdown signals:

1. Stop accepting new HTTP requests.
2. Stop accepting new background jobs where applicable.
3. Allow in-flight requests and jobs to finish within a defined deadline.
4. Close queue instances and workers.
5. Close email transports and other integrations.
6. Close database pools and Redis connections in dependency-safe order.
7. Flush and close logging destinations.
8. Exit with an appropriate process status.

Make shutdown handlers idempotent. Set a bounded shutdown timeout so an unresponsive dependency cannot indefinitely prevent termination.

14. Environment-Specific Requirements

Environment	Requirements
Development	Local credentials, isolated services, diagnostic logs, and safe test integrations.
Testing	Isolated test data, deterministic setup, mocked or controlled external services, and invalid-configuration tests.
Staging	Production-like infrastructure, test payment credentials, deployment checks, and integration validation.
Production	Secure secret injection, HTTPS, least privilege, monitoring, backups, tested rollback, and strict startup validation.

Do not use production credentials or production customer data in ordinary development and automated testing.

15. Testing and Verification

Before deployment, verify each module independently and as part of the application.

Recommended checks:

* Valid and invalid environment settings.
* Missing required variables.
* Invalid origins and CSP sources.
* Database connection and transaction failures.
* Email transport failures and timeouts.
* Payment mode and credential mismatches.
* Redis disconnection and queue initialization failures.
* Queue retry and shutdown behavior.
* Storage path boundaries and symbolic-link rejection.
* Upload size, MIME, and file-content validation.
* Secret redaction in structured logs.
* Startup failure and graceful shutdown.
* Compatibility with the deployed Node.js version.

Run the repository’s existing validation commands, for example:

npm run check
npm test

Run only commands defined in the actual package.json. If optional tools or test frameworks are not installed, add them deliberately rather than assuming they are available.

16. Troubleshooting

Startup fails

Inspect validation errors, module imports, dependency installation, environment variable names, and initialization order. Do not print secret values to diagnose configuration problems.

Database connection fails

Check the database engine, driver, host, port, credentials, network access, pool settings, and database health.

Email delivery fails

Check SMTP connectivity, authentication, TLS requirements, sender verification, and provider limits.

Payments fail

Verify provider credentials, operating mode, webhook verification, order state transitions, and provider-side status.

Queues do not process jobs

Check Redis connectivity, BullMQ compatibility, worker startup, job retention, retry policy, and failed-job records.

CORS errors occur

Inspect the browser’s origin, preflight response, allowed headers, methods, credential policy, and middleware ordering.

CSP blocks a resource

Use browser developer tools to identify the blocked resource. Add only the verified origin or directive needed, then retest.

File uploads fail

Check storage permissions, directory configuration, available disk space, request-size limits, file validation, and temporary-file cleanup.

17. Maintenance and Change Management

For every configuration change:

1. Update the relevant module.
2. Update env.js and .env.example.
3. Document the setting and its default.
4. Add or update automated tests.
5. Review dependent imports and exports.
6. Verify startup and shutdown.
7. Test in staging.
8. Review security and operational implications before production deployment.

Keep this README synchronized with the actual implementation. Do not document a setting as supported until its parser, validator, and consumers are implemented.

18. Operational Monitoring

Monitor the infrastructure and integrations relevant to the deployment:

* Database availability and pool saturation.
* Redis availability and queue backlog.
* Worker failures and retry rates.
* Email delivery errors.
* Payment and webhook failures.
* Storage capacity and temporary-file accumulation.
* Application error rates and latency.
* Security configuration drift.
* Backup completion and restore readiness.

Monitoring should use actionable health checks and alerts without exposing credentials or sensitive application data.

Related Documentation

* docs/README.md — Documentation index.
* docs/security/ — Security policies and implementation guidance.
* docs/database/ — Database architecture and operations.
* docs/deployment/ — Deployment configuration and procedures.
* infrastructure/monitoring/ — Monitoring and alerting.
* infrastructure/backup/ — Backup and restore procedures.

Directory references above are intended documentation links; verify that the corresponding files and folders exist.

⸻

MedOrbits — Study · Work · Grow

Centralized configuration for a maintainable, secure, and deployment-ready application.