# Offline Support and Synchronization

## 1. Goals

Offline support should preserve user work where safe, clearly indicate data freshness, and avoid duplicating server-side actions. It must never claim that a submission, upload, payment, or status transition completed while its outcome is unknown.

## 2. Offline capabilities

Potentially available offline:
- Read-only cached public admissions and course summaries.
- Read-only cached institution information.
- Local draft editing, if the feature has been designed for it.
- Viewing a cached application summary with a visible last-updated time.

Require a connection unless a dedicated safe workflow exists:
- Final application submission.
- Payment initiation, cancellation, or refund requests.
- Eligibility decisions requiring current official data.
- Document upload completion or document review status.
- Administrative actions.

## 3. Connectivity states

Represent:
- Online
- Offline
- Connection uncertain
- Syncing
- Sync failed
- Pending local changes

Connectivity signals are advisory; a connected device may still be unable to reach the API.

## 4. Cached data labeling

When displaying cached data, provide a visible freshness indicator, for example:

"Last updated: [timestamp]. This information may have changed."

For deadlines, fees, eligibility, and other high-impact information, direct users to refresh before taking action. Do not infer that an opportunity remains open from stale data.

## 5. Draft synchronization

If offline drafts are supported:
1. Persist only the minimum necessary data.
2. Assign a local draft ID distinct from the server ID.
3. Track dirty fields or a draft version.
4. On reconnection, authenticate and validate the draft against current server rules.
5. Use version checks or conflict handling where supported.
6. Preserve conflicting user edits and ask for resolution when automatic merging is unsafe.
7. Mark the draft synced only after a confirmed server response.

Do not queue passwords, OTPs, payment credentials, or unreviewed sensitive documents in a generic retry queue.

## 6. Mutation queue

Only queue operations explicitly designed to be replay-safe. Each queued operation should record:
- Operation type
- Local operation ID
- Required resource reference
- Creation time
- Retry count and next eligible retry time
- Idempotency key, if supported
- Current state

Never persist access tokens inside queued operation payloads. Obtain fresh authorization at replay time.

## 7. Retry and backoff

- Use bounded exponential backoff with jitter.
- Honor server `Retry-After` headers.
- Stop retrying permanent validation and authorization errors.
- Avoid retry storms when the app resumes.
- Require idempotency for replayable operations that can create side effects.

## 8. Conflict handling

The server remains authoritative. Do not automatically overwrite newer server data with stale local state. Use explicit versioning or conditional updates where supported. Preserve the user's local draft when conflict resolution is needed.

## 9. Upload interruption

Track upload progress and final server confirmation separately. A locally selected file is not an uploaded document; an uploaded file is not an accepted document. Allow safe retry using a documented upload session or idempotent mechanism.

## 10. Payment and submission restrictions

Do not automatically retry payment or final submission after an ambiguous timeout unless the backend contract supports safe idempotent replay. First query authoritative status where possible.

## 11. Logout and multiple accounts

Prevent one account's cached private data from appearing in another account's session. Define whether drafts are retained, securely isolated, or removed on logout. Never silently transfer draft ownership.

## 12. Tests

- [ ] Cached reads work without a connection.
- [ ] Stale data is visibly marked.
- [ ] Reconnection does not duplicate submissions.
- [ ] Conflicting edits are not silently lost.
- [ ] Expired sessions do not replay private actions with stale credentials.
- [ ] Interrupted uploads are not marked complete.
- [ ] Payment state is verified from the backend.
- [ ] Retry limits and backoff are respected.
