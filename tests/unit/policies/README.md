
# MedOrbits Policy Tests

## Overview

The `tests/unit/policies/` directory contains unit tests for MedOrbits authorization policies, access-control rules, and policy-level decisions.

These tests verify that application operations enforce intended permissions, protect restricted resources, and handle unauthorized or invalid access consistently.

Policy tests should focus on policy behavior rather than HTTP routing, database implementation, or unrelated business-service logic.

## 1. Directory Structure

```text
tests/
└── unit/
    └── policies/
        ├── admission.policy.test.js
        ├── application.policy.test.js
        ├── auth.policy.test.js
        ├── candidate.policy.test.js
        ├── college.policy.test.js
        ├── counselling.policy.test.js
        ├── course.policy.test.js
        ├── document.policy.test.js
        ├── employer.policy.test.js
        ├── internship.policy.test.js
        ├── job.policy.test.js
        ├── payment.policy.test.js
        ├── policy-utils.test.js
        ├── subscription.policy.test.js
        ├── university.policy.test.js
        ├── user.policy.test.js
        └── README.md
```

This is the intended inventory. File presence does not establish that the associated tests are implemented or passing.

## 2. Policy Test Inventory

| Test file | Primary responsibility |
|—|—|
| `admission.policy.test.js` | Admission authorization and access decisions |
| `application.policy.test.js` | Application ownership, permissions, and protected operations |
| `auth.policy.test.js` | Authentication-related policy decisions and identity requirements |
| `candidate.policy.test.js` | Candidate access, ownership, and permitted actions |
| `college.policy.test.js` | College access and authorization rules |
| `counselling.policy.test.js` | Counselling records, permissions, and role restrictions |
| `course.policy.test.js` | Course access and policy enforcement |
| `document.policy.test.js` | Document ownership, access restrictions, and protected operations |
| `employer.policy.test.js` | Employer permissions and access to employer resources |
| `internship.policy.test.js` | Internship authorization and access decisions |
| `job.policy.test.js` | Job permissions and access control |
| `payment.policy.test.js` | Payment ownership, access, and restricted operations |
| `policy-utils.test.js` | Shared policy utility behavior |
| `subscription.policy.test.js` | Subscription ownership, administrative access, and protected actions |
| `university.policy.test.js` | University access and authorization rules |
| `user.policy.test.js` | User access, ownership, and administrative permissions |

Confirm actual coverage by inspecting each test file alongside its corresponding policy implementation.

## 3. Testing Objectives

### 3.1 Authentication and identity

- Reject protected operations when the required identity is missing.
- Handle malformed or incomplete actor information.
- Distinguish authenticated users from unauthenticated requests where applicable.
- Avoid granting permissions solely because an untrusted request supplies an identity or role.

### 3.2 Authorization and roles

- Allow explicitly authorized operations.
- Reject operations that exceed the actor’s permissions.
- Verify administrative privileges using the application’s established role model.
- Prevent ordinary users from obtaining administrative access by modifying request data.
- Verify that unknown actions do not accidentally grant access.

### 3.3 Resource ownership

- Allow users to access resources they are authorized to own or manage.
- Deny access to another user’s private resources when ownership is required.
- Test ownership comparisons using identifier formats supported by the implementation.
- Verify handling of missing and inaccessible resources according to the established security policy.

### 3.4 Resource-specific rules

- Test permissions for the relevant domain entity.
- Verify restrictions on modification, deletion, cancellation, publication, and document access where applicable.
- Check that domain-specific restrictions are enforced independently of unrelated policies.
- Avoid assuming that every resource uses identical permissions or ownership fields.

### 3.5 Failure handling

- Test invalid, missing, or incomplete policy inputs.
- Verify expected error types or authorization results.
- Ensure policy failures do not accidentally grant access.
- Confirm that unexpected errors are handled consistently with the policy contract.

## 4. Test Design Principles

### 4.1 Isolate policy behavior

Use small, deterministic inputs representing the actor, resource, and requested operation.

