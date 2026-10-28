# Release and Configuration

## 1. Environments

Maintain distinct development, test, staging, and production configuration. Each environment must define:
- API base URL
- Authentication issuer/client configuration
- Feature flags
- Logging/telemetry endpoint and policy
- Upload host allowlist
- Payment provider environment, if enabled
- Minimum supported API version

Do not bundle server-side secrets in the mobile app. Public client IDs may be embedded only when designed for public use by the identity provider.

## 2. Configuration validation

Fail safely when required configuration is missing or malformed. Never silently fall back from production to a development endpoint. Avoid printing configuration values that may contain secrets.

## 3. Feature flags

Feature flags must not be used as authorization. Sensitive operations must remain protected by backend policy even if a client flag is manipulated.

## 4. Build security

- Protect signing credentials.
- Restrict release pipeline permissions.
- Scan dependencies and secrets.
- Keep release artifacts and provenance.
- Avoid embedding test accounts or production tokens.
- Review permissions requested by the app.

## 5. Release checklist

- [ ] Version and build number updated.
- [ ] Correct environment selected.
- [ ] API contract checked against deployed backend.
- [ ] Authentication and authorization tests pass.
- [ ] No secrets or private test data in artifacts.
- [ ] Upload and payment flows verified in approved test environments.
- [ ] Accessibility and localization checks complete.
- [ ] Crash reporting and analytics reviewed for privacy.
- [ ] Privacy notice and consent flows current.
- [ ] Rollback and incident procedures documented.
- [ ] Release notes and known issues prepared.

## 6. Rollback

Document how to disable a feature flag, roll back a mobile/backend release where possible, revoke compromised credentials, and communicate material incidents. A mobile app cannot always be rolled back on devices already updated; design backend compatibility accordingly.
