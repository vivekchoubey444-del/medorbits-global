
/**
 * /tests/api/colleges.api.test.js
 *
 * MedOrbits -- Colleges API integration tests
 *
 * Requirements:
 *   - Node.js >= 20
 *   - An accessible MedOrbits API server
 *
 * Run:
 *   node --test tests/api/colleges.api.test.js
 *
 * Optional environment variables:
 *   API_BASE_URL=http://127.0.0.1:3000
 *   API_COLLEGES_PATH=/api/colleges
 *   API_HEALTH_PATH=/health
 *   API_TIMEOUT_MS=8000
 *   API_REQUIRE_SERVER=1
 *   API_TEST_COLLEGE_ID=
 *   API_TEST_SEARCH_TERM=
 *   API_TEST_STATE=
 *   API_TEST_PAGE=1
 *   API_TEST_LIMIT=10
 *
 * Notes:
 *   - Uses only Node.js built-in modules.
 *   - Does not create, update, or delete college records.
 *   - Adjust the route defaults and response extraction to match
 *     your actual MedOrbits API implementation.
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = (
  process.env.API_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/+$/, "");

const COLLEGES_PATH =
  process.env.API_COLLEGES_PATH || "/api/colleges";

const HEALTH_PATH =
  process.env.API_HEALTH_PATH || "/health";

const TIMEOUT_MS = Number(
  process.env.API_TIMEOUT_MS || 8000
);

const REQUIRE_SERVER =
  process.env.API_REQUIRE_SERVER === "1";

const TEST_COLLEGE_ID =
  process.env.API_TEST_COLLEGE_ID?.trim() || "";

const TEST_SEARCH_TERM =
  process.env.API_TEST_SEARCH_TERM?.trim() || "";

const TEST_STATE =
  process.env.API_TEST_STATE?.trim() || "";

const TEST_PAGE = Number(
  process.env.API_TEST_PAGE || 1
);

const TEST_LIMIT = Number(
  process.env.API_TEST_LIMIT || 10
);

let serverAvailable = false;
let serverCheckError = null;

/**
 * Validate configuration before making requests.
 */
function validateConfiguration() {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    "API_TIMEOUT_MS must be a positive number."
  );

  assert.ok(
    Number.isInteger(TEST_PAGE) && TEST_PAGE >= 1,
    "API_TEST_PAGE must be an integer greater than or equal to 1."
  );

  assert.ok(
    Number.isInteger(TEST_LIMIT) &&
      TEST_LIMIT >= 1 &&
      TEST_LIMIT <= 1000,
    "API_TEST_LIMIT must be an integer between 1 and 1000."
  );

  const base = new URL(BASE_URL);

  assert.ok(
    ["http:", "https:"].includes(base.protocol),
    "API_BASE_URL must use HTTP or HTTPS."
  );

  assert.ok(
    COLLEGES_PATH.startsWith("/") &&
      !COLLEGES_PATH.startsWith("//"),
    "API_COLLEGES_PATH must be a local absolute path."
  );

  assert.ok(
    HEALTH_PATH.startsWith("/") &&
      !HEALTH_PATH.startsWith("//"),
    "API_HEALTH_PATH must be a local absolute path."
  );

  assert.ok(
    !COLLEGES_PATH.includes("?") &&
      !COLLEGES_PATH.includes("#"),
    "API_COLLEGES_PATH must not contain a query string or fragment."
  );

  assert.ok(
    !HEALTH_PATH.includes("?") &&
      !HEALTH_PATH.includes("#"),
    "API_HEALTH_PATH must not contain a query string or fragment."
  );
}

/**
 * Construct a URL for an API path.
 */
function buildUrl(path, query = {}) {
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    new URL(BASE_URL).origin,
    "API request must remain on the configured API origin."
  );

  for (const [key, value] of Object.entries(query)) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).length > 0
    ) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

/**
 * Perform a bounded HTTP request and parse its response.
 */
