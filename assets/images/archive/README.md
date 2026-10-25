MedOrbits Archived Assets

Canonical directory: /assets/images/archive/
Project: MedOrbits
Document version: 1.0.0
Last updated: 2026-10-24
Purpose: Governance and maintenance standards for retired website assets.

1. Purpose

The /assets/images/archive/ directory is reserved for legacy image assets that have been retired from active use but must be retained for a clear historical, operational, legal, or migration-related reason.

Archived assets are not intended for new pages or active interface components. Keep this directory separate from active assets so developers can distinguish current production files from historical material.

Do not use the archive as a general-purpose folder for unsorted images, temporary downloads, drafts, or unapproved artwork.

2. Directory Structure

Recommended structure:

assets/
└── images/
    └── archive/
        ├── README.md
        ├── logos/
        ├── banners/
        ├── team/
        ├── testimonials/
        ├── social/
        └── other/

These subdirectories are optional. Create them only when archived files in those categories exist and the separation improves maintainability.

If the project already uses a different structure, preserve it unless a planned migration has been reviewed.

3. What Belongs Here

Suitable archived assets may include:

• Previously published logos replaced by an approved brand update.
• Retired banners or campaign artwork retained for reference.
• Superseded team or testimonial images where retention is authorized.
• Old social graphics retained for historical records.
• Assets kept temporarily while a migration or rollback is completed.
• Files that must be preserved to support documented legal or operational requirements.

Do not archive files simply because they are unused at the moment. Confirm their status and the reason for retention first.

4. What Must Not Be Stored Here

Do not use this directory for:

• Current production assets that belong in active asset directories.
• Unreviewed or unapproved artwork.
• Temporary files, build output, cache files, or editor lock files.
• Credentials, API keys, private documents, or confidential data.
• Personal information that is not authorized for retention.
• Copyrighted third-party material without a valid basis for retention.
• Malware samples or unsafe files intended to be opened or served by the website.

Publicly deployed files may be accessible by URL. An archive directory inside a public assets folder is not private storage.

If an asset must be retained confidentially, store it in an access-controlled location outside the public website directory.

5. Naming Convention

Use descriptive, lowercase kebab-case filenames.

Examples:

• medorbits-logo-retired-2025.svg
• homepage-banner-superseded-2025.webp
• campaign-social-graphic-retired-2024.png
• team-photo-obsolete-2025.jpg

Naming guidance:

1. Keep the original filename when it is meaningful and needed for traceability.
2. Add a date or status suffix when it helps distinguish versions.
3. Avoid vague names such as old.png, backup2.svg, or final-old-new.jpg.
4. Do not rename a file in a way that destroys useful provenance.
5. Ensure the extension matches the actual file format.
6. Avoid duplicate copies unless each copy has a documented purpose.

Use a consistent date format such as YYYY or YYYY-MM-DD when dates are useful.

6. Archive Metadata

For each archived asset, record enough information to explain why it remains in the repository.

Recommended metadata:

• Original filename and path.
• Archive filename and path.
• Asset category.
• Date archived.
• Reason for retirement.
• Original usage location, if known.
• Replacement asset, if any.
• Owner or responsible team.
• License or retention requirements, where applicable.
• Review or deletion date, if applicable.

Metadata can be maintained in a nearby inventory file if the archive contains many assets. Do not invent details that are unknown; mark them as unknown or not recorded and investigate when necessary.

7. Migration and Retirement Procedure

Before moving an asset into the archive:

1. Search the repository for references to the asset.
2. Confirm that active pages, CSS, JavaScript, manifests, and generated documents no longer depend on it.
3. Identify the replacement asset, if one exists.
4. Update and test all active references.
5. Confirm the retired asset is still required for a documented reason.
6. Move the file without altering its contents unless conversion or sanitization is explicitly required.
7. Record the archive date, reason, and replacement path.
8. Test the website after the change.
9. Confirm that no broken image references remain.

Do not move or delete assets based only on their filenames or apparent age.

8. Security and Privacy

Archived files must meet the project’s security and privacy requirements.

• Review SVG files before retaining or publishing them.
• Do not expose sensitive metadata or personal information unnecessarily.
• Do not assume that moving a file into archive/ prevents public access.
• Remove credentials and secrets from asset metadata and embedded content.
• Follow applicable licensing, consent, and retention obligations.
• Keep restricted material outside public directories.
• If an archived file is known to be unsafe, do not serve it from the public site. Retain it only in an appropriate controlled environment if there is a valid need.

