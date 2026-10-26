
/**
 * MedOrbits -- Color Contrast Accessibility Tests
 * File: tests/accessibility/color-contrast.test.js
 *
 * Requirements:
 *   - Node.js >= 20
 *   - package.json: { "type": "module" }
 *
 * Run static checks:
 *   node --test tests/accessibility/color-contrast.test.js
 *
 * Optional browser checks:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Example:
 *   ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
 *   ACCESSIBILITY_ROUTES=/,/about,/courses \
 *   ACCESSIBILITY_REQUIRE_BROWSER=true \
 *   node --test tests/accessibility/color-contrast.test.js
 *
 * Optional paths, relative to repository root:
 *   ACCESSIBILITY_CSS_DIR=assets/css
 *   ACCESSIBILITY_HTML_DIR=.
 *
 * Limitations:
 *   - Static CSS analysis uses lightweight regular expressions, not a
 *     complete CSS parser or browser cascade implementation.
 *   - Static analysis compares foreground/background colors only when
 *     both are explicitly declared in the same CSS selector.
 *   - Browser checks inspect selected visible text elements and simple
 *     opaque backgrounds. Gradients, images, pseudo-elements, complex
 *     stacking, filters, and compositing need additional verification.
 *   - Passing these tests does not establish full WCAG conformance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function resolveInsideRoot(value, label) {
  const resolved = path.resolve(ROOT_DIR, value);
  const relative = path.relative(ROOT_DIR, resolved);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be inside the repository root.`);
  }

  return resolved;
}

const CSS_DIR = resolveInsideRoot(
  process.env.ACCESSIBILITY_CSS_DIR || 'assets/css',
  'ACCESSIBILITY_CSS_DIR'
);

const HTML_DIR = resolveInsideRoot(
  process.env.ACCESSIBILITY_HTML_DIR || '.',
  'ACCESSIBILITY_HTML_DIR'
);

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || '').replace(/\/+$/, '');

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || '/')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const REQUIRE_BROWSER =
  process.env.ACCESSIBILITY_REQUIRE_BROWSER === 'true';

const TIMEOUT_MS = 20_000;
const NORMAL_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3;
const NON_TEXT_MIN = 3;

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

const CSS_EXTENSIONS = new Set(['.css']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);

const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  navy: '#000080',
  teal: '#008080',
  olive: '#808000',
  lime: '#00ff00',
  aqua: '#00ffff',
  cyan: '#00ffff',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  rebeccapurple: '#663399',
  transparent: 'transparent',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseRgbChannel(channel) {
  const input = String(channel).trim();
  const value = Number.parseFloat(input);

  if (!Number.isFinite(value)) {
    return null;
  }

  return input.endsWith('%')
    ? clamp(value / 100, 0, 1)
    : clamp(value / 255, 0, 1);
}

function parseAlpha(channel) {
  if (channel === undefined || channel === null || channel === '') {
    return 1;
  }

  const input = String(channel).trim();
  const value = Number.parseFloat(input);

  if (!Number.isFinite(value)) {
    return null;
  }

  return input.endsWith('%')
    ? clamp(value / 100, 0, 1)
    : clamp(value, 0, 1);
}

function parseColor(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const color = input.trim().toLowerCase();
  const normalized = NAMED_COLORS[color] || color;

  if (normalized === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hexMatch = normalized.match(
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  );

  if (hexMatch) {
    let hex = hexMatch[1];

    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((character) => character + character).join('');
    }

    const hasAlpha = hex.length === 8;

    return {
      r: Number.parseInt(hex.slice(0, 2), 16) / 255,
      g: Number.parseInt(hex.slice(2, 4), 16) / 255,
      b: Number.parseInt(hex.slice(4, 6), 16) / 255,
      a: hasAlpha
        ? Number.parseInt(hex.slice(6, 8), 16) / 255
        : 1,
    };
  }

  // Supports comma-separated and modern space-separated RGB/RGBA syntax.
  const rgbMatch = normalized.match(/^rgba?\((.*)\)$/i);

  if (!rgbMatch) {
    return null;
  }

  let contents = rgbMatch[1].trim();
  let alphaPart;

  if (contents.includes('/')) {
    const slashParts = contents.split('/');

    if (slashParts.length !== 2) {
      return null;
    }

    contents = slashParts[0].trim();
    alphaPart = slashParts[1].trim();
  }

  const parts = contents.includes(',')
    ? contents.split(',').map((part) => part.trim())
    : contents.split(/\s+/).filter(Boolean);

  if (parts.length === 4 && alphaPart === undefined) {
    alphaPart = parts.pop();
  }

  if (parts.length !== 3) {
    return null;
  }

  const r = parseRgbChannel(parts[0]);
  const g = parseRgbChannel(parts[1]);
  const b = parseRgbChannel(parts[2]);
  const a = parseAlpha(alphaPart);

  if ([r, g, b, a].some((value) => value === null)) {
    return null;
  }

  return { r, g, b, a };
}

function linearizeChannel(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(input) {
  const color = typeof input === 'string' ? parseColor(input) : input;

  if (!color || color.a < 1) {
    throw new Error(
      `Cannot calculate luminance for an unresolved or transparent color: ${
        typeof input === 'string' ? input : JSON.stringify(input)
      }`
    );
  }

  return (
    0.2126 * linearizeChannel(color.r) +
    0.7152 * linearizeChannel(color.g) +
    0.0722 * linearizeChannel(color.b)
  );
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function meetsContrast(foreground, background, minimum) {
  return contrastRatio(foreground, background) >= minimum;
}

function walkFiles(directory, extensions, results = []) {
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
        walkFiles(fullPath, extensions, results);
      }

      continue;
    }

    if (
      entry.isFile() &&
      extensions.has(path.extname(entry.name).toLowerCase())
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Lightweight declaration extraction.
 *
 * Nested rules, escaped delimiters, and complex CSS syntax may not be
 * parsed correctly. Use a proper CSS parser for production-grade analysis.
 */