async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    query = {},
    headers = {},
    body,
    rawBody,
  } = options;

  const url = buildUrl(path, query);
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  let requestBody;

  if (rawBody !== undefined) {
    requestBody = rawBody;
  } else if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: "manual",
    });

    const contentType =
      response.headers.get("content-type") || "";

    const text = await response.text();

    let data = null;

    if (text.length > 0) {
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `${method} ${url.pathname} returned invalid JSON.`
          );
        }
      } else {
        data = text;
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data,
      text,
      url: url.toString(),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${url.pathname}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract a college collection from common API response formats.
 *
 * Supported examples:
 *   [ { id: "1", name: "Example College" } ]
 *   { data: [ ... ] }
 *   { colleges: [ ... ] }
 *   { items: [ ... ] }
 *   { data: { colleges: [ ... ] } }
 */
function extractCollegeList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = [
    payload.colleges,
    payload.items,
    payload.results,
    payload.data,
    payload.data?.colleges,
    payload.data?.items,
    payload.data?.results,
  ];

  return candidates.find(Array.isArray) ?? null;
}

/**
 * Extract an individual college from common response formats.
 */
function extractCollege(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (Array.isArray(payload)) {
    return null;
  }

  const candidates = [
    payload.college,
    payload.data?.college,
    payload.data,
    payload.result,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      return candidate;
    }
  }

  // Some APIs return the college object directly.
  if (
    payload.id !== undefined ||
    payload._id !== undefined ||
    payload.slug !== undefined ||
    payload.name !== undefined
  ) {
    return payload;
  }

  return null;
}

/**
 * Return a stable identifier if the API provides one.
 */
function getCollegeIdentifier(college) {
  if (!college || typeof college !== "object") {
    return null;
  }

  const value =
    college.id ??
    college._id ??
    college.slug ??
    college.collegeId;

  return value === undefined || value === null
    ? null
    : String(value);
}

/**
 * Validate common fields without requiring a particular database schema.
 */
function validateCollegeRecord(college) {
  assert.ok(
    college &&
      typeof college === "object" &&
      !Array.isArray(college),
    "Each college record must be a JSON object."
  );

  const identifier = getCollegeIdentifier(college);

  assert.ok(
    identifier,
    "College record should contain id, _id, slug, or collegeId."
  );

  if (college.name !== undefined) {
    assert.equal(
      typeof college.name,
      "string",
      "College name must be a string when provided."
    );

    assert.ok(
      college.name.trim().length > 0,
      "College name must not be empty."
    );
  }

  if (college.state !== undefined) {
    assert.equal(
      typeof college.state,
      "string",
      "College state must be a string when provided."
    );
  }

  return college;
}

/**
 * Check that a response is a JSON object.
 */
function assertJsonObject(payload, message) {
  assert.ok(
    payload !== null &&
      typeof payload === "object" &&
      !Array.isArray(payload),
    message
  );
}

/**
 * Skip integration checks when the API is not running, unless
 * API_REQUIRE_SERVER=1 is set.
 */
function skipIfServerUnavailable(t) {
  if (serverAvailable) {
    return false;
  }

  if (REQUIRE_SERVER) {
    assert.fail(
      `API server is required but unavailable. ` +
      `Start the server at ${BASE_URL}. ` +
      `Details: ${serverCheckError?.message || "Unknown connection error"}`
    );
  }

  t.skip(
    `API server unavailable at ${BASE_URL}; ` +
    "set API_REQUIRE_SERVER=1 to make this a hard failure."
  );

  return true;
}

before(async () => {
  try {
    validateConfiguration();

    const response = await apiRequest(HEALTH_PATH, {
      method: "GET",
    });

    // A responding server is enough to run route-level tests.
    // Health endpoint status is tested separately below.
    serverAvailable =
      response.status >= 200 && response.status < 500;

    if (!serverAvailable) {
      serverCheckError = new Error(
        `Health endpoint returned HTTP ${response.status}.`
      );
    }
  } catch (error) {
    serverCheckError = error;
    serverAvailable = false;
  }

  if (REQUIRE_SERVER && !serverAvailable) {
    assert.fail(
      `API server is required but unavailable at ${BASE_URL}. ` +
      `${serverCheckError?.message || ""}`
    );
  }
});

/* ------------------------------------------------------------------
 * Configuration and server
 * ------------------------------------------------------------------ */

test("colleges API test configuration is valid", () => {
  validateConfiguration();

  assert.ok(BASE_URL.length > 0);
  assert.ok(COLLEGES_PATH.length > 1);
  assert.ok(HEALTH_PATH.length > 1);
});

