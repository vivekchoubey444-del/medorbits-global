MedOrbits Career Resources — Rosewood Elite

Directory: career/resources/
Project: MedOrbits
Module: Career, Recruitment & Employer Services
Design system: Rosewood Elite — Dark Brown, Deep Forest Green & Antique Gold
Purpose: Public career-development resources, job-search guidance, and employment safety information.

⸻

1. Overview

The MedOrbits Career Resources directory contains educational materials designed to help students, graduates, job seekers, and working professionals prepare for employment and make informed career decisions.

Resources cover job-search planning, resume preparation, interview readiness, salary research, employer verification, and safer job-search practices.

The directory is part of the wider MedOrbits Career Module and reuses the existing career homepage as its structural and visual reference.

The objectives are to:

* Provide accessible career-development information.
* Help users prepare application materials.
* Improve interview preparation and job-search planning.
* Explain salary research and compensation comparisons.
* Promote independent employer and vacancy verification.
* Raise awareness of recruitment fraud and suspicious job offers.
* Maintain a consistent user experience across the Career Module.

Important: These resources provide general educational information. They do not guarantee interviews, employment, salary outcomes, or recruitment success.

2. Directory structure

career/
└── resources/
    ├── README.md
    ├── index.html
    ├── guides.html
    ├── resume-templates.html
    ├── interview-questions.html
    ├── salary-guide.html
    ├── job-fraud-awareness.html
    └── faqs.html

File responsibilities

File	Responsibility
index.html	Resource library landing page and navigation.
guides.html	Job-search planning, application checklists, networking, and offer evaluation.
resume-templates.html	Resume outlines for students, experienced professionals, career changers, and academic or healthcare profiles.
interview-questions.html	Interview question bank and preparation checklist.
salary-guide.html	Salary research methods, total-compensation comparison, and negotiation preparation.
job-fraud-awareness.html	Recruitment fraud warning signs, independent verification, and response steps.
faqs.html	Frequently asked questions about career resources and safer job searching.

Keep this inventory synchronized with the actual repository whenever files are added, removed, or renamed.

3. Design system and shared shell

3.1 Rosewood Elite palette

Use the established MedOrbits Rosewood Elite direction:

* Dark Brown: premium backgrounds and supporting surfaces.
* Deep Forest Green: primary visual surfaces and selected accents.
* Antique Gold: restrained highlights, emphasis, borders, and decorative details.

Preserve the existing website design tokens and shared components rather than introducing an unrelated design system.

3.2 Shared structural elements

Resource pages reuse the existing /career/index.html shell, including:

* Opening animation.
* Announcement strip.
* Brand logo.
* Sticky header and navigation.
* Shared footer.
* Global styles.
* Shared JavaScript initialization and utilities.

Page-specific styles should supplement the shared stylesheet instead of unnecessarily duplicating global styling or navigation logic.

3.3 Layout conventions

Use responsive layouts appropriate to each resource type:

* Resource cards for the library landing page.
* Numbered steps and checklists for job-search guides.
* Structured examples for resume templates.
* Question-and-answer sections for interview preparation.
* Tables for compensation comparisons.
* Clear warning and response sections for job-fraud awareness.
* Native disclosure elements for FAQs.

Keep text readable and avoid excessive visual decoration that interferes with the resource content.

4. Shared assets

The pages reference these shared assets:

Asset	Public path
MedOrbits logo	/assets/images/logo/medorbits-logo.png
Homepage hero image	/assets/images/hero/hero-home.jpg
Global stylesheet	/assets/css/style.css
Constants	/assets/js/constants.js
Configuration	/assets/js/config.js
Utilities	/assets/js/utils.js
Navigation	/assets/js/navigation.js
Search	/assets/js/search.js
Animations	/assets/js/animations.js
Application initialization	/assets/js/app.js

Verify that the logo and hero image exist at the specified paths and that all shared scripts load successfully.

The resource content is primarily text-based and does not require additional image files.

These paths are root-relative URLs. If the website is deployed under a subdirectory, ensure the application’s base-path configuration resolves them correctly.

5. Resource content requirements

5.1 Job-search guides

guides.html should explain practical job-search activities, including:

* Defining a target role and employment objective.
* Identifying relevant skills and qualification requirements.
* Preparing and tracking applications.
* Networking professionally.
* Researching prospective employers.
* Evaluating written offers and employment terms.

Checklists should help users assess readiness without implying that completing a checklist guarantees employment.

5.2 Resume templates

resume-templates.html should provide adaptable resume structures for different career stages.

Possible categories include:

* Students and recent graduates.
* Experienced professionals.
* Career changers.
* Academic applicants.
* Healthcare applicants.

Explain how users can tailor content to the target role while keeping information accurate.

Do not encourage fabricated qualifications, experience, certifications, references, or achievements.

5.3 Interview preparation

interview-questions.html should provide:

