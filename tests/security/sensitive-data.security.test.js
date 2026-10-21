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
 * Run:
 *   node --test tests/security/sensitive-data.security.test.js
 *
 * Run only against an isolated test environment.
 * Configure paths to match the actual MedOrbits API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.SENSITIVE_DATA_TEST_BASE_URL || ''
).replace(/\/+$/, '');
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
const configured = Boolean(
  BASE_URL &&
  TOKEN &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0
);
const JSON_ACCEPT = {
  Accept: 'application/json',
};
const FORBIDDEN_RESPONSE_KEYS = new Set([
  'password',
  'passwordhash',
  'hashedpassword',
  'passworddigest',
  'passwordsalt',
  'refreshtoken',
  'accesstoken',
  'authorizationtoken',
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
    !/[\r\n]/.test(path)
  );
}
function validateBaseUrl() {
  let parsed;
  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'SENSITIVE_DATA_TEST_BASE_URL must be an absolute URL.'
    );
  }
  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'Base URL must use HTTP or HTTPS.'
  );
  assert.equal(
    parsed.username + parsed.password,
    '',
    'Do not place credentials in the base URL.'
  );
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ]);
  assert.ok(
    localHosts.has(parsed.hostname) ||
      process.env.SENSITIVE_DATA_TEST_ALLOW_REMOTE === 'true',
    'Remote targets require SENSITIVE_DATA_TEST_ALLOW_REMOTE=true.'
  );
}
function authHeaders(token, extra = {}, hasBody = false) {
  return {
    ...JSON_ACCEPT,
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
async function request(path, {
  token = TOKEN,
  method = 'GET',
  body,
  headers = {},
} = {}) {
  assert.ok(validPath(path), 'Invalid configured request path.');
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: authHeaders(
        token,
        headers,
        body !== undefined
      ),
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      redirect: 'manual',
      signal: controller.signal,
    });
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
async function responseBody(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function inspectObject(value, path = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectObject(item, `${path}[${index}]`, findings);
    });
    return findings;
  }
  if (!value || typeof value !== 'object') {
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
  const textValue = typeof value === 'string'
    ? value
    : JSON.stringify(value ?? '');
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
    `${description}: expected a 4xx response; received HTTP ${response.status}`
  );
}
function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: received HTTP ${response.status}`
  );
}
test(
  'Sensitive data exposure security integration suite',
  { skip: !configured },
  async (t) => {
    validateBaseUrl();
    for (const [name, path] of [
      ['Users path', USERS_PATH],
      ['Applications path', APPLICATIONS_PATH],
      ['Admin path', ADMIN_PATH],
      ['Invalid path', INVALID_PATH],
    ]) {
      assert.ok(validPath(path), `${name} is invalid.`);
    }
    if (PROFILE_PATH) {
      assert.ok(validPath(PROFILE_PATH), 'Profile path is invalid.');
    }
    await t.test(
      'Unauthenticated users endpoint denies access without leaking secrets',
      async () => {
        const response = await requestUnauthenticated(USERS_PATH);
        assertClientError(response, 'Unauthenticated users endpoint');
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Unauthenticated users endpoint');
        assertNoSensitiveErrorDetails(body, 'Unauthenticated users endpoint');
        assertNoSensitiveHeaders(response, 'Unauthenticated users endpoint');
      }
    );
    await t.test(
      'Authenticated user listing does not expose credential fields',
      async () => {
        const response = await request(USERS_PATH);
        assertNoServerError(response, 'Authenticated users endpoint');
        if (response.ok) {
          const body = await responseBody(response);
          assertNoForbiddenKeys(body, 'Authenticated users endpoint');
        } else {
          const body = await responseBody(response);
          assertNoSensitiveErrorDetails(
            body,
            'Authenticated users endpoint error'
          );
        }
        assertNoSensitiveHeaders(response, 'Authenticated users endpoint');
      }
    );
    await t.test(
      'Application responses do not expose credential fields',
      async () => {
        const response = await request(APPLICATIONS_PATH);
        assertNoServerError(response, 'Applications endpoint');
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Applications endpoint');
        if (!response.ok) {
          assertNoSensitiveErrorDetails(
            body,
            'Applications endpoint error'
          );
        }
        assertNoSensitiveHeaders(response, 'Applications endpoint');
      }
    );
    await t.test(
      'Profile responses do not expose credential fields',
      { skip: !PROFILE_PATH },
      async () => {
        const response = await request(PROFILE_PATH);
        assertNoServerError(response, 'Profile endpoint');
        const body = await responseBody(response);
        if (response.ok) {
          assertNoForbiddenKeys(body, 'Profile endpoint');
        } else {
          assertNoSensitiveErrorDetails(body, 'Profile endpoint error');
        }
        assertNoSensitiveHeaders(response, 'Profile endpoint');
      }
    );
    await t.test(
      'Unauthenticated administrative access is denied safely',
      async () => {
        const response = await requestUnauthenticated(ADMIN_PATH);
        assertClientError(response, 'Unauthenticated admin endpoint');
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Unauthenticated admin endpoint');
        assertNoSensitiveErrorDetails(body, 'Unauthenticated admin endpoint');
        assertNoSensitiveHeaders(response, 'Unauthenticated admin endpoint');
      }
    );
    await t.test(
      'Invalid route response does not expose implementation details',
      async () => {
        const response = await requestUnauthenticated(INVALID_PATH);
        assert.equal(
          response.status,
          404,
          `Expected HTTP 404 for the configured invalid route; received ${response.status}`
        );
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Invalid route response');
        assertNoSensitiveErrorDetails(body, 'Invalid route response');
        assertNoSensitiveHeaders(response, 'Invalid route response');
      }
    );
    await t.test(
      'Malformed JSON errors do not reveal implementation details',
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          TIMEOUT_MS
        );
        let response;
        try {
          response = await fetch(
            `${BASE_URL}${APPLICATIONS_PATH}`,
            {
              method: 'POST',
              headers: authHeaders(TOKEN, {}, true),
              body: '{"application":',
              redirect: 'manual',
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(timeout);
        }
        assertClientError(response, 'Malformed JSON request');
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Malformed JSON response');
        assertNoSensitiveErrorDetails(body, 'Malformed JSON response');
        assertNoSensitiveHeaders(response, 'Malformed JSON response');
      }
    );
    await t.test(
      'Invalid application identifier errors do not disclose internals',
      async () => {
        const path =
          `${APPLICATIONS_PATH}/__invalid_security_test_id__`;
        const response = await request(path);
        assertNoServerError(response, 'Invalid application identifier');
        const body = await responseBody(response);
        assertNoForbiddenKeys(body, 'Invalid application identifier');
        assertNoSensitiveErrorDetails(body, 'Invalid application identifier');
        assertNoSensitiveHeaders(response, 'Invalid application identifier');
      }
    );
    await t.test(
      'Users endpoint does not include diagnostic response headers',
      async () => {
        const response = await request(USERS_PATH);
        assertNoServerError(response, 'Users diagnostic header probe');
        assertNoSensitiveHeaders(
          response,
          'Users diagnostic header probe'
        );
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
  const unsafePayload = {
    user: {
      passwordHash: 'example-only',
    },
  };
  assert.deepEqual(
    inspectObject(safePayload),
    [],
    'Safe sample should not contain forbidden fields'
  );
  assert.ok(
    inspectObject(unsafePayload).length > 0,
    'Password hash field should be detected'
  );
  assert.ok(
    inspectObject({ mfa_secret: 'example-only' }).length > 0,
    'MFA secret field should be detected'
  );
  assert.ok(
    inspectText(
      'Error at handler (/app/node_modules/example.js:10:2)'
    ).length > 0,
    'Stack trace sample should be detected'
  );
  assert.ok(
    inspectText(
      'postgres://test-user:test-password@localhost:5432/testdb'
    ).length > 0,
    'Database connection URL sample should be detected'
  );
  assert.ok(
    inspectText(
      'client_secret=example-secret-value'
    ).length > 0,
    'Secret assignment sample should be detected'
  );
});