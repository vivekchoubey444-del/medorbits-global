MedOrbits Support Centre

Support Directory · Technical Documentation

Project: MedOrbits
Module: Support Centre
Directory: /support/
Primary page: /support/index.html
Documentation: /support/README.md
Website: https://medorbits.in
Design system: Ruby Noir · Neon Coral · Champagne Blush
Document version: 1.0.0

⸻

1. Overview

The MedOrbits Support Centre is the central entry point for users seeking assistance with website navigation, account access, document uploads, payments, refund enquiries, complaints, support tickets, and privacy-related questions.

This directory provides a consistent support experience across dedicated pages, with clear navigation, accessible interactions, responsive layouts, and privacy-conscious guidance.

The Support Centre is an informational interface. Ticket creation, ticket tracking, payment verification, account recovery, and refund processing require the relevant functional page and any necessary backend integration.

2. Objectives

* Provide a centralized directory of support resources.
* Help users identify the correct page for their issue.
* Offer keyword-based support-topic discovery.
* Provide direct access to frequently used support pages.
* Explain the recommended process for preparing a support request.
* Protect users from sharing unnecessary sensitive information.
* Maintain consistent branding, navigation, and accessibility across support pages.
* Support mobile, tablet, laptop, and desktop screen sizes.

3. Directory Structure

The following structure describes the intended support module. Confirm that every referenced page exists before publishing links to it.

support/
├── README.md
├── index.html
├── account-recovery.html
├── complaints.html
├── document-upload-help.html
├── faq.html
├── help-centre.html
├── payment-support.html
├── refund-request.html
├── submit-ticket.html
└── ticket-status.html

Page responsibilities

File	Purpose
index.html	Main Support Centre and support directory
account-recovery.html	Guidance for account access and recovery
complaints.html	Complaint and grievance guidance
document-upload-help.html	Document preparation and upload troubleshooting
faq.html	Frequently asked support questions
help-centre.html	General help resources and service guidance
payment-support.html	Payment enquiries and transaction troubleshooting
refund-request.html	Refund request preparation and relevant policy guidance
submit-ticket.html	Support request submission interface
ticket-status.html	Existing ticket lookup and status interface
README.md	Module documentation, route inventory, and maintenance guidance

Implementation note: This is the intended directory structure, not a verified inventory of deployed files.

4. Design System

The Support Centre uses the Ruby Noir visual identity, combining deep burgundy surfaces, neon coral accents, champagne-blush typography, and restrained animated elements.

Colour tokens

Token	Value	Usage
—bg	#10020a	Main background
—bg-soft	#1c0410	Secondary background
—surface	#2c0718	Card surfaces
—surface-2	#430b24	Elevated surfaces
—surface-3	#5a1030	Highlighted surfaces
—accent	#ff285f	Primary accent
—accent-hot	#ff174f	Strong accent
—accent-soft	#ff7899	Secondary accent
—accent-light	#ffe3eb	Highlighted text
—text	#fff5f8	Primary text
—text-soft	#f6cbd8	Secondary text
—muted	#c99aaa	Supporting text
—success	#a8ebc7	Success-state colour
—warning	#f7d79c	Warning-state colour

Typography

* DM Sans: Body text, navigation, buttons, labels, and interface elements.
* Playfair Display: Main headings and selected editorial elements.
* Fallback fonts: Arial and Georgia for resilient rendering.

Layout standards

* Maximum content width: 1180px.
* Standard card corner radius: 18px.
* Mobile-first responsive behavior at defined breakpoints.
* Soft gradients and layered backgrounds.
* Visible borders and strong text contrast.
* Consistent spacing, button styling, and hover states.
* Reduced-motion support for users who request less animation.

Do not introduce pure-white section backgrounds or transparent sections that conflict with the established design system.

5. Main Page Components

The main page at /support/index.html contains the following sections.

5.1 Announcement bar

Displays the Support Centre identity and the message:

Guidance · Assistance · Service information

5.2 Responsive navigation

Provides access to the main website sections:

* Home
* Education
* Admissions
* Careers
* About
* Support
* Contact

Dropdown menus expose related destinations. The navigation collapses into a mobile menu at narrower viewport widths.

5.3 Hero section

Introduces the Support Centre with a primary heading, explanatory text, a decorative animated illustration, and two primary actions:

* Explore support topics
* Submit a support ticket

The illustration is decorative and should remain hidden from assistive technology.

