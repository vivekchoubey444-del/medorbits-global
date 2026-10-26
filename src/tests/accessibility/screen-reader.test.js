
/**
 * MedOrbits -- Screen Reader Accessibility Tests
 * File: tests/accessibility/screen-reader.test.js
 * Runtime: Node.js >= 20, ESM.
 *
 * Static checks:
 *   node --test tests/accessibility/screen-reader.test.js
 *
 * Browser dependencies:
 *   npm install --save-dev playwright @axe-core/playwright
 *   npx playwright install chromium
 *
 * Environment:
 *   ACCESSIBILITY_HTML_DIR=.
 *   ACCESSIBILITY_HTML_FILES=index.html,about.html
 *   ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000
 *   ACCESSIBILITY_ROUTES=/,/about,/courses
 *   ACCESSIBILITY_REQUIRE_BROWSER=false
 *   ACCESSIBILITY_TIMEOUT_MS=10000
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TEST_DIR, '../..');

function resolveInsideRoot(base, value) {
  const resolved = path.resolve(base, value);
  const relative = path.relative(base, resolved);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Path must remain inside its configured directory: ${value}`,
    );
  }

  return resolved;
}

const HTML_DIR = resolveInsideRoot(
  ROOT_DIR,
  process.env.ACCESSIBILITY_HTML_DIR || '.',
);

const HTML_FILES = (
  process.env.ACCESSIBILITY_HTML_FILES || 'index.html'
)
  .split(',')
  .map((file) => file.trim())
  .filter(Boolean);

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || '/')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const REQUIRE_BROWSER =
  (process.env.ACCESSIBILITY_REQUIRE_BROWSER || 'false').toLowerCase() ===
  'true';

const TIMEOUT_MS = Number(
  process.env.ACCESSIBILITY_TIMEOUT_MS || 10000,
);

function resolveHtmlFile(file) {
  return resolveInsideRoot(HTML_DIR, file);
}

function readHtml(file) {
  const resolved = resolveHtmlFile(file);

  assert.ok(
    fs.existsSync(resolved),
    `Configured HTML file not found: ${resolved}`,
  );

  assert.ok(
    fs.statSync(resolved).isFile(),
    `Configured HTML path is not a file: ${resolved}`,
  );

  return fs.readFileSync(resolved, 'utf8');
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Lightweight static scanner for accessibility screening.
 * It is not a full HTML parser. Browser DOM and axe-core checks
 * provide more reliable validation of rendered accessibility.
 */