function extractDeclarations(css) {
  const declarations = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1].trim();

    if (!selector || selector.startsWith('@')) {
      continue;
    }

    for (const declaration of match[2].split(';')) {
      const separator = declaration.indexOf(':');

      if (separator < 0) {
        continue;
      }

      const property = declaration
        .slice(0, separator)
        .trim()
        .toLowerCase();

      const value = declaration.slice(separator + 1).trim();

      if (property && value) {
        declarations.push({ selector, property, value });
      }
    }
  }

  return declarations;
}

function resolveCssVariable(value, variables, depth = 0) {
  if (depth > 10) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(
    /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/s
  );

  if (!match) {
    return trimmed;
  }

  const [, variableName, fallback] = match;
  const replacement = variables.get(variableName) ?? fallback;

  if (!replacement) {
    return null;
  }

  return resolveCssVariable(replacement.trim(), variables, depth + 1);
}

function extractVariables(declarations) {
  const variables = new Map();

  for (const declaration of declarations) {
    if (declaration.property.startsWith('--')) {
      variables.set(declaration.property, declaration.value);
    }
  }

  return variables;
}

function isPotentialColor(value) {
  return /^(#|rgb\(|rgba\(|white$|black$|red$|blue$|green$|gray$|grey$|maroon$|navy$|teal$|purple$|orange$|yellow$|transparent$|var\()/i.test(
    value.trim()
  );
}

function analyzeCssFile(filePath) {
  const source = stripCssComments(fs.readFileSync(filePath, 'utf8'));
  const declarations = extractDeclarations(source);
  const variables = extractVariables(declarations);
  const findings = [];
  const unresolved = [];

  const colorProperties = new Set([
    'color',
    'background-color',
    'border-color',
    'outline-color',
    'fill',
    'stroke',
  ]);

  for (const declaration of declarations) {
    const { selector, property, value } = declaration;

    if (!colorProperties.has(property)) {
      continue;
    }

    const resolvedValue = resolveCssVariable(value, variables);
    const color = resolvedValue ? parseColor(resolvedValue) : null;

    if (!color) {
      if (isPotentialColor(value) || value.startsWith('--')) {
        unresolved.push({ selector, property, value });
      }

      continue;
    }

    findings.push({
      selector,
      property,
      value: resolvedValue,
      color,
    });
  }

  return {
    file: relativePath(filePath),
    declarations,
    variables,
    findings,
    unresolved,
  };
}

function extractCssColorTokens(cssFiles) {
  const tokens = new Map();

  for (const filePath of cssFiles) {
    const source = stripCssComments(fs.readFileSync(filePath, 'utf8'));
    const declarations = extractDeclarations(source);
    const variables = extractVariables(declarations);

    for (const [name, value] of variables.entries()) {
      const resolved = resolveCssVariable(value, variables);

      if (resolved && parseColor(resolved)) {
        tokens.set(name, {
          value: resolved,
          source: relativePath(filePath),
        });
      }
    }
  }

  return tokens;
}

