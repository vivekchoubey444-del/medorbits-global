‘use strict’;

const request = require(‘supertest’);
const app = require(’../../src/app’);

const baseUrl = ‘/api/universities’;
const jsonContentType = /application/json/i;

const sensitiveResponsePatterns = [
/stack trace/i,
/node_modules[\/]/i,
/\bsqlstate\b/i,
/\bDATABASE_URL\s*=/i,
/\bSESSION_SECRET\s*=/i,
/\bAI_API_KEY\s*=/i,
/\bpassword_hash\b/i,
/\bprivate_key\b/i,
/\bECONNREFUSED\b/i,
/mysql:///i,
/postgres(?:ql)?:///i,
/--–BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY--–/i,
];

function responseText(response) {
if (typeof response.text === ‘string’) {
return response.text;
}

try {
return JSON.stringify(response.body ?? {});
} catch {
return ‘’;
}
}

function expectSafeResponse(response) {
const text = responseText(response);

for (const pattern of sensitiveResponsePatterns) {
expect(text).not.toMatch(pattern);
}
}

function expectJsonResponse(response) {
expect(response.headers[‘content-type’]).toMatch(jsonContentType);
expect(response.body).toEqual(expect.any(Object));
expect(response.body).not.toBeNull();
expect(Array.isArray(response.body)).toBe(false);
}

function expectUniversityShape(university) {
expect(university).toEqual(
expect.objectContaining({
id: expect.any(String),
name: expect.any(String),
}),
);

expect(university.id.trim()).not.toBe(’’);
expect(university.name.trim()).not.toBe(’’);

for (const field of [
‘password’,
‘passwordHash’,
‘password_hash’,
‘databaseUrl’,
‘privateKey’,
‘private_key’,
‘internalNotes’,
‘secret’,
‘apiKey’,
]) {
expect(university).not.toHaveProperty(field);
}
}

function expectCatalogResponse(response) {
expectJsonResponse(response);

expect(response.body).toEqual(
expect.objectContaining({
success: expect.any(Boolean),
data: expect.any(Array),
}),
);

for (const university of response.body.data) {
expectUniversityShape(university);
}

expectSafeResponse(response);
}

describe(‘Universities API’, () => {
describe(‘GET /api/universities’, () => {
test(‘returns a valid JSON university catalog’, async () => {
const response = await request(app)
.get(baseUrl)
.set(‘Accept’, ‘application/json’);

  expect(response.status).toBe(200);
  expectCatalogResponse(response);
});
test('supports pagination', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({ page: 1, limit: 10 })
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectCatalogResponse(response);
  expect(response.body.data.length).toBeLessThanOrEqual(10);
});
test.each([
  ['page', '0'],
  ['page', '-1'],
  ['page', 'invalid'],
  ['limit', '0'],
  ['limit', '-1'],
  ['limit', 'invalid'],
])('rejects invalid pagination parameter %s=%s', async (key, value) => {
  const response = await request(app)
    .get(baseUrl)
    .query({ [key]: value })
    .set('Accept', 'application/json');
  expect([400, 422]).toContain(response.status);
  expectJsonResponse(response);
  expectSafeResponse(response);
});
test('rejects a page size above the configured maximum', async () => {
  const maxLimit = Number(
    process.env.UNIVERSITIES_TEST_MAX_LIMIT || 100,
  );
  expect(Number.isInteger(maxLimit)).toBe(true);
  expect(maxLimit).toBeGreaterThan(0);
  const response = await request(app)
    .get(baseUrl)
    .query({ page: 1, limit: maxLimit + 1 })
    .set('Accept', 'application/json');
  expect([400, 422]).toContain(response.status);
  expectJsonResponse(response);
  expectSafeResponse(response);
});

});

describe(‘University search and filters’, () => {
test.each([
[‘search’, ‘medical university’],
[‘country’, ‘IN’],
[‘countryCode’, ‘IN’],
[‘course’, ‘MBBS’],
[‘courseId’, ‘course-mbbs’],
[‘type’, ‘public’],
[‘state’, ‘Uttar Pradesh’],
])(‘handles the %s filter safely’, async (key, value) => {
const response = await request(app)
.get(baseUrl)
.query({ [key]: value })
.set(‘Accept’, ‘application/json’);

  expect(response.status).toBe(200);
  expectCatalogResponse(response);
});
test('handles combined search and filter parameters', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({
      search: 'medical',
      countryCode: 'IN',
      course: 'MBBS',
      page: 1,
      limit: 10,
    })
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectCatalogResponse(response);
  expect(response.body.data.length).toBeLessThanOrEqual(10);
});
test('handles SQL injection-like search input safely', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({ search: "' OR 1=1 --" })
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectCatalogResponse(response);
});
test('handles script-like search input without returning HTML', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({ search: '<script>alert(1)</script>' })
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectCatalogResponse(response);
});
test('ignores or safely rejects unexpected privilege parameters', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({
      isAdmin: 'true',
      role: 'admin',
      internal: 'true',
    })
    .set('Accept', 'application/json');
  expect([200, 400, 422]).toContain(response.status);
  expectSafeResponse(response);
  if (response.status === 200) {
    expectCatalogResponse(response);
  } else {
    expectJsonResponse(response);
  }
});

});