5.4 Support search

The search component supports keyword filtering across support-topic cards.

Example queries:

* document
* refund
* payment
* account
* ticket
* complaint
* privacy

Search behavior is client-side and filters the predefined cards. It does not search a database, external knowledge base, or ticket-management system.

5.5 Support directory

Displays twelve support-related cards, including document help, FAQs, payment support, refund requests, complaints, ticket submission, ticket status, account recovery, contact information, privacy, and legal policies.

Each card contains an icon, title, description, and destination link.

5.6 Quick-access shortcuts

Provides direct links to commonly used support actions, reducing the number of navigation steps required.

5.7 Support process

Explains a four-step process:

1. Choose the relevant support topic.
2. Prepare the required details.
3. Use a verified channel.
4. Keep any reference number received.

5.8 Privacy notice

Warns users not to disclose passwords, one-time passwords (OTPs), PINs, recovery codes, or complete payment credentials.

Users should only submit documents necessary for the particular request.

5.9 Frequently asked questions

Uses native HTML <details> and <summary> elements for expandable answers. This provides a lightweight accordion interface without requiring a separate JavaScript accordion library.

5.10 Contact panel and footer

Provides the published contact address, contact-page link, education resources, career services, support destinations, and legal policies.

The footer also includes a support disclaimer explaining that the directory itself does not create tickets or process refunds.

6. Navigation and URL Conventions

The Support Centre uses root-relative paths so that internal links do not depend on the current page’s directory.

Examples:

/support/index.html
/support/faq.html
/support/document-upload-help.html
/support/payment-support.html
/support/refund-request.html
/support/submit-ticket.html
/support/ticket-status.html
/support/account-recovery.html
/support/complaints.html
/pages/contact.html
/legal/privacy-policy.html
/legal/terms-and-conditions.html
/legal/refund-policy.html
/legal/disclaimer.html

Link maintenance rules

1. Use root-relative paths for internal website destinations.
2. Preserve consistent naming and URL conventions across pages.
3. Verify that every destination exists before release.
4. Avoid placeholder links and non-functional navigation.
5. Use the correct canonical URL for each indexable page.
6. Ensure breadcrumb links reflect the actual page hierarchy.
7. Update navigation, shortcuts, and footer links together when routes change.

The routes above are documented destinations and must not be treated as proof that the corresponding files or backend features already exist.

7. JavaScript Functionality

The main page uses a self-contained JavaScript module.

Navigation

The navigation script manages:

* Opening and closing the mobile menu.
* Updating aria-expanded attributes.
* Opening and closing dropdown menus.
* Closing navigation with the Escape key.
* Closing menus when the user clicks outside them.
* Closing navigation after a link is selected.
* Updating the header appearance when scrolling.

Support-topic search

The search script:

* Reads the user’s search query.
* Normalizes the query to lowercase.
* Searches card text and data-search keywords.
* Hides non-matching cards.
* Updates the number of matching results.
* Displays an empty-state message when no topics match.
* Clears the search and restores all cards.
* Scrolls to the support directory when the form is submitted.

Current year

The footer year is generated dynamically from the browser’s local date.

Dependencies

The supplied implementation uses native browser APIs and does not require a frontend framework.

Google Fonts are loaded externally. A system-font fallback remains available if the font service cannot be reached.

8. Accessibility Requirements

Maintain the following accessibility practices across the Support Centre.

* Use semantic HTML landmarks: header, nav, main, section, and footer.
* Provide a working skip-to-content link.
* Associate form labels with their controls.
* Maintain keyboard access to menus, forms, links, and FAQs.
* Show visible focus indicators.
* Keep button labels descriptive.
* Use aria-expanded and aria-controls where appropriate.
* Announce search results through a live region.
* Use sufficient contrast between text, backgrounds, and interactive elements.
* Respect prefers-reduced-motion.
* Supply meaningful alternative text for informative images.
* Hide decorative imagery from assistive technology.
* Avoid relying on colour alone to convey status or meaning.

Accessibility should be tested using keyboard navigation, a screen reader, browser zoom, and mobile viewport sizes.

9. Privacy and Security

The Support Centre must not request or expose sensitive information unnecessarily.

User-facing safeguards