/**
 * Only compare foreground/background declarations explicitly declared
 * under the same selector. This does not resolve the complete CSS cascade.
 */
function contrastFailuresForSimplePairs(analyses) {
  const failures = [];

  for (const analysis of analyses) {
    const colorsBySelector = new Map();

    for (const item of analysis.findings) {
      if (!['color', 'background-color'].includes(item.property)) {
        continue;
      }

      if (!colorsBySelector.has(item.selector)) {
        colorsBySelector.set(item.selector, {});
      }

      colorsBySelector.get(item.selector)[item.property] = item.value;
    }

    for (const [selector, pair] of colorsBySelector.entries()) {
      if (!pair.color || !pair['background-color']) {
        continue;
      }

      try {
        const ratio = contrastRatio(pair.color, pair['background-color']);

        if (ratio < NORMAL_TEXT_MIN) {
          failures.push({
            file: analysis.file,
            selector,
            foreground: pair.color,
            background: pair['background-color'],
            ratio: Number(ratio.toFixed(2)),
            minimum: NORMAL_TEXT_MIN,
          });
        }
      } catch {
        // Transparent colors require rendered-background analysis.
      }
    }
  }

  return failures;
}

test('WCAG contrast calculations match known reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.ok(
    Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.02
  );
  assert.ok(
    Math.abs(contrastRatio('#777777', '#ffffff') - 4.48) < 0.02
  );

  assert.equal(meetsContrast('#000000', '#ffffff', 4.5), true);
  assert.equal(meetsContrast('#777777', '#ffffff', 4.5), false);
  assert.equal(meetsContrast('#777777', '#ffffff', 3), true);
});

test('WCAG contrast calculations support short and alpha hex colors', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);

  const transparentBlack = parseColor('#00000000');

  assert.ok(transparentBlack);
  assert.equal(transparentBlack.a, 0);
  assert.equal(parseColor('#abcd').a, 0xdd / 255);
});

test('RGB and percentage RGB colors are parsed correctly', () => {
  assert.deepEqual(parseColor('rgb(0, 0, 0)'), {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  });

  assert.deepEqual(parseColor('rgb(100% 100% 100%)'), {
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  });

  assert.deepEqual(parseColor('rgb(0 0 0 / 50%)'), {
    r: 0,
    g: 0,
    b: 0,
    a: 0.5,
  });

  assert.equal(
    contrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)'),
    21
  );
});

test('transparent colors are not incorrectly treated as opaque', () => {
  assert.throws(
    () => relativeLuminance('transparent'),
    /transparent color/i
  );

  assert.throws(
    () => contrastRatio('#00000000', '#ffffff'),
    /transparent color/i
  );
});

test('contrast ratio is symmetric and at least 1 for opaque colors', () => {
  const pairs = [
    ['#000000', '#ffffff'],
    ['#162d25', '#f4efe6'],
    ['#8b1e3f', '#f7e7ce'],
    ['#444444', '#dddddd'],
  ];

  for (const [foreground, background] of pairs) {
    const forward = contrastRatio(foreground, background);
    const reverse = contrastRatio(background, foreground);

    assert.ok(forward >= 1);
    assert.ok(Math.abs(forward - reverse) < 1e-12);
  }
});

test('CSS asset directory exists and contains CSS files', (t) => {
  if (!fs.existsSync(CSS_DIR)) {
    t.diagnostic(`CSS directory not found: ${CSS_DIR}`);
    t.skip('Set ACCESSIBILITY_CSS_DIR to the actual CSS directory.');
    return;
  }

  const cssFiles = walkFiles(CSS_DIR, CSS_EXTENSIONS);

  assert.ok(cssFiles.length > 0, `No CSS files found under ${CSS_DIR}`);
});

test('CSS color declarations use parseable literals or resolvable variables', (t) => {
  if (!fs.existsSync(CSS_DIR)) {
    t.skip('CSS directory is unavailable.');
    return;
  }

  const cssFiles = walkFiles(CSS_DIR, CSS_EXTENSIONS);

  if (cssFiles.length === 0) {
    t.skip('No CSS files found.');
    return;
  }

  const issues = [];

  for (const filePath of cssFiles) {
    const analysis = analyzeCssFile(filePath);

    for (const item of analysis.unresolved) {
      issues.push(
        `${analysis.file}: ${item.selector} { ${item.property}: ${item.value} }`
      );
    }
  }

  assert.deepEqual(
    issues,
    [],
    `Unresolved CSS color values:\n${issues.join('\n')}`
  );
});

