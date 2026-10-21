/**

* MedOrbits -- Form Accessibility Tests
* File: tests/accessibility/forms.accessibility.test.js
* Runtime: Node.js >= 20; package.json uses "type": "module".
* Static checks:
* node –test tests/accessibility/forms.accessibility.test.js
* Optional browser checks:
* npm install –save-dev playwright
* npx playwright install chromium
* Example:
* ACCESSIBILITY_BASE_URL=http://127.0.0.1:3000 \
* ACCESSIBILITY_ROUTES=/,/contact,/login,/register \
* ACCESSIBILITY_REQUIRE_BROWSER=true \
* node –test tests/accessibility/forms.accessibility.test.js
* Optional:
* ACCESSIBILITY_HTML_DIR=.
* Limitations:
* Static HTML analysis is heuristic. Browser checks cover selected form
* semantics, not all WCAG 2.2 criteria or assistive-technology behavior.
    */

import test from ‘node:test’;
import assert from ‘node:assert/strict’;
import fs from ‘node:fs’;
import path from ‘node:path’;
import { fileURLToPath } from ‘node:url’;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, ‘../..’);

function resolveInsideRoot(value, label) {
const resolved = path.resolve(ROOT_DIR, value);
const relative = path.relative(ROOT_DIR, resolved);

if (
relative === ‘..’ ||
relative.startsWith(..${path.sep}) ||
path.isAbsolute(relative)
) {
throw new Error(${label} must be inside the repository root.);
}

return resolved;
}

const HTML_DIR = resolveInsideRoot(
process.env.ACCESSIBILITY_HTML_DIR || ‘.’,
‘ACCESSIBILITY_HTML_DIR’
);

const BASE_URL = (process.env.ACCESSIBILITY_BASE_URL || ‘’).replace(//+$/, ‘’);

const ROUTES = (process.env.ACCESSIBILITY_ROUTES || ‘/’)
.split(’,’)
.map((route) => route.trim())
.filter(Boolean);

const REQUIRE_BROWSER =
process.env.ACCESSIBILITY_REQUIRE_BROWSER === ‘true’;

const TIMEOUT_MS = 20_000;
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
return path.relative(ROOT_DIR, filePath).split(path.sep).join(’/’);
}

function decodeHtmlEntities(value) {
return value
.replace(/ /gi, ’ ‘)
.replace(/&/gi, ‘&’)
.replace(/</gi, ‘<’)
.replace(/>/gi, ‘>’)
.replace(/"/gi, ‘"’)
.replace(/'/gi, "’")
.replace(/&#x([0-9a-f]+);/gi, (, hex) => {
const codePoint = Number.parseInt(hex, 16);
return codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
? String.fromCodePoint(codePoint)
: ‘\uFFFD’;
})
.replace(/&#(\d+);/g, (, decimal) => {
const codePoint = Number.parseInt(decimal, 10);
return codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
? String.fromCodePoint(codePoint)
: ‘\uFFFD’;
});
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
  attributes.set(name, decodeHtmlEntities(value));
}

}

return attributes;
}

/**

* Lightweight source scanner. Not a complete HTML parser.
* Use rendered-browser checks for implicit labels and computed semantics.
    */
    function extractElements(html, tagName) {
    const results = [];
    const pattern = new RegExp(
    <${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}\\s*>|<${tagName}\\b([^>]*)\\/?>,
    ‘gi’
    );

let match;

while ((match = pattern.exec(html)) !== null) {
results.push({
attributes: parseAttributes(match[1] ?? match[3] ?? ‘’),
innerHtml: match[2] ?? ‘’,
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
.replace(/<script\b[^>]>[\s\S]?</script>/gi, ‘’)
.replace(/<style\b[^>]>[\s\S]?</style>/gi, ‘’)
.replace(/<[^>]+>/g, ’ ’)
.replace(/\s+/g, ’ ’)
.trim()
);
}

function getIdSet(html) {
const ids = new Set();
const pattern = /\bid\s*=\s*(?:"([^"]+)"|’([^’]+)’|([^\s>]+))/gi;
let match;

while ((match = pattern.exec(html)) !== null) {
ids.add(match[1] ?? match[2] ?? match[3]);
}

return ids;
}

function getIdCounts(html) {
const counts = new Map();
const pattern = /\bid\s*=\s*(?:"([^"]+)"|’([^’]+)’|([^\s>]+))/gi;
let match;

while ((match = pattern.exec(html)) !== null) {
const id = match[1] ?? match[2] ?? match[3];
counts.set(id, (counts.get(id) || 0) + 1);
}

return counts;
}

function getLabelTargets(html) {
return extractElements(html, ‘label’).map((label) => ({
target: label.attributes.get(‘for’),
text: extractText(label.innerHtml),
attributes: label.attributes,
}));
}

