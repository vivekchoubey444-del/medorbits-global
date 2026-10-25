
# Licences Directory — MedOrbits

**Directory:** `assets/documents/licences/`  
**Project:** MedOrbits  
**Document Type:** Licence records, third-party permissions, and usage terms  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `licences/` directory maintains licence information for documents, fonts, images, icons, illustrations, software components, datasets, templates, and other third-party resources used by the MedOrbits website and related services.

Its purpose is to support responsible asset management by recording:

- The original source of each resource.
- The applicable licence or permission.
- Whether commercial use is permitted.
- Whether modification or adaptation is permitted.
- Whether redistribution or public hosting is permitted.
- Attribution and copyright requirements.
- Licence verification status and review dates.

**Important:** A resource must not be treated as approved for commercial use or redistribution merely because it is publicly accessible or downloadable.

—

## 2. Directory Structure

Recommended structure:

```text
assets/
└── documents/
    └── licences/
        ├── README.md
        ├── LICENCE-REGISTER.md
        ├── THIRD-PARTY-LICENCES.md
        ├── ATTRIBUTION.md
        ├── LICENCE-VERIFICATION-CHECKLIST.md
        ├── sources/
        │   └── README.md
        ├── software/
        │   └── README.md
        ├── fonts/
        │   └── README.md
        ├── images/
        │   └── README.md
        ├── icons/
        │   └── README.md
        ├── documents/
        │   └── README.md
        └── archive/
            └── README.md
```

This is a recommended structure, not a statement that all listed files and folders already exist. Create only the directories needed by the project.

### File descriptions

| File or directory | Purpose |
|—|—|
| `README.md` | Explains the licence management process. |
| `LICENCE-REGISTER.md` | Summarises known resources and their licence status. |
| `THIRD-PARTY-LICENCES.md` | Records applicable third-party licence terms and references. |
| `ATTRIBUTION.md` | Collects required copyright and attribution notices. |
| `LICENCE-VERIFICATION-CHECKLIST.md` | Provides a repeatable review checklist. |
| `sources/` | Records original download pages and source references. |
| `software/` | Tracks software and package licences. |
| `fonts/` | Tracks font licences and font-specific restrictions. |
| `images/` | Tracks photographs, illustrations, and graphics. |
| `icons/` | Tracks icon libraries and individual icon resources. |
| `documents/` | Tracks templates, PDFs, publications, and other documents. |
| `archive/` | Preserves superseded records when retention is appropriate. |

Keep licence records in this directory distinct from the original licence files distributed with individual assets.

—

## 3. Scope

Licence records may cover the following resource types.

### 3.1 Fonts and typography

Record the font family, font files, original provider, licence text, permitted uses, and any attribution requirements.

For fonts stored in the project, coordinate with:

`/assets/fonts/`

For example, the project may contain DM Sans and Playfair Display font files. Their exact licence terms must be verified from the applicable original licence documents before making claims about commercial use, embedding, or redistribution.

### 3.2 Images and illustrations

Record the source, creator, applicable licence, required credit, permitted modifications, and restrictions on reuse.

Do not assume that images found through a search engine are free to use.

### 3.3 Icons and design resources

Record icon packs, SVG assets, illustrations, design templates, and other visual resources. Check whether attribution is required and whether redistribution of the original files is allowed.

### 3.4 Software and packages

Record third-party libraries, frameworks, scripts, tools, and packages incorporated into the project.

Where appropriate, preserve the licence notices supplied by package maintainers. Review the applicable licences and dependency obligations before distribution.

### 3.5 Documents and templates

Record licences and permissions for brochures, forms, educational materials, PDF templates, publications, and other documents.

Do not reproduce a third-party document simply because it is available on an official or public website. Check its copyright, reuse policy, and any applicable terms.

### 3.6 Datasets and external content

Record the provider, source URL, data licence, attribution requirements, permitted uses, update frequency, and relevant restrictions for datasets or externally sourced content.

For admissions, healthcare, employment, and recruitment information, also verify factual accuracy and the authority of the original source. A licence does not establish that information is current or correct.

—

## 4. Licence Register

Maintain a central register of resources used in the project.

Recommended fields:

| Field | Description |
|—|—|
| `resource_id` | Unique identifier for the resource. |
| `resource_name` | Name of the asset, package, font, or document. |
| `resource_type` | Font, image, icon, software, document, dataset, or other. |
| `local_path` | Location of the resource in the repository. |
| `original_source` | Original publisher or download page. |
| `licence_name` | Licence name exactly as published. |
| `licence_url` | Link to the applicable licence or terms. |
| `commercial_use` | Verified permission status for commercial use. |
| `modification_allowed` | Verified permission status for modification. |
| `redistribution_allowed` | Verified permission status for redistribution. |
| `attribution_required` | Whether attribution is required. |
| `verification_status` | Current review status. |
| `verified_on` | Date of the latest verification. |
| `review_notes` | Restrictions, exceptions, or unresolved questions. |

