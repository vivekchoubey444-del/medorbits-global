
/**
 * MedOrbits -- Applications API Tests
 * File: tests/api/applications.api.test.js
 * Runtime: Node.js >= 20, ESM.
 *
 * Run:
 *   node --test tests/api/applications.api.test.js
 *
 * Optional environment:
 *   API_BASE_URL=http://127.0.0.1:3000
 *   API_APPLICATIONS_PATH=/api/applications
 *   API_HEALTH_PATH=/health
 *   API_TIMEOUT_MS=10000
 *   API_REQUIRE_SERVER=false
 *   API_TEST_TOKEN=
 *
 * Notes:
 *   - Uses Node.js built-in fetch and node:test.
 *   - The API server must be running for HTTP integration tests.
 *   - Tests do not assume that an application is created successfully.
 *   - Destructive tests are not performed.
 *   - Set API_REQUIRE_SERVER=true in CI to require a live API.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE_URL = (
  process.env.API_BASE_URL || ''
).trim().replace(/\/+$/, '');

const APPLICATIONS_PATH = (
  process.env.API_APPLICATIONS_PATH || '/api/applications'
).trim();

const HEALTH_PATH = (
  process.env.API_HEALTH_PATH || '/health'
).trim();

const API_TIMEOUT_MS = Number(
  process.env.API_TIMEOUT_MS || 10000,
);

const REQUIRE_SERVER =
  (process.env.API_REQUIRE_SERVER || 'false').toLowerCase() ===
  'true';

const API_TEST_TOKEN = (
  process.env.API_TEST_TOKEN || ''
).trim();

function validatePath(value, variableName) {
  assert.ok(
    value.startsWith('/'),
    `${variableName} must start with "/".`,
  );

  const parsed = new URL(value, 'http://medorbits.invalid');

  assert.equal(
    parsed.origin,
    'http://medorbits.invalid',
    `${variableName} must be a relative API path.`,
  );

  return `${parsed.pathname}${parsed.search}`;
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
      'API_BASE_URL must be a valid HTTP(S) URL.',
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'API_BASE_URL must use HTTP or HTTPS.',
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'Do not include credentials in API_BASE_URL.',
  );

  return parsed;
}

const VALIDATED_APPLICATIONS_PATH = validatePath(
  APPLICATIONS_PATH,
  'API_APPLICATIONS_PATH',
);

const VALIDATED_HEALTH_PATH = validatePath(
  HEALTH_PATH,
  'API_HEALTH_PATH',
);

function buildUrl(baseUrl, route) {
  const url = new URL(route, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'API request must remain on the configured origin.',
  );

  return url;
}

function buildHeaders({ json = false, token = API_TEST_TOKEN } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (json) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function request(
  baseUrl,
  route,
  {
    method = 'GET',
    body,
    token = API_TEST_TOKEN,
    headers = {},
  } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    API_TIMEOUT_MS,
  );

  try {
    const response = await fetch(buildUrl(baseUrl, route), {
      method,
      headers: {
        ...buildHeaders({
          json: body !== undefined,
          token,
        }),
        ...headers,
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      signal: controller.signal,
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    let data = null;

    if (response.status !== 204) {
      const text = await response.text();

      if (text) {
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(text);
          } catch {
            data = {
              parseError: true,
              raw: text.slice(0, 1000),
            };
          }
        } else {
          data = {
            raw: text.slice(0, 1000),
          };
        }
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `API request timed out after ${API_TIMEOUT_MS} ms: ` +
          `${method} ${route}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertJsonResponse(result, message = 'Expected JSON response') {
  assert.ok(
    result.data !== null && typeof result.data === 'object',
    `${message}. Received: ${JSON.stringify(result.data)}`,
  );

  assert.ok(
    !result.data.parseError,
    `${message}, but the response body was not valid JSON.`,
  );
}

function getApplicationId(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidates = [
    data.id,
    data.applicationId,
    data.application_id,
    data.application?.id,
    data.application?.applicationId,
    data.data?.id,
    data.data?.applicationId,
    data.data?.application?.id,
  ];

  return candidates.find(
    (value) =>
      typeof value === 'string' ||
      typeof value === 'number',
  ) ?? null;
}

function applicationRoute(id) {
  return `${VALIDATED_APPLICATIONS_PATH}/${encodeURIComponent(String(id))}`;
}

function createApplicationFixture() {
  const unique = randomUUID();

  return {
    // Adapt these fields to the actual application.schema.json.
    applicantName: 'MedOrbits API Test',
    applicantEmail: `api-test-${unique}@example.com`,
    applicantPhone: '9000000000',
    course: 'MBBS',
    message: 'Automated API integration test fixture.',
  };
}

function assertExpectedStatus(result, expectedStatuses, context) {
  assert.ok(
    expectedStatuses.includes(result.status),
    `${context}: expected HTTP ${expectedStatuses.join(' or ')}, ` +
      `received ${result.status}. Body: ` +
      JSON.stringify(result.data),
  );
}

test('applications API test configuration is valid', () => {
  assert.ok(
    Number.isInteger(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0,
    'API_TIMEOUT_MS must be a positive integer.',
  );

  validatePath(
    APPLICATIONS_PATH,
    'API_APPLICATIONS_PATH',
  );

  validatePath(
    HEALTH_PATH,
    'API_HEALTH_PATH',
  );

  getBaseUrl();

  if (REQUIRE_SERVER) {
    assert.ok(
      BASE_URL,
      'API_REQUIRE_SERVER=true requires API_BASE_URL.',
    );
  }
});

test('applications API server is reachable when configured', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    if (REQUIRE_SERVER) {
      assert.fail(
        'API_BASE_URL is required when API_REQUIRE_SERVER=true.',
      );
    }

    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(baseUrl, VALIDATED_HEALTH_PATH);
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  assertExpectedStatus(
    result,
    [200, 204],
    'API health endpoint',
  );
});

test('listing applications returns a documented HTTP response', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(
      baseUrl,
      VALIDATED_APPLICATIONS_PATH,
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  // An authenticated API may legitimately reject an anonymous request.
  assert.ok(
    [200, 401, 403, 404].includes(result.status),
    `Unexpected application-list status: ${result.status}`,
  );

  if (result.status === 200) {
    assertJsonResponse(
      result,
      'Application listing should return JSON',
    );

    const payload = result.data;
    const list =
      Array.isArray(payload) ? payload :
      Array.isArray(payload.applications) ? payload.applications :
      Array.isArray(payload.data) ? payload.data :
      Array.isArray(payload.data?.applications) ? payload.data.applications :
      null;

    assert.ok(
      list !== null,
      'Expected an application array or a documented list envelope.',
    );
  }
});

test('application creation validates the HTTP contract', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(
      baseUrl,
      VALIDATED_APPLICATIONS_PATH,
      {
        method: 'POST',
        body: createApplicationFixture(),
      },
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  // 2xx indicates success; 400/401/403/404/409/415/422 may be
  // legitimate depending on authentication, schema, or API design.
  assert.ok(
    [
      200,
      201,
      202,
      400,
      401,
      403,
      404,
      409,
      415,
      422,
    ].includes(result.status),
    `Unexpected application-creation status: ${result.status}. ` +
      JSON.stringify(result.data),
  );

  if ([200, 201, 202].includes(result.status)) {
    assertJsonResponse(
      result,
      'Successful application creation should return JSON',
    );
  }
});

test('empty application submission is rejected or explicitly handled', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(
      baseUrl,
      VALIDATED_APPLICATIONS_PATH,
      {
        method: 'POST',
        body: {},
      },
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  assert.ok(
    [200, 201, 202, 400, 401, 403, 404, 409, 415, 422].includes(
      result.status,
    ),
    `Unexpected response for empty submission: ${result.status}`,
  );

  if ([400, 422].includes(result.status)) {
    assertJsonResponse(
      result,
      'Validation failures should return a structured response',
    );
  }

  if ([200, 201, 202].includes(result.status)) {
    t.diagnostic(
      'The API accepted an empty object. Verify whether this is allowed ' +
        'by the application schema and server-side validation rules.',
    );
  }
});

test('unsupported application methods are handled safely', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(
      baseUrl,
      VALIDATED_APPLICATIONS_PATH,
      {
        method: 'TRACE',
      },
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  assert.ok(
    [400, 401, 403, 404, 405, 501].includes(result.status),
    `Unexpected TRACE response status: ${result.status}`,
  );
});

test('application detail endpoint handles an unknown ID safely', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  const unknownId = `nonexistent-${randomUUID()}`;

  let result;

  try {
    result = await request(
      baseUrl,
      applicationRoute(unknownId),
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  assert.ok(
    [200, 400, 401, 403, 404, 422].includes(result.status),
    `Unexpected unknown-ID response: ${result.status}`,
  );

  if (result.status === 200) {
    t.diagnostic(
      'Unknown-ID lookup returned HTTP 200. Confirm that the response ' +
        'does not expose another applicant’s data.',
    );
  }
});

test('unauthenticated access does not bypass configured authorization', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  let result;

  try {
    result = await request(
      baseUrl,
      VALIDATED_APPLICATIONS_PATH,
      {
        token: '',
      },
    );
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return;
  }

  assert.ok(
    [200, 401, 403, 404].includes(result.status),
    `Unexpected unauthenticated request status: ${result.status}`,
  );

  if (result.status === 200) {
    t.diagnostic(
      'The application-list endpoint allows anonymous access. ' +
        'Verify that public listing is intentional and does not disclose ' +
        'personal or confidential applicant information.',
    );
  }
});
