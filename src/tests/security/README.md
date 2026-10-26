
# MedOrbits Security Test Suite

**Directory:** `tests/security/`  
**Runtime:** Node.js 20 or later  
**Test runner:** Node.js built-in test runner  
**Scope:** Automated security regression testing

## 1. Purpose

The MedOrbits security test suite contains automated regression tests for authentication, authorization, insecure direct object references (IDOR), input validation, mass assignment, payment webhooks, privilege escalation, rate limiting, sensitive-data exposure, and unauthorized document downloads.

The suite is intended to identify security regressions and verify the application’s expected access-control behaviour.

> **Important:** A passing test suite does not establish that the application is secure. Test results must be evaluated alongside the application implementation, API contract, database configuration, deployment environment, and other security controls.

## 2. Directory Structure

```text
tests/
└── security/
    ├── README.md
    ├── authentication.security.test.js
    ├── authorization.security.test.js
    ├── idor.security.test.js
    ├── input-validation.security.test.js
    ├── mass-assignment.security.test.js
    ├── payment-webhook.security.test.js
    ├── privilege-escalation.security.test.js
    ├── rate-limit.security.test.js
    ├── sensitive-data.security.test.js
    └── unauthorized-downloads.security.test.js
```

The canonical payment webhook test filename is:

`payment-webhook.security.test.js`

Do not create duplicate test files under alternative names unless they cover genuinely distinct security behaviour.

The directory structure is the intended inventory. Confirm the files exist in the repository before treating the inventory as complete.

## 3. Test Coverage

| Test file | Security objective |
|—|—|
| `authentication.security.test.js` | Verify credential handling, login behaviour, sessions or tokens, and protected-route authentication. |
| `authorization.security.test.js` | Verify role-based permissions and resource-level access restrictions. |
| `idor.security.test.js` | Verify that changing resource identifiers cannot bypass ownership or permission checks. |
| `input-validation.security.test.js` | Verify that malformed, unexpected, invalid, and oversized inputs are handled safely. |
| `mass-assignment.security.test.js` | Verify that client-supplied fields cannot override protected properties such as roles, ownership, or account status. |
| `payment-webhook.security.test.js` | Verify webhook signature validation, authenticity, event integrity, and replay protection where implemented. |
| `privilege-escalation.security.test.js` | Verify that ordinary users cannot obtain administrator or other elevated privileges. |
| `rate-limit.security.test.js` | Verify configured rate limits on sensitive endpoints. |
| `sensitive-data.security.test.js` | Verify that responses and errors do not expose credentials, secrets, private documents, or unnecessary personal information. |
| `unauthorized-downloads.security.test.js` | Verify that private documents require appropriate authentication and resource permissions. |

Actual coverage depends on the implemented assertions, configured routes, test fixtures, and application security policy.

## 4. Prerequisites

Before running the suite, ensure that you have:

- Node.js 20 or later.
- Project dependencies installed.
- A running, isolated test instance of the MedOrbits API.
- A dedicated test database containing suitable fixtures.
- Separate test identities for users with different permissions.
- Valid test credentials, tokens, or sessions where required.
- Test-owned resources and documents for ownership and IDOR checks.
- Payment-provider sandbox credentials and webhook fixtures where applicable.

Verify the installed runtime:

```bash
node —version
npm —version
```

Use a dedicated test environment. Never run destructive security tests against production data or live payment systems.

## 5. Configuration

### 5.1 Base URL

A common local API base URL is:

```bash
SECURITY_TEST_BASE_URL=http://127.0.0.1:3000
```

However, individual test files may use different environment variables, including:

- `BASE_URL`
- `DOWNLOAD_TEST_BASE_URL`
- `PRIVILEGE_TEST_BASE_URL`
- `RATE_LIMIT_TEST_BASE_URL`
- `SENSITIVE_DATA_TEST_BASE_URL`
- Other endpoint-specific variables declared in individual test files.

Setting `SECURITY_TEST_BASE_URL` does not automatically configure tests that read different variables.

**Always use the exact environment variable names expected by each test file.**

### 5.2 Credentials and test fixtures

Supply credentials and resource identifiers through environment variables or a dedicated, untracked test configuration.

Depending on the test, configuration may include:

- A standard test-user token.
- An administrator token.
- A second user’s token.
- Distinct user IDs and resource IDs.
- Document IDs and private download paths.
- Authentication, profile, application, or administrative endpoint paths.
- Request timeouts and response-size limits.
- Explicit opt-in flags for tests that can modify server-side state.

Do not commit production credentials, access tokens, private keys, webhook secrets, or real personal data.

Use synthetic fixtures wherever possible. Never copy production secrets into test files.

### 5.3 Confirm each test’s requirements

Before execution, inspect the environment-variable declarations and setup logic in the test file. Check:

1. Which environment variables are required.
2. Whether the test is skipped when configuration is incomplete.
3. Which routes and HTTP methods it requests.
4. Whether it modifies persistent data.
5. Whether it requires a particular database state or user role.
6. Whether remote or CI execution requires additional explicit opt-in.

A test that is skipped because its prerequisites are missing has not verified the corresponding security control.

## 6. Running the Tests

Run commands from the project root.

### 6.1 Run the complete security suite

```bash
node —test tests/security/*.security.test.js
```

The `—test` option must use two ASCII hyphens.

### 6.2 Run an individual test

```bash
node —test tests/security/authentication.security.test.js
```

### 6.3 Run authorization tests

```bash
node —test tests/security/authorization.security.test.js
```

### 6.4 Run IDOR tests

```bash
node —test tests/security/idor.security.test.js
```

### 6.5 Run input-validation tests

```bash
node —test tests/security/input-validation.security.test.js
```

### 6.6 Run mass-assignment tests

```bash
node —test tests/security/mass-assignment.security.test.js
```

### 6.7 Run payment-webhook tests

```bash
node —test tests/security/payment-webhook.security.test.js
```

Use only payment-provider sandbox configuration and test events.

### 6.8 Run privilege-escalation tests

```bash
node —test tests/security/privilege-escalation.security.test.js
```

### 6.9 Run rate-limit tests

```bash
node —test tests/security/rate-limit.security.test.js
```

### 6.10 Run sensitive-data tests

```bash
node —test tests/security/sensitive-data.security.test.js
```

### 6.11 Run unauthorized-download tests

```bash
node —test tests/security/unauthorized-downloads.security.test.js
```

### 6.12 Use a package script if configured

If `package.json` defines a dedicated security-test script, inspect its command and environment requirements before using it.

For example, a project may define:

```json
{
  “scripts”: {
    “test:security”: “node —test tests/security/*.security.test.js”
  }
}
```

This is an example configuration, not a claim that the script already exists in the MedOrbits repository.

If configured, run:

```bash
npm run test:security
```

## 7. Test Data and Isolation

Use dedicated test identities and resources:

| Identity | Purpose |
|—|—|
| User A | Owns a private test resource and should access it when authorized. |
| User B | Owns a separate private resource used for cross-user access checks. |
| Administrator | Used only for tests requiring explicitly authorized administrative access. |
| Unauthenticated client | Sends requests without valid authentication credentials. |

### Required access-control scenarios

For user-owned resources, verify both permitted and denied operations:

1. User A can access User A’s authorized resource.
2. User A cannot access User B’s private resource.
3. User B cannot access User A’s private resource.
4. An unauthenticated client cannot access protected resources.
5. An ordinary user cannot access administrator-only operations.
6. Changing an identifier, request body, or client-supplied ownership field does not bypass authorization.

A denied request must not disclose the protected file contents or sensitive resource data.

### Test isolation requirements

- Use unique fixtures or reset the test database between runs.
- Avoid relying on execution order.
- Restore modified records after tests.
- Clean up temporary files and test-only resources.
- Prevent parallel tests from modifying the same fixture unexpectedly.
- Keep rate-limit tests isolated from unrelated requests when possible.
- Ensure test accounts and resources cannot affect real users.

Where a test verifies that a mutation was rejected, check the resulting state as well as the HTTP response whenever the API provides a reliable way to read that state.

## 8. Expected Security Behaviour

The application should enforce the following controls according to its documented API contract:

1. **Authentication:** Protected endpoints reject requests without valid authentication.
2. **Authorization:** Users cannot access resources without the required permissions.
3. **Ownership:** Resource identifiers cannot be manipulated to obtain another user’s private data.
4. **Mass assignment:** Client-supplied roles, ownership, account status, and payment status cannot override trusted server-side values.
5. **Input validation:** Invalid input is rejected safely and consistently.
6. **Error handling:** Responses do not unnecessarily expose stack traces, database details, internal paths, or secrets.
7. **Webhook integrity:** Payment events are authenticated and validated before processing; replay protection is enforced where required.
8. **Rate limiting:** Configured limits protect sensitive endpoints against excessive requests.
9. **Data minimization:** Responses expose only information needed for the requested operation.
10. **Download authorization:** Every private download request is subject to appropriate access checks, including direct URL access.
11. **Secret handling:** Security logs avoid unnecessary storage of passwords, raw session tokens, and other secrets.
12. **State integrity:** Unauthorized requests do not modify protected records or trigger unintended side effects.

### Response status codes

Follow the API’s intended contract. Depending on the endpoint and resource-concealment policy, a denied request may appropriately return:

