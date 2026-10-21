
# Authorization Security

**Project:** MedOrbits  
**Purpose:** Define server-side access-control requirements for users, roles, permissions, resource ownership, and protected operations.

## 1. Overview

Authentication establishes a user’s identity. Authorization determines which actions that identity is permitted to perform on a specific resource.

MedOrbits must enforce authorization on the server for every private route, API operation, and protected resource. Client-side interface restrictions may improve usability but must never replace server-side access checks.

Authorization controls must protect user profiles, applications, private documents, payments, subscriptions, recruitment records, administrative functions, and other restricted resources supported by the application.

This document defines the expected security requirements. The actual roles, permissions, middleware, service-layer checks, database relationships, and enforcement mechanisms must be verified against the implementation.

**Implementation status:** Requirements in this document do not establish that a particular role, permission, or access-control mechanism has already been implemented.

## 2. Default-Deny Model

Use a default-deny authorization model.

- Allow access only when the user’s identity, requested action, and access to the target resource have been established.
- Deny access when authentication, permissions, ownership, or resource context cannot be verified.
- Require explicit authorization for privileged operations.
- Apply authorization consistently across web pages, APIs, background operations, and file-access mechanisms.
- Do not grant access merely because a resource identifier is difficult to guess.
- Do not treat a successful login as authorization to access every resource.
- Fail securely when permission data or required authorization dependencies are unavailable.
- Avoid fallback behavior that grants access when an authorization check fails or throws an unexpected error.

A valid login does not automatically authorize access to every resource.

## 3. Roles and Least Privilege

Apply the principle of least privilege to each role supported by the application.

Potential role categories include:

| Role category | Intended access boundary |
|—|—|
| Student or candidate | Own profile, applications, documents, and other explicitly permitted personal resources. |
| Employer | Employer-owned records, authorized recruitment functions, and permitted candidate information. |
| Staff | Assigned operational functions and resources within approved responsibilities. |
| Administrator | Explicitly authorized administrative operations, subject to additional safeguards and auditing. |

These categories describe intended access boundaries, not confirmation that every role exists in the current implementation.

### 3.1 Role Management Requirements

- Grant only the permissions necessary for each role.
- Separate administrative capabilities from ordinary user permissions.
- Prefer narrowly defined permissions over broad access grants.
- Verify role assignments and permission changes on the server.
- Prevent users from changing their own privileges through ordinary profile or account operations.
- Reassess permissions when roles, responsibilities, or account status change.
- Restrict role assignment and privilege escalation to explicitly authorized workflows.
- Validate role and permission changes before persisting them.
- Record sensitive privilege changes in protected audit records where supported.
- Define how suspended, disabled, deleted, or otherwise restricted accounts are handled.

Do not rely exclusively on role names when a decision also depends on resource ownership, record status, organizational relationships, or the requested operation.

### 3.2 Role-Based and Resource-Based Decisions

A role-based access-control model can determine whether a user may perform a general action. Resource-level checks must additionally determine whether the user may perform that action on the particular resource.

For example, permission to view applications does not automatically authorize a user to view every application in the system.

## 4. Resource-Level Authorization

Authorization must consider both the requested action and the target resource.

For each protected operation, establish:

1. Who is making the request.
2. What action is being requested.
3. Which resource is being accessed or changed.
4. Whether the user is permitted to perform that action on that resource.
5. Whether the resource’s current state permits the operation.
6. Whether additional conditions, such as organizational membership or explicit approval, apply.

Perform these checks on the server using trusted identity and permission information.

### 4.1 Applications

Verify that a user can access or modify only applications they own or are explicitly authorized to manage.

Employer, staff, and administrative access must follow defined business rules and permissions. Do not assume that a user can access an application simply because its identifier is known.

Check authorization for:

- Listing and searching applications.
- Viewing application details.
- Creating or updating application records.
- Uploading, previewing, or downloading associated documents.
- Changing application status.
- Exporting or deleting application records.
- Accessing nested application resources.

