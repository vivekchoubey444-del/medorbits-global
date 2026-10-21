‘use strict’;

const express = require(‘express’);
const request = require(‘supertest’);
const publicReleaseRoutes = require(’../../src/routes/public-release.routes’);

const baseUrl = ‘/api/v1/public-releases’;

function createApp() {
const app = express();

app.disable(‘x-powered-by’);
app.use(express.json({ limit: ‘100kb’ }));
app.use(baseUrl, publicReleaseRoutes);

app.use((req, res) => {
res.status(404).json({
success: false,
error: {
code: ‘NOT_FOUND’,
message: ‘Resource not found.’,
},
});
});

app.use((error, req, res, next) => {
if (res.headersSent) {
return next(error);
}

const status =
  Number.isInteger(error.statusCode) &&
  error.statusCode >= 400 &&
  error.statusCode < 600
    ? error.statusCode
    : Number.isInteger(error.status) &&
        error.status >= 400 &&
        error.status < 600
      ? error.status
      : 500;
res.status(status).json({
  success: false,
  error: {
    code: status === 500 ? 'INTERNAL_ERROR' : error.code || 'REQUEST_ERROR',
    message:
      status === 500
        ? 'An internal server error occurred.'
        : error.message || 'Request could not be processed.',
  },
});

});

return app;
}

function expectJsonResponse(response) {
expect(response.headers[‘content-type’]).toMatch(/application/json/i);
expect(response.body).toEqual(expect.any(Object));
}

function expectSafeResponse(response) {
const text = JSON.stringify(response.body ?? {});

for (const pattern of [
/stack trace/i,
/node_modules[\/]/i,
/\bDATABASE_URL\s*=/i,
/\bSESSION_SECRET\s*=/i,
/\bAI_API_KEY\s*=/i,
/\bpassword_hash\b/i,
/\bprivate_key\b/i,
/\bECONNREFUSED\b/i,
/mysql:///i,
/postgres(?:ql)?:///i,
]) {
expect(text).not.toMatch(pattern);
}
}

function expectReleaseResponse(response) {
expectJsonResponse(response);

expect(response.body).toEqual(
expect.objectContaining({
success: true,
data: expect.objectContaining({
notices: expect.any(Array),
bulletins: expect.any(Array),
}),
pagination: expect.objectContaining({
total: expect.objectContaining({
notices: expect.any(Number),
bulletins: expect.any(Number),
}),
}),
}),
);

expect(response.body.pagination.total.notices).toBeGreaterThanOrEqual(0);
expect(response.body.pagination.total.bulletins).toBeGreaterThanOrEqual(0);

expectSafeResponse(response);
}

describe(‘Public Releases API’, () => {
describe(‘GET /api/v1/public-releases’, () => {
test(‘returns published bulletins and pagination totals’, async () => {
const response = await request(createApp())
.get(${baseUrl}?limit=1)
.set(‘Accept’, ‘application/json’);

  expect(response.status).toBe(200);
  expectReleaseResponse(response);
  expect(response.body.data.bulletins).toHaveLength(1);
  expect(response.body.data.bulletins[0].publicationStatus).toBe('published');
  expect(response.body.pagination.total.bulletins).toBe(2);
});
test('returns only published bulletins', async () => {
  const response = await request(createApp())
    .get(`${baseUrl}?limit=10`)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectReleaseResponse(response);
  for (const bulletin of response.body.data.bulletins) {
    expect(bulletin.publicationStatus).toBe('published');
  }
});
test('returns valid pagination metadata for a small page size', async () => {
  const response = await request(createApp())
    .get(`${baseUrl}?limit=1&page=1`)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectReleaseResponse(response);
  expect(response.body.data.bulletins.length).toBeLessThanOrEqual(1);
});
test.each([
  ['limit', '0'],
  ['limit', '-1'],
  ['limit', 'invalid'],
  ['page', '0'],
  ['page', '-1'],
  ['page', 'invalid'],
])('validates invalid pagination parameter %s=%s', async (key, value) => {
  const response = await request(createApp())
    .get(baseUrl)
    .query({ [key]: value })
    .set('Accept', 'application/json');
  expect([400, 422]).toContain(response.status);
  expectJsonResponse(response);
  expectSafeResponse(response);
});
test('does not expose unpublished bulletins in public responses', async () => {
  const response = await request(createApp())
    .get(`${baseUrl}?limit=100`)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectReleaseResponse(response);
  for (const bulletin of response.body.data.bulletins) {
    expect(bulletin.publicationStatus).toBe('published');
  }
});
test('does not expose internal implementation details', async () => {
  const response = await request(createApp())
    .get(baseUrl)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectReleaseResponse(response);
  const text = JSON.stringify(response.body);
  expect(text).not.toMatch(/process\.env/i);
  expect(text).not.toMatch(/\/(?:home|root|var|opt)\/[^"\s]+/i);
});

});

describe(‘HTTP method handling’, () => {
test(‘does not permit public release creation through POST’, async () => {
const response = await request(createApp())
.post(baseUrl)
.set(‘Accept’, ‘application/json’)
.send({
publicationStatus: ‘published’,
title: ‘Unauthorized Release’,
});

  expect([404, 405]).toContain(response.status);
  expectJsonResponse(response);
  expectSafeResponse(response);
});
test('handles HEAD requests without an internal server error', async () => {
  const response = await request(createApp())
    .head(baseUrl)
    .set('Accept', 'application/json');
  expect(response.status).toBeLessThan(500);
});

});
});