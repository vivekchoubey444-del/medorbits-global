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
 *
 * Run:
 *   node --test tests/security/unauthorized-downloads.security.test.js
 *
 * IMPORTANT:
 * - Use an isolated test environment and synthetic documents.
 * - User A and User B must be separate low-privilege accounts.
 * - Never use production tokens or private production documents.
 * - Configure routes to match the actual API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.DOWNLOAD_TEST_BASE_URL || ''
).replace(/\/+$/, '');
const TIMEOUT_MS = Number(
  process.env.DOWNLOAD_TEST_TIMEOUT_MS || 15000
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
const configured = Boolean(
  BASE_URL &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0 &&
  PRIVATE_PATH.startsWith('/') &&
  !PRIVATE_PATH.startsWith('//') &&
  DOCUMENTS_PATH.startsWith('/') &&
  !DOCUMENTS_PATH.startsWith('//')
);
function urlForDocument(documentId) {
  assert.ok(
    typeof documentId === 'string' && documentId.length > 0,
    'Document ID must be a non-empty string'
  );
  const encodedId = encodeURIComponent(documentId);
  const path = PRIVATE_PATH.includes(':id')
    ? PRIVATE_PATH.replaceAll(':id', encodedId)
    : `${PRIVATE_PATH.replace(/\/+$/, '')}/${encodedId}`;
  return `${BASE_URL}${path}`;
}
function requestHeaders(token) {
  return {
    Accept: '*/*',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}
async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        ...requestHeaders(options.token || ''),
        ...options.extraHeaders,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function readBody(response) {
  return Buffer.from(await response.arrayBuffer());
}
function assertAccessDenied(response, description) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${description}: expected 401, 403, or 404; received HTTP ${response.status}`
  );
}
function assertNotRedirect(response, description) {
  assert.ok(
    ![301, 302, 303, 307, 308].includes(response.status),
    `${description}: unexpected redirect with HTTP ${response.status}`
  );
  assert.equal(
    response.headers.get('location'),
    null,
    `${description}: response must not disclose a redirect destination`
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
    contentType.includes('application/zip');
  assert.equal(
    looksLikeFile,
    false,
    `${description}: unauthorized response resembles a file download`
  );
  // A JSON error body is allowed. This check only verifies that a
  // response identified as a file download was not returned.
  assert.ok(
    body.byteLength === 0 || !looksLikeFile,
    `${description}: unexpected file response`
  );
}
async function assertUnauthorizedDownload(url, description) {
  const response = await request(url);
  assertAccessDenied(response, description);
  assertNotRedirect(response, description);
  const body = await readBody(response);
  assertNotFileDownload(response, body, description);
}
function skipUnlessConfigured(t, requirements = []) {
  if (!configured) {
    t.skip(
      'Configure DOWNLOAD_TEST_BASE_URL and valid test settings.'
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
test('Unauthenticated users cannot download a private document', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_DOCUMENT_ID', USER_A_DOCUMENT_ID],
  ])) {
    return;
  }
  await assertUnauthorizedDownload(
    urlForDocument(USER_A_DOCUMENT_ID),
    'Unauthenticated private download'
  );
});
test('User A cannot download User B document', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
    ['DOWNLOAD_TEST_USER_B_DOCUMENT_ID', USER_B_DOCUMENT_ID],
  ])) {
    return;
  }
  const response = await request(
    urlForDocument(USER_B_DOCUMENT_ID),
    { token: USER_A_TOKEN }
  );
  assertAccessDenied(response, 'Cross-user document download');
  assertNotRedirect(response, 'Cross-user document download');
  const body = await readBody(response);
  assertNotFileDownload(
    response,
    body,
    'Cross-user document download'
  );
});
test('User B can download their own document', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_B_TOKEN', USER_B_TOKEN],
    ['DOWNLOAD_TEST_USER_B_DOCUMENT_ID', USER_B_DOCUMENT_ID],
  ])) {
    return;
  }
  const response = await request(
    urlForDocument(USER_B_DOCUMENT_ID),
    { token: USER_B_TOKEN }
  );
  assert.ok(
    response.status >= 200 && response.status < 300,
    `Document owner should be authorized; received HTTP ${response.status}`
  );
  assert.ok(
    response.headers.get('content-type'),
    'Authorized download must identify its content type'
  );
  const body = await readBody(response);
  assert.ok(
    body.byteLength > 0,
    'Synthetic test document should have non-empty content'
  );
});
test('Invalid document IDs do not return file contents', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
  ])) {
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
    assert.ok(
      response.status >= 400 && response.status < 500,
      `Invalid ID "${id}" should return a client error; received HTTP ${response.status}`
    );
    assertNotRedirect(response, `Invalid ID "${id}"`);
    const body = await readBody(response);
    assertNotFileDownload(
      response,
      body,
      `Invalid ID "${id}"`
    );
  }
});
test('Download endpoint rejects unsupported HTTP methods', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_DOCUMENT_ID', USER_A_DOCUMENT_ID],
  ])) {
    return;
  }
  const response = await request(
    urlForDocument(USER_A_DOCUMENT_ID),
    {
      token: USER_A_TOKEN,
      method: 'TRACE',
    }
  );
  assert.ok(
    [400, 404, 405, 501].includes(response.status),
    `Unexpected TRACE response: HTTP ${response.status}`
  );
});
test('Document listing returns metadata rather than raw file bytes', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_TOKEN', USER_A_TOKEN],
  ])) {
    return;
  }
  const response = await request(
    `${BASE_URL}${DOCUMENTS_PATH}`,
    { token: USER_A_TOKEN }
  );
  assert.ok(
    response.status < 500,
    `Document listing returned HTTP ${response.status}`
  );
  if (!response.ok) {
    assert.ok(
      [400, 401, 403, 404, 405, 422].includes(response.status),
      `Unexpected document-listing status: HTTP ${response.status}`
    );
    return;
  }
  const contentType = (
    response.headers.get('content-type') || ''
  ).toLowerCase();
  assert.ok(
    contentType.includes('application/json'),
    'Document listing must return JSON metadata'
  );
  const body = await response.json();
  assert.ok(
    body !== null &&
      (typeof body === 'object'),
    'Document listing must return a JSON object or array'
  );
});
test('Unauthorized download requests never redirect to file URLs', async (t) => {
  if (skipUnlessConfigured(t, [
    ['DOWNLOAD_TEST_USER_A_DOCUMENT_ID', USER_A_DOCUMENT_ID],
  ])) {
    return;
  }
  const response = await request(
    urlForDocument(USER_A_DOCUMENT_ID)
  );
  assertAccessDenied(response, 'Unauthorized redirect probe');
  assertNotRedirect(response, 'Unauthorized redirect probe');
  const body = await readBody(response);
  assertNotFileDownload(
    response,
    body,
    'Unauthorized redirect probe'
  );
});
test('Fixture configuration uses distinct document ownership', () => {
  if (USER_A_DOCUMENT_ID && USER_B_DOCUMENT_ID) {
    assert.notEqual(
      USER_A_DOCUMENT_ID,
      USER_B_DOCUMENT_ID,
      'Cross-user download testing requires distinct document IDs'
    );
  }
  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'DOWNLOAD_TEST_TIMEOUT_MS must be positive'
  );
  assert.ok(
    PRIVATE_PATH.startsWith('/') && !PRIVATE_PATH.startsWith('//'),
    'Download path must be a relative API path'
  );
});