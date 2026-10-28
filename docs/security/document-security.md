
# MedOrbits Document Security and File Protection Policy

**File:** `docs/security/document-security.md`  
**Version:** 1.0.0  
**Classification:** Internal Security Policy  
**Applies to:** Admissions documents, identity records, educational certificates, uploaded PDFs and images, generated reports, document APIs, object storage, and background file-processing workers.

## 1. Purpose

This policy establishes security requirements for receiving, validating, storing, processing, accessing, sharing, and deleting documents managed by MedOrbits.

Documents may contain sensitive personal information, academic records, identity documents, financial evidence, and admission-related records. Access MUST be restricted to authorized users and services.

This policy complements:

- `docs/security/authentication.md`
- `docs/security/authorization.md`

## 2. Security principles

All document-handling components MUST follow these principles:

- **Confidentiality:** Documents are accessible only to authorized identities.
- **Integrity:** Document content and associated metadata are protected against unauthorized modification.
- **Availability:** Documents are backed up and recoverable according to documented requirements.
- **Least privilege:** Grant only the storage and processing permissions required.
- **Defense in depth:** Combine application authorization, storage controls, content inspection, and monitoring.
- **Fail closed:** Do not make a document available when validation or required security scanning fails.
- **Data minimization:** Collect and retain only documents needed for a defined purpose.
- **Traceability:** Record security-relevant document operations without logging sensitive contents.
- **Secure deletion:** Apply documented retention and deletion procedures across storage and backups.

## 3. Document classification

MedOrbits SHOULD classify documents according to their sensitivity.

| Classification | Examples | Minimum protection |
|—|—|—|
| Public | Published brochures and public prospectuses | Integrity controls and approved publication workflow |
| Internal | Internal operational reports | Authenticated access and restricted sharing |
| Confidential | Applications, academic records, admission correspondence | Resource-level authorization and protected storage |
| Highly sensitive | Identity evidence, financial records, sensitive personal documents | Strict access controls, limited staff access, enhanced auditing, and stronger sharing safeguards |

The classification MUST be assigned based on the actual content and applicable legal requirements, not solely on the filename or MIME type.

Public availability MUST be an explicit publication decision.

## 4. Supported file types and validation

The application MUST maintain an explicit allowlist of permitted file formats for each upload endpoint.

Permitted formats MAY include PDF, JPEG, and PNG when required by the relevant workflow. Other formats MUST be enabled only when there is a documented business requirement and an appropriate inspection strategy.

The server MUST:

1. Validate the request structure and declared file size.
2. Enforce a maximum upload size.
3. Validate the filename without using it as a storage path.
4. Inspect actual file signatures and content where supported.
5. Compare detected content with the permitted file types.
6. Reject malformed, unsupported, or disallowed files.
7. Reject path traversal attempts and unexpected path separators.
8. Enforce per-user, per-application, and overall storage quotas where appropriate.
9. Apply rate limits to upload endpoints.
10. Record the outcome without logging the document contents.

The client-supplied `Content-Type`, extension, and filename MUST NOT be treated as proof of file safety.

Archives, executable files, macro-enabled documents, and files with embedded active content SHOULD be rejected unless a reviewed business requirement explicitly permits them.

## 5. File size and resource-exhaustion protection

Upload limits MUST be enforced before the application consumes excessive memory, disk space, or processing capacity.

The application SHOULD enforce:

- Maximum individual file size.
- Maximum aggregate upload size per request.
- Maximum documents per application.
- Per-account storage quotas.
- Request and upload timeouts.
- Limits on image dimensions and decoded image size.
- Limits on PDF page counts and processing time.
- Limits on concurrent scans and conversions.

Limits MUST be consistent across the reverse proxy, HTTP server, application middleware, and storage provider.

File-processing workers MUST use bounded resources and MUST NOT process arbitrary untrusted content without appropriate isolation.

## 6. Malware scanning and quarantine

Uploaded files MUST enter a non-public quarantine state until required validation and malware scanning have completed.

