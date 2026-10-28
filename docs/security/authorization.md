
# MedOrbits Authorization and Access Control Policy

**File:** `/docs/security/authorization.md`  
**Policy version:** 1.0.0  
**Status:** Active  
**Applies to:** MedOrbits web application, REST APIs, administrative tools, background workers, document storage, and database access.

—

## 1. Purpose

This document defines the authorization requirements for protecting MedOrbits accounts, admissions applications, educational records, uploaded documents, administrative functions, notifications, and internal services.

Authorization determines whether an authenticated identity is permitted to perform a specific action on a specific resource.

Authentication alone does not grant access to every resource.

## 2. Security principles

All MedOrbits services MUST follow these principles:

1. **Deny by default:** Requests without an explicit authorization decision are denied.
2. **Least privilege:** Grant only the permissions necessary for a task.
3. **Server-side enforcement:** Never rely on hidden buttons, frontend checks, or client-supplied role values.
4. **Resource ownership:** Users may access only resources they own or have explicitly been authorized to access.
5. **Separation of duties:** Administrative, admissions-review, support, and security privileges MUST be separated where practical.
6. **Consistent enforcement:** Apply authorization checks to every API endpoint and resource operation.
7. **Auditable decisions:** Record security-sensitive authorization failures and privileged actions.
8. **Revocation:** Permission changes, account suspension, and session revocation MUST take effect promptly.
9. **Minimal disclosure:** Error responses MUST NOT reveal confidential records or internal security configuration.
10. **Secure defaults:** New endpoints and resources MUST remain inaccessible until their access policy is implemented.

## 3. Authentication and authorization

Authentication verifies the identity of a user or service.

Authorization determines what that identity can do.

Protected routes MUST authenticate the request before executing business logic. Authorization MUST then evaluate the user’s current account status, required permission, resource scope, and relevant application-specific conditions.

Unauthenticated requests to protected resources SHOULD return HTTP `401 Unauthorized`.

Authenticated requests lacking permission SHOULD return HTTP `403 Forbidden`, or HTTP `404 Not Found` when deliberately concealing resource existence is appropriate.

## 4. Roles and permissions

MedOrbits MAY implement role-based access control (RBAC), supplemented by resource ownership and contextual policies.

The following roles are conceptual policy categories. They MUST be mapped to actual roles and permissions defined by the application before deployment.

| Role | Intended access |
|—|—|
| `user` | Manage own profile, applications, documents, and notifications |
| `applicant` | Manage permitted admissions applications and related documents |
| `admissions_officer` | Review assigned applications and authorized admissions records |
| `support` | Access minimum information needed for approved support tasks |
| `content_manager` | Manage authorized public education and career content |
| `auditor` | Read authorized audit records without modifying them |
| `admin` | Perform approved administrative operations |
| `security_admin` | Manage security policies and access controls |
| `service_worker` | Execute narrowly scoped machine-to-machine tasks |

The database’s `users.role` field MUST NOT be treated as sufficient authorization by itself. The application MUST validate roles and enforce the associated permissions on the server.

Unknown roles MUST receive no privileged permissions.

### 4.1 Permission naming

Use explicit, action-oriented permissions where practical:

- `profile:read:self`
- `profile:update:self`
- `application:create:self`
- `application:read:self`
- `application:update:draft:self`
- `application:submit:self`
- `application:review:assigned`
- `application:decide:assigned`
- `document:upload:self`
- `document:read:authorized`
- `notification:read:self`
- `notification:update:self`
- `audit:read`
- `access_request:review`
- `user:suspend`
- `role:assign`

The permission names above are examples, not automatically active grants. Implementations MUST define the actual permission registry and role mappings.

## 5. Resource ownership and tenant boundaries

For every resource operation, the server MUST verify the relationship between the requesting principal and the requested resource.

For an application belonging to an applicant, authorization MUST verify ownership through the application’s `applicant_id` and the authenticated user’s internal identifier.

Example:

```sql
SELECT a.*
FROM medorbits.applications AS a
WHERE a.public_id = $1
  AND a.applicant_id = $2;
```

Here, `$1` MUST be a validated resource identifier and `$2` MUST come from trusted server-side authentication context, never from an untrusted request body.

Additional conditions may be required for account status, assignment, institution, application state, and delegated access.

Changing an identifier in a URL or request body MUST NOT allow a user to access another user’s records.

If the application supports organizations, institutions, or multiple tenants, tenant membership MUST be checked on every relevant query and mutation.

## 6. Application lifecycle authorization

Application permissions MUST be enforced against the current application status.

Recommended policy:

| Action | Default policy |
|—|—|
| Create application | Authenticated applicant |
| Read application | Owner or specifically authorized staff |
| Edit draft | Owner while status is `draft` |
| Submit application | Owner while status permits submission |
| Review application | Authorized admissions officer |
| Request additional documents | Authorized admissions officer |
| Approve or reject | Explicit decision permission |
| Withdraw application | Owner when withdrawal is permitted |
| Override a final decision | Restricted, separately authorized workflow |

These rules are application requirements, not automatic consequences of the database schema.

The server MUST validate every state transition. A valid transition MUST be enforced transactionally so concurrent requests cannot bypass the workflow.

The `version` column in `applications` SHOULD be used for optimistic concurrency control where concurrent editing is possible.

## 7. Document authorization

Documents may contain identity records, academic credentials, financial evidence, or other confidential information.

The application MUST:

- Authenticate and authorize every document download.
- Verify access to the parent application before returning a file.
- Store files outside publicly served directories.
- Use opaque storage keys rather than user-controlled filesystem paths.
- Reject path traversal and unauthorized storage-key manipulation.
- Enforce upload size, permitted content types, and content inspection.
- Scan uploaded files before making them available for normal use.
- Prevent access to files with `pending`, `infected`, or `failed` scan status unless an explicitly authorized quarantine workflow applies.
- Record document uploads, downloads, deletions, and privileged access where appropriate.
- Use short-lived, narrowly scoped signed URLs if direct object-storage access is required.

A MIME type supplied by a client MUST NOT be treated as proof of the actual file type.

Public file URLs MUST NOT expose private admissions documents.

## 8. Administrative access

Administrative capabilities MUST be restricted to authenticated, explicitly authorized accounts.

High-risk actions SHOULD require additional safeguards, such as multi-factor authentication, recent reauthentication, approval workflows, or independent review.

Examples include:

- Changing user roles or privileges.
- Suspending or disabling accounts.
- Viewing bulk admissions records.
- Accessing quarantined documents.
- Changing access-control policies.
- Exporting personal or educational records.
- Modifying security settings.
- Accessing audit logs.

A general administrator SHOULD NOT automatically receive unrestricted access to every sensitive operation when narrower privileges are practical.

Administrative APIs MUST NOT trust role names or permission lists supplied by the browser.

## 9. Access requests and delegated access

Access requests MUST be treated as requests for authorization, not as authorization grants.

Approval MUST be performed by a properly authorized reviewer.

The system MUST record the requester, requested resource, decision, reviewer, and timestamps.

Delegated access MUST be explicit, scoped to the necessary resources and actions, and revocable.

Delegation MUST NOT silently grant access to unrelated records.

## 10. Session and token security

For cookie-based authentication:

- Use `HttpOnly`, `Secure` in production, and an appropriate `SameSite` policy.
- Protect state-changing requests against cross-site request forgery where applicable.
- Rotate session identifiers after authentication and privilege changes.
- Revoke sessions on logout and account suspension where supported.

For bearer tokens:

- Validate signature, issuer, audience, expiration, and relevant claims.
- Use short-lived access tokens and a controlled refresh-token lifecycle.
- Do not store long-lived credentials in URLs.
- Never accept a client-supplied role as a replacement for server-side authorization.
- Revalidate permissions or use a revocation strategy appropriate to token lifetime and risk.

Credentials and tokens MUST NOT appear in logs, audit metadata, error messages, or committed configuration files.

## 11. API implementation requirements

Every protected route MUST declare or inherit an explicit authentication and authorization policy.

Recommended processing order:

1. Validate request structure and input types.
2. Authenticate the caller.
3. Confirm account and session status.
4. Resolve the requested resource safely.
5. Evaluate action permissions and resource ownership.
6. Enforce workflow and business constraints.
7. Execute the operation transactionally where needed.
8. Record relevant audit events.
9. Return only authorized response fields.

Example Express pattern:

```javascript
function requirePermission(permission) {
  return function authorizationMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: “Authentication required”
      });
    }

    const permissions = req.user.permissions;

    if (!Array.isArray(permissions) ||
        !permissions.includes(permission)) {
      return res.status(403).json({
        error: “Forbidden”
      });
    }

    return next();
  };
}

// Example only: ensure authentication middleware runs first.
// router.get(
//   “/admin/audit”,
//   authenticate,
//   requirePermission(“audit:read”),
//   auditController.list
// );
```

This example assumes `req.user` is established by trusted authentication middleware and that permissions are derived from a trusted server-side policy. It does not implement resource ownership checks, session revocation, or a complete authorization system.

Routes MUST NOT be deployed with this example alone as their security control.

## 12. PostgreSQL security

The MedOrbits database schema uses the `medorbits` schema and includes users, applications, application files, access requests, audit logs, notifications, and worker jobs.

Database authorization MUST follow these requirements:

- Use separate database roles for runtime access, migrations, and administration.
- Do not run the application as a PostgreSQL superuser or schema owner.
- Grant only the required table, sequence, schema, and function privileges.
- Parameterize SQL queries.
- Restrict access to password hashes, confidential metadata, and audit records.
- Keep database credentials in a secret manager or protected environment configuration.
- Restrict network access to the database.
- Back up data securely and periodically test restoration.

Where appropriate, use PostgreSQL row-level security (RLS) as defense in depth. RLS policies MUST be tested against the application’s connection pooling and identity propagation model.

The `app.user_id` and `app.request_id` transaction settings used by the status-history trigger are context values, not independently verified identities. The application MUST set them inside the correct transaction and prevent untrusted clients from controlling authorization context.

Append-only triggers on audit and history tables do not protect against privileged database owners or superusers. Restrict ownership and privileges separately.

## 13. Background jobs and service identities

Workers MUST use dedicated service identities with narrowly scoped permissions.

Each job MUST validate its type, payload, status, and permitted operations before execution.

Workers MUST NOT treat user-controlled job payloads as trusted commands or execute arbitrary shell instructions.

For jobs involving a user’s data, the originating authorization context SHOULD be preserved as auditable metadata where necessary. The worker MUST still enforce the service’s allowed operations and applicable access policy.

Job retries MUST be bounded, and sensitive payloads MUST NOT be copied into unrestricted logs.

## 14. Audit logging

Record security-relevant events, including:

- Failed authorization attempts.
- Privileged role and permission changes.
- Administrative decisions.
- Application status transitions.
- Sensitive document access.
- Access request decisions.
- Account suspension and recovery.
- Security configuration changes.
- Bulk exports of confidential data.

Audit records SHOULD include an event identifier, timestamp, actor, action, target resource, outcome, and request correlation identifier.

Do not record plaintext passwords, authentication tokens, session secrets, or unnecessary personal information.

Audit logs MUST be accessible only to authorized identities and protected against modification through ordinary application privileges.

Retention, deletion, and export procedures MUST follow applicable legal and operational requirements.

## 15. Error handling and information disclosure

Authorization failures MUST NOT reveal:

- Whether another user’s private record exists, where existence is sensitive.
- Password hashes or authentication secrets.
- Internal storage paths.
- Database connection details.
- Stack traces or implementation internals.
- Privileged policy configuration.

Return stable, generic client-facing error messages. Store diagnostic information in access-controlled logs, with sensitive values redacted.

## 16. Testing requirements

Authorization controls MUST be covered by automated tests.

At minimum, test:

- Unauthenticated requests to protected endpoints.
- Authenticated users accessing their own resources.
- Attempts to access another user’s resources.
- Unknown roles and missing permissions.
- Suspended and disabled accounts.
- Unauthorized application state transitions.
- Unauthorized document uploads and downloads.
- Rejected or unscanned files.
- Privileged administrative operations.
- Access revocation and expired sessions.
- Concurrent application updates.
- SQL injection and identifier manipulation.
- Cross-tenant access, if multi-tenancy is supported.
- Worker jobs with malformed or unauthorized payloads.

Tests MUST verify both permitted and denied behavior. A successful response code alone is not proof that authorization is correct.

## 17. Deployment checklist

Before production deployment:

- [ ] Define the authoritative role and permission registry.
- [ ] Protect every API route with authentication and authorization.
- [ ] Implement ownership and tenant-scope checks.
- [ ] Validate application state transitions on the server.
- [ ] Secure document storage and download authorization.
- [ ] Separate runtime and migration database roles.
- [ ] Configure session or token revocation.
- [ ] Restrict administrative functions.
- [ ] Enable security event logging and redaction.
- [ ] Test access-denied cases in CI.
- [ ] Review database migrations and grants.
- [ ] Verify production secrets are not committed.
- [ ] Document permission ownership and incident response procedures.

## 18. Incident response

If an authorization bypass or privilege escalation is suspected:

1. Restrict the affected endpoint or capability.
2. Revoke compromised sessions, tokens, or service credentials as appropriate.
3. Preserve relevant logs and incident evidence.
4. Determine the affected users, resources, and time window.
5. Correct the authorization policy and add regression tests.
6. Review whether data was accessed, altered, or exported.
7. Follow applicable notification and reporting obligations.
8. Document remediation and verify the fix before restoring access.

## 19. Maintenance and governance

The security owner MUST review this policy periodically and whenever significant authentication, role, API, storage, or database changes are introduced.

Changes to role mappings and privileged permissions MUST be reviewed and tested before deployment.

This document defines the policy baseline. It does not, by itself, implement or certify authorization controls in application code.

—

**End of policy**