test("API server health endpoint responds successfully", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(HEALTH_PATH);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Health endpoint should return 2xx; received HTTP ${response.status}.`
  );
});

/* ------------------------------------------------------------------
 * College collection
 * ------------------------------------------------------------------ */

test("GET colleges endpoint returns a successful response", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Expected successful colleges response; received HTTP ${response.status}.`
  );

  assertJsonObjectOrArray(
    response.data,
    "Colleges endpoint must return a JSON array or object."
  );
});

test("college collection uses a recognizable response format", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Cannot validate collection format: HTTP ${response.status}.`
  );

  const colleges = extractCollegeList(response.data);

  assert.ok(
    colleges !== null,
    "Expected an array of colleges or a response object containing " +
      "colleges, items, results, or data."
  );

  assert.ok(
    colleges.every(
      (college) =>
        college !== null &&
        typeof college === "object" &&
        !Array.isArray(college)
    ),
    "College collection must contain only JSON objects."
  );
});

test("college records expose stable identifiers", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Cannot inspect college identifiers: HTTP ${response.status}.`
  );

  const colleges = extractCollegeList(response.data);

  assert.ok(
    colleges !== null,
    "Could not extract college collection."
  );

  for (const college of colleges) {
    validateCollegeRecord(college);
  }
});

test("college identifiers are unique within the returned collection", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Cannot inspect identifiers: HTTP ${response.status}.`
  );

  const colleges = extractCollegeList(response.data);

  assert.ok(
    colleges !== null,
    "Could not extract college collection."
  );

  const identifiers = colleges.map(getCollegeIdentifier);

  assert.ok(
    identifiers.every(Boolean),
    "Every college must expose a stable identifier."
  );

  assert.equal(
    new Set(identifiers).size,
    identifiers.length,
    "Duplicate college identifiers were returned in one collection."
  );
});

/* ------------------------------------------------------------------
 * Search and filters
 * ------------------------------------------------------------------ */

test("college search parameter is handled safely", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const term = TEST_SEARCH_TERM || "medical";

  const response = await apiRequest(COLLEGES_PATH, {
    query: {
      search: term,
    },
  });

  assert.ok(
    response.status >= 200 &&
      response.status < 500 &&
      response.status !== 500,
    `Search should not produce a server error; received HTTP ${response.status}.`
  );

  if (response.status >= 200 && response.status < 300) {
    const colleges = extractCollegeList(response.data);

    assert.ok(
      colleges !== null,
      "Successful search should return a recognizable college collection."
    );
  }
});

test("college state filter is handled safely", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH, {
    query: {
      state: TEST_STATE || "Uttar Pradesh",
    },
  });

  assert.ok(
    response.status < 500,
    `State filtering should not cause a server error; received HTTP ${response.status}.`
  );

  if (response.status >= 200 && response.status < 300) {
    assert.ok(
      extractCollegeList(response.data) !== null,
      "Successful state-filter response should contain a recognizable collection."
    );
  }
});

test("empty search parameter does not crash the API", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH, {
    query: {
      search: "",
    },
  });

  assert.ok(
    response.status < 500,
    `Empty search should not cause a server error; received HTTP ${response.status}.`
  );
});

/* ------------------------------------------------------------------
 * Pagination
 * ------------------------------------------------------------------ */

test("college pagination parameters are handled safely", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH, {
    query: {
      page: TEST_PAGE,
      limit: TEST_LIMIT,
    },
  });

  assert.ok(
    response.status < 500,
    `Pagination should not cause a server error; received HTTP ${response.status}.`
  );

  if (response.status >= 200 && response.status < 300) {
    const colleges = extractCollegeList(response.data);

    assert.ok(
      colleges !== null,
      "Successful paginated response should contain a recognizable collection."
    );

    assert.ok(
      colleges.length <= TEST_LIMIT,
      `Expected no more than ${TEST_LIMIT} records, received ${colleges.length}.`
    );
  }
});

test("invalid pagination values do not crash the API", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH, {
    query: {
      page: -1,
      limit: -10,
    },
  });

  assert.ok(
    response.status < 500,
    `Invalid pagination must not produce a server error; received HTTP ${response.status}.`
  );

  if (response.status >= 400) {
    assert.ok(
      response.status >= 400 && response.status < 500,
      "Invalid pagination should be rejected with a client error."
    );
  }
});

/* ------------------------------------------------------------------
 * Individual college record
 * ------------------------------------------------------------------ */

test("a college detail endpoint returns a valid record when an ID is configured", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  let identifier = TEST_COLLEGE_ID;

  if (!identifier) {
    const collectionResponse = await apiRequest(COLLEGES_PATH);

    assert.ok(
      collectionResponse.status >= 200 &&
        collectionResponse.status < 300,
      `Cannot discover a college ID: HTTP ${collectionResponse.status}.`
    );

    const colleges = extractCollegeList(collectionResponse.data);

    assert.ok(
      colleges !== null,
      "Could not extract colleges to discover a test ID."
    );

    identifier = getCollegeIdentifier(colleges[0]);
  }

  if (!identifier) {
    t.skip(
      "No college ID is available. Set API_TEST_COLLEGE_ID or seed a college record."
    );
    return;
  }

  const detailPath =
    `${COLLEGES_PATH.replace(/\/+$/, "")}/` +
    encodeURIComponent(identifier);

  const response = await apiRequest(detailPath);

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Expected college detail response for ID ${identifier}; ` +
      `received HTTP ${response.status}.`
  );

  const college = extractCollege(response.data);

  assert.ok(
    college !== null,
    "College detail endpoint should return an identifiable college object."
  );

  const returnedIdentifier = getCollegeIdentifier(college);

  if (returnedIdentifier) {
    assert.equal(
      returnedIdentifier,
      identifier,
      "Returned college identifier should match the requested identifier."
    );
  }
});

