MedOrbits Security Test Suite

1. Purpose

This directory contains automated security regression tests for the MedOrbits application. The tests are intended to detect authentication failures, authorization bypasses, insecure direct object references (IDOR), input-validation weaknesses, mass assignment, payment webhook vulnerabilities, privilege escalation, rate-limit failures, sensitive-data exposure, and unauthorized document downloads.

> **Important:** A test passing does not independently establish that the application is secure. Tests must be executed against the actual application and reviewed alongside the implementation, configuration, and deployment environment.

2. Directory Structure

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

The canonical payment webhook test filename is payment-webhook.security.test.js. Do not maintain duplicate tests under alternative filenames unless they cover distinct functionality.

3. Test Coverage

|Test file                                |Security objective                                                                                                  |
|——————————————|———————————————————————————————————————|
|`authentication.security.test.js`        |Verify login, session or token handling, invalid credentials, and protected-route authentication.                   |
|`authorization.security.test.js`         |Verify role-based and resource-level access restrictions.                                                           |
|`idor.security.test.js`                  |Verify users cannot access another user’s records by changing resource identifiers.                                 |
|`input-validation.security.test.js`      |Verify malformed, unexpected, oversized, and invalid inputs are rejected safely.                                    |
|`mass-assignment.security.test.js`       |Verify clients cannot modify protected properties such as roles, ownership, or account status.                      |
|`payment-webhook.security.test.js`       |Verify webhook authenticity, signature validation, and replay protection where applicable.                          |
|`privilege-escalation.security.test.js`  |Verify ordinary users cannot obtain administrator or other elevated privileges.                                     |
|`rate-limit.security.test.js`            |Verify configured rate limits protect sensitive endpoints against excessive requests.                               |
|`sensitive-data.security.test.js`        |Verify responses and errors do not expose passwords, tokens, private documents, or unnecessary personal information.|
|`unauthorized-downloads.security.test.js`|Verify private documents and downloads require authentication and appropriate resource permissions.                 |

Actual coverage depends on the implemented tests, configured endpoints, and available test fixtures.

4. Prerequisites

• Node.js 20 or later.
• Dependencies installed using the project’s package manager.
• A running test instance of the MedOrbits API.
• Test accounts with distinct user identities and roles.
• Test documents and other resources owned by the appropriate test accounts.
• Valid test tokens or sessions where required.
• A dedicated test database and test payment-webhook configuration, where applicable.

Never run destructive security tests against production data or live payment systems.

5. Configuration

Review each test file for its supported environment variables. A common configuration value may be:

SECURITY_TEST_BASE_URL=http://127.0.0.1:3000

Individual tests may use different variable names, including BASE_URL, DOWNLOAD_TEST_BASE_URL, or endpoint-specific settings. Use the exact names expected by each file rather than assuming one variable configures the entire suite.

Provide credentials and test resource identifiers through environment variables or a dedicated test configuration. Do not commit real credentials, access tokens, private keys, or production personal data.

6. Running the Tests

Run the complete security test suite from the project root using Node.js’s built-in test runner:

node —test tests/security/*.security.test.js

Run an individual test file:

node —test tests/security/authentication.security.test.js

Run the download authorization tests:

node —test tests/security/unauthorized-downloads.security.test.js

Use two ASCII hyphens in —test; do not use an em dash. If the project defines a dedicated security-test script in package.json, confirm its command and environment configuration before using it.

7. Test Data and Isolation

Use dedicated test identities and resources:

• User A: owns a private test resource.
• User B: owns a different private test resource.
• Administrator: used only for explicitly authorized administrative tests.
• Unauthenticated client: sends requests without credentials.

Tests should verify both allowed and denied access. For example, User A should be able to access their own authorized resource but must not be able to access User B’s private resource.

Restore modified records and remove temporary files after testing. Tests should be repeatable and should not depend on execution order.

8. Expected Security Behaviour

The application should enforce the following controls:

1. Protected endpoints reject unauthenticated requests.
2. Authenticated users cannot access resources they do not own or have explicit permission to access.
3. Client-supplied role, ownership, payment status, and account-status fields cannot override server-side authorization.
4. Invalid input is rejected without exposing stack traces, database details, or secrets.
5. Payment events are processed only after the applicable authenticity and integrity checks.
6. Rate limits are enforced on configured sensitive endpoints.
7. Responses disclose only the information required for the operation.
8. Private downloads enforce authorization on every request, including direct URL access.
9. Security failures do not leak private file contents or bypass access controls.
10. Security logging avoids storing passwords, raw session tokens, or other secrets unnecessarily.

Use the status codes defined by the API contract. A denied resource request may appropriately return 401, 403, or 404, depending on the endpoint and whether resource existence should be concealed.

9. Interpreting Results

A successful test run means only that the tested assertions passed under the tested conditions.

Investigate failures by checking:

• Whether the API server is running and reachable.
• Whether route paths match the actual route registrations.
• Whether authentication credentials and resource IDs are valid.
• Whether the test expects the correct response status and content type.
• Whether the database contains the expected isolated fixtures.
• Whether the application uses a different documented authorization policy.

Do not weaken a security assertion merely to make a test pass. Confirm the intended security policy and correct either the implementation or the test expectation.

10. Limitations

These tests are not a substitute for:

• Dependency and vulnerability scanning.
• Static analysis and code review.
• Database permission and deployment configuration reviews.
• CSRF, CORS, session-cookie, and transport-security verification where applicable.
• Payment-provider sandbox testing.
• File-upload content validation and malware scanning.
• Independent penetration testing.

Endpoint names, environment variables, test fixtures, and response expectations must match the actual MedOrbits implementation. Do not assume a route is implemented simply because a test references it.

11. Maintenance

When adding or modifying an API endpoint:

1. Define its authentication and authorization requirements.
2. Add positive and negative security tests.
3. Include cross-user access checks for user-owned resources.
4. Verify validation and error-handling behaviour.
5. Update this README if the test inventory changes.
6. Run the relevant tests and the complete security suite before merging.

12. Security Reporting

Report confirmed vulnerabilities privately to the project’s maintainers. Include the affected endpoint, prerequisites, reproducible test steps, expected behaviour, actual behaviour, and potential impact. Exclude live credentials, private documents, and unnecessary personal information from reports.