
'use strict';

/**
 * MedOrbits -- Sensitive Data Exposure Security Tests
 *
 * File: tests/security/sensitive-data.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   SENSITIVE_DATA_TEST_BASE_URL
 *   SENSITIVE_DATA_TEST_TOKEN
 *   SENSITIVE_DATA_TEST_TIMEOUT_MS
 *   SENSITIVE_DATA_TEST_PROFILE_PATH
 *   SENSITIVE_DATA_TEST_USERS_PATH
 *   SENSITIVE_DATA_TEST_APPLICATIONS_PATH
 *   SENSITIVE_DATA_TEST_ADMIN_PATH
 *   SENSITIVE_DATA_TEST_INVALID_PATH
 *
 * Additional safeguards:
 *   SENSITIVE_DATA_TEST_ALLOW_REMOTE=true
 *   SENSITIVE_DATA_TEST_RUN_MUTATIONS=true
 *   SENSITIVE_DATA_TEST_ENVIRONMENT=sandbox
 *   SENSITIVE_DATA_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   SENSITIVE_DATA_TEST_ALLOW_CI_MUTATIONS=true
 *
 * Run:
 *   SENSITIVE_DATA_TEST_BASE_URL=http://127.0.0.1:3000 \
 *   SENSITIVE_DATA_TEST_TOKEN=your-test-token \
 *   node --test tests/security/sensitive-data.security.test.js
 *
 * IMPORTANT:
 * - Run against a dedicated test environment.
 * - Use test credentials, never production credentials.
 * - Read-only tests run by default.
 * - Malformed-body POST tests require explicit mutation-test opt-in.
 * - Configure paths to match the actual MedOrbits API.
 * - This suite does not replace a review of database queries, logs,
 *   object storage permissions, or deployment configuration.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (
  process.env.SENSITIVE_DATA_TEST_BASE_URL || ''
).trim().replace(/\/+$/, '');

const TOKEN =
  process.env.SENSITIVE_DATA_TEST_TOKEN || '';

const TIMEOUT_MS = Number(
  process.env.SENSITIVE_DATA_TEST_TIMEOUT_MS || 15000
);

const PROFILE_PATH =
  process.env.SENSITIVE_DATA_TEST_PROFILE_PATH || '';

const USERS_PATH =
  process.env.SENSITIVE_DATA_TEST_USERS_PATH || '/api/users';

const APPLICATIONS_PATH =
  process.env.SENSITIVE_DATA_TEST_APPLICATIONS_PATH ||
  '/api/applications';

const ADMIN_PATH =
  process.env.SENSITIVE_DATA_TEST_ADMIN_PATH || '/api/admin';

const INVALID_PATH =
  process.env.SENSITIVE_DATA_TEST_INVALID_PATH ||
  '/api/__security_test_invalid_route__';

const ALLOW_REMOTE =
  process.env.SENSITIVE_DATA_TEST_ALLOW_REMOTE === 'true';

const RUN_MUTATIONS =
  process.env.SENSITIVE_DATA_TEST_RUN_MUTATIONS === 'true';

const TEST_ENVIRONMENT = (
  process.env.SENSITIVE_DATA_TEST_ENVIRONMENT || ''
).trim().toLowerCase();

const ALLOW_REMOTE_MUTATIONS =
  process.env.SENSITIVE_DATA_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.SENSITIVE_DATA_TEST_ALLOW_CI_MUTATIONS === 'true';

const IS_CI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.BUILDKITE ||
  process.env.JENKINS_URL
);

const MAX_RESPONSE_BYTES = 1024 * 1024;

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const FORBIDDEN_RESPONSE_KEYS = new Set([
  'password',
  'passwordhash',
  'hashedpassword',
  'passworddigest',
  'passwordsalt',
  'refreshtoken',
  'accesstoken',
  'authorizationtoken',
  'bearertoken',
  'jwt',
  'secretkey',
  'privatekey',
  'clientsecret',
  'webhooksecret',
  'apikey',
  'apisecret',
  'sessionsecret',
  'otpsecret',
  'mfasecret',
  'totpsecret',
  'recoverycodes',
  'recoverycode',
  'cardnumber',
  'cvv',
  'cvc',
  'cardsecuritycode',
  'bankaccountpassword',
  'databaseurl',
  'connectionstring',
]);

const SENSITIVE_HEADERS = new Set([
  'x-powered-by',
  'x-debug-token',
  'x-internal-error',
  'x-stack-trace',
]);

const CONFIGURED = Boolean(
  BASE_URL &&
  TOKEN &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS >= 100 &&
  TIMEOUT_MS <= 120000
);

function normalizeKey(key) {
  return String(key)
    .replace(/[-_\s]/g, '')
    .toLowerCase();
}

function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !/[\r\n\u0000]/.test(path) &&
    !path.includes('#')
  );
}

function assertValidPath(path, description) {
  assert.ok(
    validPath(path),
    `${description} must start with one slash and contain no ` +
      'backslashes, fragments, or control characters.'
  );
}

function validateBaseUrl() {
  let parsed;

  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'SENSITIVE_DATA_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'Base URL must use HTTP or HTTPS.'
  );

  assert.equal(
    parsed.username + parsed.password,
    '',
    'Do not include credentials in the base URL.'
  );

  assert.equal(
    parsed.search,
    '',
    'Base URL must not contain a query string.'
  );

  assert.equal(
    parsed.hash,
    '',
    'Base URL must not contain a fragment.'
  );

  assert.ok(
    parsed.pathname === '/' || parsed.pathname === '',
    'Base URL must identify an origin, not an application subpath.'
  );

  const isLocal = LOCAL_HOSTS.has(parsed.hostname);

  assert.ok(
    isLocal || ALLOW_REMOTE,
    'Remote targets require SENSITIVE_DATA_TEST_ALLOW_REMOTE=true.'
  );

  if (!isLocal) {
    assert.equal(
      parsed.protocol,
      'https:',
      'Remote test targets must use HTTPS.'
    );
  }

  return { parsed, isLocal };
}

function mutationSkipReason() {
  if (!RUN_MUTATIONS) {
    return (
      'Mutation tests are disabled. Set ' +
      'SENSITIVE_DATA_TEST_RUN_MUTATIONS=true to enable them.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (TEST_ENVIRONMENT !== 'sandbox') {
    return 'Mutation tests require SENSITIVE_DATA_TEST_ENVIRONMENT=sandbox.';
  }

  if (IS_CI && !ALLOW_CI_MUTATIONS) {
    return (
      'Mutation tests in CI require ' +
      'SENSITIVE_DATA_TEST_ALLOW_CI_MUTATIONS=true.'
    );
  }

  try {
    const { isLocal } = validateBaseUrl();

    if (
      !isLocal &&
      (!ALLOW_REMOTE || !ALLOW_REMOTE_MUTATIONS)
    ) {
      return (
        'Remote mutations require both ' +
        'SENSITIVE_DATA_TEST_ALLOW_REMOTE=true and ' +
        'SENSITIVE_DATA_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }
  } catch (error) {
    return `Invalid mutation target: ${error.message}`;
  }

  return null;
}

function authHeaders(token, extra = {}, hasBody = false) {
  return {
    Accept: 'application/json',
    ...(hasBody
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  assert.ok(
    BASE_URL,
    'SENSITIVE_DATA_TEST_BASE_URL is required.'
  );

  assertValidPath(path, 'Request path');

  const {
    token = TOKEN,
    method = 'GET',
    body,
    headers: extraHeaders = {},
  } = options;

  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request must remain on the configured origin.'
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      method,
      headers: authHeaders(
        token,
        extraHeaders,
        body !== undefined
      ),
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestUnauthenticated(path, options = {}) {
  return request(path, {
    ...options,
    token: '',
    headers: {
      ...(options.headers || {}),
      Authorization: '',
    },
  });
}

async function readResponseBody(response) {
  const declaredLength = response.headers.get('content-length');

  if (declaredLength !== null) {
    const length = Number(declaredLength);

    assert.ok(
      Number.isFinite(length) &&
        length >= 0 &&
        length <= MAX_RESPONSE_BYTES,
      `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
    );
  }

  if (!response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();

        throw new Error(
          `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function inspectObject(value, path = '$', findings = []) {
  if (!value || typeof value !== 'object') {
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectObject(item, `${path}[${index}]`, findings);
    });

    return findings;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RESPONSE_KEYS.has(normalizeKey(key))) {
      findings.push(`${path}.${key}`);
    }

    inspectObject(child, `${path}.${key}`, findings);
  }

  return findings;
}

function inspectText(value) {
  let textValue;

  try {
    textValue = typeof value === 'string'
      ? value
      : JSON.stringify(value ?? '');
  } catch {
    textValue = String(value);
  }

  const patterns = [
    {
      name: 'private-key material',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
    },
    {
      name: 'stack trace',
      regex: /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/,
    },
    {
      name: 'internal source path',
      regex: /(?:\/app\/|\/srv\/|[A-Z]:\\)[^\s"'<>]*node_modules[\\/]/i,
    },
    {
      name: 'database connection URL',
      regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s/]+@/i,
    },
    {
      name: 'JWT-like token',
      regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    },
    {
      name: 'secret assignment',
      regex: /\b(?:client_secret|webhook_secret|private_key|session_secret|api_secret)\s*[:=]\s*["']?[^"'\s,}]{8,}/i,
    },
    {
      name: 'environment variable secret',
      regex: /\b(?:DATABASE_URL|SESSION_SECRET|JWT_SECRET|API_KEY|WEBHOOK_SECRET)\s*[:=]\s*["']?[^"'\s,}]{8,}/i,
    },
  ];

  return patterns
    .filter((pattern) => pattern.regex.test(textValue))
    .map((pattern) => pattern.name);
}

function assertNoForbiddenKeys(body, description) {
  const findings = inspectObject(body);

  assert.equal(
    findings.length,
    0,
    `${description}: forbidden sensitive response fields detected: ` +
      findings.join(', ')
  );
}

function assertNoSensitiveErrorDetails(body, description) {
  const findings = inspectText(body);

  assert.equal(
    findings.length,
    0,
    `${description}: possible internal diagnostic disclosure: ` +
      findings.join(', ')
  );
}

function assertNoSensitiveHeaders(response, description) {
  const exposed = [];

  for (const [name] of response.headers.entries()) {
    if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
      exposed.push(name);
    }
  }

  assert.deepEqual(
    exposed,
    [],
    `${description}: diagnostic headers detected: ${exposed.join(', ')}`
  );
}

function assertClientError(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected a 4xx response; received HTTP ${response.status}.`
  );
}

function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: received HTTP ${response.status}.`
  );
}

function assertNoSensitiveDisclosure(
  response,
  body,
  description
) {
  assertNoForbiddenKeys(body, description);
  assertNoSensitiveErrorDetails(body, description);
  assertNoSensitiveHeaders(response, description);
}

async function assertSafeResponse(
  response,
  description,
  options = {}
) {
  const {
    requireClientError = false,
    expectedStatus,
  } = options;

  if (expectedStatus !== undefined) {
    assert.equal(
      response.status,
      expectedStatus,
      `${description}: expected HTTP ${expectedStatus}, ` +
        `received HTTP ${response.status}.`
    );
  }

  if (requireClientError) {
    assertClientError(response, description);
  } else {
    assertNoServerError(response, description);
  }

  const body = await readResponseBody(response);

  assertNoSensitiveDisclosure(
    response,
    body,
    description
  );

  return body;
}

async function sendMalformedJson(path) {
  assertValidPath(path, 'Malformed JSON request path');

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    return await fetch(new URL(path, `${BASE_URL}/`), {
      method: 'POST',
      headers: authHeaders(TOKEN, {}, true),
      body: '{"application":',
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Malformed JSON request timed out after ${TIMEOUT_MS} ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

test(
  'Sensitive data exposure security integration suite',
  { skip: !CONFIGURED },
  async (t) => {
    validateBaseUrl();

    for (const [name, path] of [
      ['Users path', USERS_PATH],
      ['Applications path', APPLICATIONS_PATH],
      ['Admin path', ADMIN_PATH],
      ['Invalid path', INVALID_PATH],
    ]) {
      assertValidPath(path, name);
    }

    if (PROFILE_PATH) {
      assertValidPath(PROFILE_PATH, 'Profile path');
    }

    await t.test(
      'Unauthenticated users endpoint denies access without leaking secrets',
      async () => {
        const response = await requestUnauthenticated(USERS_PATH);

        await assertSafeResponse(
          response,
          'Unauthenticated users endpoint',
          { requireClientError: true }
        );
      }
    );

    await t.test(
      'Authenticated users response does not expose credential fields',
      async () => {
        const response = await request(USERS_PATH);

        await assertSafeResponse(
          response,
          'Authenticated users endpoint'
        );
      }
    );

    await t.test(
      'Application responses do not expose sensitive fields or diagnostics',
      async () => {
        const response = await request(APPLICATIONS_PATH);

        await assertSafeResponse(
          response,
          'Applications endpoint'
        );
      }
    );

    await t.test(
      'Profile response does not expose credential fields',
      { skip: !PROFILE_PATH },
      async () => {
        const response = await request(PROFILE_PATH);

        await assertSafeResponse(
          response,
          'Profile endpoint'
        );
      }
    );

    await t.test(
      'Unauthenticated administrative access is denied safely',
      async () => {
        const response = await requestUnauthenticated(ADMIN_PATH);

        await assertSafeResponse(
          response,
          'Unauthenticated admin endpoint',
          { requireClientError: true }
        );
      }
    );

    await t.test(
      'Invalid route response does not disclose implementation details',
      async () => {
        const response = await requestUnauthenticated(INVALID_PATH);

        await assertSafeResponse(
          response,
          'Invalid route response',
          { expectedStatus: 404 }
        );
      }
    );

    await t.test(
      'Malformed JSON errors do not reveal implementation details',
      {
        skip: Boolean(mutationSkipReason()),
      },
      async () => {
        const response = await sendMalformedJson(
          APPLICATIONS_PATH
        );

        try {
          await assertSafeResponse(
            response,
            'Malformed JSON response',
            { requireClientError: true }
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'Invalid application identifier does not disclose internals',
      async () => {
        const path =
          `${APPLICATIONS_PATH}/__invalid_security_test_id__`;

        const response = await request(path);

        await assertSafeResponse(
          response,
          'Invalid application identifier'
        );
      }
    );

    await t.test(
      'Users endpoint does not expose diagnostic response headers',
      async () => {
        const response = await request(USERS_PATH);

        try {
          assertNoServerError(
            response,
            'Users diagnostic header probe'
          );

          assertNoSensitiveHeaders(
            response,
            'Users diagnostic header probe'
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );
  }
);

test('Sensitive data inspection helper invariants', () => {
  const safePayload = {
    id: 'security-test-user',
    displayName: 'Security Test User',
    role: 'user',
  };

  const unsafePayloads = [
    { user: { passwordHash: 'example-only' } },
    { mfa_secret: 'example-only' },
    { auth: { refresh_token: 'example-only' } },
    { billing: { card_number: '4111111111111111' } },
  ];

  assert.deepEqual(
    inspectObject(safePayload),
    [],
    'Ordinary profile fields should not be flagged.'
  );

  for (const payload of unsafePayloads) {
    assert.ok(
      inspectObject(payload).length > 0,
      'Sensitive response fields should be detected.'
    );
  }

  assert.ok(
    inspectText(
      'Error at handler (/app/node_modules/example.js:10:2)'
    ).includes('stack trace'),
    'Stack trace sample should be detected.'
  );

  assert.ok(
    inspectText(
      'postgres://test-user:test-password@localhost:5432/testdb'
    ).includes('database connection URL'),
    'Database connection URL sample should be detected.'
  );

  assert.ok(
    inspectText(
      'client_secret=example-secret-value'
    ).includes('secret assignment'),
    'Secret assignment sample should be detected.'
  );

  assert.ok(
    inspectText(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue123'
    ).includes('JWT-like token'),
    'JWT-like token sample should be detected.'
  );

  assert.equal(
    normalizeKey('password_hash'),
    'passwordhash'
  );

  assert.equal(
    normalizeKey('refresh-token'),
    'refreshtoken'
  );

  assert.equal(
    validPath('//example.com/api/users'),
    false
  );

  assert.equal(
    validPath('/api/users\r\nX-Test: true'),
    false
  );

  assert.equal(
    validPath('https://example.com/api/users'),
    false
  );
});

test('Sensitive data configuration invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'Timeout must be between 100 and 120000 milliseconds.'
  );

  for (const [name, path] of [
    ['Users path', USERS_PATH],
    ['Applications path', APPLICATIONS_PATH],
    ['Admin path', ADMIN_PATH],
    ['Invalid path', INVALID_PATH],
  ]) {
    assertValidPath(path, name);
  }

  if (PROFILE_PATH) {
    assertValidPath(PROFILE_PATH, 'Profile path');
  }

  if (BASE_URL) {
    validateBaseUrl();
  } else {
    assert.equal(
      CONFIGURED,
      false,
      'Suite must remain unconfigured without a base URL.'
    );
  }
});
