
# MedOrbits — Documents Directory

**Directory:** `/assets/documents/`  
**Project:** MedOrbits  
**Document:** Document Asset Management Guidelines  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `/assets/documents/` directory organizes approved document assets used by the MedOrbits website.

It may contain public-facing brochures, informational guides, reusable templates, policy documents, licence records, and other approved downloadable resources.

This directory provides consistent organization, naming, accessibility, version control, and publication standards for document assets.

**Security requirement:** Do not store confidential applicant records, identity documents, medical records, passwords, or private application uploads in a publicly accessible static directory.

## 2. Recommended Directory Structure

```text
assets/
└── documents/
    ├── README.md
    ├── licenses/
    ├── policies/
    ├── forms/
    ├── guides/
    ├── brochures/
    ├── templates/
    ├── official/
    ├── archive/
    └── metadata/
```

Create only the directories required by the project. Keep the actual repository structure consistent with the paths used by the website.

## 3. Directory Responsibilities

| Directory | Purpose |
|—|—|
| `licenses/` | Applicable licences and permitted-use documentation |
| `policies/` | Approved privacy, terms, disclaimer, and policy documents |
| `forms/` | Blank, public-facing forms and application templates |
| `guides/` | Educational, admission, and user guidance documents |
| `brochures/` | Approved programme and service brochures |
| `templates/` | Reusable document templates |
| `official/` | Verified official documents whose redistribution is permitted |
| `archive/` | Retired or superseded documents retained under the project’s retention policy |
| `metadata/` | Document indexes, catalogues, and descriptive metadata |

These categories are recommendations, not confirmation that the corresponding documents already exist.

## 4. Supported Document Formats

| Format | Intended use |
|—|—|
| PDF | Published guides, brochures, and read-only documents |
| DOCX | Editable word-processing templates |
| XLSX | Approved spreadsheets and structured worksheets |
| CSV | Tabular data exchange |
| TXT | Plain-text documentation |
| MD | Technical documentation and repository guides |
| HTML | Web-readable documents when required |

Choose the format that best suits the intended audience and workflow. Do not convert documents unnecessarily when the original format is required.

## 5. File Naming Convention

Use descriptive, lowercase filenames with hyphens.

### Recommended examples

```text
privacy-policy.pdf
admission-guide.pdf
course-brochure.pdf
application-form-template.pdf
document-licensing-register.md
```

### Naming rules

1. Use lowercase letters and hyphens.
2. Include the document’s subject or purpose.
3. Avoid vague filenames such as `file1.pdf` or `final-new.pdf`.
4. Use version numbers only when they are part of the established release process.
5. Do not place personal identifiers in filenames.
6. Preserve existing filenames when production pages depend on them.
7. Update all document links when a path changes.
8. Do not imply that a document is official unless its source and status have been verified.

## 6. Document Accuracy and Verification

Before publishing a document:

- Verify the source and content.
- Confirm that the document is current where dates or rules matter.
- Check names, dates, links, tables, and contact details.
- Verify official documents against the issuing authority.
- Clearly distinguish MedOrbits-created guidance from third-party official documents.
- Include a publication or revision date where appropriate.
- Remove obsolete or contradictory information.
- Avoid unsupported guarantees about admissions, employment, eligibility, or outcomes.

For admission and healthcare-related material, verify time-sensitive claims using the relevant official source before publication.

## 7. Copyright and Licensing

Before distributing a document, confirm that MedOrbits has the right to publish it.

- Retain required copyright and attribution notices.
- Verify permission to reproduce third-party material.
- Follow applicable licence and redistribution terms.
- Do not publish paid, restricted, or confidential documents without authorization.
- Record the source and applicable licence where required.
- Avoid modifying official documents in a way that misrepresents their origin or meaning.

## 8. Accessibility Requirements

Documents should be usable by people with different access needs.

For PDFs and other downloadable documents:

- Use meaningful titles and headings.
- Preserve logical reading order.
- Use selectable text instead of image-only text wherever possible.
- Add alternative text to meaningful images.
- Use descriptive link labels.
- Maintain readable text size and adequate contrast.
- Tag PDFs appropriately when producing accessible PDFs.
- Check tables, lists, and form fields for usability.
- Provide an accessible HTML alternative when practical.

Do not assume that a PDF is accessible simply because it opens successfully.

## 9. Privacy and Security

The `/assets/documents/` directory should contain approved resources intended for public distribution or repository-managed use.

Never store the following in a publicly served directory:

- Applicant identity documents.
- Passports or other personal identification.
- Medical records or sensitive health information.
- Private application forms containing personal data.
- Bank statements or financial records.
- Passwords, API keys, tokens, or credentials.
- Confidential institutional or business records.

Private uploads must use appropriately secured storage with access controls, authorization, retention policies, and secure delivery mechanisms.

Review document metadata and embedded content before publication to prevent accidental disclosure of personal information.

## 10. Website Integration

Link to documents using paths that match the actual deployment configuration.

Example:

```html
<a
  href=“/assets/documents/guides/admission-guide.pdf”
  target=“_blank”
  rel=“noopener”
>
  Read the admission guide (PDF)
</a>
```

This is an example. Ensure that the referenced file exists before using the link.

### Integration rules

- Use descriptive link text.
- Identify the file format when helpful.
- Check every document URL before deployment.
- Ensure that public documents can be retrieved without exposing private files.
- Update dependent links when documents move.
- Avoid hard-coded paths that conflict with the hosting configuration.

## 11. Version Control and Archiving

Maintain a clear record of significant document updates.

- Update the revision date when content changes.
- Retain older versions only when there is a legitimate need.
- Label superseded documents clearly.
- Do not allow archived documents to be mistaken for current guidance.
- Remove obsolete public links.
- Follow applicable retention and deletion requirements.
- Avoid duplicating large files unnecessarily.

## 12. Quality Assurance Checklist

Before publishing a document:

- [ ] File exists at the expected path.
- [ ] Filename follows the naming convention.
- [ ] Source and publication rights are verified.
- [ ] Content has been reviewed for accuracy.
- [ ] Dates and official references are current where required.
- [ ] Accessibility has been checked.
- [ ] No confidential personal information is exposed.
- [ ] File opens correctly in supported applications.
- [ ] Website links work.
- [ ] Version and revision information are correct.
- [ ] Archived documents cannot be confused with current versions.

## 13. Troubleshooting

### Document link returns an error

Check the filename, capitalization, file location, deployment output, and server response.

### Document opens locally but not online

Verify static-file routing, production build inclusion, hosting configuration, and path resolution.

### PDF text cannot be selected

The document may contain scanned pages. Use OCR where appropriate and verify the extracted text before publication.

### Document contains outdated information

Review the issuing authority or source, update the document, revise its date, and replace or clearly retire the obsolete version.

### Sensitive information is discovered

Remove public access promptly, investigate the exposure, and follow the applicable privacy incident procedure.

## 14. Related Project Areas

The document directory may work alongside:

```text
assets/
├── documents/
├── fonts/
├── images/
├── css/
└── js/
```

This is an illustrative structure. Use the actual project architecture as the source of truth.

## 15. Change Log

### Version 1.0.0 — 2026-10-24

- Established document directory guidelines.
- Defined recommended categories and naming conventions.
- Added document accuracy, licensing, and accessibility requirements.
- Documented privacy, security, and website integration.
- Added quality assurance and maintenance procedures.

## 16. Final Standard

Every document published through MedOrbits must be accurate, appropriately licensed, accessible where practical, correctly referenced, and safe for its intended audience.

**Core principle:** Public document assets must never expose confidential applicant data or misrepresent the source, validity, or official status of a document.