test('CSS custom-property color tokens are non-empty and parseable', (t) => {
  if (!fs.existsSync(CSS_DIR)) {
    t.skip('CSS directory is unavailable.');
    return;
  }

  const cssFiles = walkFiles(CSS_DIR, CSS_EXTENSIONS);

  if (cssFiles.length === 0) {
    t.skip('No CSS files found.');
    return;
  }

  const tokens = extractCssColorTokens(cssFiles);

  for (const [name, token] of tokens.entries()) {
    assert.ok(name.startsWith('--'));
    assert.ok(token.value.length > 0);

    assert.ok(
      parseColor(token.value),
      `Invalid color token ${name}: ${token.value} (${token.source})`
    );
  }
});

test('explicit CSS foreground/background pairs meet WCAG AA normal-text contrast', (t) => {
  if (!fs.existsSync(CSS_DIR)) {
    t.skip('CSS directory is unavailable.');
    return;
  }

  const cssFiles = walkFiles(CSS_DIR, CSS_EXTENSIONS);

  if (cssFiles.length === 0) {
    t.skip('No CSS files found.');
    return;
  }

  const failures = contrastFailuresForSimplePairs(
    cssFiles.map(analyzeCssFile)
  );

  assert.deepEqual(
    failures,
    [],
    [
      'Static CSS contrast failures detected.',
      'Review each pair and its actual text-size threshold.',
      JSON.stringify(failures, null, 2),
    ].join('\n')
  );
});

test('HTML asset directory can be scanned for inline color declarations', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.diagnostic(`HTML directory not found: ${HTML_DIR}`);
    t.skip('Set ACCESSIBILITY_HTML_DIR to the actual HTML directory.');
    return;
  }

  const htmlFiles = walkFiles(HTML_DIR, HTML_EXTENSIONS);

  if (htmlFiles.length === 0) {
    t.diagnostic(`No HTML files found under ${HTML_DIR}.`);
    t.skip('No HTML files available for static analysis.');
    return;
  }

  const findings = [];
  const inlineStylePattern =
    /\bstyle\s*=\s*(["'])(?:(?!\1)[\s\S])*?\b(?:color|background-color)\s*:/gi;

  for (const filePath of htmlFiles) {
    const source = fs.readFileSync(filePath, 'utf8');

    for (const match of source.matchAll(inlineStylePattern)) {
      findings.push({
        file: relativePath(filePath),
        declaration: match[0],
      });
    }
  }

  if (findings.length > 0) {
    t.diagnostic(
      `Found ${findings.length} inline color declaration(s); review rendered contrast:\n` +
        findings
          .slice(0, 25)
          .map((finding) => `${finding.file}: ${finding.declaration}`)
          .join('\n')
    );
  }
});

