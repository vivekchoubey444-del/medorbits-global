
# MedOrbits Download API

**File:** `app/api/download/README.md`  
**Endpoint:** `/api/download`  
**Runtime:** Node.js 20+  
**Framework:** Next.js App Router  
**Purpose:** Secure delivery of approved public PDF resources.

—

## 1. Overview

The MedOrbits Download API allows visitors to download approved educational and career resources through a controlled server-side endpoint.

Features include:

- Explicit resource allowlisting.
- PDF-only downloads.
- Resource ID validation.
- Filesystem path traversal protection.
- File-size limits.
- Download-specific response headers.
- `GET`, `HEAD`, and `OPTIONS` handlers.
- Generic error messages that avoid exposing filesystem details.

The endpoint is intended for public resources such as admission guides, document checklists, career guides, and course catalogs.

**Security boundary:** This endpoint is designed for approved public documents. It is not an authentication or authorization system for confidential files, student records, application documents, or identity documents.

## 2. Directory Structure

```text
app/
└── api/
    └── download/
        ├── route.js
        └── README.md

public/
└── downloads/
    ├── mbbs-admission-guide.pdf
    ├── neet-ug-document-checklist.pdf
    ├── career-guide.pdf
    └── course-catalog.pdf
```

The PDF files must exist in the configured download directory before they can be downloaded.

Only place resources intended for public access in this directory.

## 3. Available Endpoints

| Method | Endpoint | Purpose |
|—|—|—|
| `GET` | `/api/download?id=mbbs-admission-guide` | Download an approved PDF |
| `HEAD` | `/api/download?id=mbbs-admission-guide` | Check resource availability and metadata |
| `OPTIONS` | `/api/download` | Advertise supported methods |

### Supported resource IDs

The current `RESOURCE_MANIFEST` in `route.js` defines these identifiers:

| Resource ID | Expected filename |
|—|—|
| `mbbs-admission-guide` | `mbbs-admission-guide.pdf` |
| `neet-ug-checklist` | `neet-ug-document-checklist.pdf` |
| `career-guide` | `career-guide.pdf` |
| `course-catalog` | `course-catalog.pdf` |

The manifest is the authoritative list of downloadable resources. Adding a PDF to the directory alone does not make it downloadable.

## 4. Request Examples

Download the MBBS admission guide:

```bash
curl -fL \
  “http://localhost:3000/api/download?id=mbbs-admission-guide” \
  -o MedOrbits-MBBS-Admission-Guide.pdf
```

Download the NEET UG checklist:

```bash
curl -fL \
  “http://localhost:3000/api/download?id=neet-ug-checklist” \
  -o MedOrbits-NEET-UG-Document-Checklist.pdf
```

Check availability without downloading the file:

```bash
curl -I \
  “http://localhost:3000/api/download?id=career-guide”
```

In production, replace `http://localhost:3000` with the deployed MedOrbits domain.

## 5. Response Behavior

### Successful download

A successful request returns HTTP `200 OK`, the PDF body, and headers such as:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename=“MedOrbits-MBBS-Admission-Guide.pdf”
Content-Length: 123456
Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0
X-Content-Type-Options: nosniff
```

The content length above is illustrative.

### Error responses

| Status | Meaning |
|—|—|
| `200` | File successfully served or HEAD metadata returned |
| `204` | OPTIONS response |
| `400` | Missing or invalid resource ID |
| `404` | Resource is unknown or unavailable on disk |
| `503` | Resource exceeds configured limits or cannot be served under the current implementation |
| `500` | Unexpected download-processing failure |

For GET requests, errors are returned as JSON.

Example:

```json
{
  “success”: false,
  “error”: “resource_not_found”,
  “message”: “The requested resource was not found.”
}
```

The implementation intentionally avoids exposing internal filesystem paths and operating-system error messages.

## 6. Environment Configuration

The endpoint supports the following optional variables:

```dotenv
DOWNLOADS_DIRECTORY=public/downloads
DOWNLOAD_MAX_FILE_BYTES=52428800
```

| Variable | Default | Description |
|—|—|—|
| `DOWNLOADS_DIRECTORY` | `public/downloads` | Directory containing approved downloadable files |
| `DOWNLOAD_MAX_FILE_BYTES` | `52428800` | Maximum permitted file size in bytes |

The configured file-size limit is capped at 200 MB by the current handler.

For example, `52428800` bytes equals 50 MiB.

Configure these variables in `.env.local` for development or in your hosting provider’s environment settings for production.

Do not put private credentials in this file.

## 7. Adding a New Resource

Follow these steps whenever a new public PDF needs to be published.

### Step 1: Add the PDF

Place the approved document in the configured directory:

```text
public/downloads/scholarship-guide.pdf
```

### Step 2: Register the resource

Add a corresponding entry to `RESOURCE_MANIFEST` in `app/api/download/route.js`:

```javascript
‘scholarship-guide’: Object.freeze({
  file: ‘scholarship-guide.pdf’,
  filename: ‘MedOrbits-Scholarship-Guide.pdf’,
  contentType: ‘application/pdf’,
}),
```

Use a unique, lowercase resource ID containing letters, numbers, and hyphens.

### Step 3: Test the endpoint

```bash
curl -fL \
  “http://localhost:3000/api/download?id=scholarship-guide” \
  -o MedOrbits-Scholarship-Guide.pdf
