
'use strict';

/**
 * MedOrbits -- Unauthorized Downloads Security Tests
 *
 * File: tests/security/unauthorized-downloads.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   DOWNLOAD_TEST_BASE_URL
 *   DOWNLOAD_TEST_TIMEOUT_MS
 *   DOWNLOAD_TEST_PRIVATE_PATH
 *   DOWNLOAD_TEST_USER_A_TOKEN
 *   DOWNLOAD_TEST_USER_B_TOKEN
 *   DOWNLOAD_TEST_USER_A_DOCUMENT_ID
 *   DOWNLOAD_TEST_USER_B_DOCUMENT_ID
 *   DOWNLOAD_TEST_DOWNLOAD_PATH_TEMPLATE
 *   DOWNLOAD_TEST_DOCUMENTS_PATH
 *   DOWNLOAD_TEST_MAX_RESPONSE_BYTES
 *
 * Mutation safeguards:
 *   DOWNLOAD_TEST_RUN_MUTATIONS=true
 *   DOWNLOAD_TEST_ENVIRONMENT=sandbox
 *   DOWNLOAD_TEST_ALLOW_REMOTE=true
 *   DOWNLOAD_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   DOWNLOAD_TEST_ALLOW_CI_MUTATIONS=true
 *
 * Run:
 *   DOWNLOAD_TEST_BASE_URL=http://127.0.0.1:3000 \
 *   node --test tests/security/unauthorized-downloads.security.test.js
 *
 * IMPORTANT:
 * - Use an isolated test environment and synthetic documents.
 * - User A and User B must be separate low-privilege accounts.
 * - Never use production tokens or private production documents.
 * - Mutation tests are disabled by default.
 * - Configure paths to match the actual API.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (
  process.env.DOWNLOAD_TEST_BASE_URL || ''
).trim().replace(/\/+$/, '');

const TIMEOUT_MS = Number(
  process.env.DOWNLOAD_TEST_TIMEOUT_MS || 15000
);

const MAX_RESPONSE_BYTES = Number(
  process.env.DOWNLOAD_TEST_MAX_RESPONSE_BYTES ||
  5 * 1024 * 1024
);

const PRIVATE_PATH =
  process.env.DOWNLOAD_TEST_DOWNLOAD_PATH_TEMPLATE ||
  process.env.DOWNLOAD_TEST_PRIVATE_PATH ||
  '/api/documents/:id/download';

const DOCUMENTS_PATH =
  process.env.DOWNLOAD_TEST_DOCUMENTS_PATH ||
  '/api/documents';

const USER_A_TOKEN =
  process.env.DOWNLOAD_TEST_USER_A_TOKEN || '';

const USER_B_TOKEN =
  process.env.DOWNLOAD_TEST_USER_B_TOKEN || '';

const USER_A_DOCUMENT_ID =
  process.env.DOWNLOAD_TEST_USER_A_DOCUMENT_ID || '';

const USER_B_DOCUMENT_ID =
  process.env.DOWNLOAD_TEST_USER_B_DOCUMENT_ID || '';

const ALLOW_REMOTE =
  process.env.DOWNLOAD_TEST_ALLOW_REMOTE === 'true';

const RUN_MUTATIONS =
  process.env.DOWNLOAD_TEST_RUN_MUTATIONS === 'true';

const TEST_ENVIRONMENT = (
  process.env.DOWNLOAD_TEST_ENVIRONMENT || ''
).trim().toLowerCase();

const ALLOW_REMOTE_MUTATIONS =
  process.env.DOWNLOAD_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.DOWNLOAD_TEST_ALLOW_CI_MUTATIONS === 'true';

const IS_CI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.BUILDKITE ||
  process.env.JENKINS_URL
);

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const CONFIGURED = Boolean(
  BASE_URL &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS >= 100 &&
  TIMEOUT_MS <= 120000 &&
  Number.isFinite(MAX_RESPONSE_BYTES) &&
  MAX_RESPONSE_BYTES >= 1024 &&
  MAX_RESPONSE_BYTES <= 50 * 1024 * 1024 &&
  validPath(PRIVATE_PATH) &&
  validPath(DOCUMENTS_PATH)
);

function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !/[\r\n\u0000]/.test(path) &&
    !path.includes('#') &&
    !path.includes('?')
  );
}

function assertValidPath(path, description = 'API path') {
  assert.ok(
    validPath(path),
    `${description} must begin with one slash and contain no query, fragment, backslash, or control character.`
  );
}

function validateBaseUrl() {
  let parsed;

  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'DOWNLOAD_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'Base URL must use HTTP or HTTPS.'
  );

  assert.equal(
    parsed.username + parsed.password,
    '',
    'Do not put credentials in the base URL.'
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
    'Remote targets require DOWNLOAD_TEST_ALLOW_REMOTE=true.'
  );

  if (!isLocal) {
    assert.equal(
      parsed.protocol,
      'https:',
      'Remote targets must use HTTPS.'
    );
  }

  return { parsed, isLocal };
}

function mutationSkipReason() {
  if (!RUN_MUTATIONS) {
    return (
      'Mutation tests are disabled. Set ' +
      'DOWNLOAD_TEST_RUN_MUTATIONS=true to enable them.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (TEST_ENVIRONMENT !== 'sandbox') {
    return 'Mutation tests require DOWNLOAD_TEST_ENVIRONMENT=sandbox.';
  }

  if (IS_CI && !ALLOW_CI_MUTATIONS) {
    return (
      'Mutation tests in CI require ' +
      'DOWNLOAD_TEST_ALLOW_CI_MUTATIONS=true.'
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
        'DOWNLOAD_TEST_ALLOW_REMOTE=true and ' +
        'DOWNLOAD_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }
  } catch (error) {
    return `Invalid mutation target: ${error.message}`;
  }

  return null;
}

function urlForDocument(documentId) {
  assert.ok(
    typeof documentId === 'string' &&
      documentId.length > 0 &&
      documentId.length <= 512,
    'Document ID must be a non-empty string of at most 512 characters.'
  );

  assertValidPath(PRIVATE_PATH, 'Download path template');

  const encodedId = encodeURIComponent(documentId);

  const path = PRIVATE_PATH.includes(':id')
    ? PRIVATE_PATH.replaceAll(':id', encodedId)
    : `${PRIVATE_PATH.replace(/\/+$/, '')}/${encodedId}`;

  assertValidPath(path, 'Resolved document download path');

  return path;
}

function requestHeaders(token = '', extra = {}) {
  return {
    Accept: '*/*',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  assert.ok(
    BASE_URL,
    'DOWNLOAD_TEST_BASE_URL is required.'
  );

  assertValidPath(path, 'Request path');

  const {
    token = '',
    method = 'GET',
    headers: extraHeaders = {},
    body,
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
      headers: requestHeaders(token, {
        ...extraHeaders,
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      }),
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

/**
 * Read a bounded response body to avoid unbounded memory consumption.
 */
async function readBody(response) {
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
    return Buffer.alloc(0);
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
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

function assertAccessDenied(response, description) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${description}: expected HTTP 401, 403, or 404; received HTTP ${response.status}.`
  );
}

function assertNotServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}.`
  );
}

