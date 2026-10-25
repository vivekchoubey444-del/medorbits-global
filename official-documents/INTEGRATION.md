MedOrbits Official Documents — Integration Guide

Document: official-documents/INTEGRATION.md
Purpose: Safely connect the Official Documents pages to the shared resource dataset and progressive-enhancement JavaScript without changing the existing page design.

────────

1. Integration files

Keep the current HTML pages and CSS files in their existing locations. Add or maintain these shared assets:

|File                                          |Responsibility                                                                                                                             |
|-———————————————|-——————————————————————————————————————————————|
|`assets/js/official-documents.js`             |Search, category filtering, resource enhancement, rails, mobile navigation, and checklist/progress interactions where supported by the page|
|`assets/data/official-document-resources.json`|Curated resource records used to enhance the static HTML                                                                                   |
|`assets/images/documents/`                    |Locally hosted resource imagery, where used                                                                                                |
|`official-documents/*.html`                   |Individual document pages; retain their current paths and page-specific content                                                            |

Use root-relative paths when the site is deployed at the domain root. If the site is hosted under a subpath, adjust asset URLs to match the deployment base path.

2. HTML integration

Resource dataset

Add the dataset path to the page’s <body>. Use standard straight quotes, not typographic (“smart”) quotes:

<body data-resources-json=“/assets/data/official-document-resources.json”>

If the page already has a <body> tag with attributes, add data-resources-json to that existing tag rather than creating a second body element.

JavaScript

Load the shared script with defer, preferably near the end of <head>. Do not include the same script twice.

<script src=“/assets/js/official-documents.js” defer></script>

If the page already loads a bundled script that includes this module, do not add a duplicate standalone include.

Required element IDs

The script may use these IDs to locate page controls. Preserve the exact spelling and avoid duplicate IDs:

|ID                |Purpose                          |
|——————|———————————|
|`currentYear`     |Dynamic copyright year           |
|`menuToggle`      |Mobile navigation toggle         |
|`mainNav`         |Main navigation container        |
|`documentSearch`  |Resource search input            |
|`documentCategory`|Category filter                  |
|`resetDocuments`  |Reset search and filter controls |
|`documentStatus`  |Accessible status/results message|
|`documentGrid`    |Main resource-card container     |

A page that does not provide a particular feature may omit its related element, provided the JavaScript treats that element as optional. Do not add empty controls solely to satisfy this list.

For accessible navigation, the menu button should expose its state:

<button
  id=“menuToggle”
  type=“button”
  aria-controls=“mainNav”
  aria-expanded=“false”
>
  <span class=“sr-only”>Toggle navigation</span>
</button>

Adapt the button’s visible icon and styling to the existing design. The script should update aria-expanded when the menu opens or closes. Ensure the menu remains usable with a keyboard and at narrow viewport widths.

For search, use a real label and a live status region:

<label for=“documentSearch”>Search resources</label>
<input id=“documentSearch” type=“search” autocomplete=“off”>

<p id=“documentStatus” role=“status” aria-live=“polite”></p>

Keep the existing page’s visual treatment; these examples illustrate the semantic requirements, not a replacement layout.

3. Resource cards and rails

Static cards

Static HTML cards are the baseline content and must remain useful if JavaScript or the JSON request fails. Use .resource-card for each resource card and a matching data-category value:

<article class=“resource-card” data-category=“education” data-resource-id=“example-resource”>
  <h3>Official resource</h3>
  <p>A short explanation of this resource.</p>
  <a href=“https://example.gov/“>Open official resource</a>
</article>

data-resource-id is recommended so a JSON record can be matched to an existing static card. IDs must be unique within the page. Do not let a fetched record create a second card for an already-present resource.

Rails / carousels

Use .resource-rail on each rail wrapper and .resource-track on the element that actually scrolls horizontally. The previous/next controls use data-rail-prev and data-rail-next.

<section class=“resource-rail” aria-label=“Additional resources”>
  <button type=“button” data-rail-prev aria-label=“Scroll to previous resources”>
    Previous
  </button>

  <div class=“resource-track” tabindex=“0”>
    <!— .resource-card elements —>
  </div>

  <button type=“button” data-rail-next aria-label=“Scroll to next resources”>
    Next
  </button>
</section>