Use explicit statuses such as:

- `verified` — applicable licence terms have been reviewed.
- `pending` — the resource has not yet been fully reviewed.
- `restricted` — use is limited by the applicable terms.
- `permission_required` — additional permission is needed.
- `unknown` — the applicable licence could not be established.
- `rejected` — the resource must not be used under the current conditions.

Do not mark a resource as `verified` without evidence supporting the recorded permissions.

—

## 5. Example Licence Record

The following is an illustrative template only. It does not identify an actual verified resource.

```yaml
resource_id: RESOURCE-001
resource_name: Example Resource
resource_type: image
local_path: assets/images/example-image.svg
original_source: “”
licence_name: unknown
licence_url: “”
commercial_use: unknown
modification_allowed: unknown
redistribution_allowed: unknown
attribution_required: unknown
verification_status: pending
verified_on: null
review_notes: Confirm the original source and applicable licence before publication.
```

Replace the example values with verified information. Do not leave a resource marked as approved merely to complete the register.

If the project uses JSON as its primary metadata format, maintain the equivalent record in a valid JSON file rather than duplicating conflicting information across formats.

—

## 6. Licence Verification Procedure

Before adding or publishing a third-party resource:

1. **Identify the resource.** Record its name, type, local path, and intended use.
2. **Locate the original source.** Prefer the creator, publisher, official repository, or authorised distributor.
3. **Obtain the licence terms.** Save or link to the applicable licence version, terms of use, or written permission.
4. **Check the intended use.** Confirm whether website display, commercial use, modification, hosting, and redistribution are allowed.
5. **Check attribution.** Record the exact credit or notice required by the licence.
6. **Check additional restrictions.** Review any limits concerning trademarks, personal likenesses, sensitive uses, or redistribution of source files.
7. **Record evidence.** Add the source URL, review date, relevant licence version, and reviewer notes.
8. **Assign a status.** Use `verified` only when the applicable terms and intended use have been checked.
9. **Resolve uncertainty.** Obtain clarification or permission where necessary. Otherwise, do not publish the resource.
10. **Review periodically.** Recheck material when the licence changes, the resource is replaced, or the intended use changes.

A licence summary is an administrative record, not a substitute for the original licence or legal advice.

—

## 7. Attribution Requirements

Where attribution is required, preserve the wording and placement requirements specified by the licence.

An attribution record should contain:

- Resource name.
- Creator or copyright holder.
- Original source.
- Licence name and link.
- Required copyright notice.
- Required attribution wording.
- Modification statement, where required.
- Date last checked.

Example format:

```text
Resource: [Resource name]
Creator: [Creator or copyright holder]
Source: [Original source URL]
Licence: [Licence name and URL]
Changes: [Describe modifications, if applicable]
```

This is a template, not a completed attribution notice. Replace every placeholder with verified information.

Do not imply endorsement by a creator, publisher, government body, educational institution, or other organisation unless explicit authorisation supports that claim.

—

## 8. Third-Party and Official Resources

MedOrbits may reference information published by government departments, counselling authorities, educational institutions, healthcare regulators, employers, and other organisations.

For these resources:

- Preserve the original source URL.
- Record the publication or update date when available.
- Distinguish factual verification from copyright permission.
- Check whether copying, republication, adaptation, or commercial reuse is permitted.
- Avoid using official logos, seals, or emblems in a way that implies affiliation or endorsement without authorisation.
- Use links to original publications when reproducing the material is unnecessary.
- Recheck time-sensitive information before publication.

**Official availability does not automatically mean unrestricted reuse.** Follow the relevant authority’s copyright notice, reuse policy, and applicable law.

—

## 9. Repository and Website Integration

Licence information should remain traceable from the original resource to its use in the website.

Recommended practices:

- Keep original licence files alongside the relevant asset or in a clearly referenced licence directory.
- Include required notices in distributed software or documentation.
- Maintain a central attribution page if the project needs to display credits publicly.
- Keep a record of third-party package licences and dependency versions.
- Avoid removing copyright or licence notices from source files.
- Check build output and deployment bundles when redistribution obligations apply.
- Do not expose private credentials, access tokens, personal information, or confidential correspondence in licence records.
- Avoid linking to local development addresses such as `localhost` in public documentation.

Where a resource is removed, update its register entry and archive the record if needed for auditability.

