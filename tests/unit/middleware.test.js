'use strict';

/**
 * MedOrbits -- Middleware Unit Tests
 *
 * File: tests/unit/middleware.test.js
 * Run: node --test tests/unit/middleware.test.js
 *
 * Tests the actual middleware implementations.
 * Optional integrations are skipped when their packages are unavailable.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');

const middlewarePath = '../../src/middleware';

const requestId = require(`${middlewarePath}/request-id`);
const authorize = require(`${middlewarePath}/authorize`);
const maintenance = require(`${middlewarePath}/maintenance`);
const requestLogger = require(`${middlewarePath}/request-logger`);
const csrf = require(`${middlewarePath}/csrf`);
const notFound = require(`${middlewarePath}/not-found`);
const validate = require(`${middlewarePath}/validate`);
const errorHandler = require(`${middlewarePath}/error-handler`);
const verifyWebhook = require(`${middlewarePath}/verify-webhook`);

const TEST_SECRET = 'test-secret-with-at-least-32-characters-long';

function createRequest(overrides = {}) {
  const headers = Object.fromEntries(
    Object.entries(overrides.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

  return {
    method: 'GET',
    path: '/api/v1/test',
    originalUrl: '/api/v1/test',
    headers,

    get(name) {
      return headers[String(name).toLowerCase()] || '';
    },

    accepts() {
      return false;
    },

    ...overrides,

    headers,

    get: overrides.get || function get(name) {
      return headers[String(name).toLowerCase()] || '';
    },
  };
}

function createResponse() {
  const response = new EventEmitter();

  response.statusCode = 200;
  response.headers = {};
  response.body = undefined;
  response.locals = {};
  response.headersSent = false;

  response.setHeader = function setHeader(name, value) {
    response.headers[name.toLowerCase()] = value;
    return response;
  };

  response.getHeader = function getHeader(name) {
    return response.headers[name.toLowerCase()];
  };

  response.status = function status(code) {
    response.statusCode = code;
    return response;
  };

  response.json = function json(body) {
    response.body = body;
    response.headersSent = true;
    return response;
  };

  response.send = function send(body) {
    response.body = body;
    response.headersSent = true;
    return response;
  };

  response.cookie = function cookie(name, value, options) {
    response.lastCookie = { name, value, options };
    return response;
  };

  return response;
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

function packageAvailable(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function withSuppressedConsoleError(callback) {
  const original = console.error;
  console.error = () => {};

  try {
    return callback();
  } finally {
    console.error = original;
  }
}

// -----------------------------------------------------------------------------
// Request ID
// -----------------------------------------------------------------------------

test('request-id: accepts a valid incoming request ID', async () => {
  const req = createRequest({
    headers: { 'x-request-id': 'request-123_test' },
  });
  const res = createResponse();

  const result = await runMiddleware(requestId(), req, res);

  assert.equal(result.error, undefined);
  assert.equal(req.id, 'request-123_test');
  assert.equal(res.headers['x-request-id'], 'request-123_test');
});

test('request-id: replaces an invalid incoming request ID', async () => {
  const req = createRequest({
    headers: { 'x-request-id': 'invalid request id with spaces' },
  });
  const res = createResponse();

  await runMiddleware(requestId(), req, res);

  assert.equal(typeof req.id, 'string');
  assert.match(req.id, /^[0-9a-f-]{36}$/i);
  assert.equal(res.headers['x-request-id'], req.id);
});

test('request-id: generates an ID when no ID is supplied', async () => {
  const req = createRequest();
  const res = createResponse();

  await runMiddleware(requestId(), req, res);

  assert.ok(req.id);
  assert.equal(res.headers['x-request-id'], req.id);
});

test('request-id: exports the documented request ID pattern', () => {
  assert.equal(requestId.REQUEST_ID_PATTERN.test('abc-123'), true);
  assert.equal(requestId.REQUEST_ID_PATTERN.test('contains spaces'), false);
  assert.equal(requestId.REQUEST_ID_PATTERN.test(''), false);
});

// -----------------------------------------------------------------------------
// Authorization
// -----------------------------------------------------------------------------

test('authorize: rejects requests without an authenticated user', async () => {
  const result = await runMiddleware(
    authorize(),
    createRequest(),
    createResponse(),
  );

  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'AUTHENTICATION_REQUIRED');
});

test('authorize: allows a user with a required role', async () => {
  const result = await runMiddleware(
    authorize({ roles: ['admin'] }),
    createRequest({ user: { id: 'user-1', role: 'admin' } }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
});

test('authorize: supports multiple roles and role arrays', async () => {
  const result = await runMiddleware(
    authorize({ roles: ['admin', 'reviewer'] }),
    createRequest({
      user: { id: 'user-1', roles: ['editor', 'reviewer'] },
    }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
});

test('authorize: rejects a user without a required role', async () => {
  const result = await runMiddleware(
    authorize({ roles: ['admin'] }),
    createRequest({ user: { id: 'user-1', role: 'student' } }),
    createResponse(),
  );

  assert.equal(result.error.status, 403);
  assert.equal(result.error.code, 'FORBIDDEN');
});

test('authorize: checks for at least one required permission by default', async () => {
  const result = await runMiddleware(
    authorize({
      permissions: ['courses:read', 'courses:write'],
    }),
    createRequest({ user: { permissions: ['courses:read'] } }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
});

test('authorize: can require all configured permissions', async () => {
  const result = await runMiddleware(
    authorize({
      permissions: ['courses:read', 'courses:write'],
      requireAllPermissions: true,
    }),
    createRequest({ user: { permissions: ['courses:read'] } }),
    createResponse(),
  );

  assert.equal(result.error.status, 403);
});

test('authorize: awaits the ownership callback', async () => {
  const result = await runMiddleware(
    authorize({
      ownership: async (_request, user) => user.id === 'user-1',
    }),
    createRequest({ user: { id: 'user-1', role: 'student' } }),
    createResponse(),
  );

  assert.equal(result.error, undefined);
});

test('authorize: rejects failed ownership checks', async () => {
  const result = await runMiddleware(
    authorize({ ownership: () => false }),
    createRequest({ user: { id: 'user-1' } }),
    createResponse(),
  );

  assert.equal(result.error.status, 403);
});

test('authorize: forwards ownership callback errors', async () => {
  const expectedError = new Error('Ownership lookup failed');

  const result = await runMiddleware(
    authorize({
      ownership: () => {
        throw expectedError;
      },
    }),
    createRequest({ user: { id: 'user-1' } }),
    createResponse(),
  );

  assert.equal(result.error, expectedError);
});

test('authorize: exposes role and permission helper factories', () => {
  assert.equal(typeof authorize.requireRole, 'function');
  assert.equal(typeof authorize.requirePermission, 'function');
  assert.equal(typeof authorize.forbidden, 'function');
});

// -----------------------------------------------------------------------------
// Maintenance mode
// -----------------------------------------------------------------------------

test('maintenance: passes requests through when disabled', async () => {
  const result = await runMiddleware(
    maintenance({ enabled: false }),
    createRequest(),
    createResponse(),
  );

  assert.equal(result.count, 1);
  assert.equal(result.res.statusCode, 200);
});

test('maintenance: allows configured health endpoints', async () => {
  const result = await runMiddleware(
    maintenance({ enabled: true }),
    createRequest({ path: '/health' }),
    createResponse(),
  );

  assert.equal(result.count, 1);
  assert.equal(result.res.statusCode, 200);
});

test('maintenance: returns a structured 503 for API requests', async () => {
  const res = createResponse();

  await runMiddleware(
    maintenance({ enabled: true }),
    createRequest({
      path: '/api/v1/courses',
      id: 'request-42',
    }),
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['retry-after'], '300');
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'MAINTENANCE_MODE');
  assert.equal(res.body.requestId, 'request-42');
});

test('maintenance: supports a custom retry interval and message', async () => {
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

  assert.equal(res.headers['retry-after'], '120');
  assert.equal(res.body.error.message, 'Scheduled maintenance');
});

test('maintenance: sends a plain response for non-API requests by default', async () => {
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
  let called = false;

  await runMiddleware(
    maintenance({
      enabled: true,
      htmlHandler: () => {
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
  assert.throws(
    () => validate(),
    /validation schema or function is required/i,
  );
});

test('validate: accepts a successful custom validator', async () => {
  const req = createRequest({ body: { name: 'MedOrbits' } });

  const result = await runMiddleware(
    validate((input) => ({ valid: true, value: input })),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.deepEqual(req.body, { name: 'MedOrbits' });
});

test('validate: replaces request input with the custom validator result', async () => {
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

test('validate: forwards a validation error for invalid custom input', async () => {
  const result = await runMiddleware(
    validate(() => ({
      valid: false,
      errors: [{ field: 'name' }],
    })),
    createRequest({ body: { name: '' } }),
    createResponse(),
  );

  assert.equal(result.error.status, 400);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('validate: supports a custom validator returning false', async () => {
  const result = await runMiddleware(
    validate(() => false),
    createRequest({ body: {} }),
    createResponse(),
  );

  assert.equal(result.error.status, 400);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('validate: forwards an Error returned by a custom validator', async () => {
  const expectedError = new Error('Custom validation failed');

  const result = await runMiddleware(
    validate(() => expectedError),
    createRequest({ body: {} }),
    createResponse(),
  );

  assert.equal(result.error, expectedError);
});

test('validate: supports validation of body, params, and query', async () => {
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

  assert.equal(result.error.status, 400);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('validate: supports Joi-compatible validate results', async () => {
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
  const expectedError = new Error('Unexpected validator failure');

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
  assert.throws(
    () => csrf({ secret: 'short' }),
    /at least 32 characters/i,
  );
});

test('csrf: allows safe HTTP methods without a submitted token', async () => {
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
  const protection = csrf({ secret: TEST_SECRET });

  const result = await runMiddleware(
    protection.verify,
    createRequest({ method: 'POST', cookies: {} }),
    createResponse(),
  );

  assert.equal(result.error.status, 403);
  assert.equal(result.error.code, 'CSRF_VALIDATION_FAILED');
});

test('csrf: issues a signed CSRF cookie and exposes the token in locals', async () => {
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
  const protection = csrf({ secret: TEST_SECRET });
  const token = crypto.randomBytes(32).toString('base64url');

  const signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(token)
    .digest('hex');

  const signedToken = `${token}.${signature}`;

  const req = createRequest({
    method: 'POST',
    cookies: { [protection.cookieName]: signedToken },
    headers: { 'x-csrf-token': signedToken },
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
  const protection = csrf({ secret: TEST_SECRET });

  const token = [
    crypto.randomBytes(32).toString('base64url'),
    '0'.repeat(64),
  ].join('.');

  const result = await runMiddleware(
    protection.verify,
    createRequest({
      method: 'POST',
      cookies: { [protection.cookieName]: token },
      headers: { 'x-csrf-token': token },
    }),
    createResponse(),
  );

  assert.equal(result.error.status, 403);
  assert.equal(result.error.code, 'CSRF_VALIDATION_FAILED');
});

test('csrf: can skip protection when shouldProtect returns false', async () => {
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

test('csrf: exports its safe comparison helper', () => {
  assert.equal(csrf.safeEqual('same', 'same'), true);
  assert.equal(csrf.safeEqual('first', 'second'), false);
});

// -----------------------------------------------------------------------------
// Webhook signature verification
// -----------------------------------------------------------------------------

test('verify-webhook: rejects an absent or weak signing secret', () => {
  assert.throws(
    () => verifyWebhook({ secret: 'weak' }),
    /signing secret must be configured/i,
  );
});

test('verify-webhook: rejects a missing raw request body', async () => {
  const result = await runMiddleware(
    verifyWebhook({ secret: TEST_SECRET }),
    createRequest({
      get() {
        return '';
      },
    }),
    createResponse(),
  );

  assert.equal(result.error.status, 400);
  assert.equal(result.error.code, 'WEBHOOK_RAW_BODY_REQUIRED');
});

test('verify-webhook: rejects a missing signature header', async () => {
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

  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'WEBHOOK_SIGNATURE_MISSING');
});

test('verify-webhook: accepts a valid HMAC-SHA256 signature', async () => {
  const body = Buffer.from('{"event":"payment.success"}');

  const signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(body)
    .digest('hex');

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

test('verify-webhook: accepts the configured signature prefix', async () => {
  const body = Buffer.from('{"event":"payment.success"}');

  const signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(body)
    .digest('hex');

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

  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'WEBHOOK_SIGNATURE_INVALID');
});

// -----------------------------------------------------------------------------
// Not-found middleware
// -----------------------------------------------------------------------------

test('not-found: returns the standard JSON 404 response', async () => {
  const res = createResponse();

  await runMiddleware(
    notFound(),
    createRequest({ id: 'request-404' }),
    res,
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.requestId, 'request-404');
});

test('not-found: supports a custom response code and message', async () => {
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
  const result = await runMiddleware(
    notFound({ apiOnly: false }),
    createRequest({
      accepts(type) {
        return type === 'html';
      },
    }),
    createResponse(),
  );

  assert.equal(result.error.status, 404);
  assert.equal(result.error.code, 'NOT_FOUND');
});

// -----------------------------------------------------------------------------
// Centralized error handler
// -----------------------------------------------------------------------------

test('error-handler: forwards errors when response headers were already sent', () => {
  const error = new Error('Already started');
  const res = createResponse();
  res.headersSent = true;

  let forwarded;

  errorHandler(error, createRequest(), res, (nextError) => {
    forwarded = nextError;
  });

  assert.equal(forwarded, error);
});

test('error-handler: normalizes invalid status codes to 500', () => {
  const res = createResponse();
  const error = new Error('Internal details');
  error.status = 200;

  withSuppressedConsoleError(() => {
    errorHandler(
      error,
      createRequest({ id: 'request-error' }),
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
  assert.equal(res.body.requestId, 'request-error');
  assert.equal(JSON.stringify(res.body).includes('Internal details'), false);
});

test('error-handler: classifies oversized request bodies', () => {
  const error = new Error('Payload too large');
  error.type = 'entity.too.large';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('error-handler: classifies malformed JSON bodies', () => {
  const error = new Error('Malformed JSON');
  error.type = 'entity.parse.failed';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_JSON');
});

test('error-handler: classifies denied CORS origins', () => {
  const error = new Error('Origin denied');
  error.code = 'CORS_ORIGIN_DENIED';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'CORS_ORIGIN_DENIED');
});

test('error-handler: maps duplicate database records to 409', () => {
  const error = new Error('Database duplicate');
  error.code = '23505';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'RESOURCE_CONFLICT');
});

test('error-handler: maps invalid database values to 400', () => {
  const error = new Error('Database input error');
  error.code = '22P02';

  const res = createResponse();

  errorHandler(error, createRequest(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_DATA');
});

test('error-handler: uses safe client messages for server errors', () => {
  const error = new Error('Sensitive database connection string');
  const res = createResponse();

  withSuppressedConsoleError(() => {
    errorHandler(error, createRequest(), res, () => {});
  });

  assert.equal(res.statusCode, 500);
  assert.equal(
    res.body.error.message,
    'An unexpected server error occurred.',
  );
  assert.equal(
    JSON.stringify(res.body).includes(
      'Sensitive database connection string',
    ),
    false,
  );
});

test('error-handler: preserves safe client messages for ordinary request errors', () => {
  const error = new Error('Invalid course ID');
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
  const entries = [];

  const logger = {
    log: (message) => entries.push(JSON.parse(message)),
    error: (message) => entries.push(JSON.parse(message)),
  };

  const req = createRequest({
    id: 'request-log-1',
    method: 'GET',
    path: '/api/v1/courses',
    originalUrl: '/api/v1/courses?secret=should-not-be-logged',
    user: { id: 42 },
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
  assert.equal(entries[0].requestId, 'request-log-1');
  assert.equal(entries[0].method, 'GET');
  assert.equal(entries[0].path, '/api/v1/courses');
  assert.equal(entries[0].status, 200);
  assert.equal(entries[0].userId, '42');
  assert.equal(
    JSON.stringify(entries[0]).includes('should-not-be-logged'),
    false,
  );
});

test('request-logger: uses error-level logging for 5xx responses', async () => {
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
    createRequest({ method: 'POST', path: '/api/v1/test' }),
    res,
  );

  res.statusCode = 503;
  res.emit('finish');

  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, 'error');
  assert.equal(entries[0].data.level, 'error');
});

test('request-logger: respects shouldLog filtering', async () => {
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

test('authenticate: rejects missing or weak JWT configuration', {
  skip: !packageAvailable('jsonwebtoken'),
}, () => {
  const authenticate = require(`${middlewarePath}/authenticate`);

  assert.throws(
    () => authenticate({ secret: 'short' }),
    /at least 32 characters/i,
  );
});

test('authenticate: rejects requests without a Bearer token', {
  skip: !packageAvailable('jsonwebtoken'),
}, async () => {
  const authenticate = require(`${middlewarePath}/authenticate`);

  const result = await runMiddleware(
    authenticate({ secret: TEST_SECRET }),
    createRequest(),
    createResponse(),
  );

  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'AUTHENTICATION_REQUIRED');
});

test('authenticate: rejects invalid or expired tokens', {
  skip: !packageAvailable('jsonwebtoken'),
}, async () => {
  const authenticate = require(`${middlewarePath}/authenticate`);

  const result = await runMiddleware(
    authenticate({ secret: TEST_SECRET }),
    createRequest({
      headers: { authorization: 'Bearer invalid-token' },
    }),
    createResponse(),
  );

  assert.equal(result.error.status, 401);
  assert.equal(result.error.code, 'INVALID_OR_EXPIRED_TOKEN');
});

test('authenticate: establishes a normalized user from a valid JWT', {
  skip: !packageAvailable('jsonwebtoken'),
}, async () => {
  const jwt = require('jsonwebtoken');
  const authenticate = require(`${middlewarePath}/authenticate`);

  const token = jwt.sign(
    {
      sub: 'user-123',
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
    headers: { authorization: `Bearer ${token}` },
  });

  const result = await runMiddleware(
    authenticate({ secret: TEST_SECRET }),
    req,
    createResponse(),
  );

  assert.equal(result.error, undefined);
  assert.equal(req.user.id, 'user-123');
  assert.deepEqual(req.user.roles, ['student']);
  assert.deepEqual(req.user.permissions, ['courses:read']);
  assert.ok(req.auth);
});

test('rate-limit: validates limiter options', {
  skip: !packageAvailable('express-rate-limit'),
}, () => {
  const createLimiter = require(`${middlewarePath}/rate-limit`);

  assert.throws(
    () => createLimiter({ windowMs: 500 }),
    /windowMs must be an integer/i,
  );

  assert.throws(
    () => createLimiter({ limit: 0 }),
    /limit must be a positive integer/i,
  );
});

test('rate-limit: exports authentication and upload limiter factories', {
  skip: !packageAvailable('express-rate-limit'),
}, () => {
  const createLimiter = require(`${middlewarePath}/rate-limit`);

  assert.equal(typeof createLimiter.authLimiter, 'function');
  assert.equal(typeof createLimiter.uploadLimiter, 'function');

  assert.doesNotThrow(() => createLimiter.authLimiter());
  assert.doesNotThrow(() => createLimiter.uploadLimiter());
});

test('security-headers: creates Helmet middleware when installed', {
  skip: !packageAvailable('helmet'),
}, () => {
  const securityHeaders = require(`${middlewarePath}/security-headers`);

  assert.equal(typeof securityHeaders(), 'function');
});

test('upload-limits: validates upload size configuration when Multer is installed', {
  skip: !packageAvailable('multer'),
}, () => {
  const createUpload = require(`${middlewarePath}/upload-limits`);

  assert.throws(
    () => createUpload({ maxFileSize: 0 }),
    /maxFileSize must be a positive integer/i,
  );

  assert.throws(
    () => createUpload({ maxFileSize: -1 }),
    /maxFileSize must be a positive integer/i,
  );
});

test('upload-limits: creates upload middleware and error handler when Multer is installed', {
  skip: !packageAvailable('multer'),
}, () => {
  const createUpload = require(`${middlewarePath}/upload-limits`);

  const result = createUpload({
    maxFileSize: 1024,
    maxFiles: 2,
    maxFields: 3,
    allowedMimeTypes: ['application/pdf'],
  });

  assert.equal(typeof result.upload.single, 'function');
  assert.equal(typeof result.handleUploadError, 'function');
});

test('upload-limits: passes through when there is no upload error', {
  skip: !packageAvailable('multer'),
}, () => {
  const createUpload = require(`${middlewarePath}/upload-limits`);
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