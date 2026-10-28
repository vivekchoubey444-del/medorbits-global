# Data Storage and Caching

## 1. Storage classification

Classify data before choosing persistence:

- Public reference data: published course and institution summaries.
- Potentially stale factual data: admissions deadlines, fees, eligibility rules.
- Private applicant data: profile, application fields, document metadata.
- Highly sensitive data: identity documents and authentication credentials.
- Transactional data: payment status and submission receipts.

## 2. Secure storage

Use platform-provided secure storage for refresh credentials or other secrets when the authentication architecture requires client persistence. Do not store secrets in plain preferences, logs, source code, or URLs.

## 3. Local database

If local persistence is needed, define:
- Encryption requirements.
- Access controls.
- Schema migrations.
- Cache expiration and invalidation.
- Logout behavior.
- Backup policy.
- Data deletion and retention.
- Recovery from partial writes.

Do not assume an encrypted local database removes the need for authorization.

## 4. Cache policy

Each endpoint should document:
- Whether caching is allowed.
- Maximum age.
- Whether stale data can be displayed offline.
- How freshness is displayed.
- What actions invalidate the cache.
- Whether the data contains personal information.

For admissions deadlines and fees, display source/verification metadata when available. Do not imply stale cached information is current.

## 5. Private data

Avoid caching private documents locally unless there is a reviewed product requirement and a secure implementation. If temporary downloads are necessary, use protected storage, limit access, and delete temporary files according to policy.

## 6. Logout and account deletion

Logout must clear active session credentials and protected in-memory state. Define separate retention behavior for offline drafts and cached records. Account deletion is a server-side lifecycle and must not be represented as complete merely because local data was cleared.

## 7. Backups and diagnostics

Do not include tokens, private documents, or sensitive application data in diagnostics, crash dumps, or unreviewed backups. Apply platform-specific backup exclusions where required.

## 8. Testing

Test migrations, corrupted cache, stale cache, low storage, interrupted writes, logout cleanup, and cache isolation between accounts.