function assertNotRedirect(response, description) {
  assert.ok(
    ![301, 302, 303, 307, 308].includes(response.status),
    `${description}: unexpected redirect with HTTP ${response.status}.`
  );

  assert.equal(
    response.headers.get('location'),
    null,
    `${description}: response must not disclose a redirect destination.`
  );
}

function assertNotFileDownload(response, body, description) {
  const contentType = (
    response.headers.get('content-type') || ''
  ).toLowerCase();

  const disposition = (
    response.headers.get('content-disposition') || ''
  ).toLowerCase();

  const looksLikeFile =
    disposition.includes('attachment') ||
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.startsWith('image/') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/vnd.') ||
    contentType.includes('application/x-');

  assert.equal(
    looksLikeFile,
    false,
    `${description}: unauthorized response resembles a file download.`
  );

  assert.ok(
    Buffer.isBuffer(body),
    `${description}: response body must be read as bytes.`
  );
}

async function assertUnauthorizedDownload(path, description) {
  const response = await request(path);

  try {
    assertAccessDenied(response, description);
    assertNotRedirect(response, description);

    const body = await readBody(response);

    assertNotFileDownload(
      response,
      body,
      description
    );
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

function skipUnlessConfigured(t, requirements = []) {
  if (!CONFIGURED) {
    t.skip(
      'Configure DOWNLOAD_TEST_BASE_URL and valid timeout, response-size, and path settings.'
    );

    return true;
  }

  for (const [name, value] of requirements) {
    if (!value) {
      t.skip(`Missing required configuration: ${name}`);

      return true;
    }
  }

  return false;
}

test(
  'Unauthorized downloads security integration suite',
  { skip: !CONFIGURED },
  async (t) => {
    validateBaseUrl();

    assertValidPath(PRIVATE_PATH, 'Download path template');
    assertValidPath(DOCUMENTS_PATH, 'Documents path');

    await t.test(
      'Unauthenticated users cannot download a private document',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            [
              'DOWNLOAD_TEST_USER_A_DOCUMENT_ID',
              USER_A_DOCUMENT_ID,
            ],
          ])
        ) {
          return;
        }

        await assertUnauthorizedDownload(
          urlForDocument(USER_A_DOCUMENT_ID),
          'Unauthenticated private download'
        );
      }
    );

    await t.test(
      'User A cannot download User B document',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
            [
              'DOWNLOAD_TEST_USER_B_DOCUMENT_ID',
              USER_B_DOCUMENT_ID,
            ],
          ])
        ) {
          return;
        }

        assert.notEqual(
          USER_A_DOCUMENT_ID,
          USER_B_DOCUMENT_ID,
          'Cross-user testing requires distinct document IDs.'
        );

        await assertUnauthorizedDownload(
          urlForDocument(USER_B_DOCUMENT_ID),
          'Unauthenticated cross-user baseline'
        );

        const response = await request(
          urlForDocument(USER_B_DOCUMENT_ID),
          { token: USER_A_TOKEN }
        );

        try {
          assertAccessDenied(
            response,
            'Cross-user document download'
          );

          assertNotRedirect(
            response,
            'Cross-user document download'
          );

          const body = await readBody(response);

          assertNotFileDownload(
            response,
            body,
            'Cross-user document download'
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'User B can download their own synthetic document',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            ['DOWNLOAD_TEST_USER_B_TOKEN', USER_B_TOKEN],
            [
              'DOWNLOAD_TEST_USER_B_DOCUMENT_ID',
              USER_B_DOCUMENT_ID,
            ],
          ])
        ) {
          return;
        }

        const response = await request(
          urlForDocument(USER_B_DOCUMENT_ID),
          { token: USER_B_TOKEN }
        );

        try {
          assert.ok(
            response.status >= 200 &&
              response.status < 300,
            'Document owner should be authorized; ' +
              `received HTTP ${response.status}.`
          );

          assert.equal(
            response.headers.get('location'),
            null,
            'Expected the endpoint to return the file directly, not redirect.'
          );

          assert.ok(
            response.headers.get('content-type'),
            'Authorized download must identify its content type.'
          );

          const body = await readBody(response);

          assert.ok(
            body.byteLength > 0,
            'Synthetic test document should have non-empty content.'
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'Invalid document IDs do not return file contents',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
          ])
        ) {
          return;
        }

        const invalidIds = [
          'undefined',
          'null',
          '-1',
          'nonexistent-security-test-document',
          '../admin',
          '..%2Fadmin',
          '%00',
        ];

        for (const id of invalidIds) {
          const response = await request(
            urlForDocument(id),
            { token: USER_A_TOKEN }
          );

          try {
            assert.ok(
              response.status >= 400 &&
                response.status < 500,
              `Invalid ID "${id}" should return a 4xx response; ` +
                `received HTTP ${response.status}.`
            );

            assertNotRedirect(
              response,
              `Invalid ID "${id}"`
            );

            const body = await readBody(response);

            assertNotFileDownload(
              response,
              body,
              `Invalid ID "${id}"`
            );
          } finally {
            await response.body?.cancel().catch(() => {});
          }
        }
      }
    );

    await t.test(
      'Download endpoint rejects PATCH without changing document data',
      {
        skip: Boolean(mutationSkipReason()),
      },
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            [
              'DOWNLOAD_TEST_USER_A_TOKEN',
              USER_A_TOKEN,
            ],
            [
              'DOWNLOAD_TEST_USER_A_DOCUMENT_ID',
              USER_A_DOCUMENT_ID,
            ],
          ])
        ) {
          return;
        }

        const response = await request(
          urlForDocument(USER_A_DOCUMENT_ID),
          {
            token: USER_A_TOKEN,
            method: 'PATCH',
            body: {
              securityTest: true,
              title: 'Unauthorized-download-test',
            },
          }
        );

        try {
          assert.ok(
            [400, 401, 403, 404, 405, 501].includes(
              response.status
            ),
            `Expected PATCH to be rejected; received HTTP ${response.status}.`
          );

          assertNotRedirect(
            response,
            'Unsupported download method'
          );

          const body = await readBody(response);

          assertNotFileDownload(
            response,
            body,
            'Unsupported download method'
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'Document listing returns JSON metadata rather than raw file bytes',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
          ])
        ) {
          return;
        }

        const response = await request(
          DOCUMENTS_PATH,
          { token: USER_A_TOKEN }
        );

        try {
          assertNotServerError(
            response,
            'Document listing'
          );

          if (!response.ok) {
            assert.ok(
              [400, 401, 403, 404, 405, 422].includes(
                response.status
              ),
              `Unexpected document-listing status: HTTP ${response.status}.`
            );

            return;
          }

          const contentType = (
            response.headers.get('content-type') || ''
          ).toLowerCase();

          assert.ok(
            contentType.includes('application/json'),
            'Document listing must return JSON metadata.'
          );

          const body = await readBody(response);

          assert.ok(
            body.byteLength > 0,
            'Document listing should return a JSON response body.'
          );

          let parsed;

          try {
            parsed = JSON.parse(body.toString('utf8'));
          } catch {
            assert.fail(
              'Document listing declared JSON but returned invalid JSON.'
            );
          }

          assert.ok(
            parsed !== null &&
              typeof parsed === 'object',
            'Document listing must return a JSON object or array.'
          );
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'Unauthorized download requests never redirect to file URLs',
      async (t) => {
        if (
          skipUnlessConfigured(t, [
            [
              'DOWNLOAD_TEST_USER_A_DOCUMENT_ID',
              USER_A_DOCUMENT_ID,
            ],
          ])
        ) {
          return;
        }

        await assertUnauthorizedDownload(
          urlForDocument(USER_A_DOCUMENT_ID),
          'Unauthorized redirect probe'
        );
      }
    );
  }
);

