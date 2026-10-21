MedOrbits Social Icons

Directory: assets/icons/social/
Category: Social Media and Digital Communication
Brand: MedOrbits
Design System: Royal Burgundy and Champagne Gold
Primary Format: SVG
Access: Public frontend assets

⸻

1. Purpose

The assets/icons/social/ directory contains reusable icons for social media platforms, social sharing, community engagement, and digital communication across the MedOrbits website.

These icons support website headers, footers, contact pages, social-sharing controls, promotional landing pages, educational campaigns, and other approved communication interfaces.

The collection should prioritize recognizable platform branding, consistent rendering, accessibility, lightweight assets, and safe integration.

2. Directory Structure

The following is the proposed icon inventory. Create and publish only the icons required by the application.

assets/icons/social/
├── README.md
├── social.svg
├── share.sag
├── share-link.svg
├── copy-link.svg
├── email.svg
├── whatsapp.svg
├── telegram.svg
├── instagram.svg
├── facebook.svg
├── youtube.svg
├── linkedin.svg
├── x.svg
├── pinterest.svg
├── reddit.svg
├── threads.svg
├── tiktok.svg
├── snapchat.svg
├── discord.svg
├── messenger.svg
├── phone.svg
├── contact.svg
├── community.svg
├── follow.svg
├── external-link.svg
├── link.svg
├── newsletter.svg
├── feedback.svg
└── qr-code.svg

Inventory note: This list defines the intended collection, not confirmation that every SVG file already exists.

3. Icon Catalogue

Icon	Intended use
social.svg	General social media and community sections.
share.svg	Share controls and sharing interfaces.
share-link.svg	Share a page or resource through a link.
copy-link.svg	Copy a URL to the clipboard.
email.svg	Email contact or email-sharing actions.
whatsapp.svg	WhatsApp contact or sharing links.
telegram.svg	Telegram contact or sharing links.
instagram.svg	Instagram profile links and social promotion.
facebook.svg	Facebook profile or page links.
youtube.svg	YouTube channel and video links.
linkedin.svg	LinkedIn company and professional links.
x.svg	Links to profiles or content on X.
pinterest.svg	Pinterest profile or approved content-sharing links.
reddit.svg	Reddit community or content links.
threads.svg	Threads profile or content links.
tiktok.svg	TikTok profile and video links.
snapchat.svg	Snapchat profile or contact links.
discord.svg	Discord community links.
messenger.svg	Messenger contact links.
phone.svg	Telephone contact actions.
contact.svg	General contact information.
community.svg	Community and audience-engagement sections.
follow.svg	Follow prompts and social profile links.
external-link.svg	Indicate navigation to an external destination.
link.svg	General hyperlink actions.
newsletter.svg	Newsletter and email-subscription sections.
feedback.svg	Feedback and user-engagement interfaces.
qr-code.svg	QR-code-related interface elements.

Platform-specific icons should represent the intended service accurately. General communication and sharing icons should remain visually distinct from official platform logos.

4. Brand and Visual Design

Social icons must integrate with the MedOrbits Royal Burgundy and Champagne Gold design system without compromising platform recognition.

Design standards

* Use the existing MedOrbits design tokens where possible.
* Use Burgundy and Champagne Gold for general social and interface icons.
* Preserve recognizable platform-brand colours when an official platform logo is required.
* Use transparent backgrounds by default.
* Maintain consistent sizing, alignment, and visual weight.
* Prefer simple SVG geometry and optimized vector paths.
* Keep icons legible at small sizes.
* Avoid decorative effects that reduce contrast or distort recognizable logos.

Platform-branding rule: Do not recolour official platform marks in a way that makes them unrecognizable or violates applicable brand guidelines. Use monochrome variants only where permitted and appropriate.

5. SVG Technical Standards

Each published icon should:

1. Use valid, optimized SVG markup.
2. Use a consistent viewBox, preferably 0 0 24 24 for standard interface icons.
3. Scale cleanly without distortion.
4. Avoid unnecessary metadata and excessive path complexity.
5. Use transparent backgrounds unless a particular asset requires otherwise.
6. Avoid embedded raster images when a vector implementation is practical.
7. Contain no scripts, embedded event handlers, or unsafe external references.
8. Be reviewed for visual accuracy and licensing or brand-use requirements.

Example SVG structure for a general interface icon:

<svg
  xmlns=“http://www.w3.org/2000/svg”
  viewBox=“0 0 24 24”
  fill=“none”
  stroke=“currentColor”
  stroke-width=“1.75”
  stroke-linecap=“round”
  stroke-linejoin=“round”
  aria-hidden=“true”
>
  <!— Insert reviewed SVG paths here. —>
</svg>