- `400 Bad Request` — invalid request data.
- `401 Unauthorized` — authentication is missing or invalid.
- `403 Forbidden` — the authenticated caller lacks permission.
- `404 Not Found` — the resource does not exist or its existence is intentionally concealed.
- `405 Method Not Allowed` — the HTTP method is not supported.
- `413 Content Too Large` — the request exceeds the permitted size.
- `415 Unsupported Media Type` — the request uses an unsupported content type.
- `422 Unprocessable Content` — the request is syntactically valid but fails semantic validation.
- `429 Too Many Requests` — a configured rate limit has been exceeded.

These are common examples, not mandatory status codes for every endpoint. Tests should match the documented API policy without weakening the underlying security requirement.

## 9. Interpreting Results

A successful run means only that the executed assertions passed under the tested conditions.

### When a test fails

Investigate:

- Whether the API server is reachable.
- Whether the base URL and route paths match the application.
- Whether the credentials and fixture identifiers are valid.
- Whether the test expects the correct status code and response format.
- Whether the database contains the expected isolated fixtures.
- Whether the application follows a different documented authorization policy.
- Whether rate limits, session state, or test ordering affected the result.
- Whether the failure reveals a real security defect.

Do not weaken a security assertion merely to make the suite pass. Establish the intended security policy first, then correct the implementation or test expectation as appropriate.

### When a test is skipped

Determine why it was skipped. Missing credentials, unavailable routes, absent fixtures, or disabled mutation tests can prevent a security control from being tested.

A skipped test is not a passing security verification.

### When a test passes

Confirm that:

- The intended test actually executed.
- The expected endpoint was reached.
- The response was evaluated correctly.
- Relevant persistent state was checked where necessary.
- The test used the intended user identity and permissions.
- The environment represented the security configuration being evaluated.

## 10. Safety Requirements for Mutating Tests

Some security tests may issue `POST`, `PUT`, `PATCH`, or `DELETE` requests. These requests can create, modify, or remove persistent data.

Before running mutating tests:

1. Use an isolated test instance.
2. Use a dedicated test database.
3. Confirm that external integrations point to sandbox systems.
4. Inspect the test’s opt-in flags and execution guards.
5. Create disposable fixtures or backups where appropriate.
6. Verify cleanup and state-restoration behaviour.

If a test requires explicit mutation opt-in, do not enable it until its prerequisites and possible side effects are understood.

Do not point a mutation-enabled test at production. A variable named `test`, `sandbox`, or similar is not proof that the target is safe; independently verify the actual destination.

## 11. Limitations

The security suite is not a substitute for:

- Dependency and vulnerability scanning.
- Static analysis and code review.
- Database access-control and deployment configuration reviews.
- CSRF, CORS, cookie, session, and transport-security verification where applicable.
- Payment-provider sandbox testing.
- File-upload content validation and malware scanning.
- Secret scanning and secure configuration management.
- Logging and audit-trail reviews.
- Independent penetration testing.

A test cannot verify an endpoint, feature, or security control that it does not exercise. Endpoint names, environment variables, fixtures, and response expectations must match the actual MedOrbits implementation.

Do not assume a route is implemented merely because a test references it.

## 12. Maintenance Checklist

When adding or modifying an API endpoint:

1. Define the endpoint’s authentication requirements.
2. Define role-based and resource-level authorization rules.
3. Add positive and negative security tests.
4. Include cross-user access checks for user-owned resources.
5. Test malformed, unexpected, and boundary-case inputs.
6. Verify that protected properties cannot be changed through mass assignment.
7. Check error responses for sensitive information.
8. Verify that unauthorized requests do not cause state changes.
9. Ensure fixtures are isolated and cleanup is reliable.
10. Update this README when the test inventory changes.
11. Run the relevant tests and the complete security suite before merging.
12. Record any known gaps or skipped checks in the review.

## 13. Security Reporting

Report confirmed vulnerabilities privately to the project maintainers through an approved reporting channel.

Include:

- The affected endpoint or component.
- The environment and prerequisites.
- Reproducible steps using synthetic test data.
- Expected behaviour.
- Actual behaviour.
- Potential security impact.
- Relevant sanitized logs or test output.
- A proposed mitigation, if known.

Do not include live credentials, raw access tokens, private documents, production personal information, or other secrets in the report.

## 14. Final Verification

Before considering the security suite ready for a release, confirm that:

- [ ] All expected security test files exist.
- [ ] Environment-variable names match the test implementations.
- [ ] The API is running in an isolated test environment.
- [ ] Test users and resources have the intended permissions and ownership.
- [ ] Mutating tests are guarded and use disposable fixtures.
- [ ] Payment tests use sandbox configuration.
- [ ] The complete suite has been executed.
- [ ] Failures and skips have been investigated.
- [ ] The results and any remaining coverage gaps have been reviewed.

**Release principle:** Security testing is meaningful only when the relevant tests actually execute against the intended application, with valid fixtures and independently verified environment isolation.