—

## 10. Licence Files and Evidence

Where legally and operationally appropriate, preserve the original licence text or a stable reference to it.

Recommended evidence may include:

- Original licence file supplied with the resource.
- Official licence webpage.
- Written permission from the copyright holder.
- Purchase or subscription terms relevant to the resource.
- Version or release information.
- Verification date and reviewer notes.

Do not edit the original licence text when preserving it as evidence. Add explanatory notes separately.

If a licence URL becomes unavailable, search for an authoritative archived or publisher-maintained copy and document the source of the replacement. Do not silently substitute an unrelated licence.

—

## 11. Security and Privacy

Licence documentation must not contain:

- API keys or passwords.
- Payment card details.
- Identity documents belonging to applicants.
- Confidential contracts intended for restricted access.
- Private email addresses or contact details unless publication is authorised.
- Internal access tokens or deployment secrets.

If permission is documented in a private agreement, store the full agreement in an appropriately restricted location and include only a safe reference in the public repository.

The `assets/documents/` directory may be publicly accessible when served as website content. Never store confidential applicant records or private agreements in a public asset directory.

—

## 12. Maintenance and Version Control

Review this directory when:

- A new third-party asset is added.
- A dependency or font version changes.
- An existing resource is modified or replaced.
- A licence or provider policy changes.
- A new commercial use or distribution method is introduced.
- An attribution requirement changes.
- A previously unknown licence is verified.
- A resource is removed from the project.

For every meaningful update, record the change in version control and update the verification date where applicable.

Recommended maintenance cadence:

- **Before publication:** verify every newly introduced resource.
- **During releases:** check material licence changes and required notices.
- **Periodically:** review important assets and unresolved entries.
- **When changing intended use:** reassess whether the existing permissions remain sufficient.

Do not treat a past verification as permanent approval for every future use.

—

## 13. Quality Assurance Checklist

Before release, confirm the following:

- [ ] Every third-party resource has an identifiable source.
- [ ] Applicable licence terms have been located.
- [ ] Commercial-use permissions have been checked where relevant.
- [ ] Modification and redistribution restrictions have been reviewed.
- [ ] Required attribution and copyright notices are present.
- [ ] Unknown or pending resources are not incorrectly marked as approved.
- [ ] Official documents and external information link to reliable sources.
- [ ] Original licence notices have been preserved where required.
- [ ] No confidential files or secrets are stored in public directories.
- [ ] Register entries match the actual assets used in the release.
- [ ] Superseded records are retained or removed according to project policy.
- [ ] Public-facing credits do not imply unauthorised endorsement.

—

## 14. Troubleshooting

### The licence cannot be found

Check the original download package, publisher website, repository, or supplier documentation. If the licence remains unclear, mark the entry `unknown` or `pending` and do not assume unrestricted use.

### Commercial use is unclear

Review the exact licence and the intended commercial activity. Seek written clarification from the rights holder if necessary.

### Attribution requirements are unclear

Consult the original licence text and publisher guidance. Record the required wording and placement before publication.

### An official document is available online

Check the authority’s reuse and copyright terms. Link to the official document when appropriate rather than copying it without permission.

### A licence changes after release

Assess the impact on current use, distribution, and future releases. Document the decision and take corrective action where necessary.

—

## 15. Related Directories

| Directory | Purpose |
|—|—|
| `/assets/documents/` | Public-facing documents and document organisation. |
| `/assets/documents/templates/` | Document templates and reusable forms. |
| `/assets/documents/policies/` | Website policies and procedural documentation. |
| `/assets/documents/officials/` | Official-document references and verification records. |
| `/assets/documents/metadata/` | Structured metadata for document assets. |
| `/assets/fonts/` | Font assets and font-related documentation. |
| `/assets/fonts/fonts/FONT-LICENCES/` | Font-specific licence records and references. |

Keep directory names consistent with the actual repository. These paths are references to the intended project structure and should be adjusted if the repository uses different locations.

—

## 16. Disclaimer

This directory supports internal documentation and licence management. It does not itself grant rights to use, modify, publish, or redistribute any resource.

The applicable licence, permission agreement, and relevant law govern each resource. Where rights or restrictions are uncertain, obtain appropriate permission or qualified legal guidance before use.

—

## 17. Completion Checklist

- [ ] Create `/assets/documents/licences/README.md`.
- [ ] Add the licence register if the project needs one.
- [ ] Record all relevant third-party resources.
- [ ] Preserve or link to original licence terms.
- [ ] Verify required credits and notices.
- [ ] Resolve pending or unknown licence entries before publication.
- [ ] Review the directory before each production release.

**End of README**
