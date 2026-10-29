
# MedOrbits Download API

**File:** `app/api/download/README.md`  
**Version:** 2.1.1  
**Runtime:** Next.js App Router with Node.js

## 1. Overview

The Download API serves approved files from a designated private directory. It validates filenames, restricts supported file types, checks resolved file paths, and returns downloads with security-oriented response headers.

**Endpoint:** `GET /api/download?file=admission-guide.pdf`

The route implementation must be saved as:

`app/api/download/route.js`

Next.js App Router does not recognize `routes.js` as a route handler filename.

## 2. Supported methods

| Method | Behavior |
|—|—|
| `GET` | Validates and downloads an allowed file |
| `POST` | Returns `405 Method Not Allowed` |
| `PUT` | Returns `405 Method Not Allowed` |
| `PATCH` | Returns `405 Method Not Allowed` |
| `DELETE` | Returns `405 Method Not Allowed` |

## 3. Configuration

Configure these environment variables in your deployment environment:

```dotenv
DOWNLOAD_ROOT=/absolute/path/to/private-downloads
DOWNLOAD_ALLOWLIST=admission-guide.pdf,course-catalog.pdf
ALLOWED_ORIGINS=https://your-domain.example,https://www.your-domain.example
```

| Variable | Required | Purpose |
|—|—|—|
| `DOWNLOAD_ROOT` | Optional | Directory containing downloadable files |
| `DOWNLOAD_ALLOWLIST` | Strongly recommended | Comma-separated filenames permitted for download |
| `ALLOWED_ORIGINS` | Optional | Allowed browser origins |

If `DOWNLOAD_ROOT` is omitted, the implementation uses the `private-downloads` directory beneath the process working directory.

**Production requirement:** Configure an explicit allowlist and verify that the directory persists across deployments if files must remain available.

Do not store credentials or private environment files in Git.

## 4. Directory structure

```text
app/
└── api/
    └── download/
        ├── route.js
        └── README.md

private-downloads/
├── admission-guide.pdf
└── course-catalog.pdf
```

Keep downloadable files outside the public static directory, such as `public/`, when access restrictions are required.

The directory must exist on the deployed server. Serverless platforms may have read-only or ephemeral filesystems; use an appropriate private object-storage service if persistent storage is unavailable.

## 5. Request example

```bash
curl -fS \
  —output admission-guide.pdf \
  —get \
  —data-urlencode “file=admission-guide.pdf” \
  https://your-domain.example/api/download
```

For local development:

```bash
curl -i \
  —get \
  —data-urlencode “file=admission-guide.pdf” \
  http://localhost:3000/api/download
```

The requested filename must match the configured allowlist entry exactly when an allowlist is configured.

## 6. Response behavior

| Status | Meaning |
|—|—|
| `200` | File successfully returned |
| `400` | Missing or invalid filename |
| `403` | Browser origin rejected |
| `404` | File is missing or not permitted by the allowlist |
| `405` | Unsupported HTTP method |
| `413` | File exceeds the configured size limit |
| `415` | File extension is not supported |
| `500` | Unexpected server-side failure |

The current implementation supports these extensions:

- PDF
- PNG, JPG, JPEG, WebP
- CSV, TXT, JSON
- DOCX and XLSX

The extension-to-content-type mapping is an application policy, not a verification that a file’s actual contents match its extension.

## 7. Security controls

The implementation provides the following baseline protections:

- Filename validation and rejection of path separators.
- Path resolution and symbolic-link escape checks.
- Optional filename allowlisting.
- A maximum file size of 25 MiB.
- Explicit content types and `X-Content-Type-Options: nosniff`.
- `Content-Disposition: attachment` to encourage downloads.
- `Cache-Control: private, no-store` to discourage caching.
- Server-side logging without returning raw filesystem errors.

### Required production hardening

**This sample does not authenticate the requester.** The origin allowlist is not authentication or authorization, and requests without an `Origin` header are accepted by the sample’s origin check.

Before serving confidential documents:

1. Authenticate the user with the application’s established authentication mechanism.
2. Authorize access to the specific requested file for that user.
3. Apply rate limits and request monitoring.
4. Avoid exposing predictable private filenames.
5. Consider signed, short-lived download URLs or an authorized object-storage download flow.
6. Audit access to sensitive documents without logging document contents or secrets.
7. Ensure uploaded or externally sourced files cannot overwrite trusted files.

For highly sensitive documents, use a dedicated document service rather than relying on filename checks alone.

## 8. Testing checklist

- [ ] Valid allowlisted PDF returns `200`.
- [ ] Missing filename returns `400`.
- [ ] Path traversal attempts are rejected.
- [ ] Symbolic links escaping the download directory are rejected.
- [ ] Unlisted filenames return `404`.
- [ ] Unsupported extensions return `415`.
- [ ] Oversized files return `413`.
- [ ] Disallowed browser origins return `403`.
- [ ] Unsupported methods return `405`.
- [ ] Missing files do not expose filesystem paths.
- [ ] Private files cannot be accessed without authorization.
- [ ] Production deployment can access the configured storage directory.

## 9. Operational notes

Use the project’s existing logging, monitoring, and deployment conventions. Keep private downloads separate from public website assets, and verify file permissions and storage persistence in the production environment.

Syntax validation alone does not confirm that file access, authorization, or storage behavior works correctly on the deployed platform.
