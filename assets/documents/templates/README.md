
# MedOrbits — Document Templates

**Directory:** `/assets/documents/templates/`  
**Project:** MedOrbits  
**Document:** Document Template Management Guidelines  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `/assets/documents/templates/` directory stores approved, reusable document templates used by MedOrbits for educational guidance, admissions support, healthcare information, career services, recruitment, and internal business documentation.

Templates provide a consistent starting point for creating documents while maintaining the MedOrbits brand identity, formatting standards, accessibility, accuracy, and document control.

This directory may contain blank application templates, checklists, letters, reports, worksheets, and other reusable document formats.

**Important:** The filenames and folder structure shown in this README are recommendations. They do not confirm that the example files already exist.

—

## 2. Recommended Directory Structure

```text
assets/
└── documents/
    └── templates/
        ├── README.md
        ├── applications/
        ├── admissions/
        ├── healthcare/
        ├── careers/
        ├── recruitment/
        ├── business/
        ├── checklists/
        ├── reports/
        ├── pdf/
        ├── editable/
        └── archive/
```

Create only the folders required by the project. Avoid unnecessary duplication of templates across categories.

### Directory responsibilities

| Directory | Purpose |
|—|—|
| `applications/` | Blank application and registration templates |
| `admissions/` | Admission preparation and document checklist templates |
| `healthcare/` | Healthcare education and information templates |
| `careers/` | CV, career planning, and professional development templates |
| `recruitment/` | Recruitment workflow and candidate evaluation templates |
| `business/` | Internal business forms, letters, and operational documents |
| `checklists/` | Reusable review and document preparation checklists |
| `reports/` | Report and assessment templates |
| `pdf/` | Approved PDF templates intended for distribution |
| `editable/` | Editable source documents |
| `archive/` | Retired templates retained according to the project retention policy |

The directory names are illustrative. Adapt them to the actual repository and workflow.

—

## 3. Supported Template Formats

| Format | Intended use |
|—|—|
| PDF | Distribution-ready documents and printable blank forms |
| DOCX | Editable letters, applications, reports, and business documents |
| XLSX | Worksheets, trackers, and structured tabular templates |
| CSV | Simple structured data templates |
| HTML | Web-based forms and printable document layouts |
| MD | Technical documentation and text-based templates |
| TXT | Plain-text templates and reusable text content |

Choose a format according to the intended user and workflow.

Use fillable PDF fields when users must complete a PDF electronically. A normal PDF containing blank lines is not automatically a fillable PDF.

—

## 4. Naming Convention

Use descriptive, lowercase filenames separated by hyphens.

### Recommended examples

```text
application-form-template.pdf
admission-document-checklist.pdf
candidate-evaluation-template.xlsx
career-planning-template.docx
business-letter-template.docx
document-review-checklist.pdf
```

These names are examples only.

### Naming rules

1. Use lowercase letters and hyphens.
2. Identify the template’s purpose.
3. Include the format extension.
4. Avoid spaces, vague filenames, and unnecessary suffixes.
5. Preserve existing filenames when active website pages reference them.
6. Use version numbers only when required by the project’s release process.
7. Do not include personal names, application IDs, or other sensitive information in filenames.
8. Update dependent links when a template is renamed or moved.

—

## 5. Template Design Standards

Templates should follow the established MedOrbits visual identity.

### Visual guidelines

- Use a consistent heading hierarchy.
- Keep page layouts clean and professional.
- Use the project’s established typography and colour tokens.
- Prefer sapphire blue, deep navy, burgundy, aubergine, champagne gold, and softly tinted backgrounds where appropriate.
- Avoid pure-white background sections when the established design calls for tinted surfaces.
- Maintain readable text sizes and sufficient contrast.
- Use consistent margins, spacing, page numbers, and document titles.
- Keep tables and form fields aligned.
- Ensure that templates print correctly when printing is an intended use.
- Avoid decorative elements that interfere with readability.

Use the shared design system where available rather than creating conflicting styles for each template.

—

## 6. Required Template Metadata

Where practical, include the following information in reusable document templates:

- Document title.
- Organization or project name.
- Template identifier.
- Version number.
- Creation or revision date.
- Intended purpose.
- Instructions for completion.
- Required fields and supporting documents.
- Relevant disclaimer or privacy notice.
- Contact information, where appropriate.

Do not insert invented approval details, official seals, or institutional endorsements.

For externally distributed templates, distinguish clearly between MedOrbits-created materials and forms issued by external authorities.

—

## 7. Forms and Application Templates

Templates used for applications or registrations must be clear, accessible, and limited to information necessary for the stated purpose.

### Form requirements

- Use descriptive field labels.
- Clearly identify required fields.
- Explain accepted file formats and size limits when uploads are supported.
- Include clear instructions for dates, names, and contact information.
- Provide space for signatures only where appropriate.
- Explain how submitted information will be used.
- Avoid collecting unnecessary sensitive personal information.
- Include a privacy notice when required.
- Do not imply that completing a template guarantees admission, employment, approval, or another outcome.

**Security requirement:** Store blank, approved templates here. Do not place completed forms containing personal data in a publicly accessible template directory.

Completed applications and identity documents must be handled through appropriately secured storage with suitable access controls.

—

## 8. Admissions and Educational Templates

Admission-related templates may include:

- Document preparation checklists.
- Personal information worksheets.
- Application planning sheets.
- Counselling preparation checklists.
- Course comparison worksheets.
- Admission guidance forms.
- Document submission trackers.

### Accuracy requirements

- Verify time-sensitive admission rules using the relevant official authority.
- Identify the applicable academic year where necessary.
- Distinguish general guidance from official instructions.
- Do not invent eligibility criteria, fees, deadlines, or document requirements.
- Avoid representing a MedOrbits template as an official government or university form.
- Direct users to the appropriate official source when an official form is required.

Templates must be reviewed when admission rules or application processes change.

—

## 9. Career and Recruitment Templates

Career-related templates may include:

- CV and résumé templates.
- Cover letter templates.
- Career planning worksheets.
- Interview preparation checklists.
- Candidate evaluation forms.
- Recruitment process checklists.
- Job application preparation templates.
- Interview feedback forms.

### Professional requirements

- Use neutral, job-related evaluation criteria.
- Avoid discriminatory or irrelevant personal questions.
- Collect only information needed for the stated recruitment purpose.
- Clearly distinguish blank templates from completed candidate records.
- Do not imply that a template guarantees employment.
- Protect candidate information through appropriate storage and access controls.
- Verify any applicable recruitment, employment, and privacy requirements.

—

## 10. PDF and Print Quality

For PDF templates:

- Use readable typography and consistent margins.
- Check page breaks and alignment.
- Ensure that form fields are usable where electronic completion is required.
- Verify that links work.
- Use selectable text wherever possible.
- Add document titles and metadata where appropriate.
- Test the file in common PDF viewers.
- Check printing on standard page sizes, including A4 where appropriate.
- Ensure that important content is not clipped.
- Verify accessibility where applicable.

If a PDF is intended to be fillable, test field entry, saving, reopening, and printing.

—

## 11. Editable Source Files

Where a PDF is generated from an editable source document, retain the source when practical and permitted.

Example:

```text
templates/
├── admissions/
│   ├── admission-checklist.docx
│   └── admission-checklist.pdf
└── careers/
    ├── career-planning-template.docx
    └── career-planning-template.pdf
```

This is an illustrative structure.

Keep source and published versions consistent. Update both when a template changes and confirm that the exported PDF reflects the latest approved content.

Do not distribute fonts, logos, images, or other embedded assets unless their licences permit the intended use.

—

## 12. Privacy, Security, and Confidentiality

The templates directory should contain reusable blank documents and approved public-facing resources.

Do not store:

- Completed applications containing personal data.
- Passports or identity documents.
- Medical records.
- Bank statements.
- Private candidate evaluations.
- Confidential contracts.
- Passwords, API keys, or access tokens.
- Documents containing restricted institutional information.

### Handling requirements

