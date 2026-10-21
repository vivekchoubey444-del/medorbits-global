
# MedOrbits — Authorization Policies

**Directory:** `src/policies/`  
**Runtime:** Node.js >= 20  
**Application:** MedOrbits Education, Admissions, Career, Recruitment and Student Services Platform

## 1. Purpose and Scope

The authorization policies layer centralizes resource-level access decisions for the MedOrbits Express backend.

Each policy determines whether an authenticated actor may perform a specific action on a trusted resource in its current state.

Policies complement, but do not replace:

- Authentication and session validation.
- Request validation and field-level allowlists.
- Business rules and workflow state transitions.
- Database constraints and transaction management.
- Private file storage and secure download delivery.
- Payment-provider verification and idempotency.
- Audit logging and security monitoring.

**Core rule:** deny access whenever the required identity, ownership, permission, or resource state cannot be established reliably.

A policy returning `true` authorizes only the operation represented by that policy function. It does not grant unrestricted access to the resource or authorize unrelated operations.

## 2. Policy Inventory

The following is the expected policy inventory. Confirm filenames and exports against the actual repository before integrating or documenting them as implemented.

| Policy module | Responsibility |
|—|—|
| `admission.policy.js` | Admission ownership, review access, decisions and protected workflow operations |
| `application.policy.js` | Applicant ownership, counsellor assignments, application review and decisions |
| `auth.policy.js` | Account operations, authentication-related authorization and session management |
| `candidate.policy.js` | Candidate profile privacy, ownership and application-related access |
| `college.policy.js` | Public college catalog visibility and restricted management |
| `counselling.policy.js` | Counselling records, assignment scope and protected status changes |
| `course.policy.js` or `courses.policy.js` | Course catalog access and management permissions |
| `document.policy.js` | Document ownership, review, download and deletion |
| `employer.policy.js` | Employer account access, job management and applicant visibility |
| `internship.policy.js` | Internship visibility, employer ownership and applicant access |
| `job.policy.js` | Job visibility, management and applicant access |
| `payment.policy.js` | Payer ownership, payment visibility, cancellation and refund authorization |
| `policy-utils.js` | Shared identity normalization, roles, permissions, ownership and status helpers |
| `recruitment.policy.js` | Recruitment workflows, candidate visibility and pipeline management |
| `subscription.policy.js` | Subscription ownership, plan changes, cancellation and entitlement checks |
| `university.policy.js` | University catalog visibility and restricted management |
| `user.policy.js` | User privacy, account ownership and privileged account operations |

Do not create duplicate policy modules solely to match this list. Choose one canonical filename for each resource and update all imports and tests accordingly.

## 3. Mandatory Security Principles

Every policy must follow these principles.

### 3.1 Deny by default

Return `false` if required information is missing, malformed, contradictory, or insufficient to establish authorization.

Unknown actions and unknown resource states must not be implicitly permitted.

### 3.2 Least privilege

Grant only the permissions necessary for the requested action and resource scope.

An actor allowed to read a record is not automatically allowed to edit, export, delete, approve, publish, or download it.

### 3.3 Trusted identity

Derive the actor from validated authentication middleware, such as `req.user`.

Never construct a trusted actor by copying role, permission, ownership, verification, or entitlement values from request parameters, query strings, or request bodies.

### 3.4 Trusted resource state

Load resources and their ownership relationships from trusted repositories or services before evaluating resource-level authorization.

A client-provided identifier is a lookup input, not proof of ownership.

### 3.5 Explicit state transitions

Publishing, archiving, approving, rejecting, verifying, completing, cancelling, deleting, refunding, and granting entitlements must use dedicated operations with explicit preconditions.

### 3.6 Minimal disclosure

Return only data the caller is permitted to receive. Use consistent error handling and avoid revealing protected resource existence where enumeration is a concern.

### 3.7 Consistent enforcement

Enforce authorization across HTTP routes, service methods, file downloads, exports, background jobs and administrative workflows.

### 3.8 Auditable operations

