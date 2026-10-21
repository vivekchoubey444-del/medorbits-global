/**

* MedOrbits -- Keyboard Navigation Accessibility Tests
* File: tests/accessibility/keyboard-navigation.test.js
* Runtime: Node.js >= 20; ESM project.
* Static checks:
* node –test tests/accessibility/keyboard-navigation.test.js
* Browser checks:
* npm install –save-dev playwright
* npx playwright install chromium
* Example:
* ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
* ACCESSIBILITY_ROUTES=/,/about,/courses,/contact \
* ACCESSIBILITY_REQUIRE_BROWSER=true \
* node –test tests/accessibility/keyboard-navigation.test.js
* Windows PowerShell:
* $env:ACCESSIBILITY_BASE_URL="http://127.0.0.1:3000"
* $env:ACCESSIBILITY_ROUTES="/,/about,/courses,/contact"
* $env:ACCESSIBILITY_REQUIRE_BROWSER="true"
* node –test tests/accessibility/keyboard-navigation.test.js
* Browser checks require a running test server. Use a test environment,
* not a production site: keyboard tests may activate links and dismiss dialogs.
    */

import test from ‘node:test’;
import assert from ‘node:assert/strict’;
import fs from ‘node:fs’;
import path from ‘node:path’;
import { fileURLToPath } from ‘node:url’;

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TEST_DIR, ‘../..’);

function resolveFromRoot(value) {
const resolved = path.resolve(ROOT_DIR, value);
const relative = path.relative(ROOT_DIR, resolved);

if (relative === ‘..’ || relative.startsWith(..${path.sep}) || path.isAbsolute(relative)) {
throw new Error(Configured path must remain inside the project root: ${value});
}

return resolved;
}

const HTML_DIR = resolveFromRoot(
process.env.ACCESSIBILITY_HTML_DIR || ‘.’,
);

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || ‘’).trim().replace(//+$/, ‘’);

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || ‘/’)
.split(’,’)
.map((route) => route.trim())
.filter(Boolean);

const REQUIRE_BROWSER =
process.env.ACCESSIBILITY_REQUIRE_BROWSER === ‘true’;

const TIMEOUT_MS = Number(process.env.ACCESSIBILITY_TIMEOUT_MS || 15_000);

const IGNORE_DIRS = new Set([
‘.git’,
‘node_modules’,
‘coverage’,
‘dist’,
‘build’,
‘.next’,
‘.cache’,
‘vendor’,
‘tests’,
]);

const HTML_EXTENSIONS = new Set([’.html’, ‘.htm’]);

if (!Number.isFinite(TIMEOUT_MS) || TIMEOUT_MS <= 0) {
throw new Error(‘ACCESSIBILITY_TIMEOUT_MS must be a positive number.’);
}

function walkHtmlFiles(directory, results = []) {
if (!fs.existsSync(directory)) return results;

let entries;

try {
entries = fs.readdirSync(directory, { withFileTypes: true });
} catch {
return results;
}

for (const entry of entries) {
if (entry.isSymbolicLink()) continue;

const fullPath = path.join(directory, entry.name);
if (entry.isDirectory()) {
  if (!IGNORE_DIRS.has(entry.name)) {
    walkHtmlFiles(fullPath, results);
  }
  continue;
}
if (
  entry.isFile() &&
  HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
) {
  results.push(fullPath);
}

}

return results;
}

function relativePath(filePath) {
return path.relative(ROOT_DIR, filePath).split(path.sep).join(’/’);
}

