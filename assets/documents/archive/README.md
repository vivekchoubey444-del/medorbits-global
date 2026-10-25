
# Archive Directory — MedOrbits

**Project:** MedOrbits  
**Directory:** `assets/documents/archive/`  
**Document Type:** Archived documents, superseded publications, and historical records  
**Version:** 1.0.0  
**Last Updated:** 2026-10-25

—

## 1. Purpose

The `archive/` directory provides a structured approach to managing documents that are no longer actively published but may need to be retained for historical reference, auditability, version tracking, or internal project maintenance.

It helps MedOrbits distinguish current, approved documents from older, superseded, withdrawn, or retired materials.

Archived materials may include:

- Previous versions of brochures and guides.
- Superseded application forms and templates.
- Outdated admissions and examination information.
- Retired course and service descriptions.
- Previous policy versions and notices.
- Replaced document metadata.
- Historical publication records.
- Deprecated templates and content assets.
- Records of approved document revisions.

**Important:** Archiving a document does not automatically make it accurate, approved for reuse, legally compliant, or suitable for public distribution.

—

## 2. Recommended Directory Structure

The following structure is illustrative. Create only the directories and files required by the project.

```text
assets/
└── documents/
    └── archive/
        ├── README.md
        ├── brochures/
        │   └── README.md
        ├── guides/
        │   └── README.md
        ├── forms/
        │   └── README.md
        ├── policies/
        │   └── README.md
        ├── official-documents/
        │   └── README.md
        ├── metadata/
        │   └── README.md
        ├── retired-assets/
        │   └── README.md
        └── manifests/
            └── README.md
```

### Directory responsibilities

| Directory | Purpose |
|—|—|
| `brochures/` | Previous brochure editions and superseded promotional documents. |
| `guides/` | Older instructional guides and historical reference material. |
| `forms/` | Retired blank forms and replaced templates. |
| `policies/` | Superseded policy versions retained for reference. |
| `official-documents/` | Historical copies or references to official publications, where retention and reuse are permitted. |
| `metadata/` | Previous document catalogue and metadata versions. |
| `retired-assets/` | Other retired public-facing document assets. |
| `manifests/` | Inventories of archived files and their status. |

This structure does not confirm that these folders already exist. Check the actual repository before creating or referencing them.

—

## 3. What Belongs in the Archive?

A document may be considered for archiving when it is:

- Replaced by a newer approved version.
- No longer relevant to current services.
- Associated with a completed academic year or expired campaign.
- Retired following a policy or process change.
- Removed from public distribution but retained for traceability.
- Preserved as a historical reference.
- Kept to support an approved audit or revision history.

Do not archive a document merely because it is old. Consider its purpose, accuracy, retention requirements, privacy implications, and any applicable legal obligations.

### Examples

| Document | Potential archive reason |
|—|—|
| Previous-year admissions brochure | Academic year has ended or information has been replaced. |
| Retired application form | The current workflow uses a revised form. |
| Superseded policy | A newer approved policy is in effect. |
| Old service brochure | The described service has changed or been discontinued. |
| Previous metadata file | The document catalogue has been updated. |
| Deprecated template | The project no longer uses the template. |

—

## 4. What Must Not Be Archived Here?

The public-facing `assets/documents/archive/` directory must not be used to store confidential records.

Do not place the following in a publicly served archive:

- Completed applicant forms containing personal information.
- Identity documents, passports, or certificates belonging to individuals.
- Marksheets or examination credentials linked to identifiable applicants.
- Medical records.
- CVs, résumés, or employment documents containing private information.
- Private contracts or confidential correspondence.
- Passwords, API keys, access tokens, or deployment secrets.
- Unredacted payment information.
- Documents that the project has no lawful basis or permission to retain.

Confidential records must be managed through an appropriately secured, access-controlled storage system with defined retention and deletion procedures.

**A folder named `archive/` is not inherently private.** Files inside a publicly served assets directory may be accessible to anyone who knows or discovers the URL.

—

## 5. Archiving Workflow

Use a consistent process whenever a document is retired.

### Step 1 — Identify the document

Record its title, path, version, category, and current publication status.

### Step 2 — Determine the reason

Record why the document is being retired, replaced, withdrawn, or preserved.

### Step 3 — Check retention requirements

Confirm that retention is appropriate and consistent with applicable legal requirements, internal policies, privacy obligations, and licence restrictions.

### Step 4 — Review the contents

Check for personal information, confidential material, expired links, misleading claims, and unnecessary sensitive data.

### Step 5 — Preserve the correct version

Retain the appropriate approved source and publication copy where justified. Preserve original licence notices and attribution information when required.

### Step 6 — Assign archive metadata

Record the original path, version, archive date, reason, and replacement reference where applicable.

### Step 7 — Remove obsolete publication links

Update the website catalogue, navigation, metadata, or download links so users are not directed to an obsolete document.

### Step 8 — Verify the current replacement

If a newer document replaces the archived version, confirm that the replacement exists, is approved, and is linked correctly.

### Step 9 — Test access controls