### 4.2 Documents

Verify authorization before returning, downloading, previewing, modifying, or deleting a private document.

- Check document ownership or an explicit authorization grant.
- Apply consistent restrictions to direct file URLs, download endpoints, preview endpoints, and storage-provider access.
- Verify access to the associated parent record when document permissions depend on an application, profile, or other resource.
- Prevent unauthorized users from discovering sensitive filenames or document metadata.
- Revalidate access when temporary download links or delegated access mechanisms are used.
- Ensure that revoking access is handled according to the storage and link-expiration model.

Do not assume that protecting an application page also protects the underlying file.

### 4.3 Payments and Subscriptions

Restrict payment and subscription records to their authorized users and operational roles.

- Verify access to the underlying transaction or subscription rather than trusting a client-supplied user identifier or transaction reference.
- Restrict access to transaction history, invoices, refunds, and subscription details.
- Ensure that financial state changes follow the trusted server-side payment workflow.
- Separate viewing permissions from refund, cancellation, and administrative modification permissions.
- Do not allow client-supplied payment status or subscription status to determine authorization.
- Audit sensitive administrative actions where supported.

Payment-provider webhook authentication and transaction verification are separate requirements from user authorization and must also be enforced.

### 4.4 Profiles and Account Data

Prevent users from reading or modifying another user’s private profile information without explicit authorization.

- Verify ownership or an explicit permission grant for profile access.
- Restrict updates to fields the user is allowed to change.
- Protect account identifiers, verification status, roles, permissions, and security settings from unauthorized modification.
- Apply additional checks to sensitive account changes.
- Prevent mass-assignment vulnerabilities by allowing only explicitly permitted fields to be updated.
- Enforce restrictions regardless of whether a field is editable in the user interface.

### 4.5 Recruitment and Employer Records

Where recruitment functionality is implemented:

- Restrict employer records to their authorized organization or account.
- Check permission before accessing candidate information.
- Enforce application visibility and workflow restrictions.
- Prevent access to another employer’s jobs, candidates, applications, or recruitment records.
- Apply the same rules to exports, search results, reports, and background processing.
- Respect applicable consent, privacy, and data-retention requirements.

### 4.6 Administrative Operations

Require explicit server-side authorization for administrative functions that exist in the application, including user management, permission changes, document administration, payment administration, and other privileged operations.

- Separate read-only administrative access from modification and deletion privileges.
- Apply stronger safeguards to high-impact operations.
- Require additional confirmation or recent authentication where appropriate.
- Record sensitive administrative actions in protected audit records.
- Prevent ordinary users from invoking administrative APIs directly.
- Ensure that privileged access is not granted solely by modifying client-side state.

## 5. Insecure Direct Object References (IDOR)

Prevent insecure direct object reference vulnerabilities by checking authorization for every client-supplied resource identifier.

Potentially affected identifiers include:

- Application IDs.
- Document IDs and file references.
- User profile IDs.
- Payment and subscription IDs.
- Job and employer record IDs.
- Administrative resource identifiers.
- Nested resource IDs and download references.

Never assume that a resource is authorized merely because the client submits a valid numeric ID, UUID, reference number, or URL.

Requirements:

- Scope resource lookups to the authorized user’s accessible resources where practical.
- Verify ownership or an explicit permission grant before returning data or applying changes.
- Apply checks to reads, updates, downloads, exports, and deletions.
- Repeat authorization checks for each relevant request, including requests to nested resources.
- Avoid relying on previously rendered pages or client-side state as proof of permission.
- Verify parent-resource authorization when access to a child resource depends on the parent.
- Ensure bulk operations authorize every affected resource.
- Avoid revealing whether a protected resource exists when that information is sensitive.

Unpredictable identifiers can reduce opportunistic guessing but do not replace authorization.

## 6. Server-Side Enforcement

Enforce authorization in the backend using the application’s established routing, middleware, controller, service, or data-access mechanisms.

The implementation may vary, but the following requirements apply:

- Protected routes must reject unauthenticated requests when authentication is required.
- Authenticated requests must still undergo authorization checks.
- Resource access must be checked against trusted server-side identity and permission information.
- Client-supplied role names, ownership fields, organization identifiers, and permission flags must not be trusted without server-side verification.
- Authorization must apply to API endpoints even when the associated interface hides or disables controls.
- File storage and background operations must respect the same security boundaries where applicable.
- Authorization failures must not result in an implicit allow.
- Sensitive operations must revalidate permissions at the point of execution.
- Bulk operations must not bypass checks applied to individual resources.
- Authorization logic should be centralized into shared, testable mechanisms where supported by the architecture.

Avoid scattering inconsistent permission checks across unrelated modules.

### 6.1 Request Processing

A protected request should follow this logical sequence:

1. Authenticate the requester when required.
2. Establish trusted identity and account status.
3. Validate the request and identify the target resource.
4. Evaluate role, permission, ownership, and applicable business rules.
5. Check whether the resource’s current state allows the operation.
6. Execute the authorized operation.
7. Record relevant security events where appropriate.
8. Return only the information the requester is authorized to receive.

This sequence describes the intended security model, not a verified implementation diagram.

### 6.2 Background Jobs and Internal Services

Background jobs and internal service operations must not assume that previously authorized user input remains valid indefinitely.

Where an operation acts on behalf of a user or organization:

- Preserve the necessary authorization context safely.
- Validate permissions at execution time when appropriate.
- Restrict service accounts to the required resources and operations.
- Prevent untrusted job payloads from granting privileges.
- Ensure retries and scheduled operations do not bypass access restrictions.
- Record the initiating actor and relevant authorization context where appropriate.

## 7. Denial and Error Handling

Deny requests when the application cannot establish the required permission.

Use consistent error responses that do not disclose sensitive resource information.

- Use `401 Unauthorized` when valid authentication is required but missing or invalid, according to the API’s authentication contract.
- Use `403 Forbidden` when the request is authenticated but the requested action is not permitted, where revealing the resource’s existence is appropriate.
- Use a consistent `404 Not Found` response for inaccessible resources when the security design requires concealing whether a resource exists.
- Use other status codes only when they accurately reflect the documented API contract.

Record relevant authorization failures where appropriate, but do not log secrets or excessive personal data.

Do not expose stack traces, internal permission rules, database details, or sensitive resource metadata in public error responses.

## 8. Administrative Security and Auditing

Administrative operations require explicit authorization and appropriate accountability.

Where supported by the implementation, record:

- The authenticated actor or service identity.
- The action attempted or completed.
- The affected resource.
- The event timestamp.
- The outcome.
- A relevant request or correlation identifier.
- The reason or approval reference where required by policy.

Audit records must not contain passwords, session tokens, recovery secrets, or unnecessary sensitive data.

Protect audit records against unauthorized access and modification. Define retention requirements according to organizational policies and applicable obligations.

Ensure that audit logging does not become a source of sensitive-data exposure or a cause of unhandled failures in critical workflows.

## 9. Authorization Testing

Include positive and negative tests for all important protected workflows.

### 9.1 Required Negative Tests

- [ ] A user cannot access another user’s private resource by changing an identifier.
- [ ] A user cannot modify or delete another user’s application or document.
- [ ] A user cannot retrieve another user’s payment or subscription records.
- [ ] A user cannot escalate privileges by manipulating request fields.
- [ ] A user cannot access staff-only or administrator-only operations without permission.
- [ ] Missing authentication is rejected where required.
- [ ] Missing or ambiguous ownership information results in denial.
- [ ] Unauthorized nested-resource access is rejected.
- [ ] Direct file access does not bypass document authorization.
- [ ] Bulk operations reject unauthorized target resources.
- [ ] Permission revocation takes effect according to the implemented authorization model.
- [ ] Unauthorized administrative actions are rejected and appropriately recorded.
- [ ] Suspended or disabled accounts cannot perform prohibited operations.
- [ ] An authorization-service failure does not result in access being granted.
- [ ] Users cannot access resources belonging to another employer or organization.

