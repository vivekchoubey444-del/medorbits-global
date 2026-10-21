MedOrbits Career Sectors — Rosewood Elite

Directory: career/sectors/
Project: MedOrbits
Module: Career, Recruitment & Employer Services
Design system: Rosewood Elite — Imperial Aubergine, Rosewood & Antique Gold
Purpose: Industry-specific career guides and sector navigation.

⸻

1. Overview

The MedOrbits Career Sectors directory organizes career guidance by industry, helping students, graduates, and job seekers explore role families, qualifications, skills, and employment pathways.

Each sector page provides informational guidance and may link to relevant jobs, internships, career resources, and other MedOrbits services.

The directory is designed to:

* Help users explore career pathways across industries.
* Explain common job families and role requirements.
* Identify relevant qualifications, skills, and professional development options.
* Direct users to appropriate career resources and verified listings.
* Maintain consistent navigation and visual presentation.
* Encourage independent verification of employers, vacancies, and regulated-role requirements.

Important: A sector guide does not establish that a vacancy is currently available and does not guarantee employment, salary, or recruitment outcomes.

2. Directory structure

career/
└── sectors/
    ├── README.md
    ├── index.html
    ├── healthcare.html
    ├── it.html
    ├── finance.html
    ├── hospitality.html
    ├── aviation.html
    ├── manufacturing.html
    ├── logistics.html
    └── others.html

File responsibilities

File	Responsibility
index.html	Sector directory and navigation to individual industry guides.
healthcare.html	Healthcare role families, qualification considerations, and application checks.
it.html	Information technology roles, skills, and career pathways.
finance.html	Banking and finance career guidance.
hospitality.html	Hospitality, tourism, and service-industry careers.
aviation.html	Aviation, airport operations, and related career pathways.
manufacturing.html	Manufacturing, production, and engineering career guidance.
logistics.html	Logistics, transportation, warehousing, and supply-chain careers.
others.html	Additional sectors not covered by the dedicated guides.

Keep this inventory synchronized with the actual repository.

3. Shared design system

3.1 Rosewood Elite palette

Sector pages follow the established MedOrbits visual identity:

* Imperial Aubergine: primary brand surfaces and prominent headings.
* Rosewood: supporting backgrounds and secondary accents.
* Antique Gold: restrained highlights, borders, and emphasis.

Reuse the existing MedOrbits design tokens and shared components. Do not create an independent design system for sector pages.

3.2 Shared website elements

Pages reuse the existing homepage structure, including:

* Announcement bar.
* Opening animation.
* Brand logo.
* Header and navigation.
* Shared footer.
* Global stylesheet.
* Shared JavaScript utilities and initialization.

Page-specific styles should supplement the shared stylesheet without unnecessarily duplicating global components.

3.3 Layout conventions

Use consistent, responsive layouts for:

* Sector introduction and overview.
* Role-family cards.
* Skills and qualification sections.
* Career-pathway information.
* Application and verification checklists.
* Related jobs and internships.
* Related career resources.
* Relevant disclaimers and notices.

Maintain readable text, adequate contrast, consistent spacing, and clear visual hierarchy.

4. Shared assets

Images are referenced under:

/assets/images/

Use the established shared assets where appropriate, including:

Asset	Path
Brand logo	/assets/images/logo/medorbits-logo.png
Homepage hero image	/assets/images/hero/hero-home.jpg
Global education background	/assets/images/backgrounds/education-global.jpg
Image placeholder	/assets/images/placeholders/image-placeholder.svg
Global stylesheet	/assets/css/style.css
Constants	/assets/js/constants.js
Configuration	/assets/js/config.js
Utilities	/assets/js/utils.js
Navigation	/assets/js/navigation.js
Search	/assets/js/search.js
Animations	/assets/js/animations.js
Application initialization	/assets/js/app.js

Verify that every referenced asset exists and loads correctly.

Paths beginning with /assets/ are root-relative URLs. If the website is deployed under a subdirectory, confirm that the configured base path resolves these URLs correctly.

Use meaningful alternative text for informative images and approved fallbacks for missing optional assets.

5. Sector content requirements

Sector pages should provide accurate, useful information without presenting unsupported employment claims.

Where appropriate, include:

* Sector overview.
* Common role families.
* Typical responsibilities.
* Relevant qualifications and skills.
* Training and professional development.
* Experience and entry-level considerations.
* Career progression possibilities.
* Related jobs and internships.
* Application and employer-verification guidance.
* Relevant professional registration or licensing information.

Requirements vary by role, employer, jurisdiction, and qualification. Distinguish general industry guidance from mandatory eligibility requirements.

6. Sector-specific guidance

6.1 Healthcare

File: healthcare.html

Cover appropriate healthcare role families, qualification pathways, and application checks.

For regulated professions, verify current eligibility, recognition, registration, licensing, and scope-of-practice requirements with the relevant authority.

Do not imply that a qualification automatically permits professional practice in every jurisdiction.

6.2 Information technology

File: it.html

Cover relevant role families, technical skills, experience expectations, portfolio preparation, and professional development.

Distinguish common employer preferences from mandatory qualifications or certifications.

Do not guarantee that completing a course, certification, or portfolio will result in employment.

6.3 Banking and finance

File: finance.html

Cover relevant financial-services roles, qualification considerations, analytical skills, customer-facing responsibilities, and applicable compliance requirements.

Where a position requires specific licensing, registration, or regulatory approval, direct users to the relevant official authority.

6.4 Hospitality and tourism

File: hospitality.html

Cover hospitality operations, tourism, guest services, food service, event operations, and related career pathways where relevant.

Explain role-specific expectations such as shift work, customer service, practical training, and workplace requirements without assuming that every position has identical conditions.

6.5 Aviation and airport operations