Ensure that public historical documents are intentionally public and that confidential records are stored elsewhere.

### Step 10 — Record the change

Use version control or the project’s document-management process to preserve a traceable record of the change.

—

## 6. Archive Naming Convention

Use descriptive, consistent, lowercase filenames.

Recommended pattern:

```text
document-name_version_YYYY-MM-DD.ext
```

Examples:

```text
mbbs-admission-guide_v1.0.0_2026-01-15.pdf
career-services-brochure_v1.2.0_2026-03-10.pdf
application-form_v1.0.0_2026-04-01.pdf
privacy-policy_v2.0.0_2026-05-20.md
```

These are naming examples, not records of actual archived documents.

### Naming rules

- Use lowercase letters and hyphens for descriptive names.
- Use a consistent version format.
- Include a date only when it represents a known publication, revision, or archive date.
- Preserve the original filename in metadata when it is needed for traceability.
- Avoid ambiguous names such as `old.pdf`, `backup-final.pdf`, or `latest-old-version.pdf`.
- Do not overwrite historical files without an explicit and documented reason.

The filename alone does not establish that a document was approved or published on a particular date.

—

## 7. Archive Metadata

Maintain a manifest or structured metadata file when historical documents need to be tracked.

Recommended fields:

| Field | Description |
|—|—|
| `archive_id` | Unique identifier for the archived record. |
| `title` | Human-readable document title. |
| `category` | Document category. |
| `original_path` | Original repository path, if known. |
| `archive_path` | Current location of the archived copy. |
| `version` | Document version, if known. |
| `publication_date` | Original publication date, if verified. |
| `archived_date` | Date the document was archived. |
| `archive_reason` | Explanation for archiving. |
| `status` | Current archive classification. |
| `replacement_path` | Path to the replacement document, if applicable. |
| `source_url` | Original authoritative source, when relevant. |
| `retention_review` | Retention review status or reference. |
| `notes` | Additional context and limitations. |

### Illustrative JSON record

```json
{
  “archive_id”: “ARCHIVE-001”,
  “title”: “Example Historical Brochure”,
  “category”: “brochures”,
  “original_path”: “assets/documents/brochures/example.pdf”,
  “archive_path”: “assets/documents/archive/brochures/example_v1.0.0.pdf”,
  “version”: “1.0.0”,
  “publication_date”: null,
  “archived_date”: “2026-10-25”,
  “archive_reason”: “Superseded by a newer approved edition.”,
  “status”: “archived”,
  “replacement_path”: “”,
  “source_url”: “”,
  “retention_review”: “pending”,
  “notes”: “Illustrative record. Replace values with verified project information.”
}
```

This example is a template only. It does not confirm that the referenced documents exist or that an actual archive action has occurred.

### Metadata requirements

- Use unique identifiers.
- Validate JSON syntax before deployment.
- Use consistent date formats, preferably `YYYY-MM-DD`.
- Use `null` for unknown dates rather than inventing dates.
- Keep metadata consistent with the actual files.
- Avoid including confidential personal information.
- Record replacement paths only when the replacement has been verified.
- Do not describe a document as approved unless its approval status is supported by evidence.

—

## 8. Recommended Archive Statuses

Use consistent status labels when maintaining an archive register.

- `archived` — retained as a historical record.
- `superseded` — replaced by a newer version.
- `withdrawn` — removed from use or publication.
- `expired` — no longer valid for its intended time period.
- `retired` — no longer actively maintained.
- `retention_review` — awaiting a decision about continued retention.
- `restricted` — access is limited and must not be treated as public.
- `pending` — archive metadata or review remains incomplete.

A status should describe the actual document condition, not merely the intention to archive it.

—

## 9. Public Access and Website Behaviour

Archived documents should not appear in current-document listings unless the website intentionally provides a historical archive.

For public historical resources:

- Clearly identify them as archived or superseded.
- Display the relevant version and date when verified.
- Explain when the information may no longer be current.
- Provide a link to the current replacement where available.
- Avoid presenting historical fees, eligibility criteria, or deadlines as current.
- Verify all links before publication.

For restricted material:

- Do not rely on obscure filenames or unlinked URLs for protection.
- Store the files outside publicly served assets.
- Enforce access controls at the storage or application layer.
- Avoid exposing restricted paths through public metadata or search indexes.

### Example notice

> **Archived document:** This file is retained for historical reference and may contain outdated information. Consult the current approved publication or relevant official source before relying on its contents.

Use this notice where appropriate and ensure the document is genuinely historical.

—

## 10. Official Documents and Historical Information

MedOrbits may retain references to historical notices or documents published by government departments, examination authorities, counselling bodies, educational institutions, healthcare regulators, and employers.

Before retaining or republishing a copy:

1. Identify the original issuing authority.
2. Record the original source URL where available.
3. Preserve publication dates and document identifiers when verified.
4. Check copyright, redistribution, and retention restrictions.
5. Avoid modifying an official document in a way that misrepresents its original content.
6. Clearly label any explanatory summary as a MedOrbits summary rather than an official publication.
7. Link to the original authority when appropriate.

