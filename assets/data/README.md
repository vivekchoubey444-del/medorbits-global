MedOrbits Data Directory

This directory contains the JSON data files used by the MedOrbits website. Keep this document updated when adding, renaming, removing, or changing the structure of a dataset.

Purpose

The files in this directory provide structured content for website features such as admissions, colleges and universities, courses, fees, scholarships, jobs, locations, news, services, and testimonials. The exact features available depend on which files are loaded by the site’s JavaScript.

Current data files

The following inventory is based on the repository file list shown in the supplied screenshots. Confirm filenames in GitHub before using this list as an automated manifest.

|File                    |Intended data area                         |
|————————|-——————————————|
|`admission-process.json`|Admission process guidance                 |
|`admissions.json`       |Admission records and status information   |
|`bulletins.json`        |Public information bulletins               |
|`career-options.json`   |Career pathways and options                |
|`categories.json`       |Website or content categories              |
|`colleges.json`         |College records                            |
|`countries.json`        |Country information                        |
|`courses.json`          |Course catalogue                           |
|`documents.json`        |Document requirements and guidance         |
|`entrance-exams.json`   |Entrance examination information           |
|`faqs.json`             |Frequently asked questions                 |
|`fee-guides.json`       |Fee guidance and explanatory resources     |
|`fees.json`             |Fee records or fee-related data            |
|`hostels.json`          |Hostel and accommodation information       |
|`internships.json`      |Internship opportunities                   |
|`jobs.json`             |Job opportunities                          |
|`locations.json`        |Geographic and location data               |
|`news.json`             |News content                               |
|`notifications.json`    |Website notifications                      |
|`recruitment.json`      |Recruitment information and opportunities  |
|`release-sources.json`  |Sources associated with releases or updates|
|`scholarships.json`     |Scholarship opportunities                  |
|`sectors.json`          |Industry and employment sectors            |
|`services.json`         |MedOrbits services                         |
|`social-links.json`     |Social media and external links            |
|`testimonials.json`     |Consented testimonial records              |
|`universities.json`     |University records                         |

Other files may exist or be added later. This list is not a guarantee that every file is loaded by every page.

Data-file conventions

• Use valid UTF-8 JSON. Use double quotes around JSON property names and string values.
• Keep one top-level JSON object or array per file, according to that file’s established structure.
• Preserve existing property names and data shapes unless all dependent code is updated together.
• Use stable, unique IDs for records where the dataset uses IDs.
• Use null when a value is genuinely unknown or not yet supplied; do not invent official dates, fees, eligibility criteria, contact details, or outcomes.
• Use ISO-style dates (YYYY-MM-DD) where the dataset defines date fields, and ISO 8601 timestamps where it defines timestamps.
• Keep links in their appropriate URL format. Verify official links before presenting them as authoritative.
• Avoid duplicate records and check references between datasets, such as course, institution, and location IDs.
• Do not put API keys, passwords, private tokens, personal documents, or other secrets in public JSON files.
• Treat external data and user-submitted content as untrusted input. Escape it appropriately when rendering HTML.

Recommended update workflow

1. Inspect the target JSON file and its current structure before editing.
2. Make a focused change; avoid overwriting unrelated records.
3. Validate JSON syntax after editing.
4. Check required fields, unique IDs, allowed values, and cross-file references where applicable.
5. Confirm that the website code actually loads the file at the expected path.
6. Preview the affected page or feature locally or in a deployment preview.
7. Review the diff, then commit and push the change through the repository workflow.

Special handling: testimonials

testimonials.json must contain genuine feedback from real contributors who explicitly agreed to publication. Never create fictional reviews, names, ratings, consent records, or outcome claims for the live site.

Before a testimonial is displayed, confirm that it meets the dataset’s consent, moderation, verification, privacy, and disclosure rules. Obtain separate permission before publishing a person’s name or photo. Disclose any incentive associated with feedback. Do not present individual outcomes as guaranteed or typical results.

Keep fictional fixture data, if needed for interface development, in a separate development-only location. Ensure the production website and public APIs cannot load those fixtures.

Source of truth and maintenance

• The JSON files and the application code that consumes them are the implementation source of truth.
• This README is guidance, not a schema validator or an automatically generated manifest.
• If a JSON file contains a schemaVersion, document schema changes in the relevant project documentation and update validators or consumers when needed.
• When introducing a new data file, add its purpose here and update any relevant loaders, tests, build configuration, and deployment rules.
• Do not assume that a file is connected to the website merely because it exists in this directory.

Validation commands

Run these commands from the repository root in a Node.js environment.

Validate the syntax of one JSON file:

node -e “JSON.parse(require(‘fs’).readFileSync(‘assets/data/testimonials.json’, ‘utf8’)); console.log(‘Valid JSON’)”

Validate every JSON file directly in this directory:

node -e “const fs=require(‘fs’); const dir=‘assets/data’; const files=fs.readdirSync(dir).filter(f=>f.endsWith(‘.json’)); let failed=0; for (const f of files) { try { JSON.parse(fs.readFileSync(`${dir}/${f}`, ‘utf8’)); console.log(‘OK’, f); } catch (e) { failed++; console.error(‘INVALID’, f, e.message); } } if (failed) process.exit(1); console.log(`Validated ${files.length} JSON files.`)”

These commands check JSON syntax only. They do not validate a dataset against a JSON Schema or confirm that values are factually correct.

Security and privacy

• Public data files can be downloaded by website visitors; never store confidential information in them.
• Keep consent records, internal moderation notes, private contact details, and other sensitive operational data in an access-controlled system rather than public static JSON.
• Apply server-side validation and authorization for any administrative workflow that writes or updates data.
• Review external URLs and submitted content before publishing them.