Controls should be associated with the correct rail. If the page contains multiple rails, verify that each control operates only on its intended .resource-track. Use native horizontal scrolling and avoid trapping keyboard focus. Consider honoring prefers-reduced-motion when applying smooth scrolling.

4. JSON data contract

The dataset is a UTF-8 JSON file with a top-level resources array. This is a valid illustrative record; replace it with verified production data.

{
  “resources”: [
    {
      “id”: “example-resource”,
      “title”: “Official resource”,
      “category”: “education”,
      “categoryLabel”: “Education records”,
      “description”: “A short explanation of this resource.”,
      “url”: “https://example.gov/“,
      “linkLabel”: “Open official resource”,
      “image”: “/assets/images/documents/example.jpg”,
      “imageAlt”: “Description of the image”,
      “icon”: “▤”,
      “keywords”: [“records”, “education”],
      “rail”: “additional”,
      “railLabel”: “Additional resources”
    }
  ]
}

Field reference

|Field          |Required              |Expected value                                                              |
|—————|———————:|-—————————————————————————|
|`id`           |Yes                   |Stable, unique string for deduplication                                     |
|`title`        |Yes                   |Plain-text resource title                                                   |
|`category`     |Yes                   |Stable category key matching the page’s filter values                       |
|`categoryLabel`|Recommended           |Human-readable category label                                               |
|`description`  |Yes                   |Plain-text description                                                      |
|`url`          |Yes                   |Verified `https://` or other explicitly permitted HTTP(S) URL               |
|`linkLabel`    |Recommended           |Clear link text describing the destination                                  |
|`image`        |No                    |Local path or validated HTTP(S) image URL                                   |
|`imageAlt`     |Recommended with image|Meaningful alternative text; use an empty string only for a decorative image|
|`icon`         |No                    |Short text or a safe, predefined icon token                                 |
|`keywords`     |No                    |Array of plain-text search terms                                            |
|`rail`         |No                    |Stable rail key for a known rail                                            |
|`railLabel`    |No                    |Human-readable rail label                                                   |

Do not assume an optional field exists. The JavaScript should validate record types, handle missing optional fields, and skip malformed records without breaking the rest of the page.

5. Categories and filtering

The category value is a machine-readable key, not a display label. Values in the JSON must exactly match the corresponding <option value=“…”> and static-card data-category values.

Example:

<select id=“documentCategory”>
  <option value=“all”>All categories</option>
  <option value=“education”>Education records</option>
  <option value=“admissions”>Admissions and counselling</option>
  <option value=“identity”>Identity documents</option>
</select>

In this example, records and cards should use education, admissions, or identity, not their display labels. If the site’s existing category values differ, retain the existing values and update the JSON to match them.

Search should be case-insensitive and, where practical, search the title, description, category label, and keywords. Reset should restore the default search and category values and update the results status.

6. Progressive enhancement and safe rendering

Follow these requirements in official-documents.js:

1. Keep static content available. If fetch() fails, the response is not successful, or JSON parsing fails, preserve existing HTML cards and show a helpful status message only if it does not obscure page content.
2. Deduplicate records. Compare stable IDs from data-resource-id and JSON id values. Do not duplicate static cards.
3. Validate links. Allow only explicitly permitted http: and https: URLs. For official resources, prefer HTTPS. Reject javascript:, data:, file:, and other unsafe schemes.
4. Validate images separately. Only render images from allowed local paths or validated HTTP(S) URLs. Add meaningful alt text and lazy loading where appropriate.
5. Render text safely. Insert titles, labels, descriptions, and keywords as text using textContent or text nodes. Do not interpolate untrusted values into innerHTML.
6. Use safe link behavior. If an external link opens a new tab, set rel=“noopener noreferrer” alongside target=“_blank”. Do not force new tabs without a clear reason.
7. Handle malformed records. Check that each record is an object and that fields have expected types. Skip invalid entries rather than failing the whole dataset.
8. Avoid duplicate initialization. The script should be safe if the page’s existing integration accidentally invokes initialization more than once, or should clearly guard against it.
9. Respect existing page content. Do not replace the page’s cards, navigation, footer, or styling wholesale. Add enhancement behavior to the current markup.
10. Keep controls optional. Pages can share the script while omitting controls for features they do not use; missing optional elements should not throw runtime errors.

