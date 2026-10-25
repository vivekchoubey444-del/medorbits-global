
/**
 * MedOrbits -- Form Accessibility Tests
 * File: tests/accessibility/forms.accessibility.test.js
 *
 * Runtime: Node.js >= 20
 * package.json must contain: "type": "module"
 *
 * Static checks:
 *   node --test tests/accessibility/forms.accessibility.test.js
 *
 * Optional browser checks:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Example:
 *   ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
 *   ACCESSIBILITY_ROUTES=/,/contact,/login,/register \
 *   ACCESSIBILITY_REQUIRE_BROWSER=true \
 *   node --test tests/accessibility/forms.accessibility.test.js
 *
 * Optional:
 *   ACCESSIBILITY_HTML_DIR=.
 *
 * Limitations:
 *   - Static HTML analysis is heuristic, not a complete HTML parser.
 *   - Browser checks inspect selected form semantics, not every WCAG 2.2
 *     criterion or assistive-technology behavior.
 *   - Dynamic forms, custom widgets, and client-side validation flows
 *     require additional testing.
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

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

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

function getFiles() {
  return walkHtmlFiles(HTML_DIR);
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"',
  };

  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, reference) => {
      if (reference.startsWith('#x') || reference.startsWith('#X')) {
        const codePoint = Number.parseInt(reference.slice(2), 16);

        if (
          Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return String.fromCodePoint(codePoint);
        }

        return '\uFFFD';
      }

      if (reference.startsWith('#')) {
        const codePoint = Number.parseInt(reference.slice(1), 10);

        if (
          Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff &&
          !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return String.fromCodePoint(codePoint);
        }

        return '\uFFFD';
      }

      return namedEntities[reference.toLowerCase()] ?? entity;
    }
  );
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function stripRawTextElements(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
}

function parseAttributes(attributeText) {
  const attributes = new Map();

  // Supports double-quoted, single-quoted, and unquoted attribute values.
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

function extractElements(html, tagName) {
  const results = [];
  const safeTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Lightweight scanner; not suitable for parsing arbitrary malformed HTML.
  const pattern = new RegExp(
    `<${safeTag}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${safeTag}\\s*>)`,
    'gi'
  );

  let match;

  while ((match = pattern.exec(html)) !== null) {
    results.push({
      attributes: parseAttributes(match[1] ?? ''),
      innerHtml: match[2] ?? '',
      source: match[0],
    });
  }

  return results;
}

function extractInputs(html) {
  const results = [];
  const pattern = /<input\b([^>]*)>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    results.push({
      attributes: parseAttributes(match[1]),
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
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function getIdCounts(html) {
  const counts = new Map();
  const pattern =
    /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

  let match;

  while ((match = pattern.exec(html)) !== null) {
    const id = decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');

    if (!id) {
      continue;
    }

    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return counts;
}

function getLabelTargets(html) {
  return extractElements(html, 'label').map((label) => ({
    target: label.attributes.get('for'),
    text: extractText(label.innerHtml),
    attributes: label.attributes,
    innerHtml: label.innerHtml,
  }));
}

function hasAssociatedExplicitLabel(attributes, labels) {
  const id = attributes.get('id');

  return Boolean(
    id &&
      labels.some(
        (label) => label.target === id && label.text.trim()
      )
  );
}

function hasValidLabelledBy(attributes, ids) {
  const value = attributes.get('aria-labelledby');

  if (!value?.trim()) {
    return false;
  }

  const referencedIds = value.split(/\s+/).filter(Boolean);

  return (
    referencedIds.length > 0 &&
    referencedIds.every((id) => ids.has(id))
  );
}

function hasExplicitAccessibleName(attributes, ids) {
  const ariaLabel = attributes.get('aria-label');

  if (ariaLabel?.trim()) {
    return true;
  }

  if (hasValidLabelledBy(attributes, ids)) {
    return true;
  }

  return Boolean(attributes.get('title')?.trim());
}

function isDisabled(attributes) {
  return (
    attributes.has('disabled') ||
    attributes.get('aria-disabled') === 'true'
  );
}

function getControlName(attributes) {
  return (
    attributes.get('name') ||
    attributes.get('id') ||
    '(unnamed)'
  );
}

function isLabelableInput(attributes) {
  const type = (attributes.get('type') || 'text').toLowerCase();

  return ![
    'hidden',
    'submit',
    'reset',
    'button',
    'image',
  ].includes(type);
}

function isRequired(attributes) {
  return (
    attributes.has('required') ||
    attributes.get('aria-required') === 'true'
  );
}

function getFormControls(formHtml) {
  const controls = [];
  const pattern = /<(input|select|textarea|button)\b([^>]*)>/gi;
  let match;

  while ((match = pattern.exec(formHtml)) !== null) {
    controls.push({
      tag: match[1].toLowerCase(),
      attributes: parseAttributes(match[2]),
    });
  }

  return controls;
}

function getSourceIssues() {
  const violations = [];

  for (const file of getFiles()) {
    const html = stripComments(
      fs.readFileSync(file, 'utf8')
    );

    const relative = relativePath(file);
    const idCounts = getIdCounts(html);
    const ids = new Set(idCounts.keys());
    const labels = getLabelTargets(html);

    // Duplicate IDs make label and ARIA references ambiguous.
    for (const [id, count] of idCounts.entries()) {
      if (count > 1) {
        violations.push(
          `${relative}: ID "${id}" appears ${count} times`
        );
      }
    }

    // Labels must reference existing IDs and contain a name.
    for (const label of labels) {
      if (!label.target) {
        // A label without "for" may still label a nested control.
        const nestedControl = /<(input|select|textarea)\b/i.test(
          label.innerHtml
        );

        if (!nestedControl) {
          violations.push(
            `${relative}: label is not associated with a form control`
          );
        }

        if (!label.text.trim() && !nestedControl) {
          violations.push(
            `${relative}: label has no detectable text`
          );
        }

        continue;
      }

      if (!ids.has(label.target)) {
        violations.push(
          `${relative}: label for="${label.target}" references no existing ID`
        );
      }

      if (!label.text.trim()) {
        violations.push(
          `${relative}: label for="${label.target}" has no detectable text`
        );
      }
    }

    const controls = [
      ...extractInputs(html).map((item) => ({
        tag: 'input',
        attributes: item.attributes,
      })),
      ...extractElements(html, 'select').map((item) => ({
        tag: 'select',
        attributes: item.attributes,
      })),
      ...extractElements(html, 'textarea').map((item) => ({
        tag: 'textarea',
        attributes: item.attributes,
      })),
    ];

    for (const control of controls) {
      const { tag, attributes } = control;

      if (
        (tag === 'input' && !isLabelableInput(attributes)) ||
        isDisabled(attributes)
      ) {
        continue;
      }

      const named =
        hasAssociatedExplicitLabel(attributes, labels) ||
        hasValidLabelledBy(attributes, ids) ||
        Boolean(attributes.get('aria-label')?.trim()) ||
        Boolean(attributes.get('title')?.trim());

      if (!named) {
        violations.push(
          `${relative}: ${tag} "${getControlName(attributes)}" has no detectable accessible name`
        );
      }

      if (
        attributes.has('required') &&
        attributes.get('aria-required') === 'false'
      ) {
        violations.push(
          `${relative}: required ${tag} "${getControlName(attributes)}" contradicts aria-required="false"`
        );
      }

      if (
        isRequired(attributes) &&
        attributes.get('aria-invalid') === 'true'
      ) {
        const describedBy = attributes.get('aria-describedby');

        if (!describedBy) {
          violations.push(
            `${relative}: invalid field "${getControlName(attributes)}" has no aria-describedby error/help reference`
          );
        }
      }

      const describedBy = attributes.get('aria-describedby');

      if (describedBy) {
        for (const id of describedBy.split(/\s+/).filter(Boolean)) {
          if (!ids.has(id)) {
            violations.push(
              `${relative}: aria-describedby on "${getControlName(attributes)}" references missing ID "${id}"`
            );
          }
        }
      }

      const describedByLabelledBy = attributes.get('aria-labelledby');

      if (describedByLabelledBy) {
        for (const id of describedByLabelledBy.split(/\s+/).filter(Boolean)) {
          if (!ids.has(id)) {
            violations.push(
              `${relative}: aria-labelledby on "${getControlName(attributes)}" references missing ID "${id}"`
            );
          }
        }
      }

      if (
        tag === 'input' &&
        attributes.get('type')?.toLowerCase() === 'password' &&
        !attributes.has('autocomplete')
      ) {
        // Review finding rather than a strict failure: autocomplete policy
        // depends on the form's purpose and the intended user journey.
      }
    }

    // Validate input type values.
    const validTypes = new Set([
      'text',
      'search',
      'email',
      'url',
      'tel',
      'password',
      'date',
      'datetime-local',
      'month',
      'week',
      'time',
      'number',
      'range',
      'color',
      'checkbox',
      'radio',
      'file',
      'submit',
      'image',
      'reset',
      'button',
      'hidden',
    ]);

    for (const input of extractInputs(html)) {
      const type = (
        input.attributes.get('type') || 'text'
      ).toLowerCase();

      if (!validTypes.has(type)) {
        violations.push(
          `${relative}: input "${getControlName(input.attributes)}" has unsupported type "${type}"`
        );
      }
    }

    // Static form scanner: nested forms and unusual markup may be missed.
    for (const form of extractElements(html, 'form')) {
      const controls = getFormControls(form.innerHtml);

      const hasSubmit = controls.some(({ tag, attributes }) => {
        const type = (attributes.get('type') || '').toLowerCase();

        if (tag === 'button') {
          // Per HTML, a button inside a form defaults to submit.
          return !type || type === 'submit';
        }

        return (
          tag === 'input' &&
          (type === 'submit' || type === 'image')
        );
      });

      if (!hasSubmit) {
        violations.push(
          `${relative}: form has no detectable submit control`
        );
      }
    }
  }

  return violations;
}

test('HTML asset directory is available for static form checks', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.skip(`HTML directory not found: ${HTML_DIR}`);
    return;
  }

  const files = getFiles();

  if (files.length === 0) {
    t.skip(`No HTML files found under ${HTML_DIR}`);
    return;
  }

  assert.ok(files.length > 0);
});

test('static form accessibility checks pass', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.skip('HTML directory is unavailable.');
    return;
  }

  const files = getFiles();

  if (files.length === 0) {
    t.skip('No HTML files found.');
    return;
  }

  const violations = getSourceIssues();

  assert.deepEqual(
    violations,
    [],
    `Static form accessibility issues:\n${violations.join('\n')}`
  );
});

test('password and account email fields are reviewed for autocomplete', (t) => {
  if (!fs.existsSync(HTML_DIR)) {
    t.skip('HTML directory is unavailable.');
    return;
  }

  const findings = [];

  for (const file of getFiles()) {
    const html = stripComments(
      fs.readFileSync(file, 'utf8')
    );

    for (const input of extractInputs(html)) {
      const attributes = input.attributes;
      const type = (
        attributes.get('type') || 'text'
      ).toLowerCase();

      const autocomplete = (
        attributes.get('autocomplete') || ''
      ).toLowerCase();

      const identity = [
        file,
        attributes.get('name') || '',
        attributes.get('id') || '',
      ].join(' ');

      if (
        type === 'password' &&
        !autocomplete &&
        /login|sign.?in|register|signup|account|password/i.test(identity)
      ) {
        findings.push(
          `${relativePath(file)}: password field "${getControlName(attributes)}" should be reviewed for an appropriate autocomplete token`
        );
      }

      if (
        type === 'email' &&
        !autocomplete &&
        /login|sign.?in|register|signup|account|profile/i.test(identity)
      ) {
        findings.push(
          `${relativePath(file)}: account email field "${getControlName(attributes)}" should be reviewed for autocomplete`
        );
      }
    }
  }

  if (findings.length > 0) {
    t.diagnostic(
      `Autocomplete review findings:\n${findings.join('\n')}`
    );
  }
});

test('rendered forms expose accessible names, error descriptions, and submit controls', async (t) => {
  if (!BASE_URL) {
    t.skip(
      'Set ACCESSIBILITY_BASE_URL to enable browser-based checks.'
    );
    return;
  }

  let configuredBase;

  try {
    configuredBase = new URL(BASE_URL);
  } catch {
    assert.fail(
      `ACCESSIBILITY_BASE_URL is not a valid URL: ${BASE_URL}`
    );
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

    t.skip(
      'Playwright is not installed; static checks remain available.'
    );
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    for (const route of ROUTES) {
      await t.test(`form accessibility: ${route}`, async () => {
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

          assert.ok(
            response,
            `No navigation response received for ${route}`
          );

          assert.ok(
            response.status() < 400,
            `HTTP ${response.status()} returned for ${route}`
          );

          const results = await page.evaluate(() => {
            const violations = [];
            const forms = [...document.querySelectorAll('form')];

            function accessibleName(element) {
              const ariaLabel = element.getAttribute('aria-label');

              if (ariaLabel?.trim()) {
                return ariaLabel.trim();
              }

              const labelledBy = element.getAttribute('aria-labelledby');

              if (labelledBy) {
                const text = labelledBy
                  .split(/\s+/)
                  .map(
                    (id) =>
                      document.getElementById(id)?.textContent || ''
                  )
                  .join(' ')
                  .trim();

                if (text) {
                  return text;
                }
              }

              if (element.labels?.length) {
                const text = [...element.labels]
                  .map((label) => label.textContent || '')
                  .join(' ')
                  .trim();

                if (text) {
                  return text;
                }
              }

              return element.getAttribute('title')?.trim() || '';
            }

            for (const form of forms) {
              const controls = [
                ...form.querySelectorAll('input, select, textarea'),
              ];

              for (const control of controls) {
                const type = (
                  control.getAttribute('type') || 'text'
                ).toLowerCase();

                if (
                  [
                    'hidden',
                    'submit',
                    'reset',
                    'button',
                    'image',
                  ].includes(type) ||
                  control.disabled
                ) {
                  continue;
                }

                if (!accessibleName(control)) {
                  violations.push({
                    type: 'missing-accessible-name',
                    tag: control.tagName,
                    inputType: type,
                    id: control.id || null,
                    name: control.getAttribute('name'),
                  });
                }

                if (
                  control.required &&
                  control.getAttribute('aria-required') === 'false'
                ) {
                  violations.push({
                    type: 'contradictory-required-state',
                    id: control.id || null,
                    name: control.getAttribute('name'),
                  });
                }

                const describedBy = (
                  control.getAttribute('aria-describedby') || ''
                )
                  .split(/\s+/)
                  .filter(Boolean);

                const missingDescriptions = describedBy.filter(
                  (id) => !document.getElementById(id)
                );

                if (missingDescriptions.length > 0) {
                  violations.push({
                    type: 'broken-error-or-help-description',
                    id: control.id || null,
                    missingIds: missingDescriptions,
                  });
                }

                if (
                  control.getAttribute('aria-invalid') === 'true'
                ) {
                  if (describedBy.length === 0) {
                    violations.push({
                      type: 'missing-error-description',
                      id: control.id || null,
                      name: control.getAttribute('name'),
                    });
                  } else {
                    const descriptionText = describedBy
                      .map(
                        (id) =>
                          document.getElementById(id)?.textContent || ''
                      )
                      .join(' ')
                      .trim();

                    if (!descriptionText) {
                      violations.push({
                        type: 'empty-error-description',
                        id: control.id || null,
                        name: control.getAttribute('name'),
                      });
                    }
                  }
                }
              }

              const submitButtons = [
                ...form.querySelectorAll(
                  'button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]'
                ),
              ];

              if (submitButtons.length === 0) {
                violations.push({
                  type: 'missing-submit-control',
                  formId: form.id || null,
                });
              }

              for (const button of submitButtons) {
                const type = (
                  button.getAttribute('type') || 'submit'
                ).toLowerCase();

                if (type === 'image') {
                  if (
                    !button.getAttribute('alt')?.trim() &&
                    !button.getAttribute('aria-label')?.trim()
                  ) {
                    violations.push({
                      type: 'unnamed-image-submit',
                      formId: form.id || null,
                    });
                  }

                  continue;
                }

                const name =
                  accessibleName(button) ||
                  (button.innerText || button.value || '').trim();

                if (!name) {
                  violations.push({
                    type: 'unnamed-submit-button',
                    formId: form.id || null,
                  });
                }
              }

              for (const fieldset of form.querySelectorAll('fieldset')) {
                const legend = fieldset.querySelector(':scope > legend');

                if (!legend?.textContent.trim()) {
                  violations.push({
                    type: 'fieldset-missing-legend',
                    formId: form.id || null,
                  });
                }
              }
            }

            return {
              formCount: forms.length,
              violations,
            };
          });

          if (results.formCount === 0) {
            // A route may legitimately have no form.
            return;
          }

          assert.deepEqual(
            results.violations,
            [],
            `Form accessibility violations on ${route}:\n` +
              JSON.stringify(results.violations, null, 2)
          );
        } finally {
          await page.close();
        }
      });
    }
  } finally {
    await browser.close();
  }
});
