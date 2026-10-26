
# MedOrbits Accessibility Tests

**Directory:** `tests/accessibility/`  
**Primary standard:** WCAG 2.2 Level AA  
**Runtime:** Node.js >= 20, ES modules  
**Test runner:** Node.js built-in `node:test`

## 1. Purpose

The `tests/accessibility/` directory contains automated tests for accessibility across the MedOrbits platform.

The objective is to identify accessibility barriers affecting users with disabilities, including users who rely on screen readers, keyboard navigation, magnification, or other assistive technologies.

The test suite focuses on:

- WCAG 2.2 Level AA requirements.
- Semantic HTML and accessible names.
- Keyboard accessibility and focus management.
- Form labels, instructions, and validation feedback.
- Color contrast and non-color visual indicators.
- Navigation landmarks and heading hierarchy.
- Screen-reader compatibility.
- Homepage accessibility and primary user journeys.
- Responsive layouts and accessible interactive components.

Automated tests help identify common accessibility defects. They do not replace manual assistive-technology testing or a complete WCAG conformance evaluation.

## 2. Directory Structure

Expected test files:

```text
tests/
└── accessibility/
    ├── README.md
    ├── color-contrast.test.js
    ├── forms.accessibility.test.js
    ├── homepage.accessibility.test.js
    ├── keyboard-navigation.test.js
    ├── navigation.accessibility.test.js
    └── screen-reader.test.js
```

Keep this inventory synchronized with the actual repository.

The current test implementations use Node.js’s built-in test runner. Some files optionally use Playwright and `@axe-core/playwright` for browser-based checks.

## 3. Test Responsibilities

| File | Responsibility |
| — | — |
| `color-contrast.test.js` | Text contrast, visual indicators, and accessible color usage |
| `forms.accessibility.test.js` | Labels, required fields, instructions, error messages, and validation accessibility |
| `homepage.accessibility.test.js` | Homepage landmarks, headings, links, images, and primary interactions |
| `keyboard-navigation.test.js` | Keyboard access, focus visibility, logical focus order, and keyboard interaction |
| `navigation.accessibility.test.js` | Navigation landmarks, menus, accessible names, and current-page indicators |
| `screen-reader.test.js` | Semantic structure, accessible names, ARIA usage, and relationships |

These files define testing responsibilities. Actual coverage depends on their assertions, fixtures, configured routes, and application behavior.

## 4. Accessibility Standards

Use WCAG 2.2 Level AA as the primary accessibility target.

Important requirements include:

- Text alternatives for meaningful non-text content.
- Sufficient text and interface contrast.
- Keyboard accessibility.
- Visible keyboard focus.
- Logical focus order.
- Descriptive page titles and headings.
- Accessible form labels and error identification.
- Programmatic names, roles, and states.
- Reflow and zoom support.
- Accessible authentication and error recovery.
- Adequate target sizes where applicable.
- Consistent navigation and interaction behavior.

### Relevant references

- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [WAI Images Tutorial](https://www.w3.org/WAI/tutorials/images/)

## 5. Dependencies and Tooling

Use the accessibility tools already established in the project’s `package.json` and lockfile.

The current Node.js test files use:

- `node:test` for test execution.
- `node:assert/strict` for assertions.
- Playwright for optional browser automation.
- `@axe-core/playwright` for optional automated browser accessibility audits.

Do not add or replace dependencies without checking the existing package configuration.

If the browser dependencies are not installed, add them using the package manager already adopted by the repository. For an npm project:

```bash
npm install —save-dev playwright @axe-core/playwright
npx playwright install chromium
```

These dependencies are optional when running static tests only. Browser tests may be skipped when their dependencies are unavailable and browser testing is not required.

**Important:** `ACCESSIBILITY_REQUIRE_BROWSER=true` should be used in environments where Playwright and its browser binaries are installed and the application is available.

The Jest and Testing Library example later in this document is illustrative only. The current Node.js test files cannot be run directly with Jest without adapting their test framework and imports.

## 6. Running Accessibility Tests

Run the complete accessibility suite using Node.js’s built-in test runner:

```bash
node —test tests/accessibility/*.test.js
```

Run individual files:

```bash
node —test tests/accessibility/color-contrast.test.js

node —test tests/accessibility/forms.accessibility.test.js

node —test tests/accessibility/homepage.accessibility.test.js

node —test tests/accessibility/keyboard-navigation.test.js

node —test tests/accessibility/navigation.accessibility.test.js

node —test tests/accessibility/screen-reader.test.js
```

Use the repository’s existing npm scripts if they provide equivalent commands.

### Browser-based checks

Start the application in a dedicated test environment before running browser tests.

Example for a POSIX-compatible shell:

```bash
ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
ACCESSIBILITY_ROUTES=/,/about,/courses,/contact \
ACCESSIBILITY_REQUIRE_BROWSER=true \
ACCESSIBILITY_TIMEOUT_MS=15000 \
node —test tests/accessibility/*.test.js
```

Replace the example routes with actual application routes.

Individual test files may support additional environment variables. Check each file’s configuration before assuming that a variable is supported across the entire suite.

### Static HTML configuration

For the screen-reader test, the following variables configure the HTML fixtures:

```bash
ACCESSIBILITY_HTML_DIR=.
ACCESSIBILITY_HTML_FILES=index.html,about.html
```

The directory and file paths must correspond to the actual repository structure.

### Coverage reporting

Coverage reporting is not automatically provided by the commands above. Use the coverage tool already configured in the project, if one exists.

## 7. Automated Accessibility Assertions

Automated checks should be supplemented with explicit assertions for important application behavior.

For example, if MedOrbits uses Jest and Testing Library for a particular React component, a typical `jest-axe` test might look like this:

```javascript
‘use strict’;

const { render } = require(‘@testing-library/react’);
const { axe, toHaveNoViolations } = require(‘jest-axe’);

expect.extend(toHaveNoViolations);

test(‘renders without detectable accessibility violations’, async () => {
  const { container } = render(
    <main>
      <h1>MedOrbits</h1>
      <p>Education and admissions guidance.</p>
    </main>,
  );

  const results = await axe(container);

  expect(results).toHaveNoViolations();
});
```

This is an illustrative React/Jest example, not a command that can be assumed to work with the current Node.js test files.

Adapt testing to the actual MedOrbits architecture, whether the application uses static HTML, server-rendered pages, or React components.

## 8. Color Contrast

Test contrast using the actual foreground and background colors in the rendered interface.

WCAG 2.2 Level AA generally requires:

| Content | Minimum contrast ratio |
| — | —: |
| Normal text | 4.5:1 |
| Large text | 3:1 |
| Essential non-text interface components and graphical objects | 3:1 |

Large text generally means at least 18 pt regular or 14 pt bold, approximately 24 CSS pixels or 18.7 CSS pixels, respectively.

Test representative states, including:

- Default text and backgrounds.
- Links and interactive controls.
- Hover and focus states.
- Error and success messages.
- Disabled controls where applicable.
- Text over images and gradients.
- Dark and light themes, if supported.

Do not infer that a design is accessible merely because it uses a particular brand palette. Test the actual rendered color combinations.

## 9. Forms and Validation

Forms should provide accessible names, instructions, and understandable validation feedback.

Test that:

- Every input has an accessible label.
- Required fields are identified programmatically.
- Input errors identify the affected field.
- Error messages explain how to correct the problem.
- Instructions are associated with the relevant controls.
- Invalid submissions preserve entered information when appropriate.
- Keyboard users can reach and operate every control.
- Focus moves appropriately when error recovery requires it.
- Success and failure feedback is available to assistive technologies.
- Password and authentication controls have meaningful labels.

Placeholder text should not be the only label.

Where validation messages appear dynamically, verify their programmatic association and announcement behavior using both browser automation and manual assistive-technology testing.

## 10. Keyboard Navigation

Test the complete keyboard interaction model, not only whether elements can receive focus.

Verify that:

- Interactive elements are reachable using the keyboard.
- Focus order follows a meaningful sequence.
- Focus indicators remain visible.
- No keyboard trap prevents users from leaving a component.
- Menus, dialogs, tabs, and expandable controls support their expected keyboard interactions.
- Escape closes dismissible dialogs or overlays where appropriate.
- Focus is managed correctly when dialogs open and close.
- Custom controls implement the expected keyboard behavior.
- Sticky headers and overlays do not obscure focused elements.

Use real keyboard interaction tests for critical flows rather than relying exclusively on DOM inspection.

## 11. Navigation and Semantic Structure

Verify that pages provide a coherent structure for assistive technology.

Check for:

- A descriptive document title.
- A clear primary page heading.
- Logical heading levels.
- Appropriate `main`, `nav`, `header`, and `footer` landmarks.
- Descriptive link text.
- Accessible names for icon-only controls.
- Meaningful alternative text for informative images.
- Empty alternative text for decorative images.
- Accessible menu and disclosure states.
- Programmatically identified current-page navigation items.
- No unnecessary or conflicting ARIA attributes.

Use native HTML semantics wherever possible instead of recreating standard controls with custom elements.

## 12. Screen-Reader-Oriented Testing

DOM-based tests can verify accessible names, roles, states, and relationships. They cannot prove that a page works correctly with every screen reader.

Supplement automated tests with manual checks using supported combinations such as:

- NVDA with Firefox or Chrome.
- JAWS with a supported browser.
- VoiceOver with Safari on macOS or iOS.

Test important journeys, including:

- Homepage navigation.
- Course and institution search.
- Application forms.
- Authentication.
- Document upload and download.
- Payment initiation and confirmation.
- Error recovery and status announcements.

Pay particular attention to dynamic updates, validation messages, dialogs, expanded controls, and loading states.

## 13. Homepage Accessibility

The homepage test should evaluate the actual rendered homepage and its primary interactions.

Verify:

- A meaningful page title and primary heading.
- Correct semantic landmarks.
- Accessible navigation and search.
- Alternative text for meaningful images.
- Keyboard access to primary actions.
- Visible focus.
- Sufficient contrast.
- Accessible responsive navigation.
- No detectable critical or serious automated accessibility violations.

Avoid testing only a simplified mockup if the production homepage uses substantially different components or styles.

## 14. Test Environments and Fixtures

Accessibility tests should use stable, representative page content.

For browser-based tests:

- Start the application using the project’s test or preview server.
- Use deterministic fixtures.
- Disable or mock irrelevant external services.
- Wait for the page and dynamic content to reach a stable state.
- Avoid relying on live production data.
- Test important responsive viewports.
- Clean up browser resources after each test.

Automated DOM tests and browser-level tests should be clearly distinguished because they validate different aspects of the user experience.

## 15. Failure Triage

When a test fails:

1. Identify the page, component, and accessibility rule.
2. Reproduce the issue in the rendered interface.
3. Determine whether the defect is in markup, CSS, interaction behavior, or application state.
4. Correct the underlying accessibility issue.
5. Add or update a regression test.
6. Re-run the affected test and the complete accessibility suite.
7. Perform manual assistive-technology checks for high-impact changes.

Do not suppress an accessibility violation simply to make the test pass. If a rule is genuinely inapplicable, document the rationale and narrowly scope the exception.

## 16. Definition of Done

Accessibility work is ready for review when:

- [ ] All six listed test files exist and run.
- [ ] Critical user journeys have been tested.
- [ ] No unresolved critical accessibility barriers remain.
- [ ] Automated checks have been reviewed rather than blindly suppressed.
- [ ] Keyboard navigation has been tested.
- [ ] Forms and validation feedback are accessible.
- [ ] Color contrast has been checked against rendered styles.
- [ ] Screen-reader-oriented manual testing has been performed.
- [ ] Responsive layouts and zoom behavior have been checked.
- [ ] Failures have been documented and assigned for remediation.
- [ ] Tests run in the project’s CI pipeline.

Passing automated tests alone does not establish full WCAG conformance.

## 17. Maintenance

Update this README whenever accessibility tooling, test files, supported page templates, or test commands change.

The implemented UI, rendered behavior, WCAG requirements, and actual test configuration remain the sources of truth.