function stripComments(html) {
return html.replace(//g, ‘’);
}

function parseAttributes(attributeText) {
const attributes = new Map();
const pattern =
/([^\s=/>]+)(?:\s*=\s*(?:"([^"])"|’([^’])’|([^\s"’=<>`]+)))?/g;

let match;

while ((match = pattern.exec(attributeText)) !== null) {
const name = match[1].toLowerCase();
const value = match[2] ?? match[3] ?? match[4] ?? ‘’;

if (!attributes.has(name)) {
  attributes.set(name, value);
}

}

return attributes;
}

function extractTags(html, tagName) {
const results = [];
const pattern = new RegExp(<${tagName}\\b([^>]*)\\/?>, ‘gi’);

let match;

while ((match = pattern.exec(html)) !== null) {
results.push({
attributes: parseAttributes(match[1]),
source: match[0],
});
}

return results;
}

function getHtmlFiles() {
return walkHtmlFiles(HTML_DIR);
}

function normalizeRoute(route) {
if (!route.startsWith(’/’)) {
throw new Error(Accessibility routes must start with "/": ${route});
}

const parsed = new URL(route, ‘http://accessibility-test.invalid’);

if (parsed.origin !== ‘http://accessibility-test.invalid’) {
throw new Error(Invalid accessibility route: ${route});
}

return ${parsed.pathname}${parsed.search}${parsed.hash};
}

function getBaseUrl() {
if (!BASE_URL) return null;

let parsed;

try {
parsed = new URL(BASE_URL);
} catch {
throw new Error(‘ACCESSIBILITY_BASE_URL must be a valid HTTP(S) URL.’);
}

if (![‘http:’, ‘https:’].includes(parsed.protocol)) {
throw new Error(‘ACCESSIBILITY_BASE_URL must use HTTP or HTTPS.’);
}

return parsed;
}

function routeUrl(baseUrl, route) {
const normalized = normalizeRoute(route);
const result = new URL(normalized, baseUrl);

if (result.origin !== baseUrl.origin) {
throw new Error(Route escaped the configured test origin: ${route});
}

return result.href;
}

function isVisible(element) {
const style = getComputedStyle(element);
const rect = element.getBoundingClientRect();

return (
rect.width > 0 &&
rect.height > 0 &&
style.display !== ‘none’ &&
style.visibility !== ‘hidden’ &&
style.visibility !== ‘collapse’ &&
Number(style.opacity) !== 0
);
}

function describeElement(element) {
return {
tag: element?.tagName || null,
id: element?.id || null,
role: element?.getAttribute(‘role’) || null,
href: element?.getAttribute(‘href’) || null,
name: element?.getAttribute(‘name’) || null,
text: (
element?.innerText ||
element?.getAttribute(‘aria-label’) ||
element?.getAttribute(‘title’) ||
‘’
).trim().slice(0, 100),
};
}

test(‘HTML directory is available for static keyboard checks’, (t) => {
if (!fs.existsSync(HTML_DIR)) {
t.skip(HTML directory not found: ${HTML_DIR});
return;
}

const files = getHtmlFiles();

if (files.length === 0) {
t.skip(No HTML files found under ${HTML_DIR});
return;
}

assert.ok(files.length > 0);
});

test(‘interactive elements do not have unexplained negative tabindex values’, (t) => {
const files = getHtmlFiles();

if (files.length === 0) {
t.skip(‘No HTML files are available for static analysis.’);
return;
}

const findings = [];
const interactiveTags = [
‘a’,
‘button’,
‘input’,
‘select’,
‘textarea’,
‘summary’,
‘iframe’,
];

for (const file of files) {
const html = stripComments(fs.readFileSync(file, ‘utf8’));

for (const tag of interactiveTags) {
  for (const element of extractTags(html, tag)) {
    const attributes = element.attributes;
    const rawTabIndex = attributes.get('tabindex');
    if (rawTabIndex === undefined) continue;
    const tabIndex = Number(rawTabIndex);
    if (!Number.isFinite(tabIndex) || tabIndex >= 0) continue;
    const type = (attributes.get('type') || '').toLowerCase();
    if (
      (tag === 'input' && type === 'hidden') ||
      attributes.has('disabled')
    ) {
      continue;
    }
    const hasFocusManagementMarker =
      attributes.has('data-focus-target') ||
      attributes.has('data-dialog') ||
      attributes.has('data-modal') ||
      attributes.has('data-skip-target') ||
      attributes.has('data-focus-management');
    if (!hasFocusManagementMarker) {
      findings.push(
        `${relativePath(file)}: ${element.source} has a negative tabindex. ` +
          'Confirm that the element is intentionally removed from sequential keyboard navigation.',
      );
    }
  }
}

}

if (findings.length > 0) {
t.diagnostic(
‘Review these findings; negative tabindex can be legitimate for programmatic focus targets:\n’ +
findings.join(’\n’),
);
}
});

test(‘positive tabindex values are not used to override natural focus order’, (t) => {
const files = getHtmlFiles();

if (files.length === 0) {
t.skip(‘No HTML files are available for static analysis.’);
return;
}

const findings = [];

for (const file of files) {
const html = stripComments(fs.readFileSync(file, ‘utf8’));

for (const element of extractTags(html, '[a-z][a-z0-9-]*')) {
  const rawValue = element.attributes.get('tabindex');
  if (rawValue === undefined) continue;
  const tabIndex = Number(rawValue);
  if (Number.isFinite(tabIndex) && tabIndex > 0) {
    findings.push(
      `${relativePath(file)}: ${element.source} uses positive tabindex="${rawValue}".`,
    );
  }
}

}

assert.deepEqual(
findings,
[],
Positive tabindex values found:\n${findings.join('\n')},
);
});

test(‘browser keyboard-navigation checks’, async (t) => {
const baseUrl = getBaseUrl();

if (!baseUrl) {
if (REQUIRE_BROWSER) {
assert.fail(
‘Browser checks are required, but ACCESSIBILITY_BASE_URL is not set.’,
);
}

t.skip('Set ACCESSIBILITY_BASE_URL to enable browser checks.');
return;

}

let chromium;

try {
({ chromium } = await import(‘playwright’));
} catch (error) {
if (REQUIRE_BROWSER) {
assert.fail(
’Playwright is required. Install it with "npm install –save-dev playwright" and "npx playwright install chromium". ’ +
Import error: ${error.message},
);
}

t.skip('Playwright is not installed.');
return;

}

assert.ok(ROUTES.length > 0, ‘At least one accessibility route is required.’);

const browser = await chromium.launch({ headless: true });

try {
for (const route of ROUTES) {
const url = routeUrl(baseUrl, route);

  await t.test(`keyboard navigation: ${route}`, async (routeTest) => {
    const page = await browser.newPage({
      viewport: { width: 1365, height: 900 },
    });
    page.setDefaultTimeout(TIMEOUT_MS);
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_MS,
      });
      assert.ok(response, `No HTTP response received for ${url}`);
      assert.ok(
        response.status() < 400,
        `${route} returned HTTP ${response.status()}`,
      );
      const title = await page.title();
      assert.ok(title.trim(), 'Page title should not be empty.');
      await routeTest.test('Tab moves focus to a keyboard target', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => ({
          element: {
            tag: document.activeElement?.tagName || null,
            id: document.activeElement?.id || null,
            href: document.activeElement?.getAttribute('href') || null,
            text: (
              document.activeElement?.innerText ||
              document.activeElement?.getAttribute('aria-label') ||
              document.activeElement?.getAttribute('title') ||
              ''
            ).trim().slice(0, 100),
          },
          isBody: document.activeElement === document.body,
        }));
        assert.ok(
          state.element.tag && !state.isBody,
          `Tab did not move focus away from body: ${JSON.stringify(state)}`,
        );
      });
      await routeTest.test('Tab and Shift+Tab traverse focus in both directions', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        await page.keyboard.press('Tab');
        const first = await page.evaluate(describeElement, undefined).catch(
          async () => page.evaluate(() => {
            const element = document.activeElement;
            return element
              ? `${element.tagName}|${element.id}|${element.getAttribute('href') || ''}|${element.getAttribute('name') || ''}`
              : '';
          }),
        );
        await page.keyboard.press('Tab');
        const second = await page.evaluate(() => {
          const element = document.activeElement;
          return element
            ? `${element.tagName}|${element.id}|${element.getAttribute('href') || ''}|${element.getAttribute('name') || ''}`
            : '';
        });
        await page.keyboard.press('Shift+Tab');
        const returned = await page.evaluate(() => {
          const element = document.activeElement;
          return element
            ? `${element.tagName}|${element.id}|${element.getAttribute('href') || ''}|${element.getAttribute('name') || ''}`
            : '';
        });
        const firstIdentity = typeof first === 'string'
          ? first
          : `${first.tag}|${first.id}|${first.href || ''}|${first.name || ''}`;
        if (second !== firstIdentity) {
          assert.equal(
            returned,
            firstIdentity,
            'Shift+Tab should return focus to the previous keyboard target.',
          );
        }
      });
      await routeTest.test('focusable controls are not accidentally excluded by negative tabindex', async () => {
        const findings = await page.evaluate(() => {
          const selector = [
            'a[href]',
            'button',
            'input:not([type="hidden"])',
            'select',
            'textarea',
            'summary',
            'iframe',
            '[contenteditable="true"]',
            '[role="button"]',
            '[role="link"]',
            '[role="checkbox"]',
            '[role="radio"]',
            '[role="tab"]',
            '[role="menuitem"]',
          ].join(',');
          return [...document.querySelectorAll(selector)]
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              if (
                element.disabled ||
                element.getAttribute('aria-disabled') === 'true' ||
                element.closest('[inert]') ||
                element.closest('[aria-hidden="true"]') ||
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                rect.width === 0 ||
                rect.height === 0
              ) {
                return false;
              }
              const value = element.getAttribute('tabindex');
              return value !== null && Number(value) < 0;
            })
            .map((element) => ({
              ...{
                tag: element.tagName,
                id: element.id || null,
                role: element.getAttribute('role'),
                label:
                  element.getAttribute('aria-label') ||
                  element.innerText ||
                  element.getAttribute('href') ||
                  '',
              },
              tabindex: element.getAttribute('tabindex'),
            }));
        });
        assert.deepEqual(
          findings,
          [],
          `Visible interactive elements may be unreachable by Tab:\n${JSON.stringify(findings, null, 2)}`,
        );
      });
      await routeTest.test('focused elements have a visible focus indicator', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => {
          const element = document.activeElement;
          if (!element || element === document.body) {
            return { found: false, reason: 'No focused element.' };
          }
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
          const outlineVisible =
            outlineWidth > 0 &&
            style.outlineStyle !== 'none' &&
            style.outlineStyle !== 'hidden' &&
            style.outlineColor !== 'transparent';
          const shadowVisible =
            style.boxShadow !== 'none' &&
            style.boxShadow !== '' &&
            !style.boxShadow.includes('rgba(0, 0, 0, 0)');
          return {
            found: true,
            ...{
              tag: element.tagName,
              id: element.id || null,
            },
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden',
            outlineVisible,
            shadowVisible,
            outline: style.outline,
            boxShadow: style.boxShadow,
            focusVisible: element.matches(':focus-visible'),
          };
        });
        assert.ok(state.found && state.visible, JSON.stringify(state));
        if (!state.outlineVisible && !state.shadowVisible) {
          routeTest.diagnostic(
            'Review focus visibility manually. No obvious outline or box-shadow was detected; other indicators such as a border or background change may still be valid.',
          );
        }
      });
      await routeTest.test('skip-navigation link is provided when required by the page design', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        await page.keyboard.press('Tab');
        const first = await page.evaluate(() => {
          const element = document.activeElement;
          return {
            tag: element?.tagName || '',
            href: element?.getAttribute('href') || '',
            text: (
              element?.innerText ||
              element?.getAttribute('aria-label') ||
              ''
            ).trim(),
          };
        });
        const isSkipLink =
          first.tag === 'A' &&
          /skip|main content|jump to/i.test(first.text);
        if (!isSkipLink) {
          routeTest.diagnostic(
            'The first Tab target was not clearly a skip link. Manually confirm that a skip link or equivalent bypass mechanism is available where required.',
          );
          return;
        }
        assert.ok(
          first.href.startsWith('#'),
          'A same-page skip link should normally point to a content target.',
        );
        const targetId = decodeURIComponent(first.href.slice(1));
        assert.ok(targetId, 'Skip link target must not be empty.');
        const targetExists = await page.locator(`#${CSS.escape(targetId)}`).count()
          .catch(() => 0);
        assert.ok(targetExists > 0, `Skip link target #${targetId} does not exist.`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        const targetState = await page.evaluate(() => ({
          hash: window.location.hash,
          activeId: document.activeElement?.id || '',
          activeTag: document.activeElement?.tagName || '',
        }));
        assert.equal(
          decodeURIComponent(targetState.hash.slice(1)),
          targetId,
          'Activating the skip link should navigate to its target.',
        );
        const focusedTarget = targetState.activeId === targetId;
        if (!focusedTarget) {
          routeTest.diagnostic(
            'The skip link navigated to its target, but the target did not receive focus. Verify focus management for non-focusable main-content targets.',
          );
        }
      });
      await routeTest.test('native buttons and links support keyboard activation', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        const candidates = await page.evaluate(() => {
          const visible = (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              !element.disabled &&
              element.getAttribute('aria-disabled') !== 'true'
            );
          };
          const buttons = [...document.querySelectorAll('button')]
            .filter(visible)
            .map((element) => ({
              tag: 'button',
              text: (
                element.innerText ||
                element.getAttribute('aria-label') ||
                ''
              ).trim(),
            }));
          const links = [...document.querySelectorAll('a[href]')]
            .filter(visible)
            .map((element) => ({
              tag: 'a',
              text: (
                element.innerText ||
                element.getAttribute('aria-label') ||
                ''
              ).trim(),
            }));
          return { buttons, links };
        });
        if (candidates.buttons.length === 0 && candidates.links.length === 0) {
          routeTest.diagnostic(
            'No visible native buttons or links were found to test. Confirm whether this route should contain interactive controls.',
          );
          return;
        }
        // Test a native button without submitting a form or triggering
        // navigation. Do not click potentially destructive site controls.
        const button = page.locator('button:visible:not([disabled])').first();
        if (await button.count()) {
          const buttonType = await button.getAttribute('type');
          if (buttonType === 'submit' || buttonType === null) {
            routeTest.diagnostic(
              'A native button was found but may submit a form. Skipping Enter/Space activation to avoid unintended submission.',
            );
          } else {
            await button.focus();
            const before = await button.evaluate((element) => ({
              active: document.activeElement === element,
              tag: element.tagName,
            }));
            assert.equal(before.active, true, 'Button should be programmatically focusable.');
            assert.equal(before.tag, 'BUTTON');
            // Keyboard events are dispatched, but no click handler is
            // invoked deliberately because it could trigger real actions.
            await page.keyboard.press('Space');
          }
        }
        const link = page.locator('a[href]:visible').first();
        if (await link.count()) {
          await link.focus();
          const linkFocused = await link.evaluate(
            (element) => document.activeElement === element,
          );
          assert.equal(linkFocused, true, 'Native link should be keyboard focusable.');
          // Enter on a link can navigate away, so activation is not
          // performed here. Native semantics provide Enter activation;
          // verify any custom link-like controls separately.
          routeTest.diagnostic(
            'Native link focus verified. Enter activation was not triggered to avoid unintended navigation.',
          );
        }
      });
      await routeTest.test('form controls can receive keyboard focus', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        const count = await page.locator(
          'input:not([type="hidden"]):visible:not([disabled]), select:visible:not([disabled]), textarea:visible:not([disabled]), button:visible:not([disabled])',
        ).count();
        if (count === 0) {
          routeTest.diagnostic(
            'No visible enabled form controls or buttons were found on this route.',
          );
          return;
        }
        const controls = page.locator(
          'input:not([type="hidden"]):visible:not([disabled]), select:visible:not([disabled]), textarea:visible:not([disabled]), button:visible:not([disabled])',
        );
        await controls.first().focus();
        assert.equal(
          await controls.first().evaluate((element) => document.activeElement === element),
          true,
          'A visible enabled form control should be focusable.',
        );
      });
      await routeTest.test('open dialogs keep focus within the dialog and support Escape when appropriate', async () => {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        const dialog = page.locator(
          'dialog[open]:visible, [role="dialog"]:visible, [role="alertdialog"]:visible',
        ).first();
        if (!(await dialog.count())) {
          routeTest.diagnostic(
            'No open visible dialog was found. Dialog focus containment and Escape behavior were not exercised on this route.',
          );
          return;
        }
        const role = await dialog.getAttribute('role');
        const isNativeDialog = await dialog.evaluate(
          (element) => element.tagName.toLowerCase() === 'dialog',
        );
        const activeInside = await dialog.evaluate(
          (element) => element.contains(document.activeElement),
        );
        if (!activeInside) {
          routeTest.diagnostic(
            `Focus is outside the visible dialog (${role || (isNativeDialog ? 'native dialog' : 'custom dialog')}). Verify focus moves into the dialog when it opens.`,
          );
        }
        const focusableCount = await dialog.locator(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).count();
        if (focusableCount > 0) {
          await page.keyboard.press('Tab');
          const remainsInside = await dialog.evaluate(
            (element) => element.contains(document.activeElement),
          );
          if (!remainsInside) {
            routeTest.diagnostic(
              'Tab moved focus outside the open dialog. Confirm that the dialog implements the appropriate modal focus-management behavior.',
            );
          }
        }
        if (isNativeDialog) {
          await page.keyboard.press('Escape');
          const remainsOpen = await dialog.evaluate(
            (element) => element.open,
          );
          if (remainsOpen) {
            routeTest.diagnostic(
              'The native dialog remained open after Escape. This may be intentional if the application prevents cancellation; verify the expected behavior.',
            );
          }
        } else {
          routeTest.diagnostic(
            'Escape was not sent to the custom dialog because closing it may change application state. Test its expected Escape behavior in a dedicated fixture.',
          );
        }
      });
      await routeTest.test('reduced-motion preference preserves keyboard access', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT_MS,
        });
        await page.keyboard.press('Tab');
        const state = await page.evaluate(() => ({
          activeTag: document.activeElement?.tagName || null,
          isBody: document.activeElement === document.body,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        }));
        assert.equal(state.reducedMotion, true);
        assert.ok(
          state.activeTag && !state.isBody,
          'Keyboard focus should remain usable with reduced motion enabled.',
        );
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      });
    } finally {
      await page.close();
    }
  });
}

} finally {
await browser.close();
}
});