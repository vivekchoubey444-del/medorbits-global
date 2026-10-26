
/**
 * MedOrbits -- Navigation Accessibility Tests
 * File: tests/accessibility/navigation.accessibility.test.js
 * Runtime: Node.js >= 20, ESM.
 *
 * Static checks:
 *   node --test tests/accessibility/navigation.accessibility.test.js
 *
 * Browser dependencies:
 *   npm install --save-dev playwright @axe-core/playwright
 *   npx playwright install chromium
 *
 * Environment:
 *   ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000
 *   ACCESSIBILITY_ROUTES=/,/about,/courses,/contact
 *   ACCESSIBILITY_REQUIRE_BROWSER=true
 *   ACCESSIBILITY_TIMEOUT_MS=15000
 *
 * Optional:
 *   ACCESSIBILITY_HTML_DIR=.
 *
 * Notes:
 *   - Static checks use lightweight HTML parsing heuristics.
 *   - Browser checks require a running website.
 *   - axe-core checks are skipped when its dependency is absent,
 *     unless ACCESSIBILITY_REQUIRE_BROWSER=true.
 *   - Automated checks do not replace manual accessibility testing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TEST_DIR, '../..');

function resolveInsideRoot(relativePath) {
  const resolved = path.resolve(ROOT_DIR, relativePath);
  const relative = path.relative(ROOT_DIR, resolved);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Configured path must remain inside the project root: ${relativePath}`,
    );
  }

  return resolved;
}

const HTML_DIR = resolveInsideRoot(
  process.env.ACCESSIBILITY_HTML_DIR || '.',
);

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || '/')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const REQUIRE_BROWSER =
  process.env.ACCESSIBILITY_REQUIRE_BROWSER === 'true';

const TIMEOUT_MS = Number(
  process.env.ACCESSIBILITY_TIMEOUT_MS || 15000,
);

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

function walkHtmlFiles(directory, results = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
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

  return results.sort();
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const codePoint = Number.parseInt(hex, 16);

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    })
    .replace(/&#(\d+);/g, (_, decimal) => {
      const codePoint = Number.parseInt(decimal, 10);

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _;
      }
    });
}

/**
 * Lightweight attribute parser.
 * This is intended for static heuristics, not full HTML validation.
 */
function parseAttributes(attributeText) {
  const attributes = new Map();

  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match;

  while ((match = pattern.exec(attributeText)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (!attributes.has(name)) {
      attributes.set(name, decodeHtmlEntities(value));
    }
  }

  return attributes;
}

/**
 * Extracts basic paired or self-closing HTML elements.
 * Avoid using this helper as a replacement for a full HTML parser.
 */
function extractElements(html, tagName) {
  const results = [];

  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const pattern = new RegExp(
    `<${escapedTag}\\b([^>]*)>([\\s\\S]*?)<\\/${escapedTag}\\s*>|<${escapedTag}\\b([^>]*)\\/?>`,
    'gi',
  );

  let match;

  while ((match = pattern.exec(html)) !== null) {
    results.push({
      attributes: parseAttributes(match[1] ?? match[3] ?? ''),
      innerHtml: match[2] ?? '',
      source: match[0],
    });
  }

  return results;
}

function extractText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
      .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function getIds(html) {
  const ids = [];
  const pattern = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

  let match;

  while ((match = pattern.exec(html)) !== null) {
    ids.push(
      decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? ''),
    );
  }

  return ids;
}

function hasAccessibleName(element) {
  const attributes = element.attributes;

  const ariaLabel = attributes.get('aria-label') || '';
  const labelledBy = attributes.get('aria-labelledby') || '';
  const title = attributes.get('title') || '';
  const alt = attributes.get('alt') || '';
  const text = extractText(element.innerHtml);

  return Boolean(
    ariaLabel.trim() ||
    labelledBy.trim() ||
    title.trim() ||
    alt.trim() ||
    text,
  );
}

function getHtmlFiles() {
  return walkHtmlFiles(HTML_DIR);
}

function relativeFile(file) {
  return path.relative(ROOT_DIR, file) || path.basename(file);
}

function getBaseUrl() {
  if (!BASE_URL) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'ACCESSIBILITY_BASE_URL must be a valid HTTP(S) URL.',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(
      'ACCESSIBILITY_BASE_URL must use HTTP or HTTPS.',
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      'Do not include credentials in ACCESSIBILITY_BASE_URL.',
    );
  }

  return parsed;
}

