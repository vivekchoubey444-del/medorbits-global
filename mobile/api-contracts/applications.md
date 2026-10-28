# Applications API Contract

**Base path:** `/api/v1/applications`  
**Authentication:** Required for all endpoints in this document.

## 1. Create a draft

`POST /api/v1/applications`

Headers:
- `Authorization: Bearer <access-token>`
- `Idempotency-Key: <unique-key>` where supported

Example request:

```json
{
  "admissionId": "adm_example_001",
  "institutionId": "inst_example_001",
  "courseId": "course_example_001",
  "applicant": {
    "fullName": "Applicant Name",
    "email": "applicant@example.com",
    "phone": null
  },
  "consents": {
    "privacyNoticeAccepted": true,
    "dataProcessingAccepted": true
  }
}
```

Success: `201 Created`

Example response:

```json
{
  "success": true,
  "data": {
    "id": "application_example_001",
    "status": "draft",
    "createdAt": "2026-10-29T10:00:00Z",
    "updatedAt": "2026-10-29T10:00:00Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

The server must validate referenced records, access rights, required consent, and application-cycle rules. The example values are not real records.

## 2. List my applications

`GET /api/v1/applications`

Optional query parameters: `status`, `limit`, `cursor`.

Only return applications the authenticated user is authorized to view.

## 3. Get application

`GET /api/v1/applications/{applicationId}`

Returns permitted application fields, status, checklist summary, outstanding actions, and timestamps.

## 4. Update a draft

`PATCH /api/v1/applications/{applicationId}`

Only allowlisted fields may be updated. The server must verify ownership and current state.

Example:

```json
{
  "applicant": {
    "email": "updated@example.com"
  }
}
```

Reject changes to server-controlled fields such as `status`, `submittedAt`, `reviewerId`, or approval decisions.

## 5. Submit application

`POST /api/v1/applications/{applicationId}/submit`

Before accepting, the server must:

1. Authenticate and authorize the caller.
2. Verify the application is in a submittable state.
3. Confirm the application window is open according to authoritative data.
4. Validate required fields, declarations, and documents.
5. Enforce applicable duplicate-submission and idempotency rules.
6. Record the submission time and audit event.
7. Return a stable result for a safe retry where idempotency is supported.

Example response:

```json
{
  "success": true,
  "data": {
    "id": "application_example_001",
    "status": "submitted",
    "submittedAt": "2026-10-29T10:30:00Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Possible errors include `409 INVALID_STATE_TRANSITION`, `422 DEADLINE_PASSED`, and `422 DOCUMENTS_INCOMPLETE`.

## 6. Withdraw application

`POST /api/v1/applications/{applicationId}/withdraw`

Implement only if withdrawal is permitted by the business process. Require confirmation and record the event. Do not imply that withdrawal reverses external counselling, payment, or institutional processes.

## 7. Status history

`GET /api/v1/applications/{applicationId}/history`

Returns authorized status changes and user-safe descriptions. Do not expose confidential reviewer notes.

## 8. Status values

Proposed values:

- `draft`
- `submitted`
- `under_review`
- `action_required`
- `documents_pending`
- `approved`
- `rejected`
- `withdrawn`
- `closed`

The backend owns status transitions. Do not let clients set arbitrary status values.

## 9. Concurrency and audit

Where supported, use `ETag` / `If-Match` or another explicit version check to prevent lost updates. Audit creation, submission, withdrawal, status changes, and sensitive field changes.

## 10. Privacy

Return only fields required by the current user. Apply object-level authorization on every request and do not trust the application ID alone.
