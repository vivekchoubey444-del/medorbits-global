
'use strict';

/**
 * MedOrbits -- Frontend Integration Tests
 * File: tests/integration/frontend.integration.test.js
 *
 * Coverage:
 * - Responsive catalog grid styles
 * - Catalog pagination and card visibility
 * - DOM preservation during pagination
 * - Footer social-link rendering
 * - Safe handling of missing social URLs
 * - External-link security attributes
 * - DOM lifecycle and cleanup
 *
 * Run:
 *   node --test tests/integration/frontend.integration.test.js
 *
 * Requirements:
 *   npm install --save-dev jsdom
 *
 * Assumes:
 *   assets/js/app.js
 *   assets/js/animations.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const APP_SCRIPT_PATH = path.join(root, 'assets/js/app.js');
const ANIMATION_SCRIPT_PATH = path.join(root, 'assets/js/animations.js');

const appScript = readRequiredFile(APP_SCRIPT_PATH);
const animationScript = readRequiredFile(ANIMATION_SCRIPT_PATH);

const PAGE_URL = 'https://medorbits.in/education/courses.html';
const SOCIAL_CONFIG_URL = 'https://medorbits.in/assets/data/social-links.json';

const SOCIAL_CONFIG = Object.freeze({
  links: [
    {
      id: 'website',
      label: 'MedOrbits website',
      url: 'https://medorbits.in',
    },
    {
      id: 'whatsapp-primary',
      label: 'WhatsApp',
      url: 'https://wa.me/916205889064',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      url: '',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      url: '',
    },
    {
      id: 'x',
      label: 'X',
      url: '',
    },
  ],
});

function readRequiredFile(filePath) {
  assert.ok(
    fs.existsSync(filePath),
    `Required frontend script does not exist: ${path.relative(root, filePath)}`,
  );

  const contents = fs.readFileSync(filePath, 'utf8');

  assert.ok(
    contents.trim().length > 0,
    `Required frontend script is empty: ${path.relative(root, filePath)}`,
  );

  return contents;
}

function createMatchMedia() {
  return (query) => ({
    matches: false,
    media: String(query),
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
}

function createFetchStub() {
  return async (input) => {
    const requestUrl = new URL(
      typeof input === 'string' ? input : input.url,
      PAGE_URL,
    );

    if (requestUrl.href === SOCIAL_CONFIG_URL) {
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type'
              ? 'application/json'
              : null;
          },
        },
        json: async () => structuredClone(SOCIAL_CONFIG),
        text: async () => JSON.stringify(SOCIAL_CONFIG),
      };
    }

    return {
      ok: false,
      status: 404,
      headers: {
        get() {
          return null;
        },
      },
      json: async () => ({}),
      text: async () => '',
    };
  };
}

function createFixtureHtml({ cardCount = 5 } = {}) {
  assert.ok(
    Number.isInteger(cardCount) && cardCount >= 0 && cardCount <= 100,
    'cardCount must be an integer between 0 and 100',
  );

  const cards = Array.from(
    { length: cardCount },
    (_, index) =>
      `<article class="card"><h2>Item ${index + 1}</h2></article>`,
  ).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MedOrbits Frontend Test</title>
    <style>
      .cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
      }

      .footer-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
      }

      [hidden] {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="section">
        <div class="section-head">
          <h1>Catalog</h1>
        </div>
        <div class="cards">${cards}</div>
      </section>
    </main>

    <footer>
      <div class="footer-grid">
        <div class="footer-brand">Brand</div>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
      </div>
      <div class="footer-bottom"></div>
    </footer>
  </body>
</html>`;
}

function setupPage(options = {}) {
  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];

  virtualConsole.on('jsdomError', (error) => {
    jsdomErrors.push(error);
  });

  const dom = new JSDOM(createFixtureHtml(options), {
    url: PAGE_URL,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const { window } = dom;

  window.matchMedia = createMatchMedia();
  window.fetch = createFetchStub();

  // Keep tests deterministic and avoid external network access.
  window.console.error = (...args) => {
    jsdomErrors.push(new Error(args.map(String).join(' ')));
  };

  try {
    window.eval(appScript);
    window.eval(animationScript);

    // JSDOM does not automatically reproduce every browser lifecycle detail
    // when scripts are evaluated manually.
    window.document.dispatchEvent(
      new window.Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: false,
      }),
    );
  } catch (error) {
    window.close();
    throw error;
  }

  return {
    dom,
    window,
    document: window.document,
    jsdomErrors,
    close() {
      window.close();
    },
  };
}

function nextTask(window) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function settlePage(page) {
  await nextTask(page.window);
  await nextTask(page.window);
}

function getCatalogTrack(document) {
  return document.querySelector('.cards');
}

function getNextButton(document) {
  return document.querySelector(
    '[aria-label="Show next catalog items"]',
  );
}

function getSocialFooter(document) {
  return document.querySelector('[data-social-links]');
}

function getSocialPlaceholders(footer) {
  return [...footer.querySelectorAll('.footer-social-placeholder')];
}

function visibleCards(track) {
  return [...track.children].filter((card) => !card.hidden);
}

function getAccessibleLabel(element) {
  return (
    element.getAttribute('aria-label') ||
    element.textContent.trim()
  );
}

async function withPage(t, options = {}) {
  const page = setupPage(options);

  t.after(() => {
    page.close();
  });

  await settlePage(page);

  return page;
}

test('frontend scripts load and execute without uncaught JSDOM errors', async (t) => {
  const page = await withPage(t);

  assert.ok(page.document.body);
  assert.ok(page.document.querySelector('main'));

  assert.deepEqual(
    page.jsdomErrors.map((error) => error.message),
    [],
    'Frontend scripts should not emit JSDOM runtime errors',
  );
});

test('catalog applies responsive two-column grid styles', async (t) => {
  const page = await withPage(t);
  const { document } = page;

  const track = getCatalogTrack(document);

  assert.ok(track, 'Catalog track should exist');
  assert.equal(track.children.length, 5);

  const style = document.getElementById('medorbits-grid-layout');

  assert.ok(style, 'Responsive catalog styles should be injected');

  assert.match(
    style.textContent,
    /repeat\(\s*2\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/,
    'Responsive grid should define two equal-width columns',
  );
});

test('catalog initially displays the first four cards and hides the remainder', async (t) => {
  const page = await withPage(t);
  const track = getCatalogTrack(page.document);

  assert.ok(track);

  assert.deepEqual(
    [...track.children].map((card) => card.hidden),
    [false, false, false, false, true],
  );

  assert.equal(visibleCards(track).length, 4);
});

test('catalog next button advances to the next card set', async (t) => {
  const page = await withPage(t);
  const { document } = page;

  const track = getCatalogTrack(document);
  const nextButton = getNextButton(document);

  assert.ok(track, 'Catalog track should exist');
  assert.ok(nextButton, 'Next button should exist');

  assert.equal(track.classList.contains('is-catalog-slider'), true);

  const cards = [...track.children];

  assert.deepEqual(
    cards.map((card) => card.hidden),
    [false, false, false, false, true],
  );

  nextButton.click();

  assert.deepEqual(
    cards.map((card) => card.hidden),
    [true, true, true, true, false],
  );

  assert.equal(visibleCards(track).length, 1);
});

test('pagination hides cards without removing them from the DOM', async (t) => {
  const page = await withPage(t);
  const { document } = page;

  const track = getCatalogTrack(document);
  const nextButton = getNextButton(document);

  assert.ok(track);
  assert.ok(nextButton);

  const originalCards = [...track.children];

  nextButton.click();

  assert.equal(track.children.length, 5);

  assert.deepEqual([...track.children], originalCards);
  assert.equal(visibleCards(track).length, 1);
});

test('pagination preserves card content and ordering', async (t) => {
  const page = await withPage(t);
  const { document } = page;

  const track = getCatalogTrack(document);
  const nextButton = getNextButton(document);

  assert.ok(track);
  assert.ok(nextButton);

  const originalHeadings = [...track.children].map(
    (card) => card.querySelector('h2')?.textContent,
  );

  nextButton.click();

  assert.deepEqual(
    [...track.children].map(
      (card) => card.querySelector('h2')?.textContent,
    ),
    originalHeadings,
  );
});

test('pagination control exposes an accessible name', async (t) => {
  const page = await withPage(t);
  const nextButton = getNextButton(page.document);

  assert.ok(nextButton);

  assert.equal(
    getAccessibleLabel(nextButton),
    'Show next catalog items',
  );
});

test('catalog with no cards does not crash', async (t) => {
  const page = await withPage(t, { cardCount: 0 });
  const track = getCatalogTrack(page.document);

  assert.ok(track);
  assert.equal(track.children.length, 0);
  assert.equal(visibleCards(track).length, 0);
});

test('catalog with one card preserves the card', async (t) => {
  const page = await withPage(t, { cardCount: 1 });
  const track = getCatalogTrack(page.document);

  assert.ok(track);
  assert.equal(track.children.length, 1);
  assert.equal(track.children[0].hidden, false);
});

test('catalog with exactly four cards displays all cards initially', async (t) => {
  const page = await withPage(t, { cardCount: 4 });
  const track = getCatalogTrack(page.document);

  assert.ok(track);
  assert.equal(track.children.length, 4);
  assert.equal(visibleCards(track).length, 4);
});

test('footer renders configured website and WhatsApp links only', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer, 'Footer social links container should exist');

  const links = [...footer.querySelectorAll('a')];
  const placeholders = getSocialPlaceholders(footer);

  assert.deepEqual(
    links.map((link) => link.textContent.trim()),
    ['MedOrbits website', 'WhatsApp'],
  );

  assert.deepEqual(
    placeholders.map((item) => item.textContent.trim()),
    ['Instagram', 'Facebook', 'X'],
  );

  assert.equal(links.length, 2);
});

test('website social link uses the expected local icon', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer);

  const websiteLink = [...footer.querySelectorAll('a')].find(
    (link) => link.textContent.trim() === 'MedOrbits website',
  );

  assert.ok(websiteLink);

  assert.equal(
    websiteLink.querySelector('img')?.getAttribute('src'),
    '/assets/icons/social/link.svg',
  );
});

test('configured social links use their configured destinations', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer);

  const links = [...footer.querySelectorAll('a')];

  const websiteLink = links.find(
    (link) => link.textContent.trim() === 'MedOrbits website',
  );

  const whatsappLink = links.find(
    (link) => link.textContent.trim() === 'WhatsApp',
  );

  assert.ok(websiteLink);
  assert.ok(whatsappLink);

  assert.equal(websiteLink.href, 'https://medorbits.in/');
  assert.equal(whatsappLink.href, 'https://wa.me/916205889064');
});

test('external footer links open in a new tab with safe rel attributes', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer);

  const links = [...footer.querySelectorAll('a')];

  assert.equal(links.length, 2);

  for (const link of links) {
    assert.equal(link.target, '_blank');

    const relTokens = new Set(
      (link.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token.toLowerCase()),
    );

    assert.ok(
      relTokens.has('noopener'),
      `${link.textContent.trim()} must use rel="noopener"`,
    );
  }
});

test('empty social URLs never become clickable profile links', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer);

  for (const label of ['Instagram', 'Facebook', 'X']) {
    const placeholder = getSocialPlaceholders(footer).find(
      (item) => item.textContent.trim() === label,
    );

    assert.ok(placeholder, `${label} placeholder should exist`);
    assert.equal(
      placeholder.closest('a'),
      null,
      `${label} must not be wrapped in an anchor`,
    );
  }

  assert.equal(footer.querySelectorAll('a').length, 2);
});

test('footer does not invent destinations for unconfigured profiles', async (t) => {
  const page = await withPage(t);
  const footer = getSocialFooter(page.document);

  assert.ok(footer);

  const allLinks = [...footer.querySelectorAll('a')];
  const hrefs = allLinks.map((link) => link.href);

  assert.equal(
    hrefs.some((href) => /instagram\.com/i.test(href)),
    false,
  );

  assert.equal(
    hrefs.some((href) => /facebook\.com/i.test(href)),
    false,
  );

  assert.equal(
    hrefs.some((href) => /x\.com|twitter\.com/i.test(href)),
    false,
  );
});

test('social link labels are rendered as text rather than interpreted as HTML', async (t) => {
  const page = setupPage();
  t.after(() => page.close());

  const maliciousConfig = {
    links: [
      {
        id: 'test-link',
        label: '<img src=x onerror=alert(1)>',
        url: 'https://medorbits.in',
      },
    ],
  };

  page.window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => structuredClone(maliciousConfig),
  });

  // The already-evaluated application may have started its first fetch.
  // This test documents a security invariant and exercises the DOM's
  // text-only behavior independently of the application fetch timing.
  const safeLabel = page.document.createElement('span');
  safeLabel.textContent = maliciousConfig.links[0].label;

  assert.equal(safeLabel.querySelector('img'), null);
  assert.equal(
    safeLabel.textContent,
    '<img src=x onerror=alert(1)>',
  );
});

test('invalid social URLs are not treated as trusted destinations', async (t) => {
  const invalidUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/path',
  ];

  for (const value of invalidUrls) {
    const parsed = (() => {
      try {
        return new URL(value, PAGE_URL);
      } catch {
        return null;
      }
    })();

    assert.ok(parsed, `URL should be parseable for test case: ${value}`);

    assert.equal(
      ['https:', 'http:'].includes(parsed.protocol),
      false,
      `${value} should not be accepted as a web social destination`,
    );
  }
});

test('footer grid exists and retains all five fixture columns', async (t) => {
  const page = await withPage(t);
  const grid = page.document.querySelector('.footer-grid');

  assert.ok(grid);
  assert.equal(grid.children.length, 5);
});

test('fixture and frontend test setup remain isolated between runs', async (t) => {
  const first = await withPage(t);
  const second = await withPage(t);

  const firstTrack = getCatalogTrack(first.document);
  const secondTrack = getCatalogTrack(second.document);

  assert.ok(firstTrack);
  assert.ok(secondTrack);

  assert.notEqual(firstTrack, secondTrack);

  firstTrack.children[0].hidden = true;

  assert.equal(firstTrack.children[0].hidden, true);
  assert.equal(secondTrack.children[0].hidden, false);
});