Record security-sensitive actions and outcomes without logging credentials, secrets, payment tokens, document contents or unnecessary personal information.

## 4. Authenticated Actor Contract

Policies normally receive an actor derived from trusted authentication and authorization middleware.

An actor may contain the following fields, depending on the actual application schema:

| Field | Meaning |
|—|—|
| `id` or `userId` | Canonical user identifier |
| `role` or `roles` | Server-assigned application roles |
| `permissions` | Explicitly granted permissions |
| `candidateId` | Associated candidate profile |
| `employerId` | Associated employer account |
| `isVerified` | Verified account state, where required |
| `status` | Account lifecycle state |

This is a proposed contract, not a claim that all fields already exist.

### Identity normalization requirements

- Select one canonical authenticated user identifier.
- Reject malformed identifiers rather than falling back to an unrelated identity.
- Keep user IDs, employer IDs, candidate IDs, job IDs and subscription IDs in distinct identity domains.
- Normalize identifier formats consistently with the database.
- Never use a resource’s own `id` as proof that the current actor owns that resource.
- Resolve employer membership and other account associations through trusted data.

If a canonical identifier is present but malformed, the authorization layer must fail closed rather than silently accepting a secondary identifier that could represent another identity.

## 5. Role and Permission Model

Recognized role examples include:

- `user`
- `student`
- `candidate`
- `employer`
- `counsellor`
- `recruiter`
- `support`
- `admin`
- `superadmin`

Role aliases may be normalized centrally. Unknown roles must not gain implicit privileges.

### Permission rules

1. Permissions must be granted by trusted server-side authorization logic.
2. Permission names must match the application’s permission registry.
3. Resource-specific permissions must be checked against the relevant resource.
4. Administrative exceptions must be explicit and narrowly scoped.
5. Privileged role assignment must require a separate protected operation.
6. Client-submitted roles and permissions must never be merged into trusted actor state.

A `superadmin` role may have broad privileges only if that is an intentional, documented application rule. Its assignment, revocation and use must be protected and auditable.

Do not let a generic `isAdmin` helper unintentionally turn a single administrative permission into unrestricted access across every resource.

## 6. Standard Authorization Flow

The intended request flow is:

**Authentication → Input validation → Trusted resource lookup → Authorization → Service operation → Audit → Response**

Example:

1. Authenticate the request and establish a trusted actor.
2. Validate the resource identifier and request parameters.
3. Load the resource using the appropriate repository or service.
4. Resolve ownership, account associations and relevant state from trusted records.
5. Invoke the policy for the exact requested operation.
6. Reject unauthorized requests before protected data is returned or modified.
7. Execute the permitted service operation.
8. Record required audit events.
9. Return a response containing only authorized fields.

For mutations, use transaction-safe or database-level conditions when resource ownership or state may change concurrently.

### Controller integration example

The following is an illustrative pattern. Adapt it to the actual service names, error middleware and response conventions.

```javascript
‘use strict’;

const {
  canViewApplication,
} = require(‘../policies/application.policy’);

async function getApplication(req, res, next) {
  try {
    const application = await applicationService.getById(
      req.params.id
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        error: {
          code: ‘NOT_FOUND’,
          message: ‘Application not found.’,
        },
        requestId: req.id,
      });
    }

    if (!canViewApplication(req.user, application)) {
      // Use 404 instead of 403 if the application conceals
      // the existence of private resources.
      return res.status(404).json({
        success: false,
        error: {
          code: ‘NOT_FOUND’,
          message: ‘Application not found.’,
        },
        requestId: req.id,
      });
    }

    return res.status(200).json({
      success: true,
      data: application,
      requestId: req.id,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getApplication,
};
```

This example assumes `applicationService`, `req.user` and `req.id` are provided by the application. The response must still use an appropriate serializer rather than exposing every database field.

## 7. Policy API Contract

Policy modules should expose named, documented functions with consistent boolean return semantics.

Examples include:

