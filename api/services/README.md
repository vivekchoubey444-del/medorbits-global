MedOrbits API Services

Directory: api/services/
Purpose: Centralize business logic, database operations, application workflows, audit logging, and notification management for the MedOrbits API.

1. Directory Structure

api/
└── services/
    ├── README.md
    ├── application-service.js
    ├── application-service-2.js
    ├── audit-service.js
    └── notification-service.js

This structure reflects the service files established during development. Keep it synchronized with the actual repository. Before production integration, determine whether application-service.js and application-service-2.js should be merged or whether they serve distinct responsibilities.

2. Service Responsibilities

Service	Responsibility
application-service.js	Application creation, retrieval, filtering, updates, and workflow transitions.
application-service-2.js	Alternative or extended application workflow implementation, including status history and transaction handling.
audit-service.js	Security events, administrative actions, resource activity, and audit-history queries.
notification-service.js	In-app notifications, recipient-specific delivery records, unread counts, and read-state management.

Application service

The application service manages application lifecycle operations.

Expected responsibilities include:

* Create applications associated with the authenticated applicant.
* Retrieve applications with ownership checks.
* List applications with pagination and filtering.
* Update eligible draft applications.
* Submit, review, approve, reject, or withdraw applications according to configured workflow rules.
* Record status changes in the application’s history table.
* Enforce valid status transitions.
* Return consistent application-service errors.

Application types and eligibility requirements should be defined by the MedOrbits business domain rather than accepted blindly from client input.

Audit service

The audit service records significant events for security, compliance, troubleshooting, and accountability.

Examples include:

* application.created
* application.submitted
* application.status_changed
* user.login_failed
* user.permission_denied
* notification.created
* admin.user_updated

Audit records should identify the actor, action, resource, outcome, request ID, and timestamp where available.

Never log passwords, authentication tokens, session cookies, or unnecessary sensitive personal information. Restrict access to audit-history queries and protect records against unauthorized modification or deletion.

Notification service

The notification service manages in-app notification records.

Expected responsibilities include:

* Create a notification for an authorized recipient.
* Create notifications for a bounded list of recipients.
* Retrieve notifications belonging to the authenticated user.
* Filter notifications by type and read state.
* Count unread notifications.
* Mark individual or all notifications as read.
* Mark notifications as unread.
* Delete or clear notifications according to the application’s retention policy.

Email, SMS, push notifications, and real-time WebSocket delivery should be handled by dedicated adapters or background workers rather than assumed to occur when an in-app record is created.

⸻

3. Architecture Principles

The recommended request flow is:

HTTP Request
     |
     v
Express Route
     |
     v
Authentication Middleware
     |
     v
Authorization and Validation
     |
     v
Controller
     |
     v
Service Layer
     |
     v
Repository / PostgreSQL
     |
     v
HTTP Response

Audit logging and notification creation can be triggered by business operations when required.

Responsibilities by layer

Routes

* Define HTTP methods and endpoint paths.
* Attach appropriate middleware.
* Delegate requests to controllers.

Middleware

* Authenticate requests.
* Enforce authorization.
* Validate input.
* Apply rate limits.
* Handle cross-cutting request concerns.

Controllers

* Read validated request data.
* Obtain the authenticated actor from trusted authentication context.
* Call the appropriate service.
* Return the expected HTTP response.
* Forward errors to centralized error handling.

Services

* Implement business rules.
* Validate domain-specific invariants.
* Coordinate database operations.
* Enforce ownership and workflow requirements.
* Coordinate audit events and notifications.

Database layer

* Execute parameterized SQL.
* Enforce constraints and relationships.
* Support transactions where required.
* Apply migrations and indexes.

⸻

4. PostgreSQL Integration

Services should receive the existing database pool through dependency injection rather than creating a new connection pool independently.

Example:

‘use strict’;
const db = require(‘../config/database’);
const {
  createApplicationService,
} = require(‘./application-service’);
const {
  createAuditService,
} = require(‘./audit-service’);
const {
  createNotificationService,
} = require(‘./notification-service’);
const applicationService = createApplicationService({ db });
const auditService = createAuditService({ db });
const notificationService = createNotificationService({ db });
module.exports = {
  applicationService,
  auditService,
  notificationService,
};