test("an unknown college identifier is handled without a server error", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const unknownIdentifier =
    "test-college-that-does-not-exist-9d7e6c4b";

  const detailPath =
    `${COLLEGES_PATH.replace(/\/+$/, "")}/` +
    encodeURIComponent(unknownIdentifier);

  const response = await apiRequest(detailPath);

  assert.ok(
    response.status < 500,
    `Unknown college ID should not cause a server error; received HTTP ${response.status}.`
  );

  if (response.status >= 200 && response.status < 300) {
    const college = extractCollege(response.data);

    assert.ok(
      college === null,
      "Unknown college ID should not return an unrelated college record."
    );
  } else {
    assert.ok(
      [400, 404, 422].includes(response.status),
      `Expected a not-found or validation response; received HTTP ${response.status}.`
    );
  }
});

/* ------------------------------------------------------------------
 * HTTP method and input handling
 * ------------------------------------------------------------------ */

test("unsupported TRACE method is not accepted", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  const response = await apiRequest(COLLEGES_PATH, {
    method: "TRACE",
  });

  assert.ok(
    [400, 404, 405, 501].includes(response.status),
    `TRACE should not be accepted; received HTTP ${response.status}.`
  );
});

test("malformed JSON request body is handled safely by the API", async (t) => {
  if (skipIfServerUnavailable(t)) return;

  // This is a read-only collection endpoint. A GET request with an
  // unexpected body may be ignored or rejected by the HTTP stack.
  // The test checks that such input does not cause an internal error.
  const response = await apiRequest(COLLEGES_PATH, {
    method: "GET",
    rawBody: "{invalid-json",
    headers: {
      "Content-Type": "application/json",
    },
  });

  assert.ok(
    response.status < 500,
    `Unexpected request body should not cause a server error; received HTTP ${response.status}.`
  );
});

/* ------------------------------------------------------------------
 * Response helpers
 * ------------------------------------------------------------------ */

function assertJsonObjectOrArray(value, message) {
  assert.ok(
    value !== null &&
      typeof value === "object",
    message
  );

  // JSON arrays are objects in JavaScript, so both arrays and objects
  // are accepted here. Primitives and null are rejected.
}

/* ------------------------------------------------------------------
 * Test-contract reminders
 * ------------------------------------------------------------------ */

// This suite deliberately does not assume that the following are
// implemented:
//   - GET /api/colleges/:id
//   - search=...
//   - state=...
//   - page=...&limit=...
//
// Align the relevant tests with the actual routes, query parameter
// names, and schemas used by MedOrbits before enabling this suite
// as a strict CI gate.