* Never request account passwords or OTPs through support messages.
* Do not ask users to disclose full payment-card credentials.
* Avoid publishing private ticket details in publicly accessible URLs.
* Do not place sensitive information in query strings.
* Verify the destination before users upload documents.
* Provide appropriate privacy-policy links.
* Collect only the information required to investigate the reported issue.

Implementation safeguards

If support forms are connected to a backend, implement appropriate server-side validation, access control, secure session management, CSRF protection where applicable, rate limiting, and safe file-upload handling.

File uploads should enforce permitted file types, size limits, server-side content validation, and appropriate storage permissions. Consider malware scanning and private document storage where applicable.

Do not store API secrets, database credentials, authentication tokens, or private configuration values in this directory’s public frontend files.

10. Functional Boundaries

The main Support Centre page is a navigation and informational interface.

Feature	Main page behavior	Additional implementation
Support-topic search	Filters existing cards locally	Search service only if broader search is required
FAQ accordion	Expands and collapses answers	None for basic functionality
Mobile navigation	Opens and closes the menu	None for basic functionality
Ticket submission	Links to the submission page	Form handling and backend integration
Ticket status	Links to the status page	Authorized ticket lookup
Refund request	Links to refund guidance	Review and processing workflow
Account recovery	Links to recovery guidance	Secure authentication and recovery workflow
Payment support	Links to payment guidance	Transaction verification where required
Document upload	Links to upload guidance	Secure upload implementation where required
Complaints	Links to complaint guidance	Submission, tracking, and review workflow where required

Do not display a success message, ticket reference, payment confirmation, or refund status unless the relevant system has actually confirmed the result.

11. Search Engine Metadata

The supplied main page includes:

* A descriptive page title.
* A meta description.
* A canonical URL.
* A robots directive.
* A theme colour.
* A favicon.
* Language and viewport declarations.

Each indexable support page should have a unique title and description that accurately reflect its content.

For the documentation file, search-engine metadata is not applicable in the same way as it is to an HTML page. Markdown documentation is primarily intended for maintainers and repository users.

12. Quality Assurance Checklist

Before releasing changes to the Support Centre, verify the following.

Structure and navigation

* [ ]	The main page loads successfully.
* [ ]	All linked support pages exist or have an intentional unavailable-state page.
* [ ]	Navigation dropdowns work with mouse, touch, and keyboard.
* [ ]	The mobile menu opens and closes correctly.
* [ ]	Breadcrumbs point to valid destinations.
* [ ]	Footer links match the current website routes.
* [ ]	No unintended localhost URLs remain.

Search and interactions

* [ ]	Searching for a known keyword returns relevant cards.
* [ ]	Clearing the search restores every card.
* [ ]	An unmatched query displays the empty state.
* [ ]	Search result announcements are accessible.
* [ ]	FAQ items expand and collapse.
* [ ]	No JavaScript errors appear in the browser console.

Responsive design

* [ ]	Layout works at 320px, 375px, 768px, 1024px, and desktop widths.
* [ ]	Cards fit the available viewport.
* [ ]	Long links and text do not cause horizontal overflow.
* [ ]	Buttons remain usable on touchscreens.
* [ ]	The sticky header does not obscure important content.

Security and accessibility

* [ ]	No credentials or secrets are embedded in frontend code.
* [ ]	Sensitive information is not requested unnecessarily.
* [ ]	Keyboard focus remains visible.
* [ ]	Reduced-motion preferences are respected.
* [ ]	Contrast and screen-reader behavior are checked.
* [ ]	Forms and backend integrations are tested independently.

13. Maintenance Guidelines

When adding or updating a support page:

1. Create the page using the established MedOrbits visual system.
2. Add the route to the appropriate navigation, directory card, shortcut, or footer section.
3. Verify the destination and any associated form behavior.
4. Add relevant keywords to the support card’s search metadata.
5. Review privacy, accessibility, and mobile usability.
6. Update this README when the directory structure or implemented functionality changes.
7. Run the applicable quality checks before deployment.

Keep the support directory concise, task-oriented, and consistent with the rest of the website.

14. Disclaimer

This README documents the intended structure and behavior of the MedOrbits Support Centre based on its supplied page implementation. It does not establish that all linked pages, integrations, or backend services are deployed or operational.

Users should follow the instructions published on the relevant page and verify applicable admission, employment, payment, refund, and privacy information with the responsible organization where necessary.

⸻

MedOrbits Support Centre
Study · Career · Consultancy

Website: https://medorbits.in
Support contact: contact@medorbits.in