test('rendered pages meet WCAG AA text contrast where Playwright is installed', async (t) => {
  if (!BASE_URL) {
    t.skip('Set ACCESSIBILITY_BASE_URL to enable rendered-page checks.');
    return;
  }

  let configuredBase;

  try {
    configuredBase = new URL(BASE_URL);
  } catch {
    assert.fail(`ACCESSIBILITY_BASE_URL is not a valid URL: ${BASE_URL}`);
  }

  let chromium;

  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    if (REQUIRE_BROWSER) {
      assert.fail(
        'Playwright is required. Install it with ' +
          '`npm install --save-dev playwright` and ' +
          '`npx playwright install chromium`. ' +
          `Details: ${error.message}`
      );
    }

    t.skip('Playwright is not installed; static checks remain available.');
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    for (const route of ROUTES) {
      await t.test(`rendered contrast: ${route}`, async () => {
        const url = new URL(route, `${BASE_URL}/`);

        assert.equal(
          url.origin,
          configuredBase.origin,
          `Route must remain on the configured base origin: ${route}`
        );

        const response = await page.goto(url.href, {
          waitUntil: 'networkidle',
          timeout: TIMEOUT_MS,
        });

        assert.ok(response, `No navigation response received for ${route}`);

        assert.ok(
          response.status() < 400,
          `Page returned HTTP ${response.status()} for ${route}`
        );

        const results = await page.evaluate(() => {
          function parseComputedRgb(value) {
            const match = value.match(
              /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
            );

            if (!match) {
              return null;
            }

            const alpha = match[4]
              ? match[4].endsWith('%')
                ? Number.parseFloat(match[4]) / 100
                : Number.parseFloat(match[4])
              : 1;

            return {
              r: Number(match[1]) / 255,
              g: Number(match[2]) / 255,
              b: Number(match[3]) / 255,
              a: alpha,
            };
          }

          function linearize(value) {
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          }

          function luminance(color) {
            return (
              0.2126 * linearize(color.r) +
              0.7152 * linearize(color.g) +
              0.0722 * linearize(color.b)
            );
          }

          function ratio(foreground, background) {
            const foregroundLuminance = luminance(foreground);
            const backgroundLuminance = luminance(background);

            return (
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
            );
          }

          function isLargeText(style) {
            const size = Number.parseFloat(style.fontSize);
            const weight = Number.parseInt(style.fontWeight, 10) || 400;

            // WCAG large text: at least 24 CSS px, or about 18.67 px bold.
            return size >= 24 || (weight >= 700 && size >= 18.67);
          }

          function getOpaqueBackground(element) {
            let current = element;

            while (
              current &&
              current.nodeType === Node.ELEMENT_NODE
            ) {
              const style = getComputedStyle(current);
              const color = parseComputedRgb(style.backgroundColor);

              if (color) {
                if (color.a >= 0.999) {
                  return { color, unresolved: false };
                }

                // Correctly compositing translucent layers requires more
                // work; do not pretend an ancestor is the actual background.
                if (color.a > 0) {
                  return { color: null, unresolved: true };
                }
              }

              // Background images and gradients are not resolved here.
              if (style.backgroundImage !== 'none') {
                return { color: null, unresolved: true };
              }

              current = current.parentElement;
            }

            return { color: null, unresolved: true };
          }

          const failures = [];
          const unresolved = [];
          let checkedCount = 0;

          const candidates = document.querySelectorAll(
            'p, a, button, label, li, dt, dd, th, td, h1, h2, h3, h4, h5, h6, ' +
              'input, textarea, select, summary, [role="button"], [role="link"]'
          );

          for (const element of candidates) {
            const style = getComputedStyle(element);

            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number.parseFloat(style.opacity) === 0 ||
              element.getClientRects().length === 0
            ) {
              continue;
            }

            const text = (
              element.innerText ||
              element.value ||
              element.getAttribute('aria-label') ||
              ''
            ).trim();

            if (!text) {
              continue;
            }

            const foreground = parseComputedRgb(style.color);
            const backgroundResult = getOpaqueBackground(element);
            const background = backgroundResult.color;

            if (
              !foreground ||
              !background ||
              foreground.a < 0.999 ||
              backgroundResult.unresolved
            ) {
              unresolved.push({
                tag: element.tagName,
                text: text.slice(0, 80),
                reason:
                  'Foreground/background requires compositing, image, or gradient analysis.',
              });

              continue;
            }

            const minimum = isLargeText(style) ? 3 : 4.5;
            const contrast = ratio(foreground, background);

            checkedCount += 1;

            if (contrast < minimum) {
              failures.push({
                tag: element.tagName,
                text: text.slice(0, 80),
                foreground: style.color,
                background:
                  `rgb(${Math.round(background.r * 255)}, ` +
                  `${Math.round(background.g * 255)}, ` +
                  `${Math.round(background.b * 255)})`,
                ratio: Number(contrast.toFixed(2)),
                minimum,
              });
            }
          }

          return { failures, unresolved, checkedCount };
        });

        assert.ok(
          results.checkedCount > 0,
          `No text contrast pairs could be checked on ${route}.`
        );

        if (results.unresolved.length > 0) {
          t.diagnostic(
            `${route}: ${results.unresolved.length} text pair(s) require manual or advanced background analysis.`
          );
        }

        assert.deepEqual(
          results.failures,
          [],
          `WCAG AA text contrast failures on ${route}:\n` +
            JSON.stringify(results.failures, null, 2)
        );
      });
    }
  } finally {
    await browser.close();
  }
});

test('non-text UI contrast requirements are documented for manual verification', (t) => {
  t.diagnostic(
    `Verify component boundaries, meaningful icons, and visual control states against the WCAG ${NON_TEXT_MIN}:1 minimum where applicable.`
  );

  t.diagnostic(
    `Normal text requires ${NORMAL_TEXT_MIN}:1 contrast; large text requires ${LARGE_TEXT_MIN}:1 under WCAG AA.`
  );

  t.diagnostic(
    'Test hover, focus, disabled, error, selected, gradients, images, overlays, and transparent layers separately.'
  );
});