function tokenizeHtml(html) {
  const source = stripComments(html).replace(
    /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );

  const tokens = [];
  const pattern = /<([a-z][\w:-]*)\b([^>]*)>/gi;

  for (const match of source.matchAll(pattern)) {
    tokens.push({
      tag: match[1].toLowerCase(),
      attrs: match[2] || '',
      raw: match[0],
    });
  }

  return tokens;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getAttribute(attrs, name) {
  const escaped = escapeRegExp(name);

  const pattern = new RegExp(
    `(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );

  const match = attrs.match(pattern);

  return match
    ? (match[1] ?? match[2] ?? match[3] ?? '')
    : null;
}

function hasAttribute(attrs, name) {
  const escaped = escapeRegExp(name);

  return new RegExp(
    `(?:^|\\s)${escaped}(?=\\s|=|\\/?>|$)`,
    'i',
  ).test(attrs);
}

function hasNonEmptyAttribute(attrs, name) {
  const value = getAttribute(attrs, name);

  return value !== null && value.trim().length > 0;
}

function getOpeningTags(html, tagName) {
  return tokenizeHtml(html).filter(
    (token) => token.tag === tagName,
  );
}

function getIds(html) {
  return tokenizeHtml(html)
    .map((token) => getAttribute(token.attrs, 'id'))
    .filter((id) => id !== null && id.trim() !== '');
}

function getLabelForValues(html) {
  return getOpeningTags(html, 'label')
    .map((token) => getAttribute(token.attrs, 'for'))
    .filter((value) => value !== null && value.trim() !== '');
}

function getFormControls(html) {
  return tokenizeHtml(html).filter((token) => {
    if (!['input', 'select', 'textarea'].includes(token.tag)) {
      return false;
    }

    if (token.tag !== 'input') {
      return true;
    }

    const type = (
      getAttribute(token.attrs, 'type') || 'text'
    ).toLowerCase();

    return ![
      'hidden',
      'submit',
      'reset',
      'button',
      'image',
    ].includes(type);
  });
}

function checkUniqueIds(html) {
  const seen = new Set();
  const duplicates = new Set();

  for (const id of getIds(html)) {
    if (seen.has(id)) {
      duplicates.add(id);
    }

    seen.add(id);
  }

  return [...duplicates];
}

function checkLabelReferences(html) {
  const ids = new Set(getIds(html));

  return getLabelForValues(html).filter(
    (id) => !ids.has(id),
  );
}

function checkAriaReferences(html) {
  const ids = new Set(getIds(html));
  const issues = [];

  const referenceAttributes = [
    'aria-labelledby',
    'aria-describedby',
    'aria-controls',
    'aria-owns',
  ];

  for (const token of tokenizeHtml(html)) {
    for (const attribute of referenceAttributes) {
      const value = getAttribute(token.attrs, attribute);

      if (!value) {
        continue;
      }

      for (const id of value.trim().split(/\s+/)) {
        if (id && !ids.has(id)) {
          issues.push({
            element: token.tag,
            attribute,
            id,
          });
        }
      }
    }
  }

  return issues;
}

function checkHeadingStructure(html) {
  const headings = tokenizeHtml(html)
    .filter((token) => /^h[1-6]$/.test(token.tag))
    .map((token) => Number(token.tag.slice(1)));

  const issues = [];

  if (headings.length === 0) {
    issues.push('No semantic h1–h6 headings found.');
    return issues;
  }

  if (!headings.includes(1)) {
    issues.push('No h1 heading found.');
  }

  if (headings.filter((level) => level === 1).length > 1) {
    issues.push(
      'Multiple h1 elements found; review the document heading structure.',
    );
  }

  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) {
      issues.push(
        `Heading level jumps from h${headings[index - 1]} ` +
          `to h${headings[index]}.`,
      );
    }
  }

  return issues;
}

function checkLandmarks(html) {
  const tokens = tokenizeHtml(html);

  const mainCount = tokens.filter(
    (token) =>
      token.tag === 'main' ||
      getAttribute(token.attrs, 'role') === 'main',
  ).length;

  const issues = [];

  if (mainCount === 0) {
    issues.push('No main landmark found.');
  }

  if (mainCount > 1) {
    issues.push('Multiple main landmarks found.');
  }

  const hasNavigation = tokens.some(
    (token) =>
      token.tag === 'nav' ||
      getAttribute(token.attrs, 'role') === 'navigation',
  );

  if (!hasNavigation) {
    issues.push(
      'No navigation landmark found; verify whether navigation is required.',
    );
  }

  return issues;
}

function checkImages(html) {
  return getOpeningTags(html, 'img')
    .filter((image) => {
      // Every img needs an alt attribute. An empty alt is valid for
      // decorative images; missing alt is not equivalent to empty alt.
      return !hasAttribute(image.attrs, 'alt');
    })
    .map((image) => image.raw);
}

function checkFormControls(html) {
  const controls = getFormControls(html);
  const ids = new Set(getIds(html));
  const explicitLabels = new Set(getLabelForValues(html));
  const issues = [];

  for (const control of controls) {
    const id = getAttribute(control.attrs, 'id');
    const labelledBy = getAttribute(
      control.attrs,
      'aria-labelledby',
    );
    const ariaLabel = getAttribute(control.attrs, 'aria-label');

    const hasExplicitLabel = Boolean(
      id && explicitLabels.has(id),
    );

    const hasAriaLabel = Boolean(ariaLabel?.trim());

    const hasValidLabelledBy = Boolean(
      labelledBy?.trim() &&
        labelledBy
          .trim()
          .split(/\s+/)
          .every((reference) => ids.has(reference)),
    );

    if (
      !hasExplicitLabel &&
      !hasAriaLabel &&
      !hasValidLabelledBy
    ) {
      issues.push(
        `${control.tag} may lack an accessible name. ` +
          'Check for a wrapping label or valid ARIA naming attributes.',
      );
    }

    if (labelledBy) {
      for (const reference of labelledBy.trim().split(/\s+/)) {
        if (reference && !ids.has(reference)) {
          issues.push(
            `${control.tag} references missing aria-labelledby ` +
              `ID "${reference}".`,
          );
        }
      }
    }
  }

  return issues;
}

function checkInteractiveNames(html) {
  const issues = [];

  for (const token of tokenizeHtml(html)) {
    const type = (
      getAttribute(token.attrs, 'type') || 'text'
    ).toLowerCase();

    const role = (
      getAttribute(token.attrs, 'role') || ''
    ).toLowerCase();

    const interactive =
      token.tag === 'button' ||
      token.tag === 'select' ||
      token.tag === 'textarea' ||
      (
        token.tag === 'input' &&
        !['hidden', 'submit', 'reset', 'button', 'image'].includes(type)
      ) ||
      (token.tag === 'input' && ['submit', 'reset', 'button'].includes(type)) ||
      (token.tag === 'a' && hasAttribute(token.attrs, 'href')) ||
      [
        'button',
        'link',
        'checkbox',
        'radio',
        'switch',
        'tab',
        'menuitem',
      ].includes(role);

    if (!interactive) {
      continue;
    }

    const hasNameAttribute =
      hasNonEmptyAttribute(token.attrs, 'aria-label') ||
      hasNonEmptyAttribute(token.attrs, 'aria-labelledby') ||
      hasNonEmptyAttribute(token.attrs, 'title') ||
      (token.tag === 'input' &&
        type === 'image' &&
        hasNonEmptyAttribute(token.attrs, 'alt'));

    // Text content and associated labels cannot be reliably determined
    // from an opening-tag-only scan. Report this as a static screening
    // heuristic rather than a definitive accessible-name failure.
    if (!hasNameAttribute) {
      const hasTextLabel = ['button', 'a'].includes(token.tag);

      if (!hasTextLabel) {
        issues.push(
          `${token.tag} may need an accessible name. ` +
            'Verify its rendered accessible name in browser mode.',
        );
      }
    }
  }

  return issues;
}

function checkAriaHiddenFocusables(html) {
  const issues = [];

  for (const token of tokenizeHtml(html)) {
    if (
      getAttribute(token.attrs, 'aria-hidden')?.toLowerCase() !== 'true'
    ) {
      continue;
    }

    const type = (
      getAttribute(token.attrs, 'type') || ''
    ).toLowerCase();

    const role = (
      getAttribute(token.attrs, 'role') || ''
    ).toLowerCase();

    const tabindex = getAttribute(token.attrs, 'tabindex');

    const nativelyFocusable =
      ['button', 'select', 'textarea'].includes(token.tag) ||
      (token.tag === 'a' && hasAttribute(token.attrs, 'href')) ||
      (token.tag === 'input' && type !== 'hidden');

    const explicitlyFocusable =
      tabindex !== null &&
      Number.isFinite(Number(tabindex)) &&
      Number(tabindex) >= 0;

    const roleFocusable = [
      'button',
      'link',
      'checkbox',
      'radio',
      'switch',
      'tab',
      'menuitem',
    ].includes(role);

    if (
      nativelyFocusable ||
      explicitlyFocusable ||
      roleFocusable
    ) {
      issues.push(
        `Potentially focusable element is marked aria-hidden="true": ` +
          token.raw,
      );
    }
  }

  return issues;
}

function runStaticChecks(file) {
  const html = readHtml(file);
  const tokens = tokenizeHtml(html);

  assert.ok(
    tokens.length > 0,
    `${file}: no recognizable HTML tags found.`,
  );

  const duplicateIds = checkUniqueIds(html);
  const missingLabelTargets = checkLabelReferences(html);
  const missingAriaReferences = checkAriaReferences(html);
  const headingIssues = checkHeadingStructure(html);
  const landmarkIssues = checkLandmarks(html);
  const missingAlt = checkImages(html);
  const formIssues = checkFormControls(html);
  const interactiveNameIssues = checkInteractiveNames(html);
  const hiddenFocusableIssues = checkAriaHiddenFocusables(html);

  assert.deepEqual(
    duplicateIds,
    [],
    `${file}: duplicate IDs: ${duplicateIds.join(', ')}`,
  );

  assert.deepEqual(
    missingLabelTargets,
    [],
    `${file}: label[for] references missing IDs: ` +
      missingLabelTargets.join(', '),
  );

  assert.deepEqual(
    missingAriaReferences,
    [],
    `${file}: broken ARIA references: ` +
      JSON.stringify(missingAriaReferences, null, 2),
  );

  assert.deepEqual(
    missingAlt,
    [],
    `${file}: images missing alt attributes: ` +
      missingAlt.join('; '),
  );

  assert.deepEqual(
    hiddenFocusableIssues,
    [],
    `${file}: potentially focusable elements hidden from assistive ` +
      `technology: ${hiddenFocusableIssues.join('; ')}`,
  );

  assert.deepEqual(
    headingIssues,
    [],
    `${file}: heading issues: ${headingIssues.join(' ')}`,
  );

  assert.deepEqual(
    landmarkIssues,
    [],
    `${file}: landmark issues: ${landmarkIssues.join(' ')}`,
  );

  assert.deepEqual(
    formIssues,
    [],
    `${file}: possible form-label issues: ${formIssues.join(' ')}`,
  );

  assert.deepEqual(
    interactiveNameIssues,
    [],
    `${file}: possible interactive-name issues: ` +
      interactiveNameIssues.join(' '),
  );
}

function validateConfiguration() {
  assert.ok(
    Number.isInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'ACCESSIBILITY_TIMEOUT_MS must be a positive integer.',
  );

  assert.ok(
    HTML_FILES.length > 0,
    'At least one static HTML file must be configured.',
  );

  assert.ok(
    ROUTES.length > 0,
    'At least one browser route must be configured.',
  );

  for (const file of HTML_FILES) {
    assert.ok(
      file.trim().length > 0,
      'Static HTML file names must not be empty.',
    );

    resolveHtmlFile(file);
  }

  for (const route of ROUTES) {
    assert.ok(
      route.startsWith('/'),
      `Browser route must start with "/": ${route}`,
    );

    const parsed = new URL(
      route,
      'http://accessibility.invalid',
    );

    assert.equal(
      parsed.origin,
      'http://accessibility.invalid',
      `Browser route must remain on the configured origin: ${route}`,
    );
  }

  if (BASE_URL) {
    let parsed;

    try {
      parsed = new URL(BASE_URL);
    } catch {
      assert.fail(
        'ACCESSIBILITY_BASE_URL must be a valid HTTP(S) URL.',
      );
    }

    assert.ok(
      ['http:', 'https:'].includes(parsed.protocol),
      'ACCESSIBILITY_BASE_URL must use HTTP or HTTPS.',
    );

    assert.ok(
      !parsed.username && !parsed.password,
      'Do not include credentials in ACCESSIBILITY_BASE_URL.',
    );
  }

  if (REQUIRE_BROWSER) {
    assert.ok(
      BASE_URL,
      'ACCESSIBILITY_REQUIRE_BROWSER=true requires ACCESSIBILITY_BASE_URL.',
    );
  }
}

async function loadBrowserDependencies() {
  const { chromium } = await import('playwright');
  const axeModule = await import('@axe-core/playwright');
  const AxeBuilder = axeModule.default ?? axeModule;

  return { chromium, AxeBuilder };
}

function getRouteUrl(baseUrl, route) {
  const url = new URL(route, baseUrl);

  assert.equal(
    url.origin,
    new URL(baseUrl).origin,
    `Route must stay on the configured test origin: ${route}`,
  );

  return url.href;
}

// -----------------------------------------------------------------------------
// Static test registration
// -----------------------------------------------------------------------------

test('screen-reader accessibility configuration is valid', () => {
  validateConfiguration();
});

for (const file of HTML_FILES) {
  test(`static screen-reader accessibility checks: ${file}`, (t) => {
    const resolved = resolveHtmlFile(file);

    if (!fs.existsSync(resolved)) {
      t.skip(`Configured HTML file not found: ${resolved}`);
      return;
    }

    runStaticChecks(file);
  });
}

// -----------------------------------------------------------------------------
// Browser checks
// -----------------------------------------------------------------------------

test('browser accessibility audit with axe-core', async (t) => {
  if (!BASE_URL) {
    if (REQUIRE_BROWSER) {
      assert.fail(
        'Browser checks are required, but ACCESSIBILITY_BASE_URL is not set.',
      );
    }

    t.skip('Set ACCESSIBILITY_BASE_URL to enable browser checks.');
    return;
  }

  let dependencies;

  try {
    dependencies = await loadBrowserDependencies();
  } catch (error) {
    if (REQUIRE_BROWSER) {
      assert.fail(
        'Browser dependencies are required. Run: ' +
          'npm install --save-dev playwright @axe-core/playwright ' +
          '&& npx playwright install chromium. ' +
          `Details: ${error.message}`,
      );
    }

    t.skip(
      'Playwright or @axe-core/playwright is not installed.',
    );
    return;
  }

  const { chromium, AxeBuilder } = dependencies;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.setDefaultTimeout(TIMEOUT_MS);

    try {
      for (const route of ROUTES) {
        const url = getRouteUrl(BASE_URL, route);

        await t.test(`axe accessibility scan: ${route}`, async () => {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: TIMEOUT_MS,
          });

          assert.ok(
            response,
            `No HTTP response received for ${url}`,
          );

          assert.ok(
            response.status() < 400,
            `${url} returned HTTP ${response.status()}`,
          );

          const results = await new AxeBuilder({ page })
            .withTags([
              'wcag2a',
              'wcag2aa',
              'wcag21a',
              'wcag21aa',
              'wcag22aa',
              'best-practice',
            ])
            .analyze();

          const violations = results.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          }));

          assert.deepEqual(
            violations,
            [],
            `axe-core violations on ${url}:\n` +
              JSON.stringify(violations, null, 2),
          );
        });

        await t.test(
          `rendered screen-reader semantics: ${route}`,
          async () => {
            const response = await page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: TIMEOUT_MS,
            });

            assert.ok(
              response,
              `No HTTP response received for ${url}`,
            );

            const result = await page.evaluate(() => {
              function accessibleName(element) {
                const labelledBy = element.getAttribute(
                  'aria-labelledby',
                );

                if (labelledBy) {
                  const referencedText = labelledBy
                    .split(/\s+/)
                    .map(
                      (id) =>
                        document.getElementById(id)?.textContent || '',
                    )
                    .join(' ')
                    .trim();

                  if (referencedText) {
                    return referencedText;
                  }
                }

                const ariaLabel = element.getAttribute('aria-label');

                if (ariaLabel?.trim()) {
                  return ariaLabel.trim();
                }

                const title = element.getAttribute('title');

                if (title?.trim()) {
                  return title.trim();
                }

                if (
                  element instanceof HTMLInputElement &&
                  element.type === 'image'
                ) {
                  return element.alt.trim();
                }

                if (
                  element instanceof HTMLInputElement &&
                  ['submit', 'reset', 'button'].includes(element.type)
                ) {
                  return (element.value || '').trim();
                }

                if (
                  element instanceof HTMLInputElement &&
                  element.labels?.length
                ) {
                  const labelText = [...element.labels]
                    .map((label) =>
                      (label.innerText || label.textContent || '').trim(),
                    )
                    .filter(Boolean)
                    .join(' ');

                  if (labelText) {
                    return labelText;
                  }
                }

                return (
                  element.innerText ||
                  element.textContent ||
                  ''
                ).trim();
              }

              const mainCount = document.querySelectorAll(
                'main, [role="main"]',
              ).length;

              const headings = [
                ...document.querySelectorAll(
                  'h1, h2, h3, h4, h5, h6',
                ),
              ].map((element) => ({
                level: Number(element.tagName.slice(1)),
                text: (
                  element.innerText ||
                  element.textContent ||
                  ''
                ).trim(),
              }));

              const interactiveSelector = [
                'button',
                'a[href]',
                'input:not([type="hidden"])',
                'select',
                'textarea',
                '[role="button"]',
                '[role="link"]',
                '[role="checkbox"]',
                '[role="radio"]',
                '[role="switch"]',
                '[role="tab"]',
                '[role="menuitem"]',
              ].join(',');

              const unnamedControls = [
                ...document.querySelectorAll(interactiveSelector),
              ]
                .filter((element) => {
                  if (
                    element.disabled ||
                    element.getAttribute('aria-disabled') === 'true'
                  ) {
                    return false;
                  }

                  return !accessibleName(element);
                })
                .map((element) => element.outerHTML.slice(0, 300));

              const imagesMissingAlt = [
                ...document.querySelectorAll('img:not([alt])'),
              ].map((element) => element.outerHTML.slice(0, 300));

              const brokenReferences = [];

              for (const element of document.querySelectorAll(
                '[aria-labelledby], [aria-describedby], ' +
                  '[aria-controls], [aria-owns]',
              )) {
                for (const attribute of [
                  'aria-labelledby',
                  'aria-describedby',
                  'aria-controls',
                  'aria-owns',
                ]) {
                  const value = element.getAttribute(attribute);

                  if (!value) {
                    continue;
                  }

                  for (const id of value.trim().split(/\s+/)) {
                    if (id && !document.getElementById(id)) {
                      brokenReferences.push({
                        attribute,
                        id,
                        element: element.outerHTML.slice(0, 200),
                      });
                    }
                  }
                }
              }

              const allIds = [
                ...document.querySelectorAll('[id]'),
              ].map((element) => element.id);

              const duplicateIds = allIds.filter(
                (id, index) => allIds.indexOf(id) !== index,
              );

              const formControlsWithoutLabels = [
                ...document.querySelectorAll(
                  'input:not([type="hidden"]):not([type="submit"]):' +
                    'not([type="reset"]):not([type="button"]):not([type="image"]), ' +
                    'select, textarea',
                ),
              ]
                .filter((element) => {
                  const hasNativeLabel = Boolean(
                    element.labels?.length,
                  );

                  const hasAriaName = Boolean(
                    element.getAttribute('aria-label')?.trim() ||
                      element.getAttribute('aria-labelledby')?.trim(),
                  );

                  return !hasNativeLabel && !hasAriaName;
                })
                .map((element) => element.outerHTML.slice(0, 300));

              return {
                mainCount,
                headings,
                unnamedControls,
                imagesMissingAlt,
                brokenReferences,
                duplicateIds,
                formControlsWithoutLabels,
              };
            });

            assert.equal(
              result.mainCount,
              1,
              `${url}: expected exactly one main landmark.`,
            );

            assert.ok(
              result.headings.some(
                (heading) =>
                  heading.level === 1 && heading.text.length > 0,
              ),
              `${url}: expected a non-empty h1.`,
            );

            assert.deepEqual(
              result.unnamedControls,
              [],
              `${url}: controls without detectable accessible names:\n` +
                JSON.stringify(result.unnamedControls, null, 2),
            );

            assert.deepEqual(
              result.imagesMissingAlt,
              [],
              `${url}: images missing alt attributes:\n` +
                JSON.stringify(result.imagesMissingAlt, null, 2),
            );

            assert.deepEqual(
              result.brokenReferences,
              [],
              `${url}: broken ARIA references:\n` +
                JSON.stringify(result.brokenReferences, null, 2),
            );

            assert.deepEqual(
              [...new Set(result.duplicateIds)],
              [],
              `${url}: duplicate IDs: ${[
                ...new Set(result.duplicateIds),
              ].join(', ')}`,
            );

            assert.deepEqual(
              result.formControlsWithoutLabels,
              [],
              `${url}: form controls without labels:\n` +
                JSON.stringify(
                  result.formControlsWithoutLabels,
                  null,
                  2,
                ),
            );
          },
        );
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
});