describe(‘GET /api/universities/:id’, () => {
test(‘returns a structured not-found response for an unknown university’, async () => {
const response = await request(app)
.get(${baseUrl}/UNIVERSITY-DOES-NOT-EXIST)
.set(‘Accept’, ‘application/json’);

  expect([404, 422]).toContain(response.status);
  expectJsonResponse(response);
  expectSafeResponse(response);
});
test('handles malformed university IDs safely', async () => {
  const response = await request(app)
    .get(`${baseUrl}/%00invalid`)
    .set('Accept', 'application/json');
  expect([400, 404, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not expose internal fields in university details', async () => {
  const response = await request(app)
    .get(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
    .set('Accept', 'application/json');
  expectSafeResponse(response);
  if (response.status === 200) {
    expectJsonResponse(response);
    const university =
      response.body.data ?? response.body.university ?? response.body;
    expectUniversityShape(university);
  } else {
    expect([404, 422]).toContain(response.status);
  }
});

});

describe(‘Catalog integrity and data safety’, () => {
test(‘does not return duplicate IDs on one result page’, async () => {
const response = await request(app)
.get(baseUrl)
.query({ page: 1, limit: 100 })
.set(‘Accept’, ‘application/json’);

  expect(response.status).toBe(200);
  expectCatalogResponse(response);
  const ids = response.body.data.map((university) => university.id);
  expect(new Set(ids).size).toBe(ids.length);
});
test('returns consistently formatted university IDs and names', async () => {
  const response = await request(app)
    .get(baseUrl)
    .query({ page: 1, limit: 10 })
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectCatalogResponse(response);
  for (const university of response.body.data) {
    expect(university.id.trim()).toBe(university.id);
    expect(university.name.trim()).toBe(university.name);
  }
});
test('does not expose environment variables or database connection details', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectSafeResponse(response);
  const text = responseText(response);
  expect(text).not.toMatch(/process\.env/i);
  expect(text).not.toMatch(/mysql:\/\/[^\s"]+/i);
  expect(text).not.toMatch(/postgres(?:ql)?:\/\/[^\s"]+/i);
});

});

describe(‘Catalog mutation protection’, () => {
test(‘does not permit unauthenticated university creation’, async () => {
const response = await request(app)
.post(baseUrl)
.set(‘Accept’, ‘application/json’)
.send({
id: ‘UNAUTHORIZED-UNIVERSITY’,
name: ‘Unauthorized Test University’,
countryCode: ‘IN’,
isVerified: true,
isFeatured: true,
});

  expect([400, 401, 403, 404, 405, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not permit unauthorized university updates', async () => {
  const response = await request(app)
    .patch(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
    .set('Accept', 'application/json')
    .send({
      name: 'Modified University',
      isVerified: true,
      isFeatured: true,
      isAdmin: true,
    });
  expect([400, 401, 403, 404, 405, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not permit unauthorized university deletion', async () => {
  const response = await request(app)
    .delete(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
    .set('Accept', 'application/json');
  expect([400, 401, 403, 404, 405, 422]).toContain(response.status);
  expectSafeResponse(response);
});

});

describe(‘HTTP method and error handling’, () => {
test(‘handles unsupported collection methods safely’, async () => {
const response = await request(app)
.put(baseUrl)
.set(‘Accept’, ‘application/json’)
.send({ isAdmin: true });

  expect([400, 401, 403, 404, 405, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not expose stack traces or filesystem paths for missing universities', async () => {
  const response = await request(app)
    .get(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
    .set('Accept', 'application/json');
  expectSafeResponse(response);
  const text = responseText(response);
  expect(text).not.toMatch(
    /at\s+\w+\s+\([^)]*\.js:\d+:\d+\)/i,
  );
  expect(text).not.toMatch(
    /\/(?:home|root|var|opt)\/[^"\s]+/i,
  );
});

});
});