* Common interview questions.
* Role-relevant preparation prompts.
* Behavioral interview practice.
* Guidance for explaining experience and skills.
* Questions candidates may ask employers.
* A pre-interview preparation checklist.

Clearly distinguish illustrative practice questions from requirements imposed by a specific employer.

5.4 Salary research

salary-guide.html should explain how to research and compare compensation.

Relevant considerations include:

* Job title and responsibilities.
* Location and work arrangement.
* Experience and qualifications.
* Fixed and variable compensation.
* Benefits and allowances.
* Working hours and employment terms.
* Applicable taxes and deductions.
* Negotiation preparation.

Do not present unsupported salary figures as verified market data or guaranteed offers. Where figures are published, identify their source, applicable period, location, and limitations.

5.5 Job-fraud awareness

job-fraud-awareness.html should help users recognize and respond to potentially fraudulent recruitment activity.

Include guidance on:

* Verifying the employer independently.
* Checking official company websites and application channels.
* Reviewing email domains and communication details.
* Recognizing suspicious requests for money or sensitive documents.
* Avoiding disclosure of passwords, OTPs, or banking credentials.
* Preserving relevant evidence.
* Reporting suspected fraud through appropriate official channels.

Explain warning signs without claiming that a single indicator proves fraud in every case.

5.6 Frequently asked questions

faqs.html should address common questions about the resource library, resume preparation, job searching, interview preparation, salary research, and safer applications.

Answers should be concise, accurate, accessible, and consistent with the other resource pages.

6. Accessibility requirements

The shared shell and individual resource pages should support:

* A functional skip link.
* Semantic HTML landmarks.
* A logical heading hierarchy.
* Keyboard-friendly navigation.
* Visible focus indicators.
* Sufficient text and control contrast.
* Descriptive links and form labels where applicable.
* Native <details> and <summary> elements for disclosure-based FAQs.
* Reduced-motion preferences for animations.
* Responsive content that remains readable at different viewport sizes.

Do not rely on color alone to communicate warnings, success, or failure.

Ensure disclosure elements remain keyboard-operable and expose their expanded state correctly.

7. Installation and routing

Deploy the directory at:

/career/resources/

Expected public URLs include:

/career/resources/
/career/resources/guides.html
/career/resources/resume-templates.html
/career/resources/interview-questions.html
/career/resources/salary-guide.html
/career/resources/job-fraud-awareness.html
/career/resources/faqs.html

Internal links should use the intended deployment paths consistently.

Confirm that links to the parent Career Module and other resource pages resolve correctly in the actual hosting environment.

Copying the files into the correct directory does not by itself verify server routing, asset availability, or backend functionality.

8. Security and privacy

These pages are public educational resources.

Do not place credentials, private applicant information, confidential employer records, or internal API secrets in static HTML or public assets.

When adding external references:

* Use reliable and relevant sources.
* Verify that URLs are valid.
* Prefer official sources for regulatory or employment-related claims.
* Avoid misleading or deceptive links.
* Use rel=“noopener noreferrer” for external links opened in a new browsing context.

If the resource library later includes forms, saved user information, or downloadable personalized documents, implement the relevant privacy, validation, access-control, and retention requirements separately.

9. Maintenance and content governance

When adding or changing a resource:

1. Update this README and the resource index.
2. Follow the established Rosewood Elite design system.
3. Check factual accuracy and source reliability.
4. Remove outdated or misleading advice.
5. Verify internal and external links.
6. Check accessibility and responsive layouts.
7. Avoid unsupported salary or employment claims.
8. Ensure no private data or secrets are exposed.
9. Test the page in the deployed environment.
10. Update related Career Module documentation when navigation or shared assets change.

Review time-sensitive guidance periodically, especially information about recruitment fraud, employment requirements, and salary research.

10. Pre-deployment checklist

* [ ]	All documented resource pages exist.
* [ ]	The shared header, announcement strip, navigation, and footer render correctly.
* [ ]	The Rosewood Elite palette is applied consistently.
* [ ]	Logo, hero image, CSS, and JavaScript assets resolve.
* [ ]	Resource cards and navigation links work.
* [ ]	FAQ disclosures support keyboard interaction.
* [ ]	Reduced-motion behavior is respected.
* [ ]	Pages work on mobile, tablet, and desktop.
* [ ]	Salary information is sourced and appropriately qualified.
* [ ]	Job-fraud guidance is clear and actionable.
* [ ]	No fabricated reviews, qualifications, vacancies, or salary claims appear.
* [ ]	No secrets or private information are exposed.
* [ ]	All pages are tested using the actual deployment paths.

11. Disclaimer

MedOrbits Career Resources provide general educational information. They do not guarantee employment, interviews, compensation, recruitment outcomes, or employer legitimacy.

Users should independently verify employers, vacancies, salary information, qualifications, and material employment claims before making decisions.

⸻

Ownership: MedOrbits project maintainers
Directory: career/resources/
Design system: Rosewood Elite
Content policy: Accurate, accessible, safety-conscious, and appropriately sourced career guidance.