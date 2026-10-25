
/**
 * MedOrbits -- Homepage Accessibility Tests
 * File: tests/accessibility/homepage.accessibility.test.js
 *
 * Runtime: Node.js >= 20
 * package.json must use "type": "module".
 *
 * Run:
 *   node --test tests/accessibility/homepage.accessibility.test.js
 *
 * Dependency:
 *   npm install --save-dev jsdom
 *
 * Optional:
 *   ACCESSIBILITY_HOMEPAGE=index.html
 *   ACCESSIBILITY_CSS=assets/css/style.css,assets/css/accessibility.css
 *
 * Limitations:
 *   Static DOM and CSS checks are heuristic. They do not establish complete
 *   WCAG 2.2 conformance or replace browser and assistive-technology testing.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const HOMEPAGE_CANDIDATES = [
  process.env.ACCESSIBILITY_HOMEPAGE || 'index.html',
  'pages/index.html',
  'public/index.html',
];

const DEFAULT_CSS_CANDIDATES = [
  'style.css',
  'css/style.css',
  'assets/css/style.css',
  'assets/css/accessibility.css',
  'css/accessibility.css',
];

function resolveInsideRoot(relativePath, label = 'Path') {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  const relative = path.relative(PROJECT_ROOT, absolutePath);

  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be inside the project root.`);
  }

  return absolutePath;
}

function findExistingFile(candidates) {
  return candidates
    .map((candidate) => resolveInsideRoot(candidate, 'Configured path'))
    .find((absolutePath) => {
      try {
        return fs.statSync(absolutePath).isFile();
      } catch {
        return false;
      }
    });
}

function loadHomepage() {
  const homepagePath = findExistingFile(HOMEPAGE_CANDIDATES);

  if (!homepagePath) {
    throw new Error(
      `Homepage not found. Checked: ${HOMEPAGE_CANDIDATES.join(', ')}`
    );
  }

  return {
    path: homepagePath,
    html: fs.readFileSync(homepagePath, 'utf8'),
  };
}

function getCssCandidates() {
  if (!process.env.ACCESSIBILITY_CSS?.trim()) {
    return DEFAULT_CSS_CANDIDATES;
  }

  return process.env.ACCESSIBILITY_CSS
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadCss() {
  const externalCss = getCssCandidates()
    .map((candidate) => resolveInsideRoot(candidate, 'CSS path'))
    .filter((absolutePath) => {
      try {
        return fs.statSync(absolutePath).isFile();
      } catch {
        return false;
      }
    })
    .map((absolutePath) => fs.readFileSync(absolutePath, 'utf8'));

  return externalCss.join('\n');
}

function parseHomepage() {
  const homepage = loadHomepage();

  return {
    ...homepage,
    dom: new JSDOM(homepage.html, {
      url: 'https://medorbits.in/',
      pretendToBeVisual: true,
    }),
  };
}

function getAccessibleName(element) {
  const ariaLabel = element.getAttribute('aria-label');

  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  const labelledBy = element.getAttribute('aria-labelledby');

  if (labelledBy) {
    const name = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id))
      .filter(Boolean)
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(' ');

    if (name) {
      return name;
    }
  }

  if (element.labels?.length) {
    const labelText = [...element.labels]
      .map((label) => label.textContent.trim())
      .filter(Boolean)
      .join(' ');

    if (labelText) {
      return labelText;
    }
  }

  if (element.tagName === 'INPUT') {
    const type = (
      element.getAttribute('type') || 'text'
    ).toLowerCase();

    if (type === 'hidden') {
      return '';
    }

    if (type === 'image') {
      return (element.getAttribute('alt') || '').trim();
    }

    // The value of a text input is not its accessible name.
    if (['button', 'submit', 'reset'].includes(type)) {
      return (
        element.getAttribute('value') ||
        element.getAttribute('title') ||
        ''
      ).trim();
    }

    return (element.getAttribute('title') || '').trim();
  }

  if (element.tagName === 'IMG') {
    return (element.getAttribute('alt') || '').trim();
  }

  if (element.tagName === 'SVG') {
    const title = element.querySelector('title')?.textContent?.trim();

    if (title) {
      return title;
    }
  }

  return (
    element.getAttribute('title') ||
    element.textContent ||
    ''
  ).trim();
}

function parseColor(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  const namedColors = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    silver: [192, 192, 192],
    maroon: [128, 0, 0],
    navy: [0, 0, 128],
    teal: [0, 128, 128],
    purple: [128, 0, 128],
    orange: [255, 165, 0],
    yellow: [255, 255, 0],
    rebeccapurple: [102, 51, 153],
  };

  if (namedColors[normalized]) {
    return namedColors[normalized];
  }

  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hex) {
    let digits = hex[1];

    if (digits.length === 3) {
      digits = [...digits]
        .map((digit) => digit + digit)
        .join('');
    }

    return [
      Number.parseInt(digits.slice(0, 2), 16),
      Number.parseInt(digits.slice(2, 4), 16),
      Number.parseInt(digits.slice(4, 6), 16),
    ];
  }

  const rgb = normalized.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
  );

  if (rgb) {
    const alpha = rgb[4]
      ? rgb[4].endsWith('%')
        ? Number.parseFloat(rgb[4]) / 100
        : Number.parseFloat(rgb[4])
      : 1;

    if (
      alpha < 0.999 ||
      [rgb[1], rgb[2], rgb[3]].some(
        (channel) => !Number.isFinite(Number(channel))
      )
    ) {
      return null;
    }

    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
    ];
  }

  return null;
}

function relativeLuminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;

    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
}

function contrastRatio(foreground, background) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);

  if (!fg || !bg) {
    return null;
  }

  const luminanceA = relativeLuminance(fg);
  const luminanceB = relativeLuminance(bg);

  return (
    (Math.max(luminanceA, luminanceB) + 0.05) /
    (Math.min(luminanceA, luminanceB) + 0.05)
  );
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractCssRules(css) {
  const source = stripCssComments(css);
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    rules.push({
      selector: match[1].trim(),
      declarations: match[2].trim(),
    });
  }

  return rules;
}

function hasAccessibleFocusRule(css) {
  const rules = extractCssRules(css);

  return rules.some(({ selector, declarations }) => {
    if (!/:focus-visible\b/i.test(selector)) {
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

function getAllCss() {
  const homepage = loadHomepage();
  const dom = new JSDOM(homepage.html);

  const inlineCss = [...dom.window.document.querySelectorAll('style')]
    .map((style) => style.textContent || '')
    .join('\n');

  dom.window.close();

  return `${loadCss()}\n${inlineCss}`;
}

function getIds(document) {
  return [...document.querySelectorAll('[id]')]
    .map((element) => element.id)
    .filter(Boolean);
}

function getDuplicateIds(document) {
  const counts = new Map();

  for (const id of getIds(document)) {
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
}

function hasAccessibleLabel(element) {
  const id = element.id;
  const document = element.ownerDocument;

  const associatedLabel = Boolean(
    id &&
      [...document.querySelectorAll('label[for]')].some(
        (label) =>
          label.getAttribute('for') === id &&
          label.textContent.trim()
      )
  );

  const wrappingLabel = Boolean(
    element.closest('label')?.textContent.trim()
  );

  const ariaLabel = Boolean(
    element.getAttribute('aria-label')?.trim()
  );

  const labelledBy = element.getAttribute('aria-labelledby');

  const validLabelledBy = Boolean(
    labelledBy &&
      labelledBy
        .split(/\s+/)
        .filter(Boolean)
        .every((reference) => {
          const target = document.getElementById(reference);
          return Boolean(target?.textContent.trim());
        })
  );

  return (
    associatedLabel ||
    wrappingLabel ||
    ariaLabel ||
    validLabelledBy
  );
}

function isLargeTextRule(declarations) {
  const sizeMatch = declarations.match(
    /(?:^|;)\s*font-size\s*:\s*([\d.]+)(px|rem|em|pt)\b/i
  );

  if (!sizeMatch) {
    return false;
  }

  const size = Number(sizeMatch[1]);
  const unit = sizeMatch[2].toLowerCase();

  const pixels =
    unit === 'px'
      ? size
      : unit === 'pt'
        ? size * (4 / 3)
        : size * 16;

  const weightMatch = declarations.match(
    /(?:^|;)\s*font-weight\s*:\s*(bold|bolder|[1-9]00)\b/i
  );

  const weight = weightMatch
    ? weightMatch[1] === 'bold' || weightMatch[1] === 'bolder'
      ? 700
      : Number(weightMatch[1])
    : 400;

  return pixels >= 24 || (pixels >= 18.67 && weight >= 700);
}

let dom;
let document;
let homepageHtml;
let homepagePath;
let css;

before(() => {
  const homepage = parseHomepage();

  dom = homepage.dom;
  document = dom.window.document;
  homepageHtml = homepage.html;
  homepagePath = homepage.path;
  css = getAllCss();
});

after(() => {
  dom?.window.close();
});

test('homepage exists and contains HTML content', () => {
  assert.ok(fs.existsSync(homepagePath));
  assert.ok(homepageHtml.trim().length > 0);
  assert.ok(document.documentElement);
  assert.ok(document.body);
});

test('document declares its language', () => {
  assert.ok(document.documentElement.getAttribute('lang')?.trim());
});

test('document includes a meaningful title', () => {
  assert.ok(document.title.trim().length > 0);
});

test('document includes a responsive viewport declaration', () => {
  const viewport = document.querySelector('meta[name="viewport"]');

  assert.ok(viewport, 'Missing responsive viewport meta tag.');

  const content = viewport.getAttribute('content') || '';

  assert.match(content, /width\s*=\s*device-width/i);
  assert.doesNotMatch(content, /user-scalable\s*=\s*no/i);
  assert.doesNotMatch(
    content,
    /maximum-scale\s*=\s*1(?:\.0+)?(?:\s|,|$)/i
  );
});

test('homepage has exactly one non-empty h1', () => {
  const headings = document.querySelectorAll('h1');

  assert.equal(headings.length, 1);
  assert.ok(headings[0].textContent.trim().length > 0);
});

test('heading levels do not skip hierarchy', () => {
  const headings = [...document.querySelectorAll(
    'h1, h2, h3, h4, h5, h6'
  )];

  let previousLevel = 0;

  for (const heading of headings) {
    const level = Number(heading.tagName.slice(1));

    assert.ok(
      heading.textContent.trim().length > 0,
      `${heading.tagName} has no text content.`
    );

    if (previousLevel > 0) {
      assert.ok(
        level <= previousLevel + 1,
        `${heading.tagName} skips a heading level after H${previousLevel}.`
      );
    }

    previousLevel = level;
  }
});

test('homepage exposes a main landmark', () => {
  assert.ok(document.querySelector('main, [role="main"]'));
});

test('multiple navigation landmarks have accessible names', () => {
  const navigation = [
    ...document.querySelectorAll('nav, [role="navigation"]'),
  ];

  if (navigation.length > 1) {
    for (const element of navigation) {
      assert.ok(
        getAccessibleName(element).length > 0,
        'Each navigation landmark should have a distinguishing accessible name.'
      );
    }
  }
});

test('main, header, and footer landmarks are not redundantly nested', () => {
  assert.equal(document.querySelector('main main'), null);
  assert.equal(document.querySelector('header header'), null);
  assert.equal(document.querySelector('footer footer'), null);
});

test('images have alt attributes', () => {
  for (const image of document.querySelectorAll('img')) {
    assert.ok(
      image.hasAttribute('alt'),
      `Image is missing alt text: ${image.getAttribute('src') || '(no src)'}`
    );
  }
});

test('non-empty image alt attributes contain meaningful text', () => {
  for (const image of document.querySelectorAll('img:not([alt=""])')) {
    assert.ok(image.getAttribute('alt')?.trim());
  }
});

test('links have detectable accessible names', () => {
  for (const link of document.querySelectorAll('a[href]')) {
    assert.ok(
      getAccessibleName(link).length > 0,
      `Link has no detectable accessible name: ${link.outerHTML.slice(0, 180)}`
    );
  }
});

test('buttons and button-like controls have accessible names', () => {
  const selector = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    '[role="button"]',
  ].join(',');

  for (const button of document.querySelectorAll(selector)) {
    assert.ok(
      getAccessibleName(button).length > 0,
      `Button has no detectable accessible name: ${button.outerHTML.slice(0, 180)}`
    );
  }
});

test('icon-only controls have accessible names', () => {
  const selector = [
    'button:has(svg)',
    'a[href]:has(svg)',
    'button:has(i[class*="icon"])',
    'a[href]:has(i[class*="icon"])',
  ].join(',');

  for (const control of document.querySelectorAll(selector)) {
    const hasText = Boolean(control.textContent.trim());

    const hasImageAlternative = Boolean(
      control.querySelector('img[alt]:not([alt=""])')
    );

    assert.ok(
      hasText ||
        hasImageAlternative ||
        getAccessibleName(control).length > 0,
      `Icon-only control needs an accessible name: ${control.outerHTML.slice(0, 180)}`
    );
  }
});

test('interactive controls do not use positive tabindex values', () => {
  for (const element of document.querySelectorAll(
    'a, button, input, select, textarea, [tabindex]'
  )) {
    const tabindex = element.getAttribute('tabindex');

    if (tabindex !== null) {
      assert.ok(
        Number(tabindex) <= 0,
        `Positive tabindex found: ${element.outerHTML.slice(0, 150)}`
      );
    }
  }
});

test('form controls have programmatic labels', () => {
  const selector = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
    'select',
    'textarea',
  ].join(',');

  for (const control of document.querySelectorAll(selector)) {
    assert.ok(
      hasAccessibleLabel(control),
      `Form control lacks a detectable label: ${control.outerHTML.slice(0, 180)}`
    );
  }
});

test('required fields expose a consistent required state', () => {
  for (const field of document.querySelectorAll(
    'input[required], select[required], textarea[required], [aria-required="true"]'
  )) {
    assert.ok(
      field.hasAttribute('required') ||
        field.getAttribute('aria-required') === 'true'
    );

    assert.notEqual(
      field.getAttribute('aria-required'),
      'false',
      'Required field contradicts aria-required="false".'
    );
  }
});

test('invalid fields reference an error description', () => {
  for (const field of document.querySelectorAll('[aria-invalid="true"]')) {
    const references = (
      field.getAttribute('aria-describedby') || ''
    ).split(/\s+/).filter(Boolean);

    const hasDescription = references.some((id) => {
      const target = document.getElementById(id);
      return Boolean(target?.textContent.trim());
    });

    const hasInlineError = Boolean(
      field.parentElement?.querySelector(
        '[role="alert"], .error, .error-message, .field-error'
      )
    );

    assert.ok(
      hasDescription || hasInlineError,
      `Invalid field lacks an associated error description: ${field.outerHTML.slice(0, 180)}`
    );
  }
});

test('placeholder text is not the only detectable label', () => {
  for (const control of document.querySelectorAll(
    'input[placeholder], textarea[placeholder]'
  )) {
    assert.ok(
      hasAccessibleLabel(control),
      `Placeholder-only field: ${control.outerHTML.slice(0, 180)}`
    );
  }
});

test('CSS defines a visible focus indicator', () => {
  assert.ok(
    hasAccessibleFocusRule(css),
    'Add a visible :focus-visible rule using outline, border, or box-shadow.'
  );
});

test('CSS respects reduced-motion preferences', () => {
  assert.match(css, /prefers-reduced-motion\s*:\s*reduce/i);
});

test('CSS includes a responsive layout mechanism', () => {
  const hasResponsiveRules =
    /@media\b/i.test(css) ||
    /max-width\s*:\s*100%/i.test(css) ||
    /width\s*:\s*min\(/i.test(css) ||
    /grid-template-columns\s*:\s*repeat\(\s*auto-fit/i.test(css) ||
    /grid-template-columns\s*:\s*repeat\(\s*auto-fill/i.test(css);

  assert.ok(hasResponsiveRules);
});

test('CSS includes safeguards against common horizontal overflow', () => {
  const hasOverflowSafeguard =
    /overflow-wrap\s*:\s*(?:anywhere|break-word)/i.test(css) ||
    /word-break\s*:\s*break-word/i.test(css) ||
    /max-width\s*:\s*100%/i.test(css) ||
    /overflow-x\s*:\s*(?:hidden|clip|auto)/i.test(css);

  assert.ok(hasOverflowSafeguard);
});

test('ARIA ID references point to existing elements', () => {
  const attributes = [
    'aria-labelledby',
    'aria-describedby',
    'aria-controls',
    'aria-owns',
    'aria-details',
    'aria-errormessage',
  ];

  for (const attribute of attributes) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      const ids = element
        .getAttribute(attribute)
        .split(/\s+/)
        .filter(Boolean);

      for (const id of ids) {
        assert.ok(
          document.getElementById(id),
          `${attribute} references missing ID "${id}".`
        );
      }
    }
  }
});

test('HTML IDs are unique', () => {
  assert.deepEqual(getDuplicateIds(document), []);
});

test('elements hidden from assistive technology are not focusable', () => {
  const focusableSelector = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  for (const hidden of document.querySelectorAll('[aria-hidden="true"]')) {
    assert.equal(
      hidden.matches(focusableSelector),
      false,
      'An aria-hidden element must not itself be focusable.'
    );

    assert.equal(
      hidden.querySelector(focusableSelector),
      null,
      'An aria-hidden subtree contains potentially focusable descendants.'
    );
  }
});

test('data tables have headers and a caption or accessible name', () => {
  for (const table of document.querySelectorAll('table')) {
    assert.ok(
      table.querySelector('th, [role="columnheader"]'),
      'Table is missing header cells.'
    );

    assert.ok(
      table.querySelector('caption') ||
        table.getAttribute('aria-label') ||
        table.getAttribute('aria-labelledby'),
      'Table should have a caption or accessible name.'
    );
  }
});

test('WCAG contrast helper returns expected reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);

  assert.ok(
    contrastRatio('#767676', '#ffffff') >= 4.5
  );

  assert.ok(
    contrastRatio('#777777', '#ffffff') < 4.5
  );
});

test('statically resolvable explicit CSS color pairs meet WCAG AA', () => {
  const rules = extractCssRules(css);
  const failures = [];

  for (const { selector, declarations } of rules) {
    if (selector.startsWith('@')) {
      continue;
    }

    const foregroundMatch = declarations.match(
      /(?:^|;)\s*color\s*:\s*([^;!]+)/i
    );

    const backgroundMatch = declarations.match(
      /(?:^|;)\s*background-color\s*:\s*([^;!]+)/i
    );

    if (!foregroundMatch || !backgroundMatch) {
      continue;
    }

    const foreground = foregroundMatch[1].trim();
    const background = backgroundMatch[1].trim();

    if (
      /var\(|currentcolor|inherit|transparent/i.test(
        `${foreground} ${background}`
      )
    ) {
      continue;
    }

    const ratio = contrastRatio(foreground, background);

    if (ratio === null) {
      continue;
    }

    const minimum = isLargeTextRule(declarations) ? 3 : 4.5;

    if (ratio < minimum) {
      failures.push({
        selector,
        foreground,
        background,
        ratio: Number(ratio.toFixed(2)),
        minimum,
      });
    }
  }

  assert.deepEqual(
    failures,
    [],
    `Static contrast failures:\n${JSON.stringify(failures, null, 2)}`
  );
});