### 9.2 Required Positive Tests

- [ ] Authorized users can access their own permitted resources.
- [ ] Authorized staff can perform only their assigned functions.
- [ ] Authorized administrators can perform explicitly permitted operations.
- [ ] Resource-state restrictions are enforced.
- [ ] Legitimate workflows continue to function after permission checks are applied.
- [ ] Explicitly delegated access works only within its approved scope.
- [ ] Authorized document downloads and previews continue to function.
- [ ] Valid access remains available after unrelated permissions are restricted.

Run authorization tests in an isolated environment using synthetic accounts, synthetic resources, and test data.

Test multiple accounts and roles to verify that access decisions depend on the actual requester and resource rather than the request’s structure alone.

## 10. Implementation Verification

Before declaring authorization controls operational:

1. Identify the implemented roles and permission model.
2. Inspect authentication and authorization middleware.
3. Review every private route and sensitive API operation.
4. Verify ownership checks for applications, documents, payments, profiles, and organization records.
5. Inspect direct file-serving and storage-access paths.
6. Review administrative routes and privilege-changing operations.
7. Confirm that client-supplied identifiers and role fields cannot bypass checks.
8. Review bulk operations, exports, background jobs, and nested-resource access.
9. Run cross-user, cross-organization, and privilege-escalation tests.
10. Verify audit logging for sensitive operations.
11. Confirm that authorization failures fail securely.
12. Record missing controls as remediation tasks with responsible owners.

A role displayed in the user interface or a permission documented in this file is not evidence that backend enforcement exists.

## 11. Remediation Tracking

For each identified authorization gap, record:

| Field | Required information |
|—|—|
| Finding | Description of the authorization weakness |
| Affected resource | Route, service, resource type, or workflow |
| Impact | Potential unauthorized access or modification |
| Root cause | Verified implementation or configuration issue |
| Corrective action | Proposed or completed remediation |
| Verification | Test or evidence confirming the correction |
| Owner | Responsible individual or team |
| Status | Open, in progress, blocked, or verified |

Prioritize vulnerabilities that permit cross-user data access, privilege escalation, unauthorized document retrieval, or unauthorized financial operations.

Do not mark a finding as verified solely because the related code was changed. Confirm the expected behavior with appropriate tests.

## 12. Related Documentation

Verify all paths against the current repository.

- `docs/security/README.md` — Security documentation index, if present.
- `docs/security/authentication.md` — Identity verification and session security, if present.
- `docs/security/sensitive-data.md` — Sensitive-data protection, if present.
- `docs/operations/incident-response.md` — Security incident handling, if present.
- `docs/operations/troubleshooting.md` — Diagnostic procedures, if present.
- `docs/architecture/system-architecture.md` — Application components and security boundaries, if present.
- `docs/architecture/application-data-flow.md` — Request and data-processing flows, if present.
- `docs/database/README.md` — Database documentation, if present.
- `docs/database/migrations.md` — Migration safeguards, if present.

## 13. Definition of Done

Authorization documentation and its associated implementation review are complete when:

- [ ] The implemented roles and permission model have been identified.
- [ ] Protected routes and sensitive operations have been reviewed.
- [ ] Resource ownership and delegated-access checks have been assessed.
- [ ] Administrative operations enforce server-side permissions.
- [ ] Direct file access and background operations respect access boundaries.
- [ ] Negative tests cover cross-user access and privilege escalation.
- [ ] Positive tests confirm legitimate workflows still function.
- [ ] Authorization failures do not grant access or disclose unnecessary information.
- [ ] Sensitive administrative actions are audited where required.
- [ ] Known gaps have documented remediation actions.
- [ ] Related documentation paths have been verified.

**Accuracy rule:** Authorization requirements describe the expected security model. The backend implementation, configuration, and negative authorization tests determine whether access controls are actually enforced.