An old official notice may remain useful as historical evidence but must not be presented as the current rule or schedule.

Do not imply government or institutional endorsement merely because an official document is referenced.

—

## 11. Version Control and Integrity

Use version control to maintain traceability for public document changes.

Recommended practices:

- Preserve approved source files where justified.
- Record meaningful changes in commit history or a change log.
- Avoid overwriting historical versions without documentation.
- Keep document metadata synchronised with the actual files.
- Verify that an archived file opens correctly.
- Preserve required copyright and licence notices.
- Use checksums when integrity verification is needed for important retained files.
- Restrict access to repositories or storage locations containing sensitive material.

A checksum can help identify changes to a file, but it does not prove the document’s authenticity, accuracy, or legal validity.

—

## 12. Retention and Deletion

Archiving is not a reason to keep information indefinitely.

Before retaining a document, consider:

- Whether it is needed for historical reference.
- Whether retention is required or permitted.
- Whether the document contains personal or confidential information.
- Whether a redacted version would meet the retention purpose.
- Whether copyright or licence terms restrict retention or redistribution.
- Whether a retention period or deletion deadline applies.

Where documents are no longer needed, follow the applicable retention and deletion policy.

Do not use this public archive for personal applicant records, confidential contracts, or restricted operational records.

—

## 13. Accessibility and File Quality

Historical documents should remain usable when continued access is justified.

Where appropriate:

- Preserve readable text and logical document structure.
- Keep headings and tables understandable.
- Use accessible PDFs where feasible.
- Ensure links and references are clear.
- Avoid corrupt or incomplete files.
- Record known limitations, such as missing pages or unavailable source documents.
- Avoid altering original historical content without documenting the change.

If an archived document is converted to another format, retain a reference to the original where permitted and document the conversion.

—

## 14. Quality Assurance Checklist

Before completing an archive update, verify:

- [ ] The document has been correctly identified.
- [ ] The reason for archiving is recorded.
- [ ] The version and relevant dates are accurate or explicitly unknown.
- [ ] Retention is appropriate.
- [ ] Confidential information has not been placed in public assets.
- [ ] Original licence and attribution requirements have been considered.
- [ ] The archived file opens correctly.
- [ ] Metadata matches the actual file.
- [ ] The current replacement is verified, if applicable.
- [ ] Public links no longer incorrectly present obsolete content as current.
- [ ] Historical notices are clearly distinguished from current guidance.
- [ ] Restricted materials have appropriate access controls.
- [ ] Version-control records are consistent.
- [ ] The archive register is updated where required.

—

## 15. Troubleshooting

### An archived document is still appearing as current

Check the document catalogue, metadata status, navigation links, search index, and any cached publication data. Correct the current listing and verify the change after deployment.

### A replacement document cannot be found

Do not invent a replacement path. Check the repository and publication records. If no replacement is available, explain that the historical document has no verified replacement.

### A historical PDF does not open

Check the file integrity, file extension, export process, and storage path. Restore a valid retained copy where permitted or document that the source is unavailable.

### The archive contains personal information

Restrict access immediately and follow the applicable privacy and incident-response procedures. Move confidential material to approved secured storage or remove it according to the relevant policy.

### An old notice is being mistaken for current guidance

Add a clear historical notice, update links, and provide a verified current official source where available.

### Archive metadata is inconsistent

Compare the manifest with the actual files, correct paths and statuses, validate the data format, and record the change.

—

## 16. Related Directories

| Directory | Purpose |
|—|—|
| `/assets/documents/` | Main public-facing document directory. |
| `/assets/documents/brochures/` | Current brochure publications. |
| `/assets/documents/guides/` | Instructional documents and user guidance. |
| `/assets/documents/forms/` | Blank forms and reusable form templates. |
| `/assets/documents/policies/` | Policies and procedural documents. |
| `/assets/documents/licences/` | Licence records and third-party permissions. |
| `/assets/documents/metadata/` | Structured document metadata. |
| `/assets/documents/officials/` | Official-document references and verification records. |

Confirm the actual repository paths before linking to them. Keep historical copies separate from current publications where practical.

—

## 17. Disclaimer

The archive exists to support historical reference and document management. Inclusion in the archive does not establish that a document is current, accurate, officially endorsed, legally valid, or authorised for redistribution.

Users should verify time-sensitive information with the responsible authority and consult current approved publications before taking action.

Retention, publication, and deletion decisions must follow applicable privacy, copyright, security, and document-management requirements.

—

## 18. Final Maintenance Checklist

- [ ] Create `/assets/documents/archive/README.md`.
- [ ] Archive only documents with a documented retention purpose.
- [ ] Keep public historical materials separate from confidential records.
- [ ] Maintain accurate filenames, versions, and metadata.
- [ ] Remove obsolete links from current publication areas.
- [ ] Clearly label superseded or expired documents.
- [ ] Verify official sources and licence restrictions.
- [ ] Apply appropriate access controls to restricted records.
- [ ] Review retention needs periodically.
- [ ] Test archived files and links after repository or deployment changes.

**End of README**