1. Separate blank templates from completed records.
2. Review documents for hidden text, comments, and tracked changes.
3. Remove unnecessary personal metadata before publication.
4. Check embedded images and attachments for confidential information.
5. Use secured storage for completed applications and sensitive records.
6. Apply appropriate access controls and retention policies.
7. Follow applicable privacy and data-protection requirements.

A publicly accessible static directory must never be treated as secure storage for private user uploads.

—

## 13. Copyright and Licensing

Before publishing or distributing a template:

- Verify ownership or permission to use the content.
- Retain required copyright notices.
- Confirm permission to reproduce third-party material.
- Follow applicable licence and attribution terms.
- Do not copy restricted forms or documents without authorization.
- Do not modify official documents in a way that misrepresents their source.
- Confirm that embedded fonts, images, and logos may be distributed.

If a template is based on an external authority’s document, identify its source and preserve the distinction between the original and any MedOrbits-created adaptation.

—

## 14. Version Control and Maintenance

Each maintained template should have a clear update history.

Recommended practices:

- Use a consistent versioning approach.
- Record meaningful revisions.
- Update the revision date when content changes.
- Identify superseded versions clearly.
- Remove obsolete download links.
- Retain older versions only when there is a legitimate reason.
- Review templates when laws, policies, admission rules, or workflows change.
- Keep filenames and links stable where practical.
- Check dependent website pages before moving or deleting a file.

Do not allow outdated templates to appear current.

—

## 15. Website Integration

Use links that match the actual deployed directory structure.

Example:

```html
<a
  href=“/assets/documents/templates/admissions/admission-document-checklist.pdf”
  target=“_blank”
  rel=“noopener”
>
  Download the admission document checklist (PDF)
</a>
```

This example assumes that the referenced PDF exists and that root-relative paths are appropriate for the deployment.

### Integration rules

- Verify the target file before publishing the link.
- Use descriptive link text.
- Identify the file format when useful.
- Check that public documents are accessible.
- Avoid exposing private storage paths.
- Update all dependent links when a template moves.
- Test downloads after deployment.

—

## 16. Quality Assurance Checklist

Before releasing a template:

- [ ] Filename follows the naming convention.
- [ ] File exists at the expected path.
- [ ] Content has been reviewed for accuracy.
- [ ] Required metadata is included.
- [ ] Branding and typography are consistent.
- [ ] Accessibility and readability have been checked.
- [ ] Page breaks and printing have been tested where applicable.
- [ ] PDF fields work if the template is fillable.
- [ ] No confidential information is exposed.
- [ ] Copyright and licensing requirements are satisfied.
- [ ] Official-source references are verified where relevant.
- [ ] Version and revision information are correct.
- [ ] Website links work after deployment.
- [ ] Superseded versions are handled appropriately.

—

## 17. Troubleshooting

### Template link does not work

Check the filename, directory path, capitalization, deployment output, and server response.

### PDF formatting changes between viewers

Check embedded font support, page dimensions, margins, field appearance, and PDF compatibility.

### Fillable fields do not work

Verify that interactive fields were actually created and test saving and reopening the document in supported viewers.

### Template contains outdated instructions

Verify the relevant source, revise the document, update its version and revision date, and retire obsolete copies.

### Private information appears in a template

Remove the document from public access, investigate the exposure, and follow the applicable privacy incident procedure.

### Editable and PDF versions disagree

Regenerate the published version from the approved source and verify the exported document before replacing the existing file.

—

## 18. Change Log

### Version 1.0.0 — 2026-10-24

- Established document template management guidelines.
- Defined recommended categories and file naming conventions.
- Added design, metadata, and accessibility standards.
- Documented application, admissions, career, and recruitment requirements.
- Added privacy, security, licensing, and version-control guidance.
- Established publication and quality-assurance checklists.

—

## 19. Final Standard

Every template stored in `/assets/documents/templates/` must be reusable, accurate, appropriately licensed, accessible where practical, and safe for its intended audience.

**Core principle:** Maintain blank templates and approved reusable documents separately from completed applications and confidential records. Ensure that each published template has a clear purpose, verified content, and a correctly maintained version history.