function hasExplicitAccessibleName(attributes) {
const ariaLabel = attributes.get(‘aria-label’);
const labelledBy = attributes.get(‘aria-labelledby’);
const title = attributes.get(‘title’);

return Boolean(
(ariaLabel && ariaLabel.trim()) ||
(labelledBy && labelledBy.trim()) ||
(title && title.trim())
);
}

function hasValidLabelledBy(attributes, ids) {
const value = attributes.get(‘aria-labelledby’);

if (!value) {
return false;
}

const idsToCheck = value.split(/\s+/).filter(Boolean);

return (
idsToCheck.length > 0 &&
idsToCheck.every((id) => ids.has(id))
);
}

function isDisabled(attributes) {
return (
attributes.has(‘disabled’) ||
attributes.get(‘aria-disabled’) === ‘true’
);
}

function getControlName(attributes) {
return (
attributes.get(‘name’) ||
attributes.get(‘id’) ||
‘(unnamed)’
);
}

function isLabelableInput(attributes) {
const type = (attributes.get(‘type’) || ‘text’).toLowerCase();

return ![
‘hidden’,
‘submit’,
‘reset’,
‘button’,
‘image’,
].includes(type);
}

function hasAssociatedExplicitLabel(attributes, labels) {
const id = attributes.get(‘id’);

return Boolean(
id &&
labels.some(
(label) => label.target === id && label.text.trim()
)
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

function getFiles() {
return walkHtmlFiles(HTML_DIR);
}

function getSourceIssues() {
const violations = [];

for (const file of getFiles()) {
const html = stripComments(fs.readFileSync(file, ‘utf8’));
const relative = relativePath(file);
const ids = getIdSet(html);
const labels = getLabelTargets(html);

for (const label of labels) {
  if (!label.target) {
    continue;
  }
  if (!ids.has(label.target)) {
    violations.push(
      `${relative}: label for="${label.target}" references no existing ID`
    );
  }
  if (!label.text.trim()) {
    violations.push(
      `${relative}: label for="${label.target}" has no text content`
    );
  }
}
for (const input of extractInputs(html)) {
  const attributes = input.attributes;
  if (!isLabelableInput(attributes) || isDisabled(attributes)) {
    continue;
  }
  const named =
    hasAssociatedExplicitLabel(attributes, labels) ||
    hasValidLabelledBy(attributes, ids) ||
    Boolean(attributes.get('aria-label')?.trim()) ||
    Boolean(attributes.get('title')?.trim());
  if (!named) {
    violations.push(
      `${relative}: input "${getControlName(attributes)}" has no detectable accessible name`
    );
  }
}
for (const tag of ['select', 'textarea']) {
  for (const element of extractElements(html, tag)) {
    const attributes = element.attributes;
    if (isDisabled(attributes)) {
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
  }
}
for (const [id, count] of getIdCounts(html)) {
  if (count > 1) {
    violations.push(
      `${relative}: ID "${id}" appears ${count} times`
    );
  }
}
for (const tag of ['input', 'select', 'textarea']) {
  const elements =
    tag === 'input'
      ? extractInputs(html)
      : extractElements(html, tag);
  for (const element of elements) {
    const attributes = element.attributes;
    if (
      isDisabled(attributes) ||
      !(
        attributes.has('required') ||
        attributes.get('aria-required') === 'true'
      )
    ) {
      continue;
    }
    if (
      attributes.has('required') &&
      attributes.get('aria-required') === 'false'
    ) {
      violations.push(
        `${relative}: required ${tag} "${getControlName(attributes)}" contradicts aria-required="false"`
      );
    }
    if (!attributes.get('id')) {
      violations.push(
        `${relative}: required ${tag} "${getControlName(attributes)}" has no ID`
      );
    }
  }
}
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
  const type = (input.attributes.get('type') || 'text').toLowerCase();
  if (!validTypes.has(type)) {
    violations.push(
      `${relative}: input "${getControlName(input.attributes)}" has unsupported type "${type}"`
    );
  }
}
for (const form of extractElements(html, 'form')) {
  const controls = getFormControls(form.innerHtml);
  const hasSubmit = controls.some((control) => {
    if (control.tag === 'button') {
      const type = (
        control.attributes.get('type') || 'submit'
      ).toLowerCase();
      return type === 'submit';
    }
    if (control.tag === 'input') {
      const type = (
        control.attributes.get('type') || 'text'
      ).toLowerCase();
      return type === 'submit' || type === 'image';
    }
    return false;
  });
  if (!hasSubmit) {
    violations.push(
      `${relative}: form has no explicit submit control`
    );
  }
}
for (const attributes of [
  ...extractInputs(html).map((item) => item.attributes),
  ...extractElements(html, 'select').map((item) => item.attributes),
  ...extractElements(html, 'textarea').map((item) => item.attributes),
]) {
  if (attributes.get('aria-invalid') !== 'true') {
    continue;
  }
  const describedBy = attributes.get('aria-describedby');
  if (!describedBy) {
    violations.push(
      `${relative}: invalid field "${getControlName(attributes)}" has no aria-describedby`
    );
    continue;
  }
  for (const id of describedBy.split(/\s+/).filter(Boolean)) {
    if (!ids.has(id)) {
      violations.push(
        `${relative}: aria-describedby references missing ID "${id}"`
      );
    }
  }
}

}

return violations;
}

test(‘HTML asset directory is available for static form checks’, (t) => {
if (!fs.existsSync(HTML_DIR)) {
t.skip(HTML directory not found: ${HTML_DIR});
return;
}

const files = getFiles();

if (files.length === 0) {
t.skip(No HTML files found under ${HTML_DIR});
return;
}

assert.ok(files.length > 0);
});

test(‘static form accessibility checks pass’, (t) => {
if (!fs.existsSync(HTML_DIR)) {
t.skip(‘HTML directory is unavailable.’);
return;
}

const files = getFiles();

if (files.length === 0) {
t.skip(‘No HTML files found.’);
return;
}

const violations = getSourceIssues();

assert.deepEqual(
violations,
[],
Static form accessibility issues:\n${violations.join('\n')}
);
});

test(‘password and account email fields are reviewed for autocomplete’, (t) => {
if (!fs.existsSync(HTML_DIR)) {
t.skip(‘HTML directory is unavailable.’);
return;
}

const findings = [];

for (const file of getFiles()) {
const html = stripComments(fs.readFileSync(file, ‘utf8’));

for (const input of extractInputs(html)) {
  const attributes = input.attributes;
  const type = (attributes.get('type') || 'text').toLowerCase();
  const autocomplete = (
    attributes.get('autocomplete') || ''
  ).toLowerCase();
  if (type === 'password' && !autocomplete) {
    findings.push(
      `${relativePath(file)}: password field "${getControlName(attributes)}" should be reviewed for an appropriate autocomplete token`
    );
  }
  if (
    type === 'email' &&
    !autocomplete &&
    /login|sign.?in|register|signup|account|profile/i.test(
      `${file} ${attributes.get('name') || ''} ${attributes.get('id') || ''}`
    )
  ) {
    findings.push(
      `${relativePath(file)}: account email field "${getControlName(attributes)}" should be reviewed for autocomplete`
    );
  }
}

}

if (findings.length > 0) {
t.diagnostic(
Autocomplete review findings:\n${findings.join('\n')}
);
}
});

test(‘rendered forms expose accessible names, error descriptions, and submit controls’, async (t) => {
if (!BASE_URL) {
t.skip(‘Set ACCESSIBILITY_BASE_URL to enable browser-based checks.’);
return;
}

let chromium;

try {
({ chromium } = await import(‘playwright’));
} catch (error) {
if (REQUIRE_BROWSER) {
assert.fail(
Playwright is required. Install it with npm install --save-dev playwright and npx playwright install chromium. Details: ${error.message}
);
}

t.skip('Playwright is not installed; static checks remain available.');
return;

}

const browser = await chromium.launch({ headless: true });

try {
for (const route of ROUTES) {
await t.test(form accessibility: ${route}, async () => {
const url = new URL(route, ${BASE_URL}/);

    assert.equal(
      url.origin,
      new URL(BASE_URL).origin,
      `Route must remain on the configured origin: ${route}`
    );
    const page = await browser.newPage();
    try {
      const response = await page.goto(url.href, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT_MS,
      });
      assert.ok(response, `No navigation response for ${route}`);
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
              .map((id) => document.getElementById(id)?.textContent || '')
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
          for (const control of form.querySelectorAll(
            'input, select, textarea'
          )) {
            const type = (
              control.getAttribute('type') || 'text'
            ).toLowerCase();
            if (
              ['hidden', 'submit', 'reset', 'button', 'image'].includes(type) ||
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
            if (control.getAttribute('aria-invalid') === 'true') {
              const references = (
                control.getAttribute('aria-describedby') || ''
              ).split(/\s+/).filter(Boolean);
              if (references.length === 0) {
                violations.push({
                  type: 'missing-error-description',
                  id: control.id || null,
                  name: control.getAttribute('name'),
                });
              } else {
                const missing = references.filter(
                  (id) => !document.getElementById(id)
                );
                if (missing.length > 0) {
                  violations.push({
                    type: 'broken-error-description',
                    id: control.id || null,
                    missingIds: missing,
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
          for (const group of form.querySelectorAll('fieldset')) {
            const legend = group.querySelector(':scope > legend');
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
        // This route may legitimately contain no forms.
        return;
      }
      assert.deepEqual(
        results.violations,
        [],
        `Form accessibility violations on ${route}:\n${JSON.stringify(results.violations, null, 2)}`
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