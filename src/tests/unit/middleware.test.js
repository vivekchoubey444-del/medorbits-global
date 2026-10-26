
'use strict';

/**
 * MedOrbits -- Middleware Unit Tests
 *
 * File: tests/unit/middleware.test.js
 * Runtime: Node.js >= 20
 * Test runner: Node.js built-in test runner
 *
 * Run:
 *   node --test tests/unit/middleware.test.js
 *
 * Tests actual middleware implementations. Optional integrations are skipped
 * when their required packages or middleware modules are unavailable.
 *
 * Security notes:
 * - Uses synthetic credentials and request data only.
 * - Never connects to production services.
 * - Does not assume that constructing middleware proves route-level security.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const path = require('node:path');

const MIDDLEWARE_DIR = path.resolve(__dirname, '../../src/middleware');

function loadMiddleware(name) {
  return require(path.join(MIDDLEWARE_DIR, name));
}

function packageAvailable(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

const TEST_SECRET = 'medorbits-test-secret-never-use-in-production-0001';

function createRequest(overrides = {}) {
  const suppliedHeaders = overrides.headers || {};
  const headers = Object.create(null);

  for (const [key, value] of Object.entries(suppliedHeaders)) {
    headers[key.toLowerCase()] = value;
  }

  const req = {
    method: 'GET',
    path: '/api/v1/test',
    originalUrl: '/api/v1/test',
    url: '/api/v1/test',
    headers,
    params: {},
    query: {},
    body: {},
    cookies: {},
    get(name) {
      return headers[String(name).toLowerCase()] ?? '';
    },
    accepts() {
      return false;
    },
    ...overrides,
  };

  req.headers = headers;

  if (!overrides.get) {
    req.get = function get(name) {
      return headers[String(name).toLowerCase()] ?? '';
    };
  }

  return req;
}

function createResponse() {
  const res = new EventEmitter();

  res.statusCode = 200;
  res.headers = Object.create(null);
  res.body = undefined;
  res.locals = {};
  res.headersSent = false;
  res.finished = false;

  res.setHeader = function setHeader(name, value) {
    res.headers[String(name).toLowerCase()] = value;
    return res;
  };

  res.getHeader = function getHeader(name) {
    return res.headers[String(name).toLowerCase()];
  };

  res.removeHeader = function removeHeader(name) {
    delete res.headers[String(name).toLowerCase()];
    return res;
  };

  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };

  res.json = function json(body) {
    res.body = body;
    res.headersSent = true;
    res.finished = true;
    return res;
  };

  res.send = function send(body) {
    res.body = body;
    res.headersSent = true;
    res.finished = true;
    return res;
  };

  res.end = function end(body) {
    if (body !== undefined) {
      res.body = body;
    }

    res.headersSent = true;
    res.finished = true;
    res.emit('finish');
    return res;
  };

  res.cookie = function cookie(name, value, options = {}) {
    res.lastCookie = { name, value, options };
    return res;
  };

  res.clearCookie = function clearCookie(name, options = {}) {
    res.lastClearedCookie = { name, options };
    return res;
  };

  return res;
}

async function runMiddleware(middleware, req, res) {
  const calls = {
    count: 0,
    error: undefined,
  };

  const next = (error) => {
    calls.count += 1;
    calls.error = error;
  };

  try {
    await middleware(req, res, next);
  } catch (error) {
    calls.error = error;
  }

  return {
    ...calls,
    req,
    res,
  };
}

function expectError(result, status, code) {
  assert.ok(
    result.error instanceof Error,
    `Expected an Error, received ${String(result.error)}`,
  );

  assert.equal(result.error.status, status);

  if (code !== undefined) {
    assert.equal(result.error.code, code);
  }
}

function signHmac(body, secret = TEST_SECRET) {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

function suppressConsoleError(callback) {
  const original = console.error;
  console.error = () => {};

  try {
    return callback();
  } finally {
    console.error = original;
  }
}

function withOptionalModule(moduleName, callback) {
  if (!packageAvailable(moduleName)) {
    test.skip(`${moduleName} integration is unavailable`, () => {});
    return;
  }

  callback();
}

// -----------------------------------------------------------------------------
// Request ID
// -----------------------------------------------------------------------------

test('request-id: exports a middleware factory', () => {
  const requestId = loadMiddleware('request-id');

  assert.equal(typeof requestId, 'function');
});

test('request-id: accepts a valid incoming request ID', async () => {
  const requestId = loadMiddleware('request-id');
  const req = createRequest({
    headers: { 'x-request-id': 'request-123_test' },
  });
  const res = createResponse();

  const result = await runMiddleware(requestId(), req, res);

  assert.equal(result.error, undefined);
  assert.equal(req.id, 'request-123_test');
  assert.equal(res.getHeader('x-request-id'), 'request-123_test');
});

test('request-id: replaces an invalid incoming request ID', async () => {
  const requestId = loadMiddleware('request-id');
  const req = createRequest({
    headers: { 'x-request-id': 'invalid request id with spaces' },
  });
  const res = createResponse();

  await runMiddleware(requestId(), req, res);

  assert.equal(typeof req.id, 'string');
  assert.match(req.id, /^[0-9a-f-]{36}$/i);
  assert.equal(res.getHeader('x-request-id'), req.id);
});

test('request-id: generates an ID when none is supplied', async () => {
  const requestId = loadMiddleware('request-id');
  const req = createRequest();
  const res = createResponse();

  await runMiddleware(requestId(), req, res);

  assert.ok(req.id);
  assert.equal(res.getHeader('x-request-id'), req.id);
});

test('request-id: exports a functional request ID pattern', () => {
  const requestId = loadMiddleware('request-id');

  assert.ok(requestId.REQUEST_ID_PATTERN instanceof RegExp);
  assert.equal(requestId.REQUEST_ID_PATTERN.test('abc-123'), true);
  assert.equal(
    requestId.REQUEST_ID_PATTERN.test('contains spaces'),
    false,
  );
  assert.equal(requestId.REQUEST_ID_PATTERN.test(''), false);
});

// -----------------------------------------------------------------------------
// Authorization
// -----------------------------------------------------------------------------

test('authorize: exports a middleware factory', () => {
  const authorize = loadMiddleware('authorize');

  assert.equal(typeof authorize, 'function');
});

test('authorize: rejects requests without an authenticated user', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize(),
    createRequest(),
    createResponse(),
  );

  expectError(result, 401, 'AUTHENTICATION_REQUIRED');
});

test('authorize: allows a user with a required role', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({ roles: ['admin'] }),
    createRequest({
      user: { id: 'user-test-001', role: 'admin' },
    }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('authorize: supports multiple roles and role arrays', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({ roles: ['admin', 'reviewer'] }),
    createRequest({
      user: {
        id: 'user-test-002',
        roles: ['editor', 'reviewer'],
      },
    }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('authorize: rejects a user without a required role', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({ roles: ['admin'] }),
    createRequest({
      user: { id: 'user-test-003', role: 'student' },
    }),
    createResponse(),
  );

  expectError(result, 403, 'FORBIDDEN');
});

test('authorize: checks for at least one configured permission by default', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({
      permissions: ['courses:read', 'courses:write'],
    }),
    createRequest({
      user: {
        id: 'user-test-004',
        permissions: ['courses:read'],
      },
    }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('authorize: can require all configured permissions', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({
      permissions: ['courses:read', 'courses:write'],
      requireAllPermissions: true,
    }),
    createRequest({
      user: {
        id: 'user-test-005',
        permissions: ['courses:read'],
      },
    }),
    createResponse(),
  );

  expectError(result, 403);
});

test('authorize: awaits the ownership callback', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({
      ownership: async (_request, user) => user.id === 'user-test-006',
    }),
    createRequest({
      user: { id: 'user-test-006', role: 'student' },
    }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('authorize: rejects failed ownership checks', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({ ownership: () => false }),
    createRequest({
      user: { id: 'user-test-007', role: 'student' },
    }),
    createResponse(),
  );

  expectError(result, 403);
});

test('authorize: forwards ownership callback errors', async () => {
  const authorize = loadMiddleware('authorize');
  const expectedError = new Error('Synthetic ownership lookup failure');

  const result = await runMiddleware(
    authorize({
      ownership: () => {
        throw expectedError;
      },
    }),
    createRequest({
      user: { id: 'user-test-008', role: 'student' },
    }),
    createResponse(),
  );

  assert.equal(result.error, expectedError);
});

test('authorize: exposes role and permission helper factories', () => {
  const authorize = loadMiddleware('authorize');

  assert.equal(typeof authorize.requireRole, 'function');
  assert.equal(typeof authorize.requirePermission, 'function');
  assert.equal(typeof authorize.forbidden, 'function');
});

test('authorize: rejects request-supplied role escalation', async () => {
  const authorize = loadMiddleware('authorize');

  const result = await runMiddleware(
    authorize({ roles: ['admin'] }),
    createRequest({
      user: { id: 'user-test-009', role: 'student' },
      body: { role: 'admin', isAdmin: true },
    }),
    createResponse(),
  );

  expectError(result, 403, 'FORBIDDEN');
});

// -----------------------------------------------------------------------------
// Maintenance mode
// -----------------------------------------------------------------------------

test('maintenance: passes requests through when disabled', async () => {
  const maintenance = loadMiddleware('maintenance');

  const result = await runMiddleware(
    maintenance({ enabled: false }),
    createRequest(),
    createResponse(),
  );

  assert.equal(result.count, 1);
  assert.equal(result.error, undefined);
  assert.equal(result.res.statusCode, 200);
});

test('maintenance: allows configured health endpoints', async () => {
  const maintenance = loadMiddleware('maintenance');

  const result = await runMiddleware(
    maintenance({ enabled: true }),
    createRequest({ path: '/health' }),
    createResponse(),
  );

  assert.equal(result.count, 1);
  assert.equal(result.error, undefined);
  assert.equal(result.res.statusCode, 200);
});

test('maintenance: returns a structured 503 for API requests', async () => {
  const maintenance = loadMiddleware('maintenance');
  const res = createResponse();

  await runMiddleware(
    maintenance({ enabled: true }),
    createRequest({
      path: '/api/v1/courses',
      originalUrl: '/api/v1/courses',
      id: 'request-test-042',
    }),
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.getHeader('retry-after'), '300');
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'MAINTENANCE_MODE');
  assert.equal(res.body.requestId, 'request-test-042');
});

test('maintenance: supports a custom retry interval and message', async () => {
  const maintenance = loadMiddleware('maintenance');
  const res = createResponse();

  await runMiddleware(
    maintenance({
      enabled: true,
      retryAfterSeconds: 120,
      message: 'Scheduled maintenance',
    }),
    createRequest({ path: '/api/v1/courses' }),
    res,
  );

  assert.equal(res.getHeader('retry-after'), '120');
  assert.equal(res.body.error.message, 'Scheduled maintenance');
});

test('maintenance: sends a plain response for non-API requests by default', async () => {
  const maintenance = loadMiddleware('maintenance');
  const res = createResponse();

  await runMiddleware(
    maintenance({ enabled: true }),
    createRequest({ path: '/courses' }),
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.match(String(res.body), /maintenance/i);
});

test('maintenance: delegates non-API requests to a configured HTML handler', async () => {
  const maintenance = loadMiddleware('maintenance');
  let called = false;

  await runMiddleware(
    maintenance({
      enabled: true,
      htmlHandler: (_req, _res) => {
        called = true;
      },
    }),
    createRequest({ path: '/courses' }),
    createResponse(),
  );

  assert.equal(called, true);
});

// -----------------------------------------------------------------------------
// Request validation
// -----------------------------------------------------------------------------

test('validate: requires a schema or validator', () => {
  const validate = loadMiddleware('validate');

  assert.throws(
    () => validate(),
    /validation schema or function is required/i,
  );
});

test('validate: accepts a successful custom validator', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({ body: { name: 'MedOrbits' } });

  const result = await runMiddleware(
    validate((input) => ({ valid: true, value: input })),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(req.body, { name: 'MedOrbits' });
});

test('validate: replaces request input with the validator result', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({ body: { name: '  MedOrbits  ' } });

  await runMiddleware(
    validate((input) => ({
      valid: true,
      value: { name: input.name.trim() },
    })),
    req,
    createResponse(),
  );

  assert.deepEqual(req.body, { name: 'MedOrbits' });
});

test('validate: rejects invalid custom input', async () => {
  const validate = loadMiddleware('validate');

  const result = await runMiddleware(
    validate(() => ({
      valid: false,
      errors: [{ field: 'name' }],
    })),
    createRequest({ body: { name: '' } }),
    createResponse(),
  );

  expectError(result, 400, 'VALIDATION_ERROR');
});

test('validate: supports a custom validator returning false', async () => {
  const validate = loadMiddleware('validate');

  const result = await runMiddleware(
    validate(() => false),
    createRequest({ body: {} }),
    createResponse(),
  );

  expectError(result, 400, 'VALIDATION_ERROR');
});

test('validate: forwards an Error returned by a custom validator', async () => {
  const validate = loadMiddleware('validate');
  const expectedError = new Error('Synthetic validation failure');

  const result = await runMiddleware(
    validate(() => expectedError),
    createRequest({ body: {} }),
    createResponse(),
  );

  assert.equal(result.error, expectedError);
});

test('validate: supports validation of body, params, and query', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({
    body: { name: 'Example' },
    params: { id: '123' },
    query: { page: '1' },
  });

  const received = [];

  const result = await runMiddleware(
    validate(
      (input) => {
        received.push(input);
        return { valid: true };
      },
      { target: 'all' },
    ),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(received.length, 3);
});

test('validate: supports asynchronous custom validators', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({ body: { active: true } });

  const result = await runMiddleware(
    validate(async (input) => ({
      valid: true,
      value: { active: Boolean(input.active) },
    })),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(req.body, { active: true });
});

test('validate: supports Zod-compatible safeParse results', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({ body: { count: '5' } });

  await runMiddleware(
    validate({
      safeParse(input) {
        return {
          success: true,
          data: { count: Number(input.count) },
        };
      },
    }),
    req,
    createResponse(),
  );

  assert.deepEqual(req.body, { count: 5 });
});

test('validate: rejects an unsuccessful Zod-compatible result', async () => {
  const validate = loadMiddleware('validate');

  const result = await runMiddleware(
    validate({
      safeParse() {
        return {
          success: false,
          error: { issues: [{ path: ['name'] }] },
        };
      },
    }),
    createRequest({ body: {} }),
    createResponse(),
  );

  expectError(result, 400, 'VALIDATION_ERROR');
});

test('validate: supports Joi-compatible validate results', async () => {
  const validate = loadMiddleware('validate');
  const req = createRequest({ body: { count: '5' } });

  await runMiddleware(
    validate({
      validate(input) {
        return {
          value: { count: Number(input.count) },
        };
      },
    }),
    req,
    createResponse(),
  );

  assert.deepEqual(req.body, { count: 5 });
});

test('validate: forwards unexpected validator exceptions', async () => {
  const validate = loadMiddleware('validate');
  const expectedError = new Error('Synthetic validator exception');

  const result = await runMiddleware(
    validate(() => {
      throw expectedError;
    }),
    createRequest({ body: {} }),
    createResponse(),
  );

  assert.equal(result.error, expectedError);
});

// -----------------------------------------------------------------------------
// CSRF protection
// -----------------------------------------------------------------------------

test('csrf: rejects a missing or weak secret', () => {
  const csrf = loadMiddleware('csrf');

  assert.throws(
    () => csrf({ secret: 'short' }),
    /at least 32 characters/i,
  );
});

test('csrf: allows safe HTTP methods without a submitted token', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({ secret: TEST_SECRET });

  const result = await runMiddleware(
    protection.verify,
    createRequest({ method: 'GET' }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('csrf: rejects a state-changing request without a token', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({ secret: TEST_SECRET });

  const result = await runMiddleware(
    protection.verify,
    createRequest({
      method: 'POST',
      cookies: {},
    }),
    createResponse(),
  );

  expectError(result, 403, 'CSRF_VALIDATION_FAILED');
});

test('csrf: issues a signed CSRF cookie and exposes the token in locals', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({
    secret: TEST_SECRET,
    secure: true,
  });

  const res = createResponse();

  const result = await runMiddleware(
    protection.issue,
    createRequest(),
    res,
  );

  assert.equal(result.error, undefined);
  assert.equal(res.lastCookie.name, protection.cookieName);
  assert.equal(res.lastCookie.options.secure, true);
  assert.equal(res.lastCookie.options.httpOnly, false);
  assert.equal(res.locals.csrfToken, res.lastCookie.value);
  assert.match(res.locals.csrfToken, /^[^.]+\.[a-f0-9]{64}$/);
});

test('csrf: accepts a correctly signed cookie/header token pair', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({ secret: TEST_SECRET });
  const token = crypto.randomBytes(32).toString('base64url');
  const signedToken = `${token}.${signHmac(token)}`;

  const req = createRequest({
    method: 'POST',
    cookies: {
      [protection.cookieName]: signedToken,
    },
    headers: {
      'x-csrf-token': signedToken,
    },
  });

  const result = await runMiddleware(
    protection.verify,
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('csrf: rejects a token with an invalid signature', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({ secret: TEST_SECRET });
  const token = `${crypto.randomBytes(32).toString('base64url')}.${'0'.repeat(64)}`;

  const result = await runMiddleware(
    protection.verify,
    createRequest({
      method: 'POST',
      cookies: {
        [protection.cookieName]: token,
      },
      headers: {
        'x-csrf-token': token,
      },
    }),
    createResponse(),
  );

  expectError(result, 403, 'CSRF_VALIDATION_FAILED');
});

test('csrf: can skip protection when shouldProtect returns false', async () => {
  const csrf = loadMiddleware('csrf');
  const protection = csrf({
    secret: TEST_SECRET,
    shouldProtect: () => false,
  });

  const result = await runMiddleware(
    protection.verify,
    createRequest({ method: 'POST' }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('csrf: exports a safe comparison helper', () => {
  const csrf = loadMiddleware('csrf');

  assert.equal(csrf.safeEqual('same', 'same'), true);
  assert.equal(csrf.safeEqual('first', 'second'), false);
  assert.equal(csrf.safeEqual('', ''), true);
  assert.equal(csrf.safeEqual('short', 'longer'), false);
});

// -----------------------------------------------------------------------------
// Webhook signature verification
// -----------------------------------------------------------------------------

test('verify-webhook: rejects an absent or weak signing secret', () => {
  const verifyWebhook = loadMiddleware('verify-webhook');

  assert.throws(
    () => verifyWebhook({ secret: 'weak' }),
    /signing secret must be configured/i,
  );
});

test('verify-webhook: rejects a missing raw request body', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');

  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    createRequest({
      get() {
        return '';
      },
    }),
    createResponse(),
  );

  expectError(result, 400, 'WEBHOOK_RAW_BODY_REQUIRED');
});

test('verify-webhook: rejects a missing signature header', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');

  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    createRequest({
      rawBody: Buffer.from('{"event":"payment.success"}'),
      get() {
        return '';
      },
    }),
    createResponse(),
  );

  expectError(result, 401, 'WEBHOOK_SIGNATURE_MISSING');
});

test('verify-webhook: accepts a valid HMAC-SHA256 signature', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');
  const body = Buffer.from('{"event":"payment.success"}');
  const signature = signHmac(body);

  const req = createRequest({
    rawBody: body,
    get(name) {
      return name === 'x-webhook-signature' ? signature : '';
    },
  });

  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(req.webhookVerified, true);
});

test('verify-webhook: accepts a configured signature prefix', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');
  const body = Buffer.from('{"event":"payment.success"}');
  const signature = signHmac(body);

  const req = createRequest({
    rawBody: body,
    get(name) {
      return name === 'x-webhook-signature'
        ? `sha256=${signature}`
        : '';
    },
  });

  const result = await runMiddleware(
    verifyWebhook({
      secret: TEST_SECRET,
      prefix: 'sha256=',
    }),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(req.webhookVerified, true);
});

test('verify-webhook: rejects an invalid signature', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');

  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    createRequest({
      rawBody: Buffer.from('payload'),
      get() {
        return '0'.repeat(64);
      },
    }),
    createResponse(),
  );

  expectError(result, 401, 'WEBHOOK_SIGNATURE_INVALID');
});

test('verify-webhook: rejects a signature calculated over a different body', async () => {
  const verifyWebhook = loadMiddleware('verify-webhook');
  const body = Buffer.from('{"event":"payment.success"}');
  const wrongSignature = signHmac(Buffer.from('{"event":"payment.failed"}'));

  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    createRequest({
      rawBody: body,
      get(name) {
        return name === 'x-webhook-signature' ? wrongSignature : '';
      },
    }),
    createResponse(),
  );

  expectError(result, 401, 'WEBHOOK_SIGNATURE_INVALID');
});

// -----------------------------------------------------------------------------
// Not-found middleware
// -----------------------------------------------------------------------------

test('not-found: returns the standard JSON 404 response', async () => {
  const notFound = loadMiddleware('not-found');
  const res = createResponse();

  await runMiddleware(
    notFound(),
    createRequest({ id: 'request-test-404' }),
    res,
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.requestId, 'request-test-404');
});

test('not-found: supports a custom response code and message', async () => {
  const notFound = loadMiddleware('not-found');
  const res = createResponse();

  await runMiddleware(
    notFound({
      code: 'API_ROUTE_NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    }),
    createRequest(),
    res,
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'API_ROUTE_NOT_FOUND');
  assert.equal(
    res.body.error.message,
    'The requested API endpoint does not exist.',
  );
});

test('not-found: can pass an HTML 404 error to next', async () => {
  const notFound = loadMiddleware('not-found');

  const result = await runMiddleware(
    notFound({ apiOnly: false }),
    createRequest({
      accepts(type) {
        return type === 'html';
      },
    }),
    createResponse(),
  );

  expectError(result, 404, 'NOT_FOUND');
});

// -----------------------------------------------------------------------------
// Centralized error handler
// -----------------------------------------------------------------------------

test('error-handler: forwards errors when response headers were already sent', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Already started');
  const res = createResponse();

  res.headersSent = true;

  let forwarded;

  errorHandler(
    error,
    createRequest(),
    res,
    (nextError) => {
      forwarded = nextError;
    },
  );

  assert.equal(forwarded, error);
});

test('error-handler: normalizes invalid status codes to 500', () => {
  const errorHandler = loadMiddleware('error-handler');
  const res = createResponse();
  const error = new Error('Synthetic internal detail');

  error.status = 200;

  suppressConsoleError(() => {
    errorHandler(
      error,
      createRequest({ id: 'request-test-error' }),
      res,
      () => {},
    );
  });

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(
    res.body.error.message,
    'An unexpected server error occurred.',
  );
  assert.equal(res.body.requestId, 'request-test-error');
  assert.equal(
    JSON.stringify(res.body).includes('Synthetic internal detail'),
    false,
  );
});

test('error-handler: classifies oversized request bodies', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic oversized request');

  error.type = 'entity.too.large';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('error-handler: classifies malformed JSON bodies', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic malformed JSON');

  error.type = 'entity.parse.failed';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_JSON');
});

test('error-handler: classifies denied CORS origins', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic origin denial');

  error.code = 'CORS_ORIGIN_DENIED';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'CORS_ORIGIN_DENIED');
});

test('error-handler: maps duplicate database records to 409', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic duplicate record');

  error.code = '23505';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'RESOURCE_CONFLICT');
});

test('error-handler: maps invalid database values to 400', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic invalid database value');

  error.code = '22P02';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_DATA');
});

test('error-handler: hides internal server errors from clients', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic sensitive connection details');
  const res = createResponse();

  suppressConsoleError(() => {
    errorHandler(error, createRequest(), res, () => {});
  });

  assert.equal(res.statusCode, 500);
  assert.equal(
    res.body.error.message,
    'An unexpected server error occurred.',
  );
  assert.equal(
    JSON.stringify(res.body).includes(
      'Synthetic sensitive connection details',
    ),
    false,
  );
});

test('error-handler: preserves a safe public message for client errors', () => {
  const errorHandler = loadMiddleware('error-handler');
  const error = new Error('Synthetic internal message');

  error.status = 400;
  error.code = 'INVALID_COURSE_ID';
  error.publicMessage = 'The course ID is invalid.';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_COURSE_ID');
  assert.equal(res.body.error.message, 'The course ID is invalid.');
});

// -----------------------------------------------------------------------------
// Request logging
// -----------------------------------------------------------------------------

test('request-logger: logs structured metadata without query parameters', async () => {
  const requestLogger = loadMiddleware('request-logger');
  const entries = [];

  const logger = {
    log: (message) => entries.push(JSON.parse(message)),
    error: (message) => entries.push(JSON.parse(message)),
  };

  const req = createRequest({
    id: 'request-log-test-001',
    method: 'GET',
    path: '/api/v1/courses',
    originalUrl: '/api/v1/courses?secret=do-not-log-this',
    user: { id: 'user-test-010' },
  });

  const res = createResponse();

  const result = await runMiddleware(
    requestLogger({ logger }),
    req,
    res,
  );

  assert.equal(result.error, undefined);
  assert.equal(entries.length, 0);

  res.statusCode = 200;
  res.emit('finish');

  assert.equal(entries.length, 1);
  assert.equal(entries[0].requestId, 'request-log-test-001');
  assert.equal(entries[0].method, 'GET');
  assert.equal(entries[0].path, '/api/v1/courses');
  assert.equal(entries[0].status, 200);
  assert.equal(entries[0].userId, 'user-test-010');
  assert.equal(
    JSON.stringify(entries[0]).includes('do-not-log-this'),
    false,
  );
});

test('request-logger: uses error-level logging for 5xx responses', async () => {
  const requestLogger = loadMiddleware('request-logger');
  const entries = [];

  const logger = {
    log: (message) => entries.push({
      level: 'log',
      data: JSON.parse(message),
    }),
    error: (message) => entries.push({
      level: 'error',
      data: JSON.parse(message),
    }),
  };

  const res = createResponse();

  await runMiddleware(
    requestLogger({ logger }),
    createRequest({
      method: 'POST',
      path: '/api/v1/test',
    }),
    res,
  );

  res.statusCode = 503;
  res.emit('finish');

  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, 'error');
  assert.equal(entries[0].data.level, 'error');
});

test('request-logger: respects shouldLog filtering', async () => {
  const requestLogger = loadMiddleware('request-logger');
  const entries = [];

  const logger = {
    log: (message) => entries.push(message),
    error: (message) => entries.push(message),
  };

  const res = createResponse();

  await runMiddleware(
    requestLogger({
      logger,
      shouldLog: () => false,
    }),
    createRequest(),
    res,
  );

  res.emit('finish');

  assert.equal(entries.length, 0);
});

// -----------------------------------------------------------------------------
// Optional dependency-backed middleware
// -----------------------------------------------------------------------------

withOptionalModule('jsonwebtoken', () => {
  test('authenticate: rejects missing or weak JWT configuration', () => {
    const authenticate = loadMiddleware('authenticate');

    assert.throws(
      () => authenticate({ secret: 'short' }),
      /at least 32 characters/i,
    );
  });

  test('authenticate: rejects requests without a Bearer token', async () => {
    const authenticate = loadMiddleware('authenticate');

    const result = await runMiddleware(
      authenticate({ secret: TEST_SECRET }),
      createRequest(),
      createResponse(),
    );

    expectError(result, 401, 'AUTHENTICATION_REQUIRED');
  });

  test('authenticate: rejects invalid tokens', async () => {
    const authenticate = loadMiddleware('authenticate');

    const result = await runMiddleware(
      authenticate({ secret: TEST_SECRET }),
      createRequest({
        headers: {
          authorization: 'Bearer invalid-test-token',
        },
      }),
      createResponse(),
    );

    expectError(result, 401, 'INVALID_OR_EXPIRED_TOKEN');
  });

  test('authenticate: establishes a normalized user from a valid JWT', async () => {
    const jwt = require('jsonwebtoken');
    const authenticate = loadMiddleware('authenticate');

    const token = jwt.sign(
      {
        sub: 'user-jwt-test-001',
        roles: ['student'],
        permissions: ['courses:read'],
      },
      TEST_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '5m',
      },
    );

    const req = createRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const result = await runMiddleware(
      authenticate({ secret: TEST_SECRET }),
      req,
      createResponse(),
    );

    assert.equal(result.error, undefined);
    assert.equal(req.user.id, 'user-jwt-test-001');
    assert.deepEqual(req.user.roles, ['student']);
    assert.deepEqual(req.user.permissions, ['courses:read']);
    assert.ok(req.auth);
  });
});

withOptionalModule('express-rate-limit', () => {
  test('rate-limit: validates limiter options', () => {
    const createLimiter = loadMiddleware('rate-limit');

    assert.throws(
      () => createLimiter({ windowMs: 500 }),
      /windowMs must be an integer/i,
    );

    assert.throws(
      () => createLimiter({ limit: 0 }),
      /limit must be a positive integer/i,
    );
  });

  test('rate-limit: exports authentication and upload limiter factories', () => {
    const createLimiter = loadMiddleware('rate-limit');

    assert.equal(typeof createLimiter.authLimiter, 'function');
    assert.equal(typeof createLimiter.uploadLimiter, 'function');

    assert.doesNotThrow(() => createLimiter.authLimiter());
    assert.doesNotThrow(() => createLimiter.uploadLimiter());
  });
});

withOptionalModule('helmet', () => {
  test('security-headers: creates Helmet middleware', () => {
    const securityHeaders = loadMiddleware('security-headers');

    assert.equal(typeof securityHeaders(), 'function');
  });
});

withOptionalModule('multer', () => {
  test('upload-limits: validates upload size configuration', () => {
    const createUpload = loadMiddleware('upload-limits');

    assert.throws(
      () => createUpload({ maxFileSize: 0 }),
      /maxFileSize must be a positive integer/i,
    );

    assert.throws(
      () => createUpload({ maxFileSize: -1 }),
      /maxFileSize must be a positive integer/i,
    );
  });

  test('upload-limits: creates upload middleware and error handler', () => {
    const createUpload = loadMiddleware('upload-limits');

    const result = createUpload({
      maxFileSize: 1024,
      maxFiles: 2,
      maxFields: 3,
      allowedMimeTypes: ['application/pdf'],
    });

    assert.equal(typeof result.upload.single, 'function');
    assert.equal(typeof result.handleUploadError, 'function');
  });

  test('upload-limits: passes through when there is no upload error', () => {
    const createUpload = loadMiddleware('upload-limits');
    const { handleUploadError } = createUpload();

    let nextCalled = false;

    handleUploadError(
      null,
      createRequest(),
      createResponse(),
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
  });
});