Mock external dependencies where necessary. Policy unit tests should not require a live database, payment gateway, email provider, or external API unless the test explicitly belongs to an integration suite.

### 4.2 Follow the existing contract

Use the actual policy exports, function signatures, return values, error codes, and role definitions.

Do not invent permissions or assume that every policy returns a boolean. A policy may return a decision object, throw an error, or use another established project convention.

Tests must match the real implementation rather than forcing the implementation to conform to an assumed interface.

### 4.3 Keep tests independent

- Establish relevant inputs within each test.
- Avoid execution-order dependencies.
- Avoid shared mutable state.
- Do not depend on network availability or data left by another test.
- Restore mocks and clean up temporary state when applicable.

### 4.4 Test allowed and denied paths

Where applicable, include:

- Authorized access.
- Unauthorized access.
- Missing identity.
- Missing resource.
- Incorrect ownership.
- Administrative access.
- Invalid input.
- Protected-field modification attempts.
- Boundary conditions and unexpected failures.

Only include scenarios supported by the actual policy contract.

## 5. Running Tests

Run all policy tests from the repository root:

```bash
node —test tests/unit/policies/*.test.js
```

Run an individual policy test:

```bash
node —test tests/unit/policies/user.policy.test.js
```

Run the shared utility tests:

```bash
node —test tests/unit/policies/policy-utils.test.js
```

Run the complete unit suite:

```bash
node —test
```

The last command relies on Node.js test discovery. Confirm that it discovers all intended test files in the repository.

Shell glob expansion differs between environments. If a glob does not work, use explicit file paths or the project’s configured test script.

If the repository standardizes on Jest, use its configured command instead:

```bash
npx jest tests/unit/policies —runInBand
```

Do not mix test-runner APIs within a test file.

## 6. Relationship to Other Test Layers

| Test layer | Responsibility |
|—|—|
| Policy unit tests | Authorization decisions and policy rules |
| Service unit tests | Business operations and dependency interactions |
| Controller tests | Request handling and response behavior |
| Route or middleware tests | Routing and authorization enforcement integration |
| Integration tests | Interactions across application components |
| API tests | HTTP contracts, status codes, and response schemas |
| Security tests | Broader security threats, including IDOR and privilege escalation |
| End-to-end tests | Complete user workflows |

Policy tests complement service, middleware, controller, and API tests. They do not replace them.

## 7. Security Requirements

- Follow the principle of least privilege.
- Deny access when authorization cannot be established, where required by the policy contract.
- Do not trust client-supplied roles or ownership claims without appropriate verification.
- Prevent unauthorized changes to protected fields.
- Avoid exposing sensitive personal information, document contents, payment details, credentials, or internal implementation details in errors.
- Use synthetic fixtures; never include real customer records or production secrets.
- Do not weaken production authorization rules merely to make tests pass.
- Verify that denied operations do not cause unauthorized state changes when state changes are within the test’s scope.

## 8. Completion Checklist

A policy test file is complete when:

- [ ] The corresponding policy implementation has been inspected.
- [ ] Tests use the real exported API and established project conventions.
- [ ] Applicable authorized and unauthorized paths are covered.
- [ ] Ownership and role checks are tested where relevant.
- [ ] Invalid inputs and applicable failure cases are covered.
- [ ] Tests are deterministic and isolated.
- [ ] No production credentials or sensitive personal data are included.
- [ ] The individual test file passes.
- [ ] The complete policy test suite passes.

A test that skips an essential authorization assertion or silently bypasses a missing implementation does not satisfy these criteria.

## 9. Maintenance

Update this README whenever policy test files are added, renamed, or removed, or when the policy architecture changes.

Keep the inventory synchronized with the repository. Document implemented behavior rather than treating a filename or planned test scenario as proof of coverage.

**Directory:** `tests/unit/policies/`

**Purpose:** Verify MedOrbits policy and authorization behavior through isolated, repeatable unit tests.