For web-delivered SVGs, inspect XML content for scripts, event handlers, embedded foreignObject content, and unexpected external references.

9. Licensing and Rights

Before retaining an asset, verify that the project has a legitimate basis to keep it.

Where applicable, preserve:

• Creator or source information.
• License or usage terms.
• Attribution requirements.
• Approval records.
• Relevant consent or release documentation, stored securely where necessary.
• Any restrictions on redistribution or public access.

Do not assume that previous publication means an asset is approved for continued use.

Retain third-party or institutional branding only when authorized and only for the permitted purpose.

10. Public Access and Deployment

If /assets/images/archive/ is inside a public web root, files may remain accessible directly even when no active page links to them.

Therefore:

• Do not store private or restricted assets here.
• Do not rely on obscure filenames as an access-control measure.
• Consider excluding archives from public deployment when historical access is not required.
• If the build system copies the entire assets/images/ directory, verify whether archived files are included in production.
• Apply access controls at the server or storage layer if restricted retention is necessary.
• Confirm that deployment rules match the intended retention policy.

An archive in source control does not have to be a publicly served archive.

11. Performance and Repository Hygiene

Archived assets should not increase the size of the active website unnecessarily.

• Keep retired assets out of active HTML and CSS references.
• Avoid loading archive files through runtime asset discovery.
• Avoid including archived files in image preloads, manifests, or active galleries.
• Do not duplicate large files without a reason.
• Consider repository size before retaining large historical artwork indefinitely.
• Use Git history or a controlled design repository when it provides a better record than keeping duplicate binaries.
• Do not delete assets required for rollback, compliance, or documented historical purposes without approval.

12. Retention and Deletion

Review archived assets periodically.

For each file, determine whether it should be:

• Retained for a documented purpose.
• Moved to a more appropriate controlled archive.
• Replaced by a reference to the version-control history.
• Deleted because the retention need has ended and deletion is authorized.

Before deleting an archived asset:

1. Check whether it is still referenced.
2. Confirm there are no outstanding retention or legal requirements.
3. Confirm the responsible owner approves deletion where required.
4. Check whether a verified backup or source-control history is sufficient.
5. Record the decision if the asset is subject to formal retention controls.

Do not establish an arbitrary deletion deadline for assets subject to legal, contractual, or operational retention requirements.

13. Validation Checklist

Before committing an archived asset, verify:

☐ The asset has a clear reason for retention.
☐ Its current production references have been checked.
☐ The original path or filename is recorded when useful.
☐ The archive name is descriptive.
☐ The file extension matches its actual format.
☐ Ownership and licensing have been considered.
☐ Personal or confidential information has been reviewed.
☐ SVG or other active-content-capable formats have been inspected.
☐ The replacement path is recorded where applicable.
☐ The asset is excluded from active UI references.
☐ Public deployment behavior is understood.
☐ A review or deletion decision is recorded when required.

14. Troubleshooting

An archived image still appears on the website

Search all HTML, CSS, JavaScript, manifest, and configuration files for its filename. Check generated files and cached resources as well.

An image breaks after archiving

A live reference may still point to the original location. Restore the asset temporarily if necessary, update the reference to the approved replacement, and retest before archiving again.

The archive is included in production unexpectedly

Review the build and deployment rules. Configure the build to omit the archive if it is not intended to be publicly served.

The archive contains duplicate files

Compare file contents and metadata before removing duplicates. Preserve the version with the strongest provenance and retain the others only when they serve a documented purpose.

The source or license is unknown

Record the information as unknown, investigate the source where practical, and avoid redistributing the asset until its permitted use is established.

15. Maintenance Responsibilities

The MedOrbits project maintainer or designated asset owner should:

1. Keep the archive organized.
2. Ensure new archived files have a documented reason.
3. Review licensing, privacy, and security considerations.
4. Prevent archived assets from being referenced accidentally by active pages.
5. Review deployment rules for public exposure.
6. Update this README when the archive policy changes.
7. Coordinate removals with the relevant project owner.

16. Change Log

Version 1.0.0 — 2026-10-24

• Established the purpose and scope of the image archive.
• Defined recommended directory structure and naming conventions.
• Added retirement, migration, licensing, security, privacy, and deployment guidance.
• Added retention, deletion, troubleshooting, and validation procedures.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/archive/
Document: README.md

This document defines archive-management guidance. It does not certify ownership, licensing, approval, or the safety of any particular archived file.