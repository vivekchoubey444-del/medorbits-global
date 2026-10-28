# Application Documents API Contract

**Base path:** `/api/v1/applications/{applicationId}/documents`  
**Authentication:** Required.

## 1. List document requirements and uploaded documents

`GET /api/v1/applications/{applicationId}/documents`

Returns the checklist for the authorized application.

Example:

```json
{
  "success": true,
  "data": [
    {
      "id": "doc_requirement_001",
      "type": "class_10_certificate",
      "required": true,
      "status": "missing",
      "uploadedAt": null
    }
  ],
  "meta": {
    "requestId": "req_example"
  }
}
```

The allowed document types must be configured by admission/course requirements. Examples may include identity, academic certificates, entrance examination records, photographs, or category certificates, but the backend must not assume every type is required for every application.

## 2. Upload a document

`POST /api/v1/applications/{applicationId}/documents`

Authentication: Required.

The implementation must choose and document one supported upload mechanism:

A. Direct multipart upload using `multipart/form-data`; or  
B. A short-lived, server-authorized upload URL followed by a completion request.

Do not accept arbitrary public URLs supplied by the client as proof of upload.

Required controls:

- Verify application ownership and upload permission.
- Enforce file-size and request-size limits.
- Allowlist supported file types.
- Validate file signatures/content as well as extensions and MIME types.
- Scan for malware where supported.
- Store files privately and encrypt them at rest where supported.
- Generate storage keys on the server.
- Avoid public, permanent document URLs.
- Record upload and review events.
- Do not log document contents or sensitive identifiers.

Example metadata response:

```json
{
  "success": true,
  "data": {
    "id": "document_example_001",
    "type": "class_10_certificate",
    "status": "uploaded",
    "uploadedAt": "2026-10-29T10:45:00Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Success: `201 Created`

## 3. Get document metadata

`GET /api/v1/applications/{applicationId}/documents/{documentId}`

Return authorized metadata, for example:

- document ID
- document type
- status
- upload timestamp
- review timestamp, if visible
- user-safe rejection reason, if applicable

Do not expose internal storage credentials or reviewer-only notes.

## 4. Download document

`POST /api/v1/applications/{applicationId}/documents/{documentId}/download-link`

Use this proposed endpoint only if temporary download links fit the storage design. Authenticate and authorize each request. Links must be short-lived and scoped to the requested object.

Alternatively, stream the file through an authenticated endpoint.

## 5. Delete or replace a document

`DELETE /api/v1/applications/{applicationId}/documents/{documentId}`

Permit deletion only when allowed by the application workflow and retention rules. A submitted or locked application may require an explicit replacement flow.

Success: `204 No Content`

## 6. Document status values

Proposed values:

- `missing`
- `uploaded`
- `processing`
- `accepted`
- `rejected`
- `replacement_required`

The backend owns the status lifecycle.

## 7. Errors

- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 RESOURCE_NOT_FOUND`
- `409 INVALID_STATE_TRANSITION`
- `413 FILE_TOO_LARGE`
- `415 UNSUPPORTED_MEDIA_TYPE`
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`

Do not reveal whether another user's document exists.

## 8. Retention and privacy

Document retention, deletion, legal holds, and access must follow the applicable privacy notice and legal requirements. Do not automatically delete records merely because a user signs out or removes the mobile app.