```javascript
canViewApplication(actor, application);
canUpdateApplication(actor, application, changes);
canReviewApplication(actor, application);
canViewDocument(actor, document);
canGenerateDocumentDownload(actor, document);
canViewPayment(actor, payment);
canCancelSubscription(actor, subscription);
canViewCandidate(actor, candidate);
canManageJob(actor, job);
```

These examples are illustrative. The actual contract is the set of functions exported by each module.

### Requirements

- Return `true` only when the requested operation is authorized.
- Return `false` for malformed inputs or insufficient evidence of permission.
- Do not perform database writes, provider requests or other side effects inside ordinary policy functions.
- Do not mix booleans, HTTP responses and thrown authorization exceptions without a documented convention.
- Keep business validation separate from authorization.
- Ensure each policy’s call sites pass trusted resource records and validated changes.

If assertion helpers are introduced, they should follow the application’s established error-handling convention and must not replace the underlying authorization check.

## 8. Resource-Specific Requirements

### 8.1 Admissions

**Module:** `admission.policy.js`

- Restrict applicant records to the applicant and explicitly authorized staff.
- Enforce counsellor assignment and administrative scope.
- Protect admission decisions, ownership and review metadata.
- Validate allowed status transitions.
- Restrict exports and access to sensitive applicant data.

### 8.2 Applications

**Module:** `application.policy.js`

- Verify applicant ownership using trusted application records.
- Restrict counsellor access to assigned applications or explicitly authorized scopes.
- Protect review status, decisions, ownership, assignment and timestamps.
- Restrict administrative decisions to explicitly authorized operations.
- Prevent applicants from changing server-controlled workflow fields.

### 8.3 Authentication and users

**Modules:** `auth.policy.js`, `user.policy.js`

- Separate credential authentication from authorization.
- Protect private account information.
- Restrict role, permission, verification and account-status changes.
- Enforce ownership for profile updates.
- Restrict session management and administrative account operations.
- Apply account-disabled and verification rules consistently with the actual authentication workflow.

### 8.4 Candidates

**Module:** `candidate.policy.js`

- Enforce candidate profile ownership.
- Restrict access to contact details, resumes and identity documents.
- Limit employer access to candidates associated with legitimate recruitment workflows.
- Verify the relationship between the employer, job, application and candidate.
- Protect identity, verification and account-association fields.
- Redact private fields from public or employer-facing responses unless access is explicitly authorized.

### 8.5 Colleges and universities

**Modules:** `college.policy.js`, `university.policy.js`

- Separate public catalog reads from restricted management operations.
- Restrict creation, editing, verification, publication and deletion.
- Use actual database ownership or management relationships where those exist.
- Do not assume that a model supports owner-based access merely because the policy has owner fields.
- Never trust owner identifiers supplied by the caller.

### 8.6 Counselling

**Module:** `counselling.policy.js`

- Restrict access to authorized participants and assigned staff.
- Protect private notes, communications and counselling history.
- Restrict assignment and reassignment to authorized operations.
- Enforce valid scheduling, cancellation and completion transitions.
- Audit sensitive access and workflow decisions where required.

### 8.7 Courses

**Module:** `course.policy.js` or `courses.policy.js`

- Define which course fields are publicly readable.
- Restrict course creation, editing, publication, archiving and deletion.
- Protect workflow metadata and server-managed fields.
- Keep catalog visibility separate from administrative mutation permissions.
- Verify that the policy filename, imports, tests and exports are consistent.

### 8.8 Documents

**Module:** `document.policy.js`

- Authorize every view, download, replacement and deletion.
- Load ownership, classification and approval state from trusted records.
- Store private files in private storage.
- Use server-generated storage keys.
- Validate file size and content type and apply malware scanning.
- Issue short-lived download URLs only after authorization.
- Never expose storage credentials or unrestricted internal storage paths.
- Ensure authorization is enforced before the file is delivered.

### 8.9 Employers and recruitment

**Modules:** `employer.policy.js`, `internship.policy.js`, `job.policy.js`, `recruitment.policy.js`

