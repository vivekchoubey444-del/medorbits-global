import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDataPath = path.resolve(
  directory,
  "../../assets/js/public-data.js",
);

assert.ok(
  fs.existsSync(publicDataPath),
  `Expected public-data.js at ${publicDataPath}`,
);

const publicDataScript = fs.readFileSync(publicDataPath, "utf8");

const UNIVERSITY_SOURCE_URL =
  "https://www.ugc.gov.in/universitydetails/Getuniversity_details?unitypeID=1";

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
        url: UNIVERSITY_SOURCE_URL,
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

function createResponse(payload, options = {}) {
  const { ok = true, status = 200 } = options;

  return {
    ok,
    status,
    json: async () => payload,
  };
}

async function loadPage(
  pagePath,
  collection,
  records,
  options = {},
) {
  const {
    responsePayload,
    responseOptions,
    fetchImplementation,
    beforeScript,
  } = options;

  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head></head><body><main><div id="university-results"></div></main></body></html>',
    {
      url: `https://medorbits.in${pagePath}`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );

  const { window } = dom;

  window.fetch =
    fetchImplementation ??
    (async () =>
      createResponse(
        responsePayload ?? {
          success: true,
          data: {
            [collection]: records,
          },
        },
        responseOptions,
      ));

  window.console = {
    ...window.console,
    error: () => {},
    warn: () => {},
  };

  if (typeof beforeScript === "function") {
    beforeScript(window);
  }

  try {
    window.eval(publicDataScript);

    // Execute callbacks scheduled during initial script evaluation.
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    // Some page scripts wait for DOMContentLoaded before fetching data.
    window.document.dispatchEvent(
      new window.Event("DOMContentLoaded", {
        bubbles: true,
      }),
    );

    // Allow fetch resolution and subsequent rendering callbacks.
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    return dom;
  } catch (error) {
    window.close();
    throw error;
  }
}

function closeAfterTest(t, dom) {
  t.after(() => {
    dom.window.close();
  });
}

function queryCards(document, selector = ".university-cards .card") {
  return [...document.querySelectorAll(selector)];
}

test("renders active UGC-backed pending university records and filters by state", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
  );

  closeAfterTest(t, dom);

  const { document } = dom.window;

  assert.equal(
    queryCards(document).length,
    2,
    "Both active university records should render",
  );

  assert.match(
    document.querySelector(".university-data-disclaimer")?.textContent ?? "",
    /pending independent MedOrbits review/i,
    "Pending records must carry a clear review disclaimer",
  );

  assert.equal(
    document.querySelectorAll(
      '.university-record-links a[target="_blank"]',
    ).length,
    3,
    "The two government source links and available university website should render",
  );

  for (const link of document.querySelectorAll(
    '.university-record-links a[target="_blank"]',
  )) {
    assert.ok(
      link.rel.split(/\s+/).includes("noopener"),
      "Links opening new tabs should protect the opener context",
    );
  }

  const stateFilter = document.querySelector(
    '[aria-label="Filter by state or union territory"]',
  );

  assert.ok(stateFilter, "The state filter should exist");

  stateFilter.value = "Delhi";
  stateFilter.dispatchEvent(
    new dom.window.Event("change", {
      bubbles: true,
    }),
  );

  assert.equal(
    queryCards(document).length,
    1,
    "Selecting Delhi should show one university",
  );

  assert.equal(
    document.querySelector(".university-cards h3")?.textContent,
    "University One",
    "The remaining card should represent University One",
  );
});

test("withholds university records when the page requests a different dataset", async (t) => {
  const dom = await loadPage(
    "/education/courses.html",
    "courses",
    universities,
  );

  closeAfterTest(t, dom);

  const { document } = dom.window;

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

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
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

  closeAfterTest(t, dom);

  const { document } = dom.window;
  const links = document.querySelectorAll(
    ".university-record-links a",
  );

  for (const link of links) {
    const href = link.getAttribute("href") ?? "";

    assert.ok(
      !/^\s*javascript:/i.test(href),
      `Unsafe JavaScript URL was rendered: ${href}`,
    );
  }
});

