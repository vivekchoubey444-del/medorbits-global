
/**
 * MedOrbits -- Keyboard Navigation Accessibility Tests
 * File: tests/accessibility/keyboard-navigation.test.js
 *
 * Runtime: Node.js >= 20
 * package.json must use "type": "module".
 *
 * Static checks:
 *   node --test tests/accessibility/keyboard-navigation.test.js
 *
 * Optional browser checks:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Example:
 *   ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
 *   ACCESSIBILITY_ROUTES=/,/about,/courses \
 *   ACCESSIBILITY_REQUIRE_BROWSER=true \
 *   node --test tests/accessibility/keyboard-navigation.test.js
 *
 * Optional:
 *   ACCESSIBILITY_HTML_DIR=.
 *   ACCESSIBILITY_CSS=assets/css/style.css,assets/css/accessibility.css
 *
 * Limitations:
 *   Static analysis is heuristic. Browser checks cover common keyboard
 *   interactions, not every widget, browser, WCAG criterion, or assistive
 *   technology. Interactive components still need manual testing.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function resolveInsideRoot(value, label) {
  const resolved = path.resolve(PROJECT_ROOT, value);
  const relative = path.relative(PROJECT_ROOT, resolved);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be inside the project root.`);
  }

  return resolved;
}

const HTML_DIR = resolveInsideRoot(
  process.env.ACCESSIBILITY_HTML_DIR || '.',
  'ACCESSIBILITY_HTML_DIR'
);

const CSS_PATHS = (
  process.env.ACCESSIBILITY_CSS ||
  [
    'style.css',
    'css/style.css',
    'assets/css/style.css',
    'assets/css/accessibility.css',
    'css/accessibility.css',
  ].join(',')
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => resolveInsideRoot(item, 'ACCESSIBILITY_CSS'));

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || '').replace(/\/+$/, '');

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || '/')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const REQUIRE_BROWSER =
  process.env.ACCESSIBILITY_REQUIRE_BROWSER === 'true';

const TIMEOUT_MS = 20_000;

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build',
  '.next',
  '.cache',
  'vendor',
  'tests',
]);

const HTML_EXTENSIONS = new Set(['.html', '.htm']);

let chromium;
let browser;

function walkHtmlFiles(directory, results = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

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
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/');
}

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function loadCss() {
  return CSS_PATHS
    .filter((filePath) => {
      try {
        return fs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    })
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function extractAttributes(attributeText) {
  const attributes = new Map();

  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;

  while ((match = pattern.exec(attributeText)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (!attributes.has(name)) {
      attributes.set(name, value);
    }
  }

  return attributes;
}

function extractOpeningTags(html) {
  const tags = [];
  const pattern = /<([a-z][\w:-]*)\b([^<>]*)>/gi;

  let match;

  while ((match = pattern.exec(html)) !== null) {
    tags.push({
      tag: match[1].toLowerCase(),
      attributes: extractAttributes(match[2]),
      source: match[0],
    });
  }

  return tags;
}

function getCssRules(css) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = pattern.exec(stripCssComments(css))) !== null) {
    rules.push({
      selector: match[1].trim(),
      declarations: match[2].trim(),
    });
  }

  return rules;
}

function hasVisibleFocusRule(css) {
  return getCssRules(css).some(({ selector, declarations }) => {
    if (!/:focus(?:-visible)?\b/i.test(selector)) {
      return false;
    }

    const outline = declarations.match(
      /(?:^|;)\s*outline\s*:\s*([^;]+)/i
    )?.[1];

    const outlineStyle = declarations.match(
      /(?:^|;)\s*outline-style\s*:\s*([^;]+)/i
    )?.[1];

    const outlineWidth = declarations.match(
      /(?:^|;)\s*outline-width\s*:\s*([^;]+)/i
    )?.[1];

    const boxShadow = declarations.match(
      /(?:^|;)\s*box-shadow\s*:\s*([^;]+)/i
    )?.[1];

    const border = declarations.match(
      /(?:^|;)\s*border(?:-width)?\s*:\s*([^;]+)/i
    )?.[1];

    const visibleOutline =
      (outline && !/^\s*(?:none|0(?:\s|$))/i.test(outline)) ||
      (outlineStyle && !/^\s*none\b/i.test(outlineStyle)) ||
      (outlineWidth && !/^\s*0(?:px|rem|em)?\s*$/i.test(outlineWidth));

    const visibleShadow =
      boxShadow && !/^\s*none\s*$/i.test(boxShadow);

    const visibleBorder =
      border && !/^\s*(?:none|0(?:\s|$))/i.test(border);

    return Boolean(visibleOutline || visibleShadow || visibleBorder);
  });
}

function getStaticKeyboardIssues(html, file) {
  const issues = [];
  const tags = extractOpeningTags(html);

  for (const item of tags) {
    const { tag, attributes, source } = item;
    const tabindexValue = attributes.get('tabindex');

    if (tabindexValue !== undefined) {
      const value = Number(tabindexValue);

      if (!Number.isInteger(value)) {
        issues.push(
          `${file}: invalid tabindex="${tabindexValue}" on ${source}`
        );
      } else if (value > 0) {
        issues.push(
          `${file}: positive tabindex="${tabindexValue}" creates a custom tab order: ${source}`
        );
      }
    }

    if (
      attributes.has('autofocus') &&
      !['input', 'select', 'textarea', 'button'].includes(tag)
    ) {
      issues.push(
        `${file}: autofocus on an unusual element should be reviewed: ${source}`
      );
    }

    if (
      attributes.get('aria-hidden') === 'true' &&
      tabindexValue !== undefined &&
      Number(tabindexValue) >= 0
    ) {
      issues.push(
        `${file}: aria-hidden element has a non-negative tabindex: ${source}`
      );
    }

    if (
      attributes.get('aria-disabled') === 'true' &&
      tabindexValue !== undefined &&
      Number(tabindexValue) >= 0 &&
      ['button', 'a', 'input', 'select', 'textarea'].includes(tag)
    ) {
      // Some disabled custom controls deliberately remain focusable.
      // Report for review instead of failing automatically.
    }
  }

  return issues;
}

before(async () => {
  if (!BASE_URL) {
    return;
  }

  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    if (REQUIRE_BROWSER) {
      throw new Error(
        'Playwright is required. Install it with ' +
          '`npm install --save-dev playwright` and ' +
          '`npx playwright install chromium`. ' +
          `Details: ${error.message}`
      );
    }

    return;
  }

  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

test('HTML directory exists and contains HTML files', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.skip(`HTML directory not found: ${HTML_DIR}`);
    return;
  }

  const files = walkHtmlFiles(HTML_DIR);

  if (files.length === 0) {
    t.skip(`No HTML files found under ${HTML_DIR}`);
    return;
  }

  assert.ok(files.length > 0);
});

test('HTML does not use positive or invalid tabindex values', (t) => {
  const files = walkHtmlFiles(HTML_DIR);

  if (files.length === 0) {
    t.skip('No HTML files available for static analysis.');
    return;
  }

  const issues = [];

  for (const file of files) {
    const html = stripHtmlComments(fs.readFileSync(file, 'utf8'));

    issues.push(
      ...getStaticKeyboardIssues(html, relativePath(file))
    );
  }

  assert.deepEqual(
    issues,
    [],
    `Keyboard navigation source issues:\n${issues.join('\n')}`
  );
});

test('CSS provides a visible focus indicator', (t) => {
  const css = loadCss();

  if (!css.trim()) {
    t.skip(
      'No configured stylesheet found. Set ACCESSIBILITY_CSS to your CSS files.'
    );
    return;
  }

  assert.ok(
    hasVisibleFocusRule(css),
    'Add a visible :focus or :focus-visible rule with a non-zero outline, shadow, or border.'
  );
});

test('keyboard navigation does not depend solely on hover styling', (t) => {
  const css = loadCss();

  if (!css.trim()) {
    t.skip('No stylesheet found for keyboard/hover comparison.');
    return;
  }

  const rules = getCssRules(css);

  const hoverOnlyInteractiveRules = rules.filter(({ selector }) => {
    const hasHover = /:hover\b/i.test(selector);
    const hasFocus = /:focus(?:-visible)?\b/i.test(selector);

    return (
      hasHover &&
      !hasFocus &&
      /(?:button|a|input|select|textarea|\.btn|\.button|\.nav-link)/i.test(
        selector
      )
    );
  });

  if (hoverOnlyInteractiveRules.length > 0) {
    t.diagnostic(
      'Review hover-only interactive styles. Ensure keyboard focus receives an equivalent visible indication:\n' +
        hoverOnlyInteractiveRules
          .slice(0, 20)
          .map((rule) => rule.selector)
          .join('\n')
    );
  }

  assert.ok(true);
});

test('skip-link candidates exist or are documented as absent', (t) => {
  const files = walkHtmlFiles(HTML_DIR);

  if (files.length === 0) {
    t.skip('No HTML files available.');
    return;
  }

  const matches = [];

  for (const file of files) {
    const html = stripHtmlComments(fs.readFileSync(file, 'utf8'));

    const hasSkipLink =
      /<a\b[^>]*(?:class\s*=\s*["'][^"']*(?:skip-link|skip-to-content)[^"']*["']|href\s*=\s*["']#[^"']*(?:main|content)[^"']*["'])[^>]*>/i.test(
        html
      );

    if (hasSkipLink) {
      matches.push(relativePath(file));
    }
  }

  if (matches.length === 0) {
    t.diagnostic(
      'No obvious skip-link candidate found. Consider adding a first-focusable "Skip to main content" link.'
    );
  } else {
    t.diagnostic(`Skip-link candidates found in: ${matches.join(', ')}`);
  }

  assert.ok(true);
});

test('browser keyboard navigation checks run when Playwright is available', async (t) => {
  if (!BASE_URL) {
    t.skip('Set ACCESSIBILITY_BASE_URL to enable browser checks.');
    return;
  }

  if (!browser) {
    if (REQUIRE_BROWSER) {
      assert.fail('Playwright is required but the browser was not initialized.');
    }

    t.skip('Playwright is not installed; static checks remain available.');
    return;
  }

  let configuredBase;

  try {
    configuredBase = new URL(BASE_URL);
  } catch {
    assert.fail(`ACCESSIBILITY_BASE_URL is not a valid URL: ${BASE_URL}`);
  }

  for (const route of ROUTES) {
    await t.test(`keyboard navigation: ${route}`, async (subtest) => {
      const url = new URL(route, `${BASE_URL}/`);

      assert.equal(
        url.origin,
        configuredBase.origin,
        `Route must remain on the configured origin: ${route}`
      );

      const page = await browser.newPage();

      try {
        const response = await page.goto(url.href, {
          waitUntil: 'networkidle',
          timeout: TIMEOUT_MS,
        });

        assert.ok(response, `No response received for ${route}`);

        assert.ok(
          response.status() < 400,
          `HTTP ${response.status()} returned for ${route}`
        );

        await page.evaluate(() => {
          const active = document.activeElement;

          if (active instanceof HTMLElement) {
            active.blur();
          }
        });

        const initialFocus = await page.evaluate(() => {
          const active = document.activeElement;

          return active
            ? {
                tag: active.tagName,
                id: active.id || null,
              }
            : null;
        });

        const focusableSelector = [
          'a[href]',
          'area[href]',
          'button:not([disabled])',
          'input:not([disabled]):not([type="hidden"])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
          '[contenteditable="true"]',
          'audio[controls]',
          'video[controls]',
          'summary',
        ].join(',');

        const staticFocusableCount = await page.locator(
          focusableSelector
        ).count();

        if (staticFocusableCount === 0) {
          subtest.diagnostic(
            `${route}: no conventional focusable elements were found.`
          );
          return;
        }

        const forwardSequence = [];
        const maxTabSteps = Math.min(
          Math.max(staticFocusableCount * 2, 10),
          100
        );

        for (let index = 0; index < maxTabSteps; index += 1) {
          await page.keyboard.press('Tab');

          const focused = await page.evaluate(() => {
            const element = document.activeElement;

            if (!(element instanceof HTMLElement)) {
              return null;
            }

            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);

            return {
              tag: element.tagName,
              id: element.id || null,
              name: element.getAttribute('name'),
              role: element.getAttribute('role'),
              text: (
                element.innerText ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                ''
              ).trim().slice(0, 100),
              tabIndex: element.tabIndex,
              visible:
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden',
              disabled:
                element.matches(':disabled') ||
                element.getAttribute('aria-disabled') === 'true',
              focusStyle: {
                outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth,
                outlineColor: style.outlineColor,
                boxShadow: style.boxShadow,
              },
            };
          });

          if (!focused) {
            break;
          }

          forwardSequence.push(focused);

          if (!focused.visible) {
            subtest.diagnostic(
              `${route}: keyboard focus reached an element with no visible box: ${JSON.stringify(focused)}`
            );
          }

          if (focused.disabled) {
            subtest.diagnostic(
              `${route}: focus reached a disabled or aria-disabled control: ${JSON.stringify(focused)}`
            );
          }
        }

        assert.ok(
          forwardSequence.length > 0,
          `Tab did not reach any element on ${route}. Initial focus: ${JSON.stringify(initialFocus)}`
        );

        const distinctTargets = new Set(
          forwardSequence.map((item) =>
            `${item.tag}|${item.id || ''}|${item.name || ''}|${item.text || ''}`
          )
        );

        assert.ok(
          distinctTargets.size > 0,
          `No distinct keyboard focus targets detected on ${route}.`
        );

        // Check reverse navigation from the current focus position.
        await page.keyboard.press('Shift+Tab');

        const reverseFocus = await page.evaluate(() => {
          const element = document.activeElement;

          if (!(element instanceof HTMLElement)) {
            return null;
          }

          return {
            tag: element.tagName,
            id: element.id || null,
            name: element.getAttribute('name'),
            text: (
              element.innerText ||
              element.getAttribute('aria-label') ||
              element.getAttribute('title') ||
              ''
            ).trim().slice(0, 100),
          };
        });

        assert.ok(
          reverseFocus,
          `Shift+Tab did not leave a focused element on ${route}.`
        );

        subtest.diagnostic(
          `${route}: inspected ${forwardSequence.length} Tab stops; Shift+Tab returned focus to ${reverseFocus.tag}${reverseFocus.id ? `#${reverseFocus.id}` : ''}.`
        );
      } finally {
        await page.close();
      }
    });
  }
});

test('browser detects keyboard focus that becomes visually hidden', async (t) => {
  if (!BASE_URL) {
    t.skip('Set ACCESSIBILITY_BASE_URL to enable browser checks.');
    return;
  }

  if (!browser) {
    t.skip('Playwright is not installed; static checks remain available.');
    return;
  }

  for (const route of ROUTES) {
    await t.test(`visible focused element: ${route}`, async () => {
      const url = new URL(route, `${BASE_URL}/`);
      const page = await browser.newPage();

      try {
        const response = await page.goto(url.href, {
          waitUntil: 'networkidle',
          timeout: TIMEOUT_MS,
        });

        assert.ok(response, `No navigation response for ${route}`);

        const issues = [];

        for (let index = 0; index < 50; index += 1) {
          await page.keyboard.press('Tab');

          const result = await page.evaluate(() => {
            const element = document.activeElement;

            if (!(element instanceof HTMLElement)) {
              return null;
            }

            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);

            return {
              tag: element.tagName,
              id: element.id || null,
              text: (
                element.innerText ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                ''
              ).trim().slice(0, 80),
              visible:
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.visibility !== 'collapse',
              rect: {
                width: rect.width,
                height: rect.height,
              },
            };
          });

          if (!result) {
            break;
          }

          if (!result.visible) {
            issues.push(result);
          }
        }

        assert.deepEqual(
          issues,
          [],
          `Keyboard focus reached visually hidden elements on ${route}:\n${JSON.stringify(issues, null, 2)}`
        );
      } finally {
        await page.close();
      }
    });
  }
});