test('Unauthorized download helper invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'DOWNLOAD_TEST_TIMEOUT_MS must be between 100 and 120000.'
  );

  assert.ok(
    Number.isFinite(MAX_RESPONSE_BYTES) &&
      MAX_RESPONSE_BYTES >= 1024 &&
      MAX_RESPONSE_BYTES <= 50 * 1024 * 1024,
    'DOWNLOAD_TEST_MAX_RESPONSE_BYTES must be between 1024 bytes and 50 MiB.'
  );

  assertValidPath(PRIVATE_PATH, 'Download path template');
  assertValidPath(DOCUMENTS_PATH, 'Documents path');

  if (USER_A_DOCUMENT_ID && USER_B_DOCUMENT_ID) {
    assert.notEqual(
      USER_A_DOCUMENT_ID,
      USER_B_DOCUMENT_ID,
      'Cross-user download testing requires distinct document IDs.'
    );
  }

  assert.equal(
    validPath('//example.com/api/documents'),
    false
  );

  assert.equal(
    validPath('/api/documents\r\nX-Test: true'),
    false
  );

  assert.equal(
    validPath('https://example.com/api/documents'),
    false
  );

  assert.equal(
    urlForDocument('doc-123'),
    '/api/documents/doc-123/download'
  );

  assert.equal(
    urlForDocument('doc/123'),
    '/api/documents/doc%2F123/download'
  );
});

test('Unauthorized download configuration validation', () => {
  if (!BASE_URL) {
    assert.equal(
      CONFIGURED,
      false,
      'Suite must remain unconfigured without a base URL.'
    );

    return;
  }

  validateBaseUrl();
});