- Verify employer account membership from trusted records.
- Restrict job, internship and recruitment management to authorized owners or administrators.
- Prevent cross-employer access to resources and candidate data.
- Validate job/application/recruitment relationships before disclosing candidate information.
- Restrict applicant exports and private recruitment notes.
- Protect recruitment assignments, status transitions and privileged decisions.

### 8.10 Payments

**Module:** `payment.policy.js`

- Verify access against trusted payer and transaction records.
- Derive amounts, currency and product details from trusted server-side data.
- Restrict cancellation and refunds to valid payment states and authorized actors.
- Verify provider webhook signatures against the exact raw request body.
- Implement replay protection, idempotency and transaction-safe state transitions.
- Reconcile payment status with provider records where required.

A policy function cannot establish webhook authenticity or guarantee that a refund will be processed exactly once.

### 8.11 Subscriptions

**Module:** `subscription.policy.js`

- Verify ownership using trusted database records.
- Derive plan, price and billing details server-side.
- Derive entitlements from validated subscription state.
- Enforce expiry, cancellation and status rules.
- Prevent client-supplied flags from granting premium access.
- Restrict administrative overrides and audit them.
- Reconcile provider events before granting or revoking entitlements.

## 9. Protected Fields and Mass Assignment

Protected fields must not be writable through generic create or update operations.

Examples include:

- `id`, `userId`, `ownerId`, `candidateId`, `employerId`
- `role`, `roles`, `permissions`, `isAdmin`
- `isVerified`, verification metadata and approval metadata
- `status`, review decisions and assignment metadata
- Payment amounts, payment status and provider identifiers
- Subscription status, plan identifiers and entitlement flags
- Server-generated timestamps, counters and audit metadata

Use explicit field allowlists for create and update operations.

For example:

```javascript
const ALLOWED_PROFILE_FIELDS = Object.freeze([
  ‘displayName’,
  ‘phone’,
  ‘preferredLanguage’,
]);

function pickAllowedFields(input, allowedFields) {
  if (
    !input ||
    typeof input !== ‘object’ ||
    Array.isArray(input)
  ) {
    return {};
  }

  const result = Object.create(null);

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      result[field] = input[field];
    }
  }

  return result;
}
```

This helper is illustrative. Validate field types, lengths, formats and business constraints separately. Do not rely on policy checks alone to prevent mass assignment.

Privileged actors should use dedicated operations for protected fields rather than bypassing those restrictions through generic update methods.

## 10. Fail-Closed Rules

Deny access when:

- The actor is missing, malformed, disabled or otherwise ineligible.
- The resource is missing or malformed.
- Required identity or ownership fields are absent.
- The requested action or role is unknown.
- The actor’s relationship to the resource cannot be established.
- Required verification or entitlement is absent.
- The resource state prohibits the requested operation.
- A protected field is submitted through an unauthorized mutation path.
- The policy cannot reliably determine whether access is permitted.

Do not silently interpret missing ownership data as permission to access a private resource.

Public visibility must be explicit, based on the resource’s trusted state and applicable publication rules.

## 11. HTTP Status and Resource Enumeration

Use response behavior consistent with the application’s disclosure policy.

| Status | Meaning |
|—|—|
| `400 Bad Request` | Malformed input or invalid parameters |
| `401 Unauthorized` | Authentication is missing or invalid |
| `403 Forbidden` | The authenticated actor is not permitted to perform the operation |
| `404 Not Found` | The resource does not exist or its existence is intentionally concealed |

For private documents, payments and other sensitive records, a consistent `404` response for unauthorized identifiers may reduce resource enumeration.

Avoid revealing protected resource existence through response bodies, detailed errors, logs or timing differences where those disclosures matter.

## 12. Audit Logging

Record appropriate audit events for sensitive operations, including:

- Administrative access to protected records.
- Document views, downloads, replacements and deletions.
- Payment refunds and subscription state changes.
- Employer access to candidate records and exports.
- Changes to roles, permissions, ownership or verification.
- Admission, counselling and recruitment decisions.
- Denied attempts to perform sensitive operations, where required by the monitoring policy.

Where supported, record:

- Actor ID.
- Action and target resource type.
- Target resource ID.
- Outcome.
- Timestamp.
- Request or correlation ID.
- Relevant authorization reason code.

Do not log credentials, authentication tokens, payment secrets, document contents or unnecessary personal data.

Audit logging must never convert a denied operation into an authorized one.

## 13. Testing Requirements

Each policy module should have unit tests for every exported function and its important decision branches.

At minimum, test:

- Authorized owner and authorized non-owner.
- Missing, anonymous and malformed actors.
- Supported roles and explicit permissions.
- Missing or mismatched ownership fields.
- Unknown roles, actions and resource states.
- Disabled and unverified actors where relevant.
- Protected-field mutation attempts.
- Invalid lifecycle transitions.
- Administrative permissions and their limits.
- Cross-employer and cross-candidate access attempts.
- Private document download restrictions.
- Payment cancellation and refund restrictions.
- Subscription expiry and entitlement checks.
- Snake-case and camel-case fields where both are supported.

### Integration tests

Unit tests are not sufficient by themselves. Route-level and service-level tests must verify that:

1. Authentication runs before protected operations.
2. The resource is loaded from a trusted source.
3. The appropriate policy is invoked.
4. Unauthorized operations do not mutate data.
5. Sensitive response fields are excluded.
6. State transitions are atomic where necessary.
7. Payment webhook verification and idempotency are enforced.
8. File delivery checks authorization before streaming or issuing a download URL.

## 14. Production Release Checklist

- [ ] Canonical policy filenames and imports are consistent.
- [ ] Every policy export matches its documented API.
- [ ] Authentication middleware supplies a trusted actor.
- [ ] Actor identity fields match the actual authentication schema.
- [ ] Roles and permissions originate from trusted server-side data.
- [ ] Every protected action has an explicit authorization check.
- [ ] Ownership is derived from trusted resource records.
- [ ] User, employer, candidate and resource identifiers are not conflated.
- [ ] Policy functions fail closed.
- [ ] Generic create and update operations use field allowlists.
- [ ] Protected lifecycle fields use dedicated service operations.
- [ ] Public catalog access is separate from management access.
- [ ] Private document storage and downloads enforce authorization.
- [ ] Payment webhooks verify signatures against the raw request body.
- [ ] Payment processing is idempotent and transaction-safe.
- [ ] Subscription entitlements reflect validated billing state.
- [ ] Sensitive operations generate appropriate audit events.
- [ ] Unit and integration tests cover authorization boundaries.
- [ ] Error responses follow the resource-disclosure policy.
- [ ] Concurrent state changes are protected where necessary.
- [ ] The actual database schema supports the ownership fields used by each policy.

## 15. Implementation Boundaries

The policies layer centralizes authorization decisions. It does not independently:

- Authenticate credentials or validate sessions.
- Validate all incoming request data.
- Enforce database constraints.
- Secure file storage.
- Verify payment-provider signatures.
- Guarantee payment idempotency.
- Reconcile billing events.
- Replace business rules or transaction handling.
- Sanitize every response automatically.

These controls must also be implemented in the relevant middleware, validators, services, repositories, payment handlers and storage integrations.

## 16. Maintenance and Change Control

Whenever a policy changes:

1. Update the policy unit tests.
2. Update permission-registry entries if required.
3. Verify the actual schema and ownership relationships.
4. Review all route and service call sites.
5. Run relevant unit and integration tests.
6. Update this document if exports, actor fields, permissions or behavior change.
7. Record security-sensitive changes in the project’s change history.

Do not mark a policy as production-ready solely because it exports the expected function names or its unit tests pass.

**Release standard:** authorization is considered implemented only when the policy, trusted actor context, service operation, data access, response serialization and relevant tests enforce the same security boundary.