The MedOrbits `application_files.scan_status` field defines these states:

- `pending`
- `clean`
- `infected`
- `failed`

### 6.1 Processing requirements

The normal workflow SHOULD be:

1. Authenticate and authorize the uploader.
2. Validate upload size and request structure.
3. Generate an opaque storage key.
4. Store the upload in quarantine.
5. Calculate a cryptographic checksum.
6. Validate file content and detected format.
7. Scan using an approved malware-scanning service.
8. Record the scan result.
9. Make the document available only after all required checks pass.

### 6.2 Scan failures

- `pending`: The document MUST remain unavailable for ordinary access.
- `infected`: The document MUST remain quarantined and MUST NOT be distributed.
- `failed`: The document MUST remain unavailable until an authorized retry or review resolves the failure.
- `clean`: The document MAY be made available after all other validation and authorization requirements are satisfied.

A scanner timeout, unavailable scanning service, or ambiguous result MUST NOT be interpreted as a clean scan.

Only an authorized processing service SHOULD update scan status. Client requests MUST NOT be allowed to mark a file as clean.

## 7. Secure storage

Private documents MUST NOT be stored inside publicly served web directories.

Storage SHOULD use a private object-storage bucket or a dedicated directory outside the web root, with restrictive operating-system permissions when filesystem storage is used.

The storage layer MUST:

- Use opaque, unpredictable storage keys.
- Prevent untrusted filenames from determining filesystem paths.
- Reject path traversal and unauthorized path manipulation.
- Restrict storage credentials to required operations.
- Prevent public listing and anonymous reads of private objects.
- Use encryption in transit.
- Use provider-supported encryption at rest where available.
- Separate production storage from development and testing environments.
- Monitor storage access and permission changes.

A database `storage_key` MUST be treated as an internal locator, not as proof that the requester may access the referenced object.

## 8. Document authorization

Every document operation MUST be authorized on the server.

This includes:

- Uploading.
- Listing.
- Viewing metadata.
- Downloading.
- Previewing.
- Replacing.
- Deleting.
- Sharing.
- Exporting.
- Changing document classification or scan state.

For application documents, authorization MUST verify access to the associated application as well as the document itself.

Example PostgreSQL query:

```sql
SELECT
    f.public_id,
    f.original_filename,
    f.mime_type,
    f.file_size_bytes,
    f.checksum_sha256,
    f.scan_status,
    f.created_at
FROM medorbits.application_files AS f
JOIN medorbits.applications AS a
    ON a.id = f.application_id
WHERE f.public_id = $1
  AND a.applicant_id = $2;
```

The application MUST bind both parameters safely. `$1` is the requested public document identifier; `$2` MUST come from trusted server-side identity context.

The query is an ownership example, not a complete authorization policy. Authorized staff, delegated access, tenant boundaries, and scan-state restrictions require additional checks.

The application MUST NOT return storage credentials, internal filesystem paths, or private storage keys in public API responses unless explicitly required by a trusted internal integration.

## 9. Secure downloads and previews

Private documents MUST be served through an authenticated and authorized endpoint or a controlled storage mechanism.

The application SHOULD:

- Verify current access before issuing a download.
- Verify that the document is in an allowed scan state.
- Set appropriate `Content-Disposition` headers.
- Use `Content-Disposition: attachment` for sensitive files unless inline preview is specifically required.
- Set an appropriate `Content-Type`.
- Set `X-Content-Type-Options: nosniff` where applicable.
- Apply a suitable cache policy, such as `Cache-Control: private, no-store`, for highly sensitive documents.
- Prevent unauthorized cross-origin access.
- Avoid exposing filenames or document identifiers in logs unnecessarily.

### 9.1 Signed URLs

If signed URLs are used, they MUST:

- Be generated only after authorization.
- Be scoped to a single object and required operation.
- Expire quickly enough for the use case.
- Use the minimum required permissions.
- Never grant broader bucket access.
- Be excluded from application logs and analytics.
- Be revoked or invalidated when the storage system supports this and risk requires it.

