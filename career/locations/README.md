MedOrbits — Career Locations

Directory: career/locations/
Module: Career, Recruitment & Employer Services
Design system: Rosewood Elite — Imperial Aubergine, Rosewood & Antique Gold
Purpose: Location-based career guides and employment information.

⸻

1. Overview

The Career Locations directory organizes career guidance by geographic area, helping users explore employment sectors, career pathways, workplace considerations, and relevant resources.

These pages are informational guides. They are not a live vacancy feed and must not imply that a particular employer is hiring unless that claim is supported by a current, verified listing.

The directory is intended to:

* Help users explore career opportunities by location.
* Explain relevant industries and employment considerations.
* Link users to approved job and internship listings.
* Provide access to location-relevant career resources.
* Maintain consistent navigation and presentation across location pages.
* Encourage users to verify employers, job requirements, and written offer terms.

2. Directory structure

career/
└── locations/
    ├── README.md
    ├── index.html
    ├── uttar-pradesh.html
    ├── delhi.html
    ├── mumbai.html
    ├── bengaluru.html
    ├── hyderabad.html
    ├── pune.html
    ├── kolkata.html
    ├── chennai.html
    ├── guwahati.html
    └── others.html

File responsibilities

File	Purpose
index.html	Location guide directory and navigation to supported locations.
uttar-pradesh.html	Career guidance for Uttar Pradesh.
delhi.html	Career guidance for Delhi.
mumbai.html	Career guidance for Mumbai.
bengaluru.html	Career guidance for Bengaluru.
hyderabad.html	Career guidance for Hyderabad.
pune.html	Career guidance for Pune.
kolkata.html	Career guidance for Kolkata.
chennai.html	Career guidance for Chennai.
guwahati.html	Career guidance for Guwahati.
others.html	Directory of additional supported locations.

This inventory documents the intended files. Confirm it against the actual repository when adding or removing pages.

3. Shared design and assets

Location pages reuse the existing MedOrbits website structure, including:

* Announcement bar.
* Opening animation.
* Brand logo.
* Header and navigation.
* Shared footer.
* Global stylesheet.
* Shared JavaScript utilities and navigation scripts.

Rosewood Elite design direction

The visual system uses:

* Imperial Aubergine: primary brand surfaces and headings.
* Rosewood: supporting backgrounds and accent surfaces.
* Antique Gold: highlights, selected navigation, and restrained decorative details.

Preserve the existing MedOrbits design tokens and shared components. Do not introduce unrelated colors, typography, or independent navigation systems.

Asset conventions

Shared images are referenced under:

/assets/images/

Verify that each referenced image exists and resolves correctly in the deployed environment.

Use appropriate alternative text for meaningful images and an approved placeholder or fallback for optional images that cannot load.

Asset paths beginning with /assets/ are root-relative URLs. If MedOrbits is deployed under a subdirectory, ensure the application’s base-path configuration resolves assets correctly.

4. Content requirements

Each location guide should provide useful, clearly scoped information rather than unsupported promises about employment.

Where appropriate, pages may include:

* Location overview.
* Relevant industry and sector guides.
* Career pathways and common role categories.
* Qualification and skills considerations.
* Links to relevant jobs and internships.
* Career guidance and interview resources.
* Employer verification and job-search safety advice.
* Links to other location guides.

Accuracy requirements

* Do not invent employers, vacancies, salaries, or hiring demand.
* Do not imply that a sector guarantees employment in a particular location.
* Distinguish general guidance from verified, current job listings.
* Cite authoritative sources for material factual claims.
* Review information that may become outdated.
* Identify estimates as estimates and explain their limitations.
* Do not imply that location-specific professional licensing or qualification requirements are uniform across employers.

If verified local information is unavailable, provide general guidance without presenting it as a confirmed local fact.

5. Job and internship integration

Location guides may link to the Career Module’s job and internship directories.

Relevant pages include:

/career/jobs.html
/career/job-categories.html
/career/internships.html
/career/resources/
/career/sectors/

These paths assume deployment at /career/. Confirm routing and link behavior in the actual hosting environment.

Location guides must remain distinct from the live listings system.

When a guide displays current opportunities, retrieve them from the approved backend or an explicitly approved public dataset. Apply the relevant publication, verification, expiry, and access rules.

A location page must not convert an unverified employer mention into a confirmed vacancy.

6. Employment and relocation considerations

Career guidance should encourage users to verify the details of an opportunity before making financial or relocation commitments.

Where relevant, advise users to confirm:

* Exact worksite and city.
* On-site, hybrid, or remote arrangement.
* Employment type and working hours.
* Written compensation and benefits.
* Probation and notice terms.
* Employer identity and official contact channels.
* Relocation, accommodation, or travel arrangements.
* Required qualifications, registration, or professional licensing.
* Applicable employment terms and documentation.

Do not represent general guidance as individualized legal, immigration, or employment advice.

7. Security and user trust

Location pages are public informational content.

Do not place the following in static HTML or public data files:

* Applicant personal information.
* Private phone numbers or email addresses.
* Authentication credentials or tokens.
* Confidential employer records.
* Internal API secrets.
* Private recruitment documents.

Forms, saved preferences, account information, and applicant records must be handled through appropriately secured backend services.

External links must be validated. When opening external destinations in a new browsing context, use appropriate link-security attributes, including rel=“noopener noreferrer”.

8. Accessibility and responsive behavior

Every location page should:

* Use semantic HTML and a consistent heading hierarchy.
* Support keyboard navigation.
* Provide visible focus indicators.
* Maintain readable contrast.
* Use meaningful image alternatives.
* Avoid horizontal overflow.
* Support mobile, tablet, and desktop layouts.
* Handle long location names and content gracefully.
* Respect reduced-motion preferences for animations.

Use shared MedOrbits components wherever practical to maintain consistent behavior.

9. Validation and testing

Before publishing changes, verify:

* [ ]	All documented files exist.
* [ ]	Shared header, navigation, announcement bar, and footer render correctly.
* [ ]	The Rosewood Elite palette is applied consistently.
* [ ]	Image and script paths resolve.
* [ ]	Internal links point to valid destinations.
* [ ]	Content contains no fabricated vacancies or unsupported claims.
* [ ]	Any current employment information has appropriate sources.
* [ ]	Responsive layouts work across supported viewport sizes.
* [ ]	Accessibility and keyboard interaction have been checked.
* [ ]	No private data or credentials appear in public content.
* [ ]	Any linked job or internship listing follows the applicable publication rules.

10. Maintenance

When adding or updating a location page:

1. Update the location directory and this README.
2. Reuse the existing shared design components.
3. Confirm that the page uses the correct asset and navigation paths.
4. Review factual claims and sources.
5. Check links to jobs, internships, sectors, and resources.
6. Test responsive behavior and accessibility.
7. Remove or update outdated information.
8. Verify that no unsupported hiring claims are presented.
9. Test the page in the actual deployment environment.

11. Disclaimer

MedOrbits location guides provide general career information. They do not guarantee job availability, employment, salary, relocation support, or recruitment outcomes.

Job requirements, compensation, work arrangements, and employment terms vary by employer and role. Users should independently verify the employer, exact worksite, written offer, and relevant terms before making commitments.

⸻

Ownership: MedOrbits project maintainers
Directory: career/locations/
Design system: Rosewood Elite
Content policy: Accurate, appropriately sourced, and non-misleading career guidance.