```

Confirm that the downloaded PDF opens correctly and contains the intended document.

### Step 4: Update the documentation

Update the supported resource list in this README and any relevant website catalog or resource page.

## 8. Security Requirements

### Resource allowlisting

Never use the user-supplied resource ID directly as a filesystem path.

Resolve the identifier through the fixed manifest and serve only registered entries.

### Path traversal prevention

Reject malformed resource IDs and ensure resolved files remain within the configured download directory.

The manifest should contain simple filenames, not arbitrary relative or absolute paths.

### Public versus confidential documents

Do not store the following in the public download directory:

- Student application records.
- Government identity documents.
- Passport scans.
- Private admission letters.
- Financial documents.
- Internal reports.
- Confidential employer or recruitment records.

Confidential documents require a separate authenticated endpoint with explicit authorization, access auditing, and appropriate storage controls.

### File validation

Before publishing a resource:

1. Verify that the file is an approved PDF.
2. Confirm that its size is within the configured limit.
3. Check the document for unintended personal information.
4. Ensure the filename and download label are appropriate.
5. Confirm that the resource is authorized for public distribution.

The current endpoint validates the manifest’s expected extension and content type, but it does not fully parse or verify PDF structure. Validate documents during the publishing workflow.

### Rate limiting

The current handler does not implement rate limiting. Consider edge-level or distributed rate limiting to protect against abusive download traffic.

For large files, use streaming or object storage rather than buffering the entire file in application memory.

## 9. Frontend Integration

A basic HTML download link can point directly to the endpoint:

```html
<a
  href=“/api/download?id=mbbs-admission-guide”
  download
>
  Download MBBS Admission Guide
</a>
```

For a resource catalog, ensure the frontend uses only IDs registered in the server-side manifest.

Never allow a client-side form to supply an arbitrary filesystem path or storage key.

## 10. Testing Checklist

Before deploying a new resource or changing the endpoint, verify:

- [ ] Every registered resource downloads successfully.
- [ ] Unknown resource IDs return `404`.
- [ ] Missing resource IDs return `400`.
- [ ] Malformed IDs are rejected.
- [ ] Path traversal attempts cannot access unrelated files.
- [ ] Unregistered files cannot be downloaded.
- [ ] Empty or oversized files are not served.
- [ ] Response headers contain the expected PDF content type.
- [ ] Content disposition uses a safe filename.
- [ ] HEAD requests do not return a file body.
- [ ] OPTIONS advertises supported methods.
- [ ] Errors do not disclose internal paths.
- [ ] Production builds include the configured resource files.
- [ ] Large downloads remain within hosting memory and execution limits.

Example negative test requests:

```bash
curl -i “http://localhost:3000/api/download”
curl -i “http://localhost:3000/api/download?id=unknown-resource”
curl -i “http://localhost:3000/api/download?id=../../.env”
curl -i “http://localhost:3000/api/download?id=mbbs%2Fguide”
```

These requests should not expose environment files or unrelated filesystem content.

## 11. Deployment Considerations

Before deployment:

- Confirm that the hosting platform packages the download directory.
- Verify that the runtime can read the PDF files.
- Configure the maximum file size appropriately.
- Test the deployed URL, not just the local development server.
- Confirm that caching behavior meets the intended privacy and distribution requirements.
- Monitor request volume, errors, and download performance.
- Avoid logging document contents or sensitive query parameters.

On serverless or container-based hosting, local files may be read-only or may not persist across deployments. Treat bundled public resources as deployment assets, not as a writable document repository.

If resources need frequent updates, consider object storage with an explicit publishing process.

## 12. Known Limitations

The current route:

- Serves only resources registered in a hard-coded manifest.
- Supports PDF resources only.
- Does not authenticate users.
- Does not track downloads in a database.
- Does not implement rate limiting.
- Buffers each file into memory before returning the response.
- Does not provide a private-document access workflow.
- Does not fully validate PDF contents.

These limitations should be addressed before using this endpoint for sensitive documents or high-volume downloads.

—

**Maintainer:** MedOrbits Engineering  
**Component:** Resource Download API  
**Related implementation:** `app/api/download/route.js`