File: aviation.html

Cover aviation and airport-related role families and the qualifications or training that may apply.

Clearly distinguish general airport employment from safety-sensitive or regulated aviation roles.

Verify current medical, licensing, training, security, and eligibility requirements with the relevant authority or employer before publishing specific claims.

6.6 Manufacturing and engineering

File: manufacturing.html

Cover manufacturing operations, production, maintenance, engineering, quality assurance, and related career pathways.

Explain applicable technical skills, practical experience, safety training, and role-specific qualifications.

Do not imply that one qualification is sufficient for every engineering or industrial role.

6.7 Logistics and supply chain

File: logistics.html

Cover logistics, transportation, warehousing, inventory, procurement, distribution, and supply-chain operations.

Explain relevant operational, analytical, communication, and technology skills. Identify licensing or safety requirements when they apply to specific roles.

6.8 Other industries

File: others.html

Provide an organized directory of additional industries and pathways that do not yet have dedicated pages.

Avoid duplicating complete sector guides. Link to the most relevant existing guide or resource where possible.

Create a dedicated sector page when the content has a distinct audience, sufficient verified information, and a clear maintenance owner.

7. Job and internship integration

Sector pages may direct users to the Career Module’s employment listings.

Canonical job directory:

/career/jobs.html

Related destinations may include:

/career/job-categories.html
/career/internships.html
/career/resources/
/career/locations/

These paths assume deployment at /career/. Verify all links against the actual routing and hosting configuration.

Listing requirements

* Use approved backend records or explicitly approved public datasets.
* Display current vacancies only when their publication and validity requirements are satisfied.
* Distinguish general sector guidance from individual job listings.
* Do not invent employers, salaries, vacancies, or application links.
* Remove or flag expired and withdrawn opportunities.
* Direct applicants to the appropriate verified application channel.
* Apply the relevant privacy and authorization controls to non-public information.

A link to the job directory does not establish that a particular employer is recruiting.

8. Data integrity and source quality

Sector information should be reviewed before publication.

For material factual claims:

* Prefer official regulators, professional bodies, institutions, and employer sources.
* Distinguish verified facts from general advice.
* Record applicable publication or review dates where needed.
* Update outdated qualifications and regulatory requirements.
* Avoid unsupported salary or hiring-demand claims.
* Correct misleading or superseded information promptly.

Where sector content is driven by assets/data/sectors.json, preserve the canonical sector identifiers and related course references. Avoid maintaining conflicting copies of the same factual records across HTML pages and JSON datasets.

9. Accessibility and responsive behavior

All sector pages should:

* Use semantic HTML and logical heading levels.
* Support keyboard navigation.
* Provide visible focus indicators.
* Maintain sufficient contrast.
* Use descriptive link text and appropriate image alternatives.
* Avoid horizontal overflow.
* Support mobile, tablet, and desktop layouts.
* Handle long role names and content gracefully.
* Respect reduced-motion preferences.

Test cards, tables, navigation, and related-listing sections at narrow viewport widths.

10. Security and user trust

Sector pages are public informational content.

Never include:

* Private applicant or employer information.
* Authentication credentials or tokens.
* Internal API secrets.
* Confidential recruitment documents.
* Unpublished personal contact details.

If a page contains a form or authenticated workflow, handle sensitive information through the appropriate secured backend service.

Validate external URLs and use rel=“noopener noreferrer” for links opened in a new browsing context.

Never rely on frontend visibility or client-side checks as a substitute for server-side authorization.

11. Installation and routing

The intended public directory is:

/career/sectors/

Expected URLs include:

/career/sectors/
/career/sectors/healthcare.html
/career/sectors/it.html
/career/sectors/finance.html
/career/sectors/hospitality.html
/career/sectors/aviation.html
/career/sectors/manufacturing.html
/career/sectors/logistics.html
/career/sectors/others.html

Verify the deployed URLs, internal links, shared assets, and navigation behavior in the actual hosting environment.

Copying the directory does not by itself configure server routing or establish that backend integrations are operational.

12. Validation and release checklist

* [ ]	All documented sector pages exist.
* [ ]	Shared header, announcement bar, navigation, and footer render correctly.
* [ ]	Rosewood Elite styling is consistent.
* [ ]	Shared CSS, JavaScript, logo, and images load.
* [ ]	Job and resource links resolve correctly.
* [ ]	Role descriptions and qualification information are appropriately sourced.
* [ ]	Regulated-role requirements are verified with relevant authorities.
* [ ]	No unsupported vacancies, salary claims, or employment guarantees appear.
* [ ]	Dataset references use canonical identifiers.
* [ ]	Responsive behavior and accessibility have been checked.
* [ ]	No private information or secrets are exposed.
* [ ]	Pages are tested using the actual deployment paths.

13. Maintenance

When adding or updating a sector page:

1. Update this README and the sector directory.
2. Reuse shared MedOrbits components and design tokens.
3. Verify assets, internal links, and public routes.
4. Review factual claims and relevant regulatory sources.
5. Check integration with jobs, internships, locations, and resources.
6. Test accessibility and responsive layouts.
7. Remove outdated or unsupported information.
8. Verify that no sensitive data is exposed.
9. Update related data schemas and consumers when required.
10. Test the page in the deployed environment.

14. Disclaimer

MedOrbits sector guides provide general career information. They do not guarantee employment, salary, eligibility, professional recognition, or recruitment outcomes.

Requirements differ by employer, position, jurisdiction, and applicable regulation. Users should independently verify qualifications, professional registration, vacancies, and material employment terms before making decisions.

⸻

Ownership: MedOrbits project maintainers
Directory: career/sectors/
Design system: Rosewood Elite
Content policy: Accurate, appropriately sourced, accessible, and non-misleading career guidance.