function normalizeRoute(route) {
  if (!route.startsWith('/')) {
    throw new Error(`Route must begin with "/": ${route}`);
  }

  let parsed;

  try {
    parsed = new URL(route, 'http://accessibility.invalid');
  } catch {
    throw new Error(`Invalid route: ${route}`);
  }

  if (parsed.origin !== 'http://accessibility.invalid') {
    throw new Error(`Route must remain on the configured origin: ${route}`);
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function routeUrl(baseUrl, route) {
  const result = new URL(normalizeRoute(route), baseUrl);

  if (result.origin !== baseUrl.origin) {
    throw new Error(
      `Route escaped the configured test origin: ${route}`,
    );
  }

  return result.href;
}

function reportViolations(violations, title) {
  assert.deepEqual(
    violations,
    [],
    `${title}:\n${violations.join('\n')}`,
  );
}

async function loadBrowserDependencies(t) {
  let chromium;
  let AxeBuilder = null;

  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    if (REQUIRE_BROWSER) {
      assert.fail(
        'Playwright is required. Install it with: ' +
          'npm install --save-dev playwright @axe-core/playwright ' +
          '&& npx playwright install chromium. ' +
          `Import error: ${error.message}`,
      );
    }

    t.skip('Playwright is not installed.');
    return null;
  }

  try {
    const axeModule = await import('@axe-core/playwright');
    AxeBuilder = axeModule.default ?? axeModule;
  } catch {
    // axe-core is optional unless its audit is explicitly required.
  }

  return { chromium, AxeBuilder };
}

function describeNavigationControl(control) {
  return [
    control.tag,
    control.id ? `#${control.id}` : '',
    control.text ? `"${control.text}"` : '',
    control.href ? `href="${control.href}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

test('navigation test configuration is valid', () => {
  assert.ok(
    Number.isInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'ACCESSIBILITY_TIMEOUT_MS must be a positive integer.',
  );

  assert.ok(
    ROUTES.length > 0,
    'At least one route must be configured.',
  );

  for (const route of ROUTES) {
    normalizeRoute(route);
  }

  getBaseUrl();
});

// -----------------------------------------------------------------------------
// Static checks
// -----------------------------------------------------------------------------

test('HTML source directory is available for static checks', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.skip(`HTML directory not found: ${HTML_DIR}`);
    return;
  }

  const files = getHtmlFiles();

  if (files.length === 0) {
    t.skip(`No HTML files found under ${HTML_DIR}`);
    return;
  }

  assert.ok(files.length > 0);
});

test(
  'multiple navigation landmarks have distinguishable accessible names',
  (t) => {
    const files = getHtmlFiles();

    if (files.length === 0) {
      t.skip('No HTML files are available.');
      return;
    }

    const violations = [];

    for (const file of files) {
      const html = stripComments(
        fs.readFileSync(file, 'utf8'),
      );

      const navs = extractElements(html, 'nav');

      if (navs.length <= 1) {
        continue;
      }

      const names = navs.map((nav) => {
        const attributes = nav.attributes;

        return (
          attributes.get('aria-label') ||
          attributes.get('aria-labelledby') ||
          ''
        ).trim().toLowerCase();
      });

      navs.forEach((nav, index) => {
        if (!names[index]) {
          violations.push(
            `${relativeFile(file)}: navigation landmark ${index + 1} ` +
              'has no explicit accessible name, although multiple ' +
              'navigation landmarks exist.',
          );
        }
      });

      const namedNames = names.filter(Boolean);
      const duplicateNames = namedNames.filter(
        (name, index) => namedNames.indexOf(name) !== index,
      );

      if (duplicateNames.length > 0) {
        violations.push(
          `${relativeFile(file)}: navigation landmarks have repeated ` +
            `explicit names: ${[...new Set(duplicateNames)].join(', ')}.`,
        );
      }
    }

    reportViolations(
      violations,
      'Navigation landmark naming issues',
    );
  },
);

test(
  'links have detectable accessible names and href attributes',
  (t) => {
    const files = getHtmlFiles();

    if (files.length === 0) {
      t.skip('No HTML files are available.');
      return;
    }

    const violations = [];

    for (const file of files) {
      const html = stripComments(
        fs.readFileSync(file, 'utf8'),
      );

      for (const link of extractElements(html, 'a')) {
        const href = link.attributes.get('href');

        if (!hasAccessibleName(link)) {
          violations.push(
            `${relativeFile(file)}: link "${href || '(no href)'}" ` +
              'has no detectable accessible name.',
          );
        }

        if (href === undefined || !href.trim()) {
          violations.push(
            `${relativeFile(file)}: anchor has no usable href attribute.`,
          );
        }
      }
    }

    reportViolations(violations, 'Link accessibility issues');
  },
);

test(
  'IDs are unique and internal fragment links resolve within each HTML file',
  (t) => {
    const files = getHtmlFiles();

    if (files.length === 0) {
      t.skip('No HTML files are available.');
      return;
    }

    const violations = [];

    for (const file of files) {
      const html = stripComments(
        fs.readFileSync(file, 'utf8'),
      );

      const ids = getIds(html);
      const idSet = new Set(ids);
      const counts = new Map();

      for (const id of ids) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }

      for (const [id, count] of counts) {
        if (count > 1) {
          violations.push(
            `${relativeFile(file)}: ID "${id}" occurs ${count} times.`,
          );
        }
      }

      for (const link of extractElements(html, 'a')) {
        const href = link.attributes.get('href') || '';

        if (!href.startsWith('#') || href === '#') {
          continue;
        }

        let fragment;

        try {
          fragment = decodeURIComponent(href.slice(1));
        } catch {
          violations.push(
            `${relativeFile(file)}: fragment link "${href}" ` +
              'has invalid encoding.',
          );
          continue;
        }

        if (!idSet.has(fragment)) {
          violations.push(
            `${relativeFile(file)}: fragment link "${href}" ` +
              'has no matching ID in the same HTML file.',
          );
        }
      }
    }

    reportViolations(violations, 'ID and fragment-link issues');
  },
);

test('breadcrumb containers contain readable content', (t) => {
  const files = getHtmlFiles();

  if (files.length === 0) {
    t.skip('No HTML files are available.');
    return;
  }

  const findings = [];

  for (const file of files) {
    const html = stripComments(
      fs.readFileSync(file, 'utf8'),
    );

    const navBreadcrumbs = extractElements(html, 'nav').filter(
      (element) => {
        const label = (
          element.attributes.get('aria-label') ||
          element.attributes.get('aria-labelledby') ||
          ''
        ).toLowerCase();

        return label.includes('breadcrumb');
      },
    );

    const listBreadcrumbs = extractElements(html, 'ol').filter(
      (element) => {
        const attributes = element.attributes;

        return (
          (attributes.get('aria-label') || '')
            .toLowerCase()
            .includes('breadcrumb') ||
          (attributes.get('itemtype') || '')
            .includes('BreadcrumbList') ||
          (attributes.get('class') || '')
            .toLowerCase()
            .includes('breadcrumb')
        );
      },
    );

    for (const breadcrumb of [
      ...navBreadcrumbs,
      ...listBreadcrumbs,
    ]) {
      if (!extractText(breadcrumb.innerHtml)) {
        findings.push(
          `${relativeFile(file)}: breadcrumb container has no ` +
            'detectable readable text.',
        );
      }
    }
  }

  if (findings.length > 0) {
    t.diagnostic(
      `Breadcrumb review findings:\n${findings.join('\n')}`,
    );
  }
});

test(
  'navigation toggles have valid expanded state and controlled targets',
  (t) => {
    const files = getHtmlFiles();

    if (files.length === 0) {
      t.skip('No HTML files are available.');
      return;
    }

    const violations = [];

    const togglePattern =
      /menu-toggle|nav-toggle|navbar-toggler|mobile-menu|mobile-nav/;

    for (const file of files) {
      const html = stripComments(
        fs.readFileSync(file, 'utf8'),
      );

      const controls = [
        ...extractElements(html, 'button'),
        ...extractElements(html, 'a'),
        ...extractElements(html, 'div'),
      ];

      const ids = new Set(getIds(html));

      for (const control of controls) {
        const attributes = control.attributes;

        const descriptor = [
          attributes.get('aria-label') || '',
          attributes.get('class') || '',
          attributes.get('id') || '',
          attributes.get('data-bs-target') || '',
        ]
          .join(' ')
          .toLowerCase();

        const likelyToggle =
          attributes.has('aria-controls') ||
          attributes.has('aria-expanded') ||
          togglePattern.test(descriptor);

        if (!likelyToggle) {
          continue;
        }

        const expanded = attributes.get('aria-expanded');
        const controlsId = attributes.get('aria-controls');

        if (
          expanded !== undefined &&
          !['true', 'false'].includes(expanded.toLowerCase())
        ) {
          violations.push(
            `${relativeFile(file)}: invalid aria-expanded="${expanded}".`,
          );
        }

        if (controlsId && !ids.has(controlsId)) {
          violations.push(
            `${relativeFile(file)}: aria-controls references missing ` +
              `ID "${controlsId}".`,
          );
        }

        if (
          togglePattern.test(descriptor) &&
          !hasAccessibleName(control)
        ) {
          violations.push(
            `${relativeFile(file)}: likely navigation toggle has no ` +
              'detectable accessible name.',
          );
        }
      }
    }

    reportViolations(violations, 'Navigation toggle issues');
  },
);

test('declared aria-current values are valid', (t) => {
  const files = getHtmlFiles();

  if (files.length === 0) {
    t.skip('No HTML files are available.');
    return;
  }

  const allowedValues = new Set([
    'page',
    'step',
    'location',
    'date',
    'time',
    'true',
    'false',
  ]);

  const violations = [];

  for (const file of files) {
    const html = stripComments(
      fs.readFileSync(file, 'utf8'),
    );

    const elements = [
      ...extractElements(html, 'a'),
      ...extractElements(html, 'button'),
      ...extractElements(html, 'li'),
    ];

    for (const element of elements) {
      const current = element.attributes.get('aria-current');

      if (
        current !== undefined &&
        !allowedValues.has(current.toLowerCase())
      ) {
        violations.push(
          `${relativeFile(file)}: invalid aria-current="${current}".`,
        );
      }
    }
  }

  reportViolations(violations, 'Invalid aria-current values');
});

// -----------------------------------------------------------------------------
// Browser accessibility checks
// -----------------------------------------------------------------------------

test(
  'rendered pages pass axe-core WCAG 2.2 AA checks when available',
  async (t) => {
    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      t.skip(
        'Set ACCESSIBILITY_BASE_URL to enable browser checks.',
      );
      return;
    }

    const dependencies = await loadBrowserDependencies(t);

    if (!dependencies) {
      return;
    }

    const { chromium, AxeBuilder } = dependencies;

    if (!AxeBuilder) {
      if (REQUIRE_BROWSER) {
        assert.fail(
          'axe-core is required for this audit. Install it with: ' +
            'npm install --save-dev @axe-core/playwright',
        );
      }

      t.skip('@axe-core/playwright is not installed.');
      return;
    }

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      for (const route of ROUTES) {
        await t.test(`axe WCAG 2.2 AA audit: ${route}`, async () => {
          const page = await browser.newPage();

          try {
            const response = await page.goto(
              routeUrl(baseUrl, route),
              {
                waitUntil: 'domcontentloaded',
                timeout: TIMEOUT_MS,
              },
            );

            assert.ok(
              response,
              `No response received for route ${route}.`,
            );

            assert.ok(
              response.status() < 400,
              `${route} returned HTTP ${response.status()}.`,
            );

            const results = await new AxeBuilder({ page })
              .withTags([
                'wcag2a',
                'wcag2aa',
                'wcag21a',
                'wcag21aa',
                'wcag22aa',
              ])
              .include('body')
              .analyze();

            const violations = results.violations.map(
              (violation) => ({
                id: violation.id,
                impact: violation.impact,
                help: violation.help,
                nodes: violation.nodes.map((node) => ({
                  target: node.target,
                  summary: node.failureSummary,
                })),
              }),
            );

            assert.deepEqual(
              violations,
              [],
              `Accessibility violations on ${route}:\n` +
                JSON.stringify(violations, null, 2),
            );
          } finally {
            await page.close();
          }
        });
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  'rendered navigation controls are keyboard reachable',
  async (t) => {
    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      t.skip(
        'Set ACCESSIBILITY_BASE_URL to enable browser checks.',
      );
      return;
    }

    const dependencies = await loadBrowserDependencies(t);

    if (!dependencies) {
      return;
    }

    const { chromium } = dependencies;

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      for (const route of ROUTES) {
        await t.test(
          `keyboard navigation controls: ${route}`,
          async (routeTest) => {
            const page = await browser.newPage();

            try {
              const response = await page.goto(
                routeUrl(baseUrl, route),
                {
                  waitUntil: 'domcontentloaded',
                  timeout: TIMEOUT_MS,
                },
              );

              assert.ok(
                response && response.status() < 400,
                `Could not load ${route} successfully.`,
              );

              const controls = await page.evaluate(() => {
                const selector = [
                  'header a[href]',
                  'header button',
                  'nav a[href]',
                  'nav button',
                  '[role="navigation"] a[href]',
                  '[role="navigation"] button',
                ].join(',');

                return [
                  ...document.querySelectorAll(selector),
                ].map((element) => {
                  const style = getComputedStyle(element);
                  const rect = element.getBoundingClientRect();

                  return {
                    tag: element.tagName,
                    text: (
                      element.innerText ||
                      element.getAttribute('aria-label') ||
                      element.getAttribute('title') ||
                      ''
                    ).trim(),
                    href: element.getAttribute('href'),
                    id: element.id || null,
                    tabIndex: element.tabIndex,
                    disabled:
                      Boolean(element.disabled) ||
                      element.getAttribute('aria-disabled') === 'true',
                    visible:
                      rect.width > 0 &&
                      rect.height > 0 &&
                      style.display !== 'none' &&
                      style.visibility !== 'hidden' &&
                      Number(style.opacity) !== 0,
                  };
                });
              });

              const actionable = controls.filter(
                (control) => control.visible && !control.disabled,
              );

              if (actionable.length === 0) {
                routeTest.diagnostic(
                  `No visible enabled navigation controls were found on ${route}.`,
                );
                return;
              }

              const unreachable = actionable.filter(
                (control) => control.tabIndex < 0,
              );

              assert.deepEqual(
                unreachable,
                [],
                'Navigation controls may be excluded from keyboard access:\n' +
                  unreachable
                    .map(describeNavigationControl)
                    .join('\n'),
              );

              await page.keyboard.press('Tab');

              const active = await page.evaluate(() => {
                const element = document.activeElement;

                return {
                  tag: element?.tagName || null,
                  href: element?.getAttribute('href') || null,
                  id: element?.id || null,
                  role: element?.getAttribute('role') || null,
                  tabIndex: element?.tabIndex ?? null,
                };
              });

              assert.ok(
                active.tag && active.tag !== 'BODY',
                `No keyboard focus target was reached on ${route}.`,
              );

              routeTest.diagnostic(
                `First Tab target: ${JSON.stringify(active)}`,
              );
            } finally {
              await page.close();
            }
          },
        );
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  'mobile navigation toggle responds to keyboard activation when present',
  async (t) => {
    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      t.skip(
        'Set ACCESSIBILITY_BASE_URL to enable browser checks.',
      );
      return;
    }

    const dependencies = await loadBrowserDependencies(t);

    if (!dependencies) {
      return;
    }

    const { chromium } = dependencies;

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      for (const route of ROUTES) {
        await t.test(
          `mobile navigation toggle: ${route}`,
          async (routeTest) => {
            const page = await browser.newPage({
              viewport: {
                width: 390,
                height: 844,
              },
            });

            try {
              const response = await page.goto(
                routeUrl(baseUrl, route),
                {
                  waitUntil: 'domcontentloaded',
                  timeout: TIMEOUT_MS,
                },
              );

              assert.ok(
                response && response.status() < 400,
                `Could not load ${route} successfully.`,
              );

              const toggle = page
                .locator(
                  [
                    'button[aria-controls][aria-expanded]',
                    'button.navbar-toggler',
                    'button.menu-toggle',
                    'button.nav-toggle',
                    'button[aria-label*="menu" i]',
                  ].join(','),
                )
                .first();

              if (!(await toggle.count())) {
                routeTest.diagnostic(
                  'No conventional mobile navigation toggle was found; ' +
                    'inspect custom controls manually.',
                );
                return;
              }

              if (
                !(await toggle.isVisible()) ||
                !(await toggle.isEnabled())
              ) {
                routeTest.diagnostic(
                  'The detected navigation toggle is not visible and enabled ' +
                    'at the mobile viewport.',
                );
                return;
              }

              const expandedBefore =
                await toggle.getAttribute('aria-expanded');

              if (expandedBefore === null) {
                routeTest.diagnostic(
                  'The toggle does not expose aria-expanded; ' +
                    'state semantics need manual review.',
                );
                return;
              }

              await toggle.focus();

              assert.equal(
                await toggle.evaluate(
                  (element) => document.activeElement === element,
                ),
                true,
                'Navigation toggle should receive keyboard focus.',
              );

              await page.keyboard.press('Enter');

              let expandedAfter =
                await toggle.getAttribute('aria-expanded');

              if (expandedAfter === expandedBefore) {
                // Try Space if Enter did not activate this control.
                await page.keyboard.press('Space');

                expandedAfter =
                  await toggle.getAttribute('aria-expanded');
              }

              assert.notEqual(
                expandedAfter,
                expandedBefore,
                'Keyboard activation did not change aria-expanded. ' +
                  'Verify the toggle handler, controlled menu, and state updates.',
              );
            } finally {
              await page.close();
            }
          },
        );
      }
    } finally {
      await browser.close();
    }
  },
);
