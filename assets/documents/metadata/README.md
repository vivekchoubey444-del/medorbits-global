Copy the following complete content into /assets/documents/metadata/README.md.
# MedOrbits — Document Metadata Directory
**Directory:** `/assets/documents/metadata/`
**Project:** MedOrbits
**Document:** Document Metadata and Registry Management Guidelines
**Version:** 1.0.0
**Last Updated:** 2026-10-24
—
## 1. Purpose
The `/assets/documents/metadata/` directory stores descriptive metadata, document indexes, source references, classification records, and other structured information used to organize document assets within the MedOrbits project.
Metadata helps the project identify documents, understand their purpose, track versions, verify sources, maintain accurate links, and manage publication status.
This directory may support documentation related to:
- Educational resources and course information.
- Admission guidance and official notices.
- Healthcare and regulatory publications.
- Career guidance and recruitment services.
- Public-facing brochures and downloadable guides.
- Reusable templates and policy documents.
- Copyright, licensing, and source verification.
- Document versioning, archiving, and maintenance.
**Important:** The examples in this README describe recommended formats and structures. They do not confirm that any example metadata file or record already exists.
—
## 2. Recommended Directory Structure
```text
assets/
└── documents/
    └── metadata/
        ├── README.md
        ├── document-index.json
        ├── document-index.csv
        ├── document-categories.json
        ├── document-sources.json
        ├── document-versions.json
        ├── document-licenses.json
        ├── document-status.json
        ├── schema/
        │   └── document-metadata.schema.json
        └── archive/
            └── README.md
```
Create only the files required by the project.
Do not maintain multiple competing registries containing inconsistent copies of the same metadata. If JSON is the primary source of truth, generate other formats from it where practical.
### Directory responsibilities
| File or directory | Purpose |
|—|—|
| `README.md` | Explains metadata conventions and maintenance procedures |
| `document-index.json` | Primary structured catalogue of document assets, if adopted |
| `document-index.csv` | Optional spreadsheet-friendly document index |
| `document-categories.json` | Optional list of supported document categories |
| `document-sources.json` | Optional register of original sources and verification details |
| `document-versions.json` | Optional version and supersession records |
| `document-licenses.json` | Optional copyright and redistribution information |
| `document-status.json` | Optional publication and review status records |
| `schema/` | Validation schemas for metadata records |
| `archive/` | Historical metadata records retained when necessary |
These files are optional examples, not confirmed project assets.
—
## 3. What Is Document Metadata?
Document metadata is structured information that describes a document without necessarily containing the document’s full content.
Common metadata fields include:
- Document identifier.
- Document title.
- Description.
- Category.
- File path.
- File format.
- Language.
- Source or issuing authority.
- Publication date.
- Last modified date.
- Version.
- Publication status.
- Verification date.
- Licence information.
- Accessibility information.
- Related documents.
Metadata should be accurate, concise, consistently formatted, and appropriate for its intended audience.
—
## 4. Metadata Design Principles
Follow these principles when creating or updating document metadata.
### Consistency
Use the same field names, date formats, status values, and category identifiers across the registry.
### Accuracy
Record verified information. Do not invent document titles, source URLs, publication dates, licence terms, or approval statuses.
### Traceability
Where appropriate, provide a stable document identifier and a traceable source reference.
### Minimality
Store only the metadata needed for document discovery, maintenance, verification, and publication.
### Maintainability
Keep metadata aligned with the actual files and website routes.
### Privacy
Do not include confidential personal information or private application data in public metadata.
### Interoperability
Use standard formats such as JSON and CSV when they suit the project workflow.
—
## 5. Recommended Metadata Fields
A document record may contain the following fields.
| Field | Type | Description |
|—|—|—|
| `id` | String | Stable, unique document identifier |
| `title` | String | Human-readable document title |
| `description` | String | Short explanation of the document |
| `category` | String | Document category |
| `path` | String | Repository-relative file path |
| `format` | String | File format, such as PDF or Markdown |
| `language` | String | Primary language code |
| `version` | String | Document version, when applicable |
| `status` | String | Current lifecycle status |
| `sourceUrl` | String or null | Original source URL, where applicable |
| `publisher` | String or null | Issuing organization or publisher |
| `publishedAt` | String or null | Verified publication date |
| `updatedAt` | String or null | Last known content update date |
| `verifiedAt` | String or null | Date the source or content was verified |
| `license` | String or null | Licence identifier or description |
| `tags` | Array | Searchable descriptive keywords |
This field set is a recommendation. Adapt it to the actual application and avoid collecting unnecessary information.
Use a consistent date format, preferably `YYYY-MM-DD`, for dates that represent calendar days.
—
## 6. Example JSON Metadata Record
The following example demonstrates a record structure. It does not describe a verified document in the repository.
```json
{
  “schemaVersion”: “1.0.0”,
  “documents”: [
    {
      “id”: “DOC-EXAMPLE-001”,
      “title”: “Example Admission Guide”,
      “description”: “Illustrative record showing the document metadata format.”,
      “category”: “admissions”,
      “path”: “assets/documents/guides/example-admission-guide.pdf”,
      “format”: “pdf”,
      “language”: “en”,
      “version”: “1.0.0”,
      “status”: “draft”,
      “sourceUrl”: null,
      “publisher”: “MedOrbits”,
      “publishedAt”: null,
      “updatedAt”: null,
      “verifiedAt”: null,
      “license”: null,
      “tags”: [
        “example”,
        “admissions”
      ]
    }
  ]
}
```
### Example requirements
- Replace all example values with verified project data before use.
- Ensure that every referenced path points to an actual file.
- Use unique document IDs.
- Use only approved status and category values.
- Use `null` for unknown optional values rather than inventing information.
- Do not mark a draft as published or verified without evidence.
—
## 7. Recommended Metadata Status Values
Use a controlled set of lifecycle statuses.
| Status | Meaning |
|—|—|
| `draft` | Metadata or document is being prepared |
| `pending-review` | Awaiting content or source verification |
| `verified` | Relevant verification checks are complete |
| `published` | Approved for the intended audience and available through the intended publication route |
| `superseded` | Replaced by a newer document |
| `archived` | Retained for historical or reference purposes |
| `withdrawn` | Removed from active use |
Use status values consistently throughout the project.
A document can be verified but not published. Verification and publication are different states and should not be treated as interchangeable.
—
## 8. Document Categories
Use consistent category identifiers.
Recommended examples:
| Category ID | Intended use |
|—|—|
| `guides` | General guidance and instructional documents |
| `admissions` | Admission preparation and counselling resources |
| `education` | Educational resources and course information |
| `healthcare` | Healthcare information and related publications |
| `careers` | Career planning and employment guidance |
| `recruitment` | Recruitment-related resources |
| `policies` | Policy documents and notices |
| `templates` | Reusable blank templates |
| `officials` | Verified official publications and reference materials |
| `brochures` | Service and programme brochures |
| `licenses` | Licence and permitted-use documentation |
| `archive` | Historical or superseded records |
These are suggested identifiers. Ensure they match the actual directory names and category system adopted by the project.
Avoid creating multiple category names for the same concept without a clear reason.
—
## 9. Source and Verification Metadata
For official, regulatory, educational, or otherwise time-sensitive documents, record source and verification details when applicable.
Recommended fields include:
- Issuing authority.
- Original source URL.
- Official document title.
- Publication date.
- Effective date.
- Academic year or applicable period.
- Verification date.
- Superseding document identifier.
- Verification notes.
Use official or authorized sources wherever possible.
Do not mark a document as official solely because it appears on a third-party website. Confirm its origin and status before publishing it as an authoritative reference.
If source verification is incomplete, use an appropriate pending status and avoid presenting the document as verified.
—
## 10. Licensing Metadata
Metadata should distinguish between a known licence and a licence that has not yet been verified.
Where applicable, record:
- Licence name.
- Copyright holder or issuing organization.
- Source of the licence information.
- Required attribution.
- Redistribution permissions.
- Commercial-use restrictions.
- Modification restrictions.
- Verification status.
Do not assume that public availability permits redistribution.
If the licence is unknown, record that uncertainty rather than inventing a licence.
Retain original licence documents where required and link to them using paths that match the actual repository.
—
## 11. File Paths and URL Management
Metadata file paths should be consistent with the repository’s directory structure.
### Recommended rules
1. Use repository-relative paths for internal file references.
2. Use the project’s established URL convention for website links.
3. Do not confuse a local filesystem path with a public URL.
4. Check that every referenced file exists.
5. Preserve filename capitalization.
6. Update metadata when files move or are renamed.
7. Avoid exposing private filesystem locations.
8. Do not include credentials or access tokens in URLs.
Example repository-relative path:
```text
assets/documents/guides/example-guide.pdf
```
Example public URL path, if the website is configured to serve that asset:
```text
/assets/documents/guides/example-guide.pdf
```
The public URL and repository path may differ depending on the hosting and build configuration.
—
## 12. JSON and CSV Standards
### JSON
- Use valid JSON syntax.
- Use double quotes for property names and string values.
- Avoid trailing commas.
- Use consistent field names.
- Represent unknown optional values with `null`.
- Use arrays for lists such as tags.
- Validate JSON before committing changes.
### CSV
- Include a clear header row.
- Use consistent column names.
- Quote fields containing commas or line breaks.
- Use a consistent character encoding, preferably UTF-8.
- Keep dates and status values consistent with the primary registry.
- Avoid maintaining manually edited duplicates that drift from the primary source.
If both JSON and CSV are needed, document which one is authoritative and how the other is generated or synchronized.
—
## 13. Metadata Validation
Validate metadata before merging or deploying changes.
Checks should include:
- JSON syntax validity.
- Required field presence.
- Unique document identifiers.
- Allowed category and status values.
- Valid date formats.
- Valid URL syntax where applicable.
- Consistent file extensions and format values.
- Existence of referenced local files.
- No duplicate records.
- No unintended private information.
- Consistency between metadata and actual documents.
A schema validator can enforce field types and required properties. File-existence checks may require a separate validation script because JSON Schema alone does not verify the repository filesystem.
—
## 14. Privacy and Security
Metadata can reveal information even when the underlying document is not directly exposed.
Do not include:
- Applicant names or identity numbers unless explicitly required and properly protected.
- Passport or document numbers.
- Private email addresses or telephone numbers.
- Medical or financial information.
- Authentication tokens or credentials.
- Internal access-control details.
- Confidential file locations.
- Sensitive unpublished institutional information.
Public metadata should contain only information approved for the intended audience.
Private applicant documents and confidential records must be stored separately in appropriately secured systems. A public assets directory is not secure storage.
—
## 15. Integration with the Website
Metadata may support document listings, search results, filters, downloads, and content management workflows.
Possible uses include:
- Displaying document titles and descriptions.
- Filtering by category or language.
- Showing publication or revision dates.
- Linking to verified official sources.
- Identifying superseded resources.
- Generating document indexes.
- Supporting automated validation.
### Integration rules
- Use metadata fields consistently in the website code.
- Escape or safely render metadata values before displaying them.
- Validate URLs before creating clickable links.
- Do not trust metadata as a substitute for access-control checks.
- Keep public metadata separate from private operational records.
- Verify file paths before displaying download links.
- Do not publish drafts as approved documents.
Metadata should describe documents, not grant permission to access restricted content.
—
## 16. Version Control and Maintenance
When changing metadata:
1. Identify the affected document records.
2. Confirm the corresponding files and sources.
3. Update relevant metadata fields.
4. Validate syntax and schema requirements.
5. Check paths, links, and identifiers.
6. Review publication and verification statuses.
7. Check for accidental disclosure of private information.
8. Update dependent indexes where required.
9. Record significant changes in the project changelog.
10. Remove obsolete records only when retention requirements permit.
Use version control to track meaningful changes and help identify unintended modifications.
—
## 17. Quality Assurance Checklist
Before committing or publishing metadata:
- [ ] Metadata files use valid syntax.
- [ ] Required fields are present.
- [ ] Document IDs are unique.
- [ ] Categories and statuses use approved values.
- [ ] Dates follow the documented format.
- [ ] Referenced files exist.
- [ ] Source URLs have been checked where applicable.
- [ ] Official-source claims have been verified.
- [ ] Licence information is accurate or explicitly marked unknown.
- [ ] Metadata matches the actual document.
- [ ] Public links use the correct URL convention.
- [ ] No confidential information is exposed.
- [ ] JSON and CSV records remain consistent where both are maintained.
- [ ] Superseded and archived records are clearly identified.
- [ ] Website integrations have been tested.
—
## 18. Troubleshooting
### Metadata file cannot be parsed
Check JSON syntax, quotation marks, commas, brackets, and encoding.
### A document link is broken
Confirm the repository path, public URL, filename capitalization, and deployment configuration.
### Duplicate document records appear
Check the stable document IDs and consolidate duplicate entries.
### Metadata differs from the document
Verify the document’s actual title, source, version, date, and status, then update the metadata.
### A document is incorrectly marked official
Review its source and issuing authority. Correct the classification and publication status until verification is complete.
### JSON and CSV records disagree
Identify the authoritative registry, regenerate or synchronize the secondary format, and document the process.
### Sensitive information appears in metadata
Remove public exposure promptly, assess the disclosure, and follow the applicable privacy incident procedure.
—
## 19. Related Project Documentation
This directory may work alongside:
```text
assets/
└── documents/
    ├── README.md
    ├── guides/
    ├── policies/
    ├── templates/
    ├── officials/
    └── metadata/
        └── README.md
```
This structure is illustrative. Use the actual repository as the source of truth.
Use the main `/assets/documents/README.md` for general document management rules and this README for metadata structure, validation, and registry maintenance.
—
## 20. Change Log
### Version 1.0.0 — 2026-10-24
- Established document metadata directory guidelines.
- Defined recommended metadata fields and status values.
- Added JSON and CSV conventions.
- Documented source verification and licensing metadata.
- Added path management, validation, privacy, and security requirements.
- Established maintenance and quality-assurance procedures.
—
## 21. Final Standard
Every metadata record maintained by MedOrbits must be accurate, consistent, traceable, and aligned with the actual document it describes.
**Core principle:** Metadata must improve document discovery and maintenance without inventing facts, misrepresenting official status, breaking website links, or exposing confidential information.