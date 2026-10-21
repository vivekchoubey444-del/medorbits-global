
# MedOrbits — Storage Integration

**Directory:** `src/integrations/storage/`

## 1. Overview

The storage integration provides a provider-independent interface for storing, retrieving, and deleting private file objects.

Supported providers:

- **Local:** Private filesystem storage.
- **S3:** Private object storage using the AWS SDK and compatible endpoints.

Provider-specific operations are encapsulated behind a consistent API.

**Security principle:** This adapter does not generate public URLs or signed download URLs. Applications must authorize every document download before retrieving its contents.

## 2. Directory Structure

```text
src/integrations/storage/
├── README.md
├── index.js
├── local.provider.js
├── s3.provider.js
├── storage.client.js
└── storage.config.js
```

## 3. Storage API

| Method | Input | Responsibility |
|—|—|—|
| `put()` | `{ key, body, contentType }` | Store a file object. |
| `get()` | `key` | Retrieve a stored object. |
| `delete()` | `key` | Delete a stored object. |
| `close()` | None | Release provider resources when supported. |

### Return contracts

**`put()`**

Returns metadata such as the storage key, byte size, content type, and checksum when supported by the provider.

**`get()`**

Returns the storage key, file body as a `Buffer`, byte size, and content type when available. The local provider currently defaults to `application/octet-stream` because it does not persist MIME metadata.

**`delete()`**

Returns the key and whether an object was deleted. A missing object may return `deleted: false`.

Provider-specific metadata should not be exposed to public API consumers unless explicitly required.

## 4. Example Usage

The following example assumes `createStorageClient()` is exported by `index.js`.

```javascript
‘use strict’;

const crypto = require(‘node:crypto’);
const { createStorageClient } = require(‘./index’);

const storage = createStorageClient();

async function storeDocument(buffer, contentType) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(‘Document body must be a Buffer.’);
  }

  // Generate a server-controlled key. Never use the client filename.
  const key = `documents/${crypto.randomUUID()}`;

  await storage.put({
    key,
    body: buffer,
    contentType,
  });

  return { key };
}

module.exports = { storeDocument };
```

Create the storage client once during application initialization and reuse it. Close it during graceful shutdown when the application owns its provider.

## 5. Configuration

### Local storage

Local storage is the default provider.

```dotenv
STORAGE_DRIVER=local
STORAGE_LOCAL_ROOT=storage/private
STORAGE_MAX_FILE_BYTES=10485760
```

- `STORAGE_DRIVER`: Selects the storage provider.
- `STORAGE_LOCAL_ROOT`: Configures the local storage root.
- `STORAGE_MAX_FILE_BYTES`: Maximum permitted object size in bytes.

The example size limit is 10 MiB.

Requirements:

- Keep private files outside publicly served directories.
- Restrict filesystem permissions to the application account.
- Reject path traversal and unsafe storage keys.
- Check path components for symbolic links.
- Enforce size limits before writing and when retrieving files.
- Do not trust client-provided filenames.

### S3 storage

Configure these variables when using S3:

```dotenv
STORAGE_DRIVER=s3
S3_BUCKET=your-private-bucket
S3_REGION=your-region
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_PREFIX=private
```

Install the dependency:

```bash
npm install @aws-sdk/client-s3
```

Use workload identity, instance roles, or the hosting platform’s supported credential chain. Do not hardcode credentials or commit secrets.

The bucket must remain private. Do not configure public ACLs or public bucket policies for documents handled by this integration.

Optional server-side encryption and KMS configuration must match the provider implementation and infrastructure policy.

## 6. Provider Selection

The `STORAGE_DRIVER` setting determines which provider is initialized.

- `local`: Initializes `LocalStorageProvider`.
- `s3`: Initializes `S3StorageProvider`.

Unsupported drivers and invalid configuration must fail during startup. The application must not silently fall back to local storage when S3 initialization fails.

Initialize only the selected provider.

When supplying a preconfigured provider or custom configuration, ensure the factory passes the configuration to the selected provider consistently.

## 7. Security Requirements

### 7.1 Object keys

- Generate object keys on the server.
- Never construct storage paths directly from client filenames.
- Reject absolute paths, traversal sequences, malformed keys, and control characters.
- Apply a consistent prefix and namespace policy.
- Prevent unauthorized overwrites.
- Use database records and application authorization to enforce ownership.
- Avoid returning filesystem paths or sensitive provider metadata.

