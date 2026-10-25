
# MedOrbits — Font Licences Directory

**Directory:** `/assets/fonts/fonts/FONT-LICENCES/`  
**Project:** MedOrbits  
**Purpose:** Organize font licensing documents, copyright notices, attribution records, and compliance documentation.  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `FONT-LICENCES` directory stores licensing documentation associated with fonts used by the MedOrbits website.

The directory supports the verification and management of font usage rights, including website embedding, commercial use, self-hosting, redistribution, and permitted modifications.

The existing font directory contains two font families:

- **DM Sans**
- **Playfair Display**

Their applicable licence terms must be verified against the original documentation before production use or redistribution.

**Important:** This directory documents licensing information. Its existence does not establish that any font has been verified or approved for use.

—

## 2. Directory Structure

Recommended structure:

```text id=“5bqzaw”
assets/
└── fonts/
    └── fonts/
        ├── README.md
        ├── DMSans-Bold.ttf
        ├── DMSans-Medium.ttf
        ├── DMSans-Regular.ttf
        ├── DMSans-SemiBold.ttf
        ├── PlayfairDisplay-Bold.ttf
        ├── PlayfairDisplay-Medium.ttf
        ├── PlayfairDisplay-SemiBold.ttf
        └── FONT-LICENCES/
            ├── README.md
            ├── FONT-LICENSE.md
            ├── DM-SANS-LICENSE.txt
            └── PLAYFAIR-DISPLAY-LICENSE.txt
```

The two `.txt` files are recommended filenames for the original licence documents. Add them only after obtaining the applicable documents from verified sources.

Keep `FONT-LICENSE.md` as the central licensing register.

—

## 3. Documents in This Directory

| File | Purpose |
|—|—|
| `README.md` | Explains the directory structure and licensing workflow |
| `FONT-LICENSE.md` | Records licence verification, usage permissions, and compliance status |
| `DM-SANS-LICENSE.txt` | Recommended location for the original DM Sans licence, if obtained |
| `PLAYFAIR-DISPLAY-LICENSE.txt` | Recommended location for the original Playfair Display licence, if obtained |

Do not create placeholder documents that could be mistaken for original publisher-issued licences.

Use the actual filenames supplied by the font publisher when retaining original licence documents, where practical.

—

## 4. Font Families Covered

### DM Sans

Expected font files:

- `DMSans-Regular.ttf`
- `DMSans-Medium.ttf`
- `DMSans-SemiBold.ttf`
- `DMSans-Bold.ttf`

### Playfair Display

Expected font files:

- `PlayfairDisplay-Medium.ttf`
- `PlayfairDisplay-SemiBold.ttf`
- `PlayfairDisplay-Bold.ttf`

These filenames reflect the supplied directory screenshot. Verify that the files and corresponding licence documentation are present before marking either family as verified.

—

## 5. Licence Verification Requirements

For each font family, confirm the following using its original licence and source documentation:

1. Official font family name and creator.
2. Original source or authorized distribution provider.
3. Applicable licence name and version, if available.
4. Copyright and attribution requirements.
5. Permission for website embedding and self-hosting.
6. Permission for commercial use, where applicable.
7. Permission to distribute font binaries with the repository.
8. Permission for conversion, modification, and subsetting.
9. Any restrictions on redistribution or sublicensing.
10. Required notices and licence files.

Do not assume that a font is unrestricted simply because it is freely downloadable.

—

## 6. Licence Status Tracking

Use `FONT-LICENSE.md` to record the verification status of each font family.

Recommended status values:

| Status | Meaning |
|—|—|
| Pending verification | Original source or licence has not yet been reviewed |
| Under review | Licence documentation has been obtained but review is incomplete |
| Verified | Applicable licence terms have been reviewed and recorded |
| Restricted | The intended use is not permitted or requires additional authorization |

Only mark a font as verified after the relevant licence documentation has been reviewed.

Record the verification date and any restrictions that apply.

—

## 7. Copyright and Attribution

Retain copyright notices and attribution statements required by the applicable licences.

Where applicable, record:

- Font family and creator.
- Copyright notice.
- Licence name.
- Original source.
- Required attribution wording.
- Licence file location.
- Any redistribution or modification conditions.

Do not invent attribution statements or remove copyright notices from the original documents.

If the licence does not require attribution, do not claim that it does.

—

## 8. Repository and Deployment Rules

Before committing or deploying font assets, verify that:

- The intended website use is permitted.
- Font binaries may be stored in the chosen repository.
- Public distribution is permitted if the repository is public.
- Licence documents are included where required.
- Required copyright notices remain intact.
- Any conversion or modification follows the licence.
- No restricted font binaries are published without authorization.

If a licence prohibits the intended distribution method, obtain the necessary authorization or replace the font with an appropriately licensed alternative.

—

## 9. File Naming and Document Management

Use clear, consistent filenames for internally maintained documentation.

Recommended:

```text id=“pgas8d”
README.md
FONT-LICENSE.md
DM-SANS-LICENSE.txt
PLAYFAIR-DISPLAY-LICENSE.txt
```

Keep original publisher-issued documents identifiable and unaltered wherever practical.

Do not rename files in a way that misrepresents their source, author, licence, or legal status.

Update references in the main `/assets/fonts/fonts/README.md` whenever the directory structure or filenames change.

—

## 10. Security and Integrity

- Obtain licence documents from trustworthy sources.
- Do not store passwords, credentials, or confidential information in this directory.
- Do not modify original licence text without clearly identifying the changes.
- Retain appropriate source and verification records.
- Keep internal compliance notes separate from original licence documents.
- Do not publish unverified claims about font ownership or permissions.
- Review licensing before replacing or converting font assets.

Licence documentation must remain traceable to its original source.

—

## 11. Maintenance Workflow

When adding or updating a font licence:

1. Identify the font family and the exact files in use.
2. Locate the original source or authorized distribution provider.
3. Obtain the applicable licence documentation.
4. Review website embedding, commercial use, and redistribution terms.
5. Check modification and conversion permissions.
6. Preserve required copyright and attribution notices.
7. Store the original licence document in this directory when appropriate.
8. Update `FONT-LICENSE.md` with verified information.
9. Record the verification date and any applicable restrictions.
10. Update the main font README if the directory structure changes.
11. Recheck compliance when changing repository visibility or distribution methods.

—

## 12. Maintenance Checklist

Before deployment or repository publication:

- [ ] DM Sans source has been identified.
- [ ] Playfair Display source has been identified.
- [ ] Applicable licence documents have been obtained.
- [ ] Commercial use permissions have been reviewed where relevant.
- [ ] Website embedding and self-hosting permissions have been reviewed.
- [ ] Repository redistribution permissions have been reviewed.
- [ ] Conversion and modification restrictions have been checked.
- [ ] Required copyright and attribution notices are retained.
- [ ] `FONT-LICENSE.md` reflects the actual verification status.
- [ ] Original licence documents have not been misrepresented.
- [ ] No restricted font binaries are published without authorization.
- [ ] Documentation paths match the actual repository.

—

## 13. Related Documentation

This directory works alongside:

```text id=“b9m42n”
assets/
└── fonts/
    └── fonts/
        ├── README.md
        └── FONT-LICENCES/
            ├── README.md
            └── FONT-LICENSE.md
```

The structure is illustrative and should reflect the actual repository.

Use the main font README for font inventory, CSS integration, typography, and performance guidelines. Use `FONT-LICENSE.md` for licensing records and verification status.

—

## 14. Change Log

### Version 1.0.0 — 2026-10-24

- Created the font licensing directory documentation.
- Defined the recommended licensing file structure.
- Added verification, attribution, and compliance requirements.
- Documented repository distribution and deployment checks.
- Added maintenance and publication checklists.

—

## 15. Final Standard

The `FONT-LICENCES` directory must contain accurate, traceable, and appropriately maintained font licensing documentation.

**Core principle:** No font should be considered licence-verified until its source, applicable terms, and required notices have been reviewed and recorded.

This README describes the intended documentation workflow. It does not independently verify the source, contents, or licensing status of any font file.