This is a structural example, not a complete social media icon. Replace the comment with valid SVG geometry before publishing.

For official platform logos, use the correct approved logo asset rather than drawing an approximate substitute.

6. Usage in HTML

For an HTML page located one directory below the project root:

<a
  href=“https://www.instagram.com/“
  target=“_blank”
  rel=“noopener noreferrer”
  aria-label=“Visit Instagram”
>
  <img
    src=“../assets/icons/social/instagram.svg”
    alt=“”
    width=“24”
    height=“24”
    loading=“lazy”
  />
</a>

This is an illustrative example. Replace the generic destination with the actual approved MedOrbits profile URL.

Adjust the relative asset path according to the HTML page’s actual location. Confirm that the SVG exists before referencing it.

Accessibility

* Give icon-only links accessible names.
* Use empty alternative text for icons when the parent link or button already provides the accessible name.
* Provide meaningful alternative text when an image communicates information independently.
* Ensure focus indicators remain visible.
* Do not use colour alone to communicate the purpose or status of a control.

7. Safe Social Sharing

Social-sharing features should follow these requirements:

* Use official platform URLs and supported sharing mechanisms.
* Validate dynamically generated destination URLs.
* Encode user-generated text and URLs correctly when constructing share links.
* Avoid exposing private account information or sensitive application details in share URLs.
* Do not automatically publish, follow, like, message, or post on behalf of a user without the appropriate authorized workflow.
* Use rel=“noopener noreferrer” for applicable links opened in a new browsing context.
* Keep social sharing optional and clearly labelled.

Do not treat an icon click as proof that content was successfully shared. External platforms may require authentication, confirmation, or additional user action.

8. Integration with MedOrbits

Use the social icon collection across:

* Website headers and footers.
* Contact and support pages.
* Official social profile links.
* Course and education resource sharing.
* Career guides and downloadable resources.
* Promotional and campaign landing pages.
* Newsletter subscription sections.
* Community and engagement interfaces.
* Approved contact and communication workflows.

Integration principles

* Reuse the same icon consistently across pages.
* Prefer an existing shared icon when an equivalent is already available.
* Avoid duplicate icons that differ only by size.
* Keep official profile destinations in the appropriate site configuration or content source when supported.
* Do not hardcode personal or temporary social account URLs into reusable icon assets.
* Keep social icons separate from brand logos and general UI icons where the repository already provides dedicated directories.

Icons represent destinations or actions; the associated HTML, JavaScript, and backend integration must implement the actual functionality.

9. Security and Privacy

* Sanitize externally sourced SVG files before publication.
* Avoid SVG scripts, embedded event handlers, and unsafe external references.
* Do not include authentication tokens, private profile details, or sensitive user data in share URLs.
* Validate URLs supplied through content management or configuration systems.
* Avoid collecting unnecessary tracking information.
* Follow applicable privacy and consent requirements for embedded social widgets and third-party integrations.
* Prefer simple external links over embedded third-party widgets when embedding is unnecessary.

Public SVG assets must not contain private configuration or secrets.

10. Naming Conventions

Use lowercase, descriptive, hyphen-separated filenames.

Examples:

* instagram.svg
* share-link.svg
* copy-link.svg
* external-link.svg
* newsletter.svg

Use official service names consistently. Avoid ambiguous abbreviations, spaces, duplicate variants, and unnecessary version numbers.

Before creating a new icon, check whether a suitable asset already exists in assets/icons/ or the shared icon library.

11. Quality Assurance Checklist

Before publishing or updating a social icon, verify:

* [ ]	The filename follows the naming convention.
* [ ]	The SVG markup is valid and optimized.
* [ ]	The icon is recognizable and visually consistent.
* [ ]	Platform logos comply with applicable brand-use requirements.
* [ ]	No unsafe active content or external references are present.
* [ ]	Accessible names are provided by the consuming interface.
* [ ]	External links use appropriate destinations and security attributes.
* [ ]	Social-sharing URLs do not expose sensitive information.
* [ ]	The asset path resolves correctly.
* [ ]	The README reflects the actual inventory.

12. Maintenance

Whenever an icon is added, renamed, replaced, or removed:

1. Update the directory inventory.
2. Update the icon catalogue.
3. Check all references across website headers, footers, and social-sharing interfaces.
4. Verify the official platform logo and destination where applicable.
5. Test keyboard accessibility and link behaviour.
6. Remove obsolete references only after confirming that no pages depend on them.

Do not list planned icons as available assets until their SVG files have been created and reviewed.

⸻

Module objective: Provide a consistent, accessible, privacy-conscious, and maintainable social icon library for MedOrbits, supporting official social links, content sharing, community engagement, and digital communication within the platform’s design system.