test("handles an empty API collection", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    [],
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "An empty collection must not render university cards",
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

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    1,
    "Missing optional fields should not break rendering",
  );
});

test("does not render records when the API reports a failed response", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
    {
      responsePayload: {
        success: false,
        message: "Request failed",
        data: {
          universities,
        },
      },
      responseOptions: {
        ok: false,
        status: 500,
      },
    },
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "A failed API response must not render supplied records",
  );
});

test("handles malformed API JSON without crashing", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
    {
      fetchImplementation: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Invalid JSON");
        },
      }),
    },
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "Malformed API data must not render university cards",
  );
});

test("does not render records when the requested collection is missing", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
    {
      responsePayload: {
        success: true,
        data: {},
      },
    },
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "Missing collections must not cause unrelated data to render",
  );
});

test("does not render records with malformed or missing identifiers", async (t) => {
  const invalidRecords = [
    {
      ...universities[0],
      id: "",
      slug: "missing-id",
    },
    {
      ...universities[1],
      id: null,
      slug: "null-id",
    },
  ];

  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    invalidRecords,
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "Records without valid identifiers must not be displayed",
  );
});

test("renders university names as text rather than executable HTML", async (t) => {
  const hostileRecords = [
    {
      ...universities[0],
      id: "hostile-name-university",
      name: '<img src=x onerror="alert(1)">',
    },
  ];

  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    hostileRecords,
  );

  closeAfterTest(t, dom);

  const { document } = dom.window;

  assert.equal(
    document.querySelectorAll(".university-cards img").length,
    0,
    "A hostile name must not create an image element",
  );

  assert.equal(
    document.querySelectorAll(".university-cards script").length,
    0,
    "A hostile name must not create a script element",
  );

  assert.ok(
    !document.querySelector(".university-cards")?.innerHTML.includes(
      'onerror="alert(1)"',
    ),
    "Executable event-handler markup must not be inserted into the DOM",
  );
});

test("rejects non-HTTP website protocols", async (t) => {
  const unsafeWebsites = [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ];

  for (const website of unsafeWebsites) {
    const dom = await loadPage(
      "/education/universities.html",
      "universities",
      [
        {
          ...universities[0],
          id: `unsafe-${unsafeWebsites.indexOf(website)}`,
          website,
        },
      ],
    );

    closeAfterTest(t, dom);

    for (const link of dom.window.document.querySelectorAll(
      ".university-record-links a",
    )) {
      assert.ok(
        !/^\s*(?:javascript|data|file):/i.test(
          link.getAttribute("href") ?? "",
        ),
        `Non-HTTP protocol must not be rendered: ${website}`,
      );
    }
  }
});

test("does not render records returned in an unexpected API envelope", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
    {
      responsePayload: {
        success: true,
        universities,
      },
    },
  );

  closeAfterTest(t, dom);

  assert.equal(
    queryCards(dom.window.document).length,
    0,
    "The renderer must not infer records from an unsupported response shape",
  );
});

test("keeps rendered university content isolated from unrelated page elements", async (t) => {
  const dom = await loadPage(
    "/education/universities.html",
    "universities",
    universities,
    {
      beforeScript(window) {
        const marker = window.document.createElement("p");
        marker.id = "fixture-isolation-marker";
        marker.textContent = "Unrelated page content";
        window.document.querySelector("main").appendChild(marker);
      },
    },
  );

  closeAfterTest(t, dom);

  const marker = dom.window.document.querySelector(
    "#fixture-isolation-marker",
  );

  assert.ok(marker, "Unrelated page content should remain in the DOM");

  assert.equal(
    marker.textContent,
    "Unrelated page content",
    "Rendering should not overwrite unrelated page content",
  );
});