For external links, “official” should be established by editorial verification, not merely by a URL passing the HTTP(S) check.

7. Official-source verification

Before publishing a resource:

• Open the destination and confirm it belongs to the responsible authority or its explicitly linked service provider.
• Confirm the link is current, relevant to the stated purpose, and does not redirect to an unrelated domain.
• Prefer the authority’s own portal, current notification, prospectus, or information bulletin.
• Record the date checked in the team’s editorial workflow if the resource is time-sensitive.
• Never describe an illustrative URL or unverified destination as an official source.
• Recheck admission schedules, eligibility, fees, seat matrices, document lists, and refund rules against the latest applicable notice.

A resource listing is informational and must not imply admission, eligibility, allotment, or approval is guaranteed.

8. Accessibility and interaction checks

Test the following on desktop and mobile:

• Menu toggle works by keyboard and touch, updates aria-expanded, and does not hide navigation from keyboard users when closed/open states change.
• Search and category controls have accessible labels and can be operated without a mouse.
• The status region announces useful result counts and failure states without excessive repeated announcements.
• Focus indicators remain visible against the dark sapphire background.
• Rail controls scroll the intended track, and tracks remain touch-scrollable and keyboard-accessible.
• Cards reflow without horizontal page overflow at narrow widths.
• Images have appropriate alternative text; decorative imagery does not produce redundant announcements.
• Reduced-motion preferences are respected by automatic movement and smooth scrolling.
• Checklist controls, if present on the page, remain usable with a keyboard and have clear completion/reset states.

9. Test plan

Complete this checklist after integration:

☐ Confirm the HTML references the correct JSON path and JavaScript path.
☐ Confirm the script is loaded once and uses defer.
☐ Confirm all IDs are unique and correctly spelled.
☐ Confirm JSON parses as valid UTF-8 JSON and has a top-level resources array.
☐ Confirm every production URL has been verified and every category matches the filter options.
☐ Confirm existing static cards remain visible when JSON loading is blocked or the file returns an error.
☐ Confirm JSON records do not duplicate static cards.
☐ Confirm search, category filtering, reset, and result announcements work together.
☐ Confirm each previous/next button controls its own rail.
☐ Confirm unsafe URL schemes and malformed records are rejected safely.
☐ Confirm no resource field is interpreted as HTML.
☐ Confirm mobile navigation, keyboard navigation, focus states, and reduced-motion behavior.
☐ Check the browser console and network panel for failed assets, JavaScript errors, and incorrect response types.

10. Troubleshooting

|Symptom                           |Likely cause                                                      |Check                                                                              |
|-———————————|——————————————————————|————————————————————————————|
|JSON resources do not appear      |Wrong path, HTTP error, invalid JSON, or fetch blocked            |Open the JSON path directly and inspect the browser Network panel                  |
|Static cards disappear            |Enhancement replaces rather than augments the grid                |Keep static cards as baseline content; append only validated, non-duplicate records|
|Search returns no expected results|Category key mismatch or search fields omitted                    |Compare JSON `category` values with `<option value>` and `data-category`           |
|Duplicate cards appear            |IDs are absent or deduplication uses display titles inconsistently|Add stable `id` / `data-resource-id` values                                        |
|Rail buttons do nothing           |Wrong selector or controls are not scoped to the intended rail    |Confirm `.resource-rail`, `.resource-track`, `data-rail-prev`, and `data-rail-next`|
|Mobile menu state is inconsistent |`aria-expanded` is not synchronized with visual state             |Update the attribute on every open/close path                                      |
|Images fail to load               |Invalid URL, missing asset, or case-sensitive path mismatch       |Verify the path and response status on the deployed host                           |

11. Deployment notes

• Commit the HTML, JavaScript, JSON, CSS, and any local image assets together where practical.
• Confirm production paths work from every official-documents page.
• Serve JSON with an appropriate JSON content type and UTF-8 encoding.
• If Content Security Policy (CSP) is enabled, ensure the script and approved resource hosts are permitted by policy.
• Avoid storing secrets or private user data in this public resource dataset.
• Re-test after changes to the shared JavaScript because multiple pages may depend on the same module.

────────

Maintenance rule: Treat the existing HTML and CSS as the source of truth for page layout. This integration guide defines data and behavior contracts; it does not authorize replacing established page design or changing unrelated routes.