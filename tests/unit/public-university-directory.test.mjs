import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const directory = path.dirname(fileURLToPath(import.meta.url));

const publicDataScript = fs.readFileSync(
  path.join(directory, "../../assets/js/public-data.js"),
  "utf8",
);

const universities = [
  {
    id: "inst-in-ugc-1",
    name: "University One",
    slug: "university-one-1",
    institutionType: "central-university",
    stateName: "Delhi",
    summary: "UGC directory listing.",
    ugcStatus: "2(f)",
    website: "https://one.example.edu/",
    sourceUrls: [
      {
        url: "https://www.ugc.gov.in/universitydetails/Getuniversity_details?unitypeID=1",
        sourceType: "government-directory",
      },
    ],
    verificationStatus: "pending-review",
    active: true,
  },
  {
    id: "inst-in-ugc-2",
    name: "University Two",
    slug: "university-two-2",
    institutionType: "private-university",
    stateName: "Maharashtra",
    summary: "UGC directory listing.",
    ugcStatus: "2(f)",
    website: null,
    sourceUrls: [
      {
        url: "https://www.ugc.gov.in/universitydetails/Getuniversity_details?unitypeID=3",
        sourceType: "government-directory",
      },
    ],
    verificationStatus: "pending-review",
    active: true,
  },
];

async function loadPage(pagePath, collection, records) {
  const dom = new JSDOM(
    '<main><div id="university-results"></div></main>',
    {
      url: `https://medorbits.in${pagePath}`,
      runScripts: "outside-only",
    },
  );

  dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        [collection]: records,
      },
    }),
  });

  dom.window.eval(publicDataScript);

  // Allow DOMContentLoaded and scheduled rendering callbacks to execute.
  await new Promise((resolve) => {
    dom.window.setTimeout(resolve, 0);
  });

  return dom;
}

test("loads UGC-backed pending records from the API and filters by state", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
  );

  t.after(() => dom.window.close());

  const document = dom.window.document;

  assert.equal(
    document.querySelectorAll(".university-cards .card").length,
    2,
    "Both active UGC-backed university records should render",
  );

  assert.match(
    document.querySelector(".university-data-disclaimer")?.textContent ?? "",
    /pending independent MedOrbits review/i,
    "Pending records should carry a clear review disclaimer",
  );

  assert.equal(
    document.querySelectorAll(
      '.university-record-links a[target="_blank"]',
    ).length,
    3,
    "The two source links and available university website should render",
  );

  const stateFilter = document.querySelector(
    '[aria-label="Filter by state or union territory"]',
  );

  assert.ok(stateFilter, "The state filter should exist");

  stateFilter.value = "Delhi";
  stateFilter.dispatchEvent(
    new dom.window.Event("change", { bubbles: true }),
  );

  assert.equal(
    document.querySelectorAll(".university-cards .card").length,
    1,
    "Selecting Delhi should show one university",
  );

  assert.equal(
    document.querySelector(".university-cards h3")?.textContent,
    "University One",
  );
});

test("withholds pending records from datasets without UGC opt-in", async (t) => {
  const dom = await loadPage(
    "/education/courses.html",
    "courses",
    universities,
  );

  t.after(() => dom.window.close());

  const document = dom.window.document;

  assert.equal(
    document.querySelectorAll(".card").length,
    0,
    "University records must not leak into the courses dataset",
  );

  assert.match(
    document.querySelector('[role="status"]')?.textContent ?? "",
    /withheld/i,
    "The page should explain that unsupported records are withheld",
  );
});

test("does not render inactive university records", async (t) => {
  const inactiveUniversities = [
    {
      ...universities[0],
      id: "inst-in-ugc-inactive",
      active: false,
    },
  ];

  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    inactiveUniversities,
  );

  t.after(() => dom.window.close());

  assert.equal(
    dom.window.document.querySelectorAll(".university-cards .card").length,
    0,
    "Inactive records must not be displayed",
  );
});

test("does not render records with unsafe website URLs", async (t) => {
  const unsafeUniversities = [
    {
      ...universities[0],
      website: "javascript:alert(1)",
    },
  ];

  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    unsafeUniversities,
  );

  t.after(() => dom.window.close());

  const document = dom.window.document;

  for (const link of document.querySelectorAll(
    ".university-record-links a",
  )) {
    assert.ok(
      !/^\s*javascript:/i.test(link.getAttribute("href") ?? ""),
      "Rendered links must not use javascript: URLs",
    );
  }
});

test("handles an empty API collection", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    [],
  );

  t.after(() => dom.window.close());

  assert.equal(
    dom.window.document.querySelectorAll(".university-cards .card").length,
    0,
  );
});

test("does not crash when API records are missing optional fields", async (t) => {
  const minimalRecords = [
    {
      id: "minimal-university",
      name: "Minimal University",
      active: true,
      verificationStatus: "pending-review",
      sourceUrls: [],
    },
  ];

  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    minimalRecords,
  );

  t.after(() => dom.window.close());

  assert.equal(
    dom.window.document.querySelectorAll(".university-cards .card").length,
    1,
    "Missing optional fields should not break rendering",
  );
});