Adapt the database import path to the actual project structure. Ensure the database module exports a compatible pg pool.

Database conventions

* Use parameterized SQL for all values.
* Use database constraints for critical invariants.
* Use transactions for related writes that must succeed or fail together.
* Keep database schema migrations under version control.
* Avoid issuing DDL statements from ordinary request handlers.
* Never return raw SQL errors to clients.
* Use connection pooling and release transaction clients reliably.

Transaction handling

When a business operation changes an application and writes its status history, both writes should occur in the same transaction.

The same principle applies when a notification or audit event must be guaranteed to commit with a business change.

For critical audit records, define a clear failure policy. If the audit record is mandatory, the business transaction should not commit when the audit write fails. If the audit record is supplementary, use an explicitly documented alternative such as a transactional outbox.

Do not use a separate pool query for an audit write that must be part of an existing transaction. Pass the same transaction client to the relevant service.

⸻

5. Application Workflow

The application workflow uses explicit states.

Status	Meaning
draft	Application is being prepared.
submitted	Applicant has submitted the application.
under_review	Authorized staff are reviewing the application.
documents_required	Additional documents or information are required.
approved	Application has been approved.
rejected	Application has been rejected.
withdrawn	Application has been withdrawn.

A service should reject transitions that are not permitted by its workflow configuration.

The status list above is a proposed shared convention. Verify that both application service implementations and the database schema use the same states and permitted transitions.

Workflow requirements

* Associate each application with its authenticated applicant.
* Do not trust a client-supplied applicant ID.
* Verify ownership before reading or modifying an application.
* Restrict review decisions to authorized staff.
* Record previous and new statuses.
* Capture the actor responsible for a transition.
* Use database transactions for state changes and history records.
* Prevent concurrent updates from bypassing transition rules.

⸻

6. Audit Event Conventions

Use consistent, machine-readable action names.

Recommended format:

<resource>.<action>

Examples:

application.created
application.updated
application.submitted
application.approved
application.rejected
notification.created
notification.marked_read
user.login_failed
admin.permission_changed

Recommended event fields:

Field	Description
actorId	Authenticated user or system actor.
action	Machine-readable event name.
resourceType	Resource category.
resourceId	Relevant resource identifier.
outcome	Success, failure, denial, or error.
requestId	Request correlation identifier.
ipAddress	Client IP when justified and correctly resolved.
userAgent	User-agent information where appropriate.
metadata	Minimal, non-sensitive event context.

Example:

await auditService.recordSuccess({
  actorId: actor.id,
  action: ‘application.submitted’,
  resourceType: ‘application’,
  resourceId: application.id,
  requestId,
  metadata: {
    applicationType: application.application_type,
    previousStatus: ‘draft’,
    newStatus: ‘submitted’,
  },
});

The example assumes the audit service instance and actor context are available. Do not log the complete request body or sensitive documents.

⸻

7. Notification Conventions

Keep notification categories consistent across services and client interfaces.

Suggested categories include:

* general
* account
* application
* admission
* document
* payment
* security
* system
* support
* career

Suggested priorities:

* low
* normal
* high
* urgent

Example:

await notificationService.create({
  recipientId: applicant.id,
  type: ‘application’,
  priority: ‘normal’,
  title: ‘Application submitted’,
  message: ‘Your application has been submitted successfully.’,
  actionUrl: ‘/applications’,
  metadata: {
    applicationId: application.id,
  },
});

The service must be called only after the caller has established authority to notify the recipient.

Notification delivery

Creating a database record is not equivalent to sending a message through email, SMS, or push notification providers.

For reliable external delivery, consider:

* A background job queue.
* Retry policies with backoff.
* Idempotency keys.
* Delivery-attempt tracking.
* Provider response logging with sensitive-data redaction.
* Dead-letter handling for permanently failed jobs.

Use a transactional outbox when notifications must not be lost after a successful business transaction.

⸻

8. Error Handling

Services should use structured errors that the centralized API error handler can translate into HTTP responses.

Recommended status codes:

HTTP status	Usage
400	Invalid input or unsupported operation.
401	Authentication is missing or invalid.
403	The actor is not authorized to perform the operation.
404	Resource does not exist or is intentionally concealed.
409	Invalid state transition or conflicting update.
429	Rate limit exceeded, generally enforced by middleware.
500	Unexpected server-side failure.

A service error may include:

{
  message: ‘The application is no longer editable.’,
  statusCode: 409,
  code: ‘APPLICATION_NOT_EDITABLE’
}

The actual error properties must match the error-handler implementation used by the application.

Error-handling rules

* Do not expose database internals.
* Preserve the original error for protected server-side diagnostics.
* Avoid converting every failure into a client error.
* Do not silently ignore failed mandatory audit writes.
* Use a consistent response envelope at the HTTP boundary.
* Avoid logging secrets or full sensitive payloads.

⸻

9. Security Requirements

Authorization

* Derive actor identity from verified authentication context.
* Enforce ownership checks on every user-specific operation.
* Restrict bulk notification creation to authorized callers.
* Restrict audit-history queries to authorized roles.
* Verify permissions for administrative changes.
* Never trust roles or user IDs supplied in an untrusted request body.

Input validation

* Validate required fields and field lengths.
* Allowlist fields that clients may modify.
* Reject unexpected properties on sensitive write endpoints.
* Validate pagination and filter parameters.
* Validate URLs before storing them as action links.
* Use parameterized SQL.
* Apply request-body size limits.

Data protection

* Never persist raw passwords or bearer tokens in metadata.
* Limit stored personal information to what the service requires.
* Apply retention and deletion policies.
* Protect sensitive document references.
* Restrict access to audit data.
* Consider encryption requirements for sensitive records.

Reliability

* Use transactions for related database writes.
* Add database indexes based on actual query patterns.
* Handle concurrent updates explicitly.
* Use idempotency where duplicate requests could cause harmful effects.
* Monitor failed background jobs and audit writes.

⸻

10. Recommended Database Indexes

Confirm that equivalent indexes do not already exist before creating additional ones.

Examples:

CREATE INDEX IF NOT EXISTS applications_applicant_created_idx
    ON applications (applicant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_status_created_idx
    ON applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS application_history_resource_idx
    ON application_status_history
       (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON notifications (recipient_id, created_at DESC)
    WHERE read_at IS NULL;

These statements assume the documented tables and columns exist. Introduce schema changes through the project’s migration system and evaluate indexes against query plans and write volume.

⸻

11. Testing Checklist

Before deployment, verify:

* [ ]	Services initialize using the existing database pool.
* [ ]	All SQL queries use parameterized values.
* [ ]	Missing or invalid actor context is rejected.
* [ ]	Users cannot read or modify another user’s application.
* [ ]	Draft-only updates reject non-draft applications.
* [ ]	Invalid status transitions are rejected.
* [ ]	Status history and status changes are transactionally consistent.
* [ ]	Audit records exclude sensitive information.
* [ ]	Unauthorized users cannot query audit history.
* [ ]	Notifications are visible only to their recipients.
* [ ]	Unread counts exclude expired notifications where configured.
* [ ]	Pagination rejects invalid values and enforces maximum limits.
* [ ]	Database failures are handled without exposing internal details.
* [ ]	Concurrent status changes do not bypass workflow rules.
* [ ]	Integration tests cover rollback behavior.
* [ ]	Background notification delivery retries failures safely.

Run the test and lint commands defined in package.json; do not assume script names without checking the repository.

⸻

12. Maintenance and Compatibility

* Keep service functions focused on business responsibilities.
* Avoid duplicating application workflow logic across service files.
* Consolidate overlapping implementations when behavior is equivalent.
* Document changes to schemas, statuses, error codes, and exported methods.
* Keep role names consistent with authentication and authorization middleware.
* Keep audit action names and notification categories consistent across the application.
* Review dependencies and security advisories regularly.

Production readiness

This README documents the intended service architecture. It does not prove that the services, database schema, authorization controls, migrations, or tests are correctly configured.

Before production deployment, verify the actual source files, database schema, route integration, role model, transaction boundaries, and automated test results.