Object keys are identifiers, not authorization credentials.

### 7.2 Upload validation

The storage adapter enforces file-size limits and validates basic input. Upload services must additionally:

- Validate permitted file types.
- Inspect file signatures where appropriate.
- Treat MIME types and extensions supplied by clients as untrusted.
- Apply malware scanning where required by the application’s risk profile.
- Keep untrusted uploads private until validation and scanning are complete.
- Enforce per-user quotas and upload rate limits where applicable.

### 7.3 Downloads

This adapter intentionally does not generate public URLs or signed URLs.

Before retrieving a document, the application must:

1. Authenticate the requester.
2. Load the authoritative document record.
3. Verify ownership or the applicable access permission.
4. Obtain the storage key from trusted server-side data.
5. Retrieve the object through the storage client.
6. Return the content with appropriate response headers.
7. Avoid exposing internal storage details.

Authorization must be enforced on every download request, regardless of provider.

### 7.4 HTTP response headers

For private documents, use appropriate headers, such as:

```http
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
Content-Disposition: attachment
```

Set a validated content type and a safely encoded download filename where needed. Do not interpolate an untrusted filename directly into an HTTP header.

### 7.5 Deletion

- Verify that the requester or internal operation is authorized to delete the object.
- Confirm that the key belongs to the expected namespace.
- Coordinate deletion with database records and retention requirements.
- Handle missing objects consistently.
- Log operational failures without logging file contents, credentials, or sensitive personal data.
- Define retry and reconciliation behavior for partial failures between database and storage operations.

## 8. Error Handling

The integration and its callers should distinguish these error categories:

| Category | Example |
|—|—|
| Invalid input | Malformed key or unsupported body type |
| Configuration | Unsupported driver or missing bucket |
| Size violation | Object exceeds configured limit |
| Missing object | Requested file does not exist |
| Filesystem failure | Permission denied or disk unavailable |
| Provider authorization | S3 credentials lack required permissions |
| Network failure | Timeout or provider outage |
| Lifecycle failure | Operation attempted after client closure |

Translate internal errors into stable application-level error codes at the service or controller boundary.

Do not expose raw filesystem paths, credentials, internal stack traces, or provider internals through public API responses.

## 9. Lifecycle and Resource Ownership

- Reuse a single initialized storage client where appropriate.
- Close owned providers during graceful application shutdown.
- Do not close an injected provider unless ownership has explicitly been transferred.
- Make shutdown idempotent.
- Avoid initializing storage clients independently for every request.
- Ensure S3 clients are destroyed when initialization fails after resource allocation.

## 10. Testing Requirements

Use temporary directories and isolated or mocked S3 resources. Never use production documents or credentials in automated tests.

Cover:

- Successful upload, retrieval, and deletion.
- Empty and invalid bodies.
- File-size boundaries.
- Invalid and traversal-based keys.
- Existing-key overwrite prevention.
- Missing objects.
- Symbolic-link and path-containment protections.
- Filesystem permission failures.
- S3 configuration and access failures.
- Provider initialization and shutdown.
- Network failures and interrupted reads.
- Unauthorized downloads at the application layer.
- Cleanup and deletion failure handling.
- Content type and metadata consistency.
- Repeated close calls and operations after closure.

A passing unit test suite does not, by itself, establish complete filesystem race protection or cloud infrastructure security.

## 11. Implementation Checklist

- [ ] `put()`, `get()`, and `delete()` follow the documented contract.
- [ ] Local storage uses a private directory.
- [ ] S3 credentials use an appropriate identity mechanism.
- [ ] File-size limits are enforced on upload and retrieval.
- [ ] Object keys are server-generated and validated.
- [ ] Existing objects cannot be overwritten unintentionally.
- [ ] Upload validation and optional malware scanning are handled by the appropriate service.
- [ ] Every download is authorized.
- [ ] Public and signed URL generation is not exposed by this adapter.
- [ ] Provider errors are mapped safely at the application boundary.
- [ ] Resource ownership and shutdown are defined.
- [ ] Automated tests cover security and failure scenarios.

## 12. Related Documentation

- `src/config/storage.js` — Application storage configuration.
- `src/integrations/README.md` — Integration architecture and shared requirements.
- `src/controllers/README.md` — Controller responsibilities and authorization.
- `infrastructure/backup/` — Backup and restore procedures.

—

**MedOrbits — Study · Work · Grow**

Private, provider-independent storage for application documents and files.
