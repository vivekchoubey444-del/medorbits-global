
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const appScript = fs.readFileSync(
  path.join(root, "assets/js/app.js"),
  "utf8",
);

const animationScript = fs.readFileSync(
  path.join(root, "assets/js/animations.js"),
  "utf8",
);

function setupPage() {
  const cards = Array.from(
    { length: 5 },
    (_, index) =>
      `<article class="card"><h2>Item ${index + 1}</h2></article>`,
  ).join("");

  const dom = new JSDOM(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          .cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
          }
          .footer-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
          }
        </style>
      </head>
      <body>
        <main>
          <section class="section">
            <div class="section-head"><h1>Catalog</h1></div>
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
    </html>`,
    {
      url: "https://medorbits.in/education/courses.html",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );

  dom.window.matchMedia = () => ({
    matches: false,
    media: "",
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });

  dom.window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      links: [
        {
          id: "website",
          label: "MedOrbits website",
          url: "https://medorbits.in",
        },
        {
          id: "whatsapp-primary",
          label: "WhatsApp",
          url: "https://wa.me/916205889064",
        },
        { id: "instagram", label: "Instagram", url: "" },
        { id: "facebook", label: "Facebook", url: "" },
        { id: "x", label: "X", url: "" },
      ],
    }),
  });

  dom.window.eval(appScript);
  dom.window.eval(animationScript);

  dom.window.document.dispatchEvent(
    new dom.window.Event("DOMContentLoaded"),
  );

  return dom;
}

function nextTask(window) {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

test("catalog uses two-column layout and advances to the next card set", async (t) => {
  const dom = setupPage();
  t.after(() => dom.window.close());

  await nextTask(dom.window);

  const { document } = dom.window;
  const track = document.querySelector(".cards");

  assert.ok(track);
  assert.equal(track.children.length, 5);

  const style = document.getElementById("medorbits-grid-layout");

  assert.ok(style, "Responsive catalog styles should be injected");
  assert.match(
    style.textContent,
    /repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );

  assert.equal(track.classList.contains("is-catalog-slider"), true);

  const cards = [...track.children];

  assert.deepEqual(
    cards.map((card) => card.hidden),
    [false, false, false, false, true],
  );

  const nextButton = document.querySelector(
    '[aria-label="Show next catalog items"]',
  );

  assert.ok(nextButton, "Next button should exist");
  nextButton.click();

  assert.deepEqual(
    cards.map((card) => card.hidden),
    [true, true, true, true, false],
  );
});

test("footer renders configured links without inventing social profiles", async (t) => {
  const dom = setupPage();
  t.after(() => dom.window.close());

  await nextTask(dom.window);

  const { document } = dom.window;
  const footer = document.querySelector("[data-social-links]");

  assert.ok(footer, "Footer social links should exist");

  const links = [...footer.querySelectorAll("a")];
  const placeholders = [
    ...footer.querySelectorAll(".footer-social-placeholder"),
  ];

  assert.deepEqual(
    links.map((link) => link.textContent.trim()),
    ["MedOrbits website", "WhatsApp"],
  );

  assert.equal(
    links[0].querySelector("img")?.getAttribute("src"),
    "/assets/icons/social/link.svg",
  );

  assert.deepEqual(
    placeholders.map((item) => item.textContent.trim()),
    ["Instagram", "Facebook", "X"],
  );

  assert.equal(footer.querySelectorAll("a").length, 2);

  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.match(link.rel, /\bnoopener\b/);
  }
});

test("pagination hides cards without removing them from the DOM", async (t) => {
  const dom = setupPage();
  t.after(() => dom.window.close());

  await nextTask(dom.window);

  const { document } = dom.window;
  const track = document.querySelector(".cards");
  const nextButton = document.querySelector(
    '[aria-label="Show next catalog items"]',
  );

  assert.ok(track);
  assert.ok(nextButton);
  assert.equal(track.children.length, 5);

  nextButton.click();

  assert.equal(track.children.length, 5);
  assert.equal(
    [...track.children].filter((card) => !card.hidden).length,
    1,
  );
});

test("empty social URLs never become clickable profile links", async (t) => {
  const dom = setupPage();
  t.after(() => dom.window.close());

  await nextTask(dom.window);

  const { document } = dom.window;
  const footer = document.querySelector("[data-social-links]");

  assert.ok(footer);

  for (const label of ["Instagram", "Facebook", "X"]) {
    const placeholder = [
      ...footer.querySelectorAll(".footer-social-placeholder"),
    ].find((item) => item.textContent.trim() === label);

    assert.ok(placeholder, `${label} placeholder should exist`);
    assert.equal(placeholder.closest("a"), null);
  }
});
