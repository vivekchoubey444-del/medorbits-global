Create /storage/README.md with the following production-oriented documentation for MedOrbits runtime storage.

MedOrbits Runtime Storage

1. Purpose

The /storage/ directory is reserved for private, runtime-generated files used by the MedOrbits application.

It may contain uploaded documents, application attachments, user profile files, employer documents, generated reports, exports, quarantined files, and operational backups.

Runtime files must not be committed to Git.

This directory is intended for application storage, not for publicly accessible website assets or source code.

2. Directory Structure

storage/
├── .gitignore
├── .gitkeep
├── README.md
├── uploads/
│   └── .gitkeep
├── documents/
│   └── .gitkeep
├── applications/
│   └── .gitkeep
├── profiles/
│   └── .gitkeep
├── employer-documents/
│   └── .gitkeep
├── generated/
│   └── .gitkeep
├── exports/
│   └── .gitkeep
├── quarantine/
│   └── .gitkeep
└── backups/
    └── .gitkeep

Directory Responsibilities

Directory	Purpose
uploads/	Incoming files awaiting validation or processing
documents/	Validated private user documents
applications/	Application-related attachments and supporting records
profiles/	Private profile-related files
employer-documents/	Employer verification and recruitment documents
generated/	Application-generated reports and documents
exports/	Generated data exports for authorized users
quarantine/	Suspicious, rejected, or unverified files isolated for review
backups/	Temporary or locally retained backup artifacts, when permitted by deployment policy

Create the listed directories and their .gitkeep placeholders when they are needed. Do not store real runtime data in placeholder files.

3. Git and Version-Control Policy

The .gitignore file in this directory ignores runtime contents by default while preserving directory placeholders.

Rules:

* Do not commit uploaded files, generated documents, exports, backups, or user records.
* Do not commit credentials, authentication tokens, private keys, or environment files.
* Preserve .gitignore, .gitkeep, and this README.
* Do not assume ignore rules remove files already tracked by Git.
* Review repository history and tracked files before declaring sensitive data safe.

To inspect tracked storage files from the repository root:

git ls-files storage/

To check whether a specific runtime file is ignored:

git check-ignore -v storage/uploads/example.pdf

Replace the example path with the actual file path. Do not use a real user’s document as a test fixture.

If sensitive files were previously committed, remove them from version control using a reviewed remediation process. Removing a file from the current commit does not erase copies from Git history, clones, caches, or backups. Rotate any exposed credentials and follow the organization’s incident-response procedure.

4. File Upload Security

All incoming files must be treated as untrusted.

The application must:

1. Authenticate the requesting user.
2. Authorize access to the relevant resource or application.
3. Enforce upload-size limits and permitted file types.
4. Validate actual file signatures instead of trusting filenames or client-supplied MIME types.
5. Generate server-controlled storage identifiers.
6. Reject path traversal attempts and unsafe filenames.
7. Scan files for malware where appropriate.
8. Place unverified or suspicious files in quarantine.
9. Prevent execution of uploaded files.
10. Record relevant upload, review, and access events without logging file contents or secrets.

Never use a client-supplied filename as a filesystem path. Store the original filename as sanitized metadata when required, and use a generated identifier for the physical storage key.

5. Access Control and Privacy

Storage must not be directly accessible through a public web server.

* Keep the directory outside the publicly served web root.
* Require authentication and resource-level authorization before reading, downloading, modifying, or deleting private files.
* Verify ownership or authorized organizational access on every request.
* Apply least-privilege filesystem permissions to the application process.
* Restrict access to employer, application, profile, and identity documents.
* Do not expose internal filesystem paths, storage keys, or private document URLs in public API responses.
* Use short-lived, access-controlled download links only when the storage provider supports them and the use case requires them.
* Apply appropriate encryption in transit and at rest.
* Define retention and secure deletion policies for personal and sensitive data.

Do not rely on unguessable URLs alone as an authorization mechanism.

6. Generated Files and Exports

Generated reports and exports can contain sensitive personal, application, or business information.

* Authorize the user before generating or retrieving an export.
* Limit export scope and record counts.
* Use temporary files where possible.
* Set expiration and cleanup policies.
* Avoid exposing exports through static-file hosting.
* Avoid including secrets or unnecessary personal information.
* Restrict administrative exports to authorized roles.
* Protect temporary files against concurrent requests and predictable filenames.

7. Quarantine Handling

Files in quarantine/ must not be served or downloaded by ordinary users.

Only authorized security or administrative workflows should be able to inspect quarantined content.

Files may be released from quarantine only after required validation and security checks succeed. Rejected files should be retained or deleted according to the application’s security and retention policies.

8. Backup and Recovery

The backups/ directory is not a substitute for a managed backup strategy.

* Do not commit backups to Git.
* Prefer encrypted, access-controlled backup storage separate from the application host.
* Restrict backup access to authorized operators.
* Define retention periods and deletion schedules.
* Test restoration procedures periodically.
* Protect backup encryption keys separately from backup data.
* Avoid retaining unnecessary duplicate copies of sensitive records.

Backups must follow the applicable privacy, retention, and disaster-recovery requirements.

9. Runtime Storage and Deployment

Local filesystem storage may be ephemeral in containerized or cloud hosting environments.

Before deployment, determine whether the host provides persistent storage. If files must survive restarts or redeployments, use a properly configured persistent volume or private object-storage service.

Configure the storage root through server-side environment or application configuration where practical. Do not accept arbitrary filesystem paths from API requests.

The application should fail safely if required storage locations are unavailable, permissions are insufficient, or storage capacity is exhausted.

10. Monitoring and Maintenance

Implement operational controls for:

* Available disk space and storage capacity.
* Upload failures and rejected file types.
* Malware-scanning failures.
* Unauthorized access attempts.
* Storage permission errors.
* Failed cleanup or retention jobs.
* Backup and restoration health.

Logs should contain enough metadata for investigation without exposing document contents, authentication credentials, or unnecessary personal information.

11. Developer Checklist

Before releasing storage-related functionality, verify that:

* [ ]	Runtime contents are ignored by Git.
* [ ]	Required directory placeholders are present.
* [ ]	Storage is outside the public web root.
* [ ]	Authentication and authorization are enforced.
* [ ]	Upload size, type, and signature checks are enabled.
* [ ]	Storage identifiers are generated server-side.
* [ ]	Suspicious files are quarantined.
* [ ]	Downloads are authorized on every request.
* [ ]	Retention and cleanup policies are configured.
* [ ]	Persistent storage or private object storage is configured when required.
* [ ]	Backups are protected and restoration is tested.
* [ ]	Logs do not expose sensitive file contents or secrets.

12. Important Notice

This README documents the intended storage security policy. It does not itself enforce access controls, encryption, malware scanning, retention, backups, or persistent storage. Those protections must be implemented and verified in application code, hosting configuration, and operational procedures.

Important: Keep /storage/.gitignore and the root .gitignore consistent. Git ignore rules protect against accidental commits; they do not replace runtime access controls or remove files already tracked by Git.