A signed URL is a bearer credential. Anyone possessing a valid URL may be able to use it until it expires or is revoked.

## 10. Filename and path security

User-supplied filenames MUST be treated as untrusted input.

The application MUST NOT concatenate a supplied filename directly into a filesystem path.

Use generated storage keys and retain a sanitized display filename separately.

The implementation MUST protect against:

- `../` path traversal.
- Absolute paths.
- Alternate path separators.
- Null-byte and control-character manipulation.
- Filename collisions.
- Unicode normalization ambiguities.
- Dangerous or misleading extensions.
- Header injection through download filenames.

Filesystem implementations MUST verify that resolved paths remain within the intended storage directory and must consider symbolic-link attacks.

## 11. Document integrity and checksums

MedOrbits SHOULD calculate a SHA-256 checksum for each uploaded file.

The checksum SHOULD be calculated from the actual stored content and verified when integrity validation is required.

Checksums MAY be used to detect accidental corruption, support duplicate detection, and verify transfer integrity.

A checksum alone does not establish document authenticity, prove who uploaded a document, or demonstrate that a document is safe.

If document replacement is permitted, the application SHOULD preserve appropriate version history and audit the replacement.

## 12. Document metadata and privacy

Document metadata MUST be limited to information needed for processing, authorization, and business operations.

Metadata SHOULD include only necessary fields, such as:

- Document identifier.
- Associated application.
- Original display filename.
- Detected media type.
- File size.
- Checksum.
- Scan status.
- Uploader identity.
- Upload timestamp.
- Retention or lifecycle state, where needed.

Avoid storing unnecessary identity numbers, financial details, document contents, or secrets in JSON metadata.

The application MUST NOT embed passwords, access tokens, session identifiers, or storage credentials in document metadata.

API responses MUST omit internal fields that clients do not need.

## 13. Encryption and key management

Document transfers MUST use HTTPS or an equivalent protected transport.

Sensitive documents SHOULD be encrypted at rest using storage-provider or infrastructure encryption.

Where application-level encryption is required, use a maintained cryptographic library and an authenticated encryption scheme.

Encryption keys MUST:

- Be stored separately from encrypted document data.
- Be accessible only to authorized services.
- Never be committed to source control.
- Be rotated according to documented key-management requirements.
- Have a recovery strategy consistent with business continuity requirements.
- Be excluded from application logs and diagnostic output.

Do not design custom encryption algorithms.

## 14. Document replacement and deletion

Document replacement and deletion MUST require explicit authorization.

The application SHOULD record the actor, document identifier, operation, timestamp, outcome, and reason where appropriate.

Deletion procedures MUST consider:

- Active storage objects.
- Database metadata.
- Temporary processing files.
- Generated previews and thumbnails.
- Cached copies.
- Search indexes.
- Replicas and backups.
- Legal holds and retention requirements.

A database row deletion alone MUST NOT be assumed to erase all copies of a file.

When retention or legal requirements prohibit deletion, access MUST remain restricted and the retention reason MUST be documented.

## 15. Audit logging

Security-relevant document events SHOULD be recorded, including:

- Upload accepted or rejected.
- Malware scan results.
- Unauthorized access attempts.
- Downloads of sensitive documents.
- Document replacement.
- Document deletion.
- Sharing and signed URL issuance.
- Changes to scan status.
- Administrative access to quarantined files.
- Retention and export operations.

Audit records SHOULD include an event identifier, timestamp, actor, document reference, operation, outcome, and request correlation identifier.

Audit logs MUST NOT contain document contents, passwords, authentication tokens, signed URLs, or unnecessary sensitive personal information.

Access to audit logs MUST be restricted and monitored.

## 16. Background processing

Document-processing workers MUST use dedicated service identities with minimal privileges.

Workers MUST:

- Process only approved job types.
- Validate job payloads.
- Enforce bounded execution time and resource limits.
- Use idempotency controls where appropriate.
- Avoid executing arbitrary commands from uploaded content or job payloads.
- Store temporary files in controlled locations.
- Clean up temporary data after processing.
- Record success and failure without leaking sensitive document content.
- Prevent untrusted content from influencing privileged filesystem paths.

PDF conversion, image processing, OCR, archive extraction, and preview generation SHOULD run in isolated processes or containers with restricted filesystem and network access.

## 17. Third-party services

Before sending documents to an external scanning, OCR, conversion, AI, or storage provider, MedOrbits MUST evaluate:

- The provider’s security and privacy controls.
- The data being transferred.
- Retention and deletion behavior.
- Access controls and encryption.
- Contractual obligations and applicable legal requirements.
- Whether the user has been appropriately informed.
- Whether a local or less-data-intensive alternative is available.

Sensitive documents MUST NOT be sent to an external service merely because an integration is technically available.

External services MUST receive only the minimum data required for the approved purpose.

## 18. Database and API integration

The core MedOrbits schema stores document metadata in `medorbits.application_files`.

The application MUST enforce authorization and scan-state checks before returning file content.

Database operations MUST use parameterized queries. Database credentials MUST NOT be exposed to browsers.

The runtime database role SHOULD have only the privileges required for normal document operations. Migration and administrative privileges MUST be separated from the runtime role.

Database triggers and constraints are useful safeguards, but they do not replace application authorization, secure storage, malware scanning, or retention controls.

## 19. Incident response

If document exposure, malware infection, unauthorized access, or storage compromise is suspected:

1. Restrict access to the affected documents or storage locations.
2. Disable compromised credentials and signed-access mechanisms where possible.
3. Preserve relevant logs and incident evidence.
4. Identify affected documents, users, and exposure duration.
5. Quarantine affected files and investigate malicious content.
6. Assess whether personal or confidential information was exposed.
7. Restore integrity from verified copies where required.
8. Follow applicable notification and reporting obligations.
9. Add regression tests and verify remediation before restoring access.

Incident actions MUST be recorded and coordinated with the appropriate security owner.

## 20. Automated testing requirements

CI and security testing SHOULD cover:

- Oversized upload rejection.
- Disallowed extensions and content signatures.
- Malformed PDF and image handling.
- Path traversal and filename manipulation.
- Duplicate storage-key rejection.
- Unauthorized upload, listing, download, and deletion.
- Cross-user and cross-application access attempts.
- Access to `pending`, `infected`, and `failed` files.
- Scanner timeout and service failure behavior.
- Signed URL expiration and scope.
- Storage permission failures.
- Temporary-file cleanup.
- Audit logging and secret redaction.
- Retention and deletion behavior.
- Concurrent replacement or deletion attempts.

Tests MUST verify that failed validation or scanning does not make a document publicly available.

## 21. Production checklist

- [ ] Private documents are stored outside the public web root.
- [ ] File types and sizes are validated server-side.
- [ ] Storage keys are generated by trusted code.
- [ ] Malware scanning is enforced before normal access.
- [ ] Scanner failures leave documents quarantined.
- [ ] Every document operation enforces authorization.
- [ ] Parent application access is checked.
- [ ] Download responses use appropriate security headers.
- [ ] Signed URLs are short-lived and narrowly scoped.
- [ ] Encryption and key management are configured.
- [ ] Storage permissions follow least privilege.
- [ ] Document events are audited without logging secrets.
- [ ] Retention and deletion procedures are documented.
- [ ] Processing workers are isolated and resource-limited.
- [ ] CI tests cover unauthorized access and unsafe uploads.
- [ ] Backup and recovery procedures are tested.

## 22. Policy maintenance

The security owner MUST review this policy periodically and whenever file formats, storage providers, upload endpoints, scanning services, or document-processing workflows change.

Implementation teams MUST review changes to document access controls before deployment.

This policy defines security requirements. It does not, by itself, implement or certify the document-handling system.

—

**End of policy**
