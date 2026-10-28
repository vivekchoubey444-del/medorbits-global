'use strict';

const request = require('supertest');
const app = require('../../src/app');

const baseUrl = '/api/colleges';

const sensitiveResponsePatterns = [
/stack trace/i,
/node_modules[\/]/i,
/\bsqlstate\b/i,
/\bDATABASE_URL\s*=/i,
/\bSESSION_SECRET\s*=/i,
/\bAI_API_KEY\s*=/i,
/\bpassword_hash\b/i,
/\bpasswordHash\b/i,
/\bprivate_key\b/i,
/\bsecret_access_key\b/i,
];

const forbiddenFields = new Set([
'password',
'passwordhash',
'password_hash',
'accesstoken',
'access_token',
'refreshtoken',
'refresh_token',
'clientsecret',
'client_secret',
'privatekey',
'private_key',
'databaseurl',
'database_url',
'sessionsecret',
'session_secret',
'aiapikey',
'ai_api_key',
]);

function expectJsonResponse(response) {
expect(response.headers['content-type']).toMatch(
/application\/json/i,
);
expect(response.body).toEqual(expect.any(Object));
expect(response.body).not.toBeNull();
expect(Array.isArray(response.body)).toBe(false);
}

function expectNoSensitiveFields(value) {
if (Array.isArray(value)) {
for (const item of value) {
expectNoSensitiveFields(item);
}
return;
}

if (!value || typeof value !== 'object') {
return;
}

for (const [key, child] of Object.entries(value)) {
expect(forbiddenFields.has(key.toLowerCase())).toBe(false);
expectNoSensitiveFields(child);
}
}

function getResponseData(body) {
if (Array.isArray(body)) {
return body;
}

if (Array.isArray(body?.data)) {
return body.data;
}

if (Array.isArray(body?.colleges)) {
return body.colleges;
}

if (Array.isArray(body?.data?.colleges)) {
return body.data.colleges;
}

return null;
}

function expectSafeError(response) {
const text = JSON.stringify(response.body ?? {});

for (const pattern of sensitiveResponsePatterns) {
expect(text).not.toMatch(pattern);
}
}

function expectNoServerError(response) {
expect(response.status).toBeLessThan(500);
expectSafeError(response);
}

describe('MedOrbits Colleges API', () => {
describe('college listing', () => {
test('responds without an internal server error', async () => {
const response = await request(app)
.get(baseUrl)
.set('Accept', 'application/json');

  expectNoServerError(response);
});
test('returns a valid response structure when listing succeeds', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json');
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
    const colleges = getResponseData(response.body);
    expect(colleges).not.toBeNull();
    expect(Array.isArray(colleges)).toBe(true);
  } else {
    expect([400, 401, 403, 404, 405, 429]).toContain(
      response.status,
    );
  }
});
test('supports pagination when the API implements it', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json')
    .query({
      page: 1,
      limit: 10,
    });
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
    const colleges = getResponseData(response.body);
    expect(colleges).not.toBeNull();
    expect(colleges.length).toBeLessThanOrEqual(10);
  } else {
    expect([400, 401, 403, 404, 405, 422, 429]).toContain(
      response.status,
    );
  }
});
test('handles invalid pagination values safely', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json')
    .query({
      page: -1,
      limit: -10,
    });
  expectNoServerError(response);
  if ([400, 422].includes(response.status)) {
    expectJsonResponse(response);
  } else if (response.status >= 200 && response.status < 300) {
    const colleges = getResponseData(response.body);
    expect(colleges).not.toBeNull();
    expect(colleges.length).toBeLessThanOrEqual(10);
  }
});

});

describe('college detail', () => {
test('handles an unknown college identifier safely', async () => {
const response = await request(app)
.get(`${baseUrl}/COLLEGE-DOES-NOT-EXIST`)
.set('Accept', 'application/json');

  expect([400, 404, 422]).toContain(response.status);
  expectSafeError(response);
});
test('returns a valid college object when a college exists', async () => {
  const listing = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json');
  expect(listing.status).toBe(200);
  const colleges = getResponseData(listing.body);
  expect(colleges).not.toBeNull();
  if (colleges.length === 0) {
    return;
  }
  const college = colleges[0];
  const id = college.id || college.collegeId || college.slug;
  expect(id).toBeTruthy();
  const response = await request(app)
    .get(`${baseUrl}/${encodeURIComponent(String(id))}`)
    .set('Accept', 'application/json');
  expect(response.status).toBe(200);
  expectJsonResponse(response);
  expectNoSensitiveFields(response.body);
  const payload = response.body?.data ?? response.body;
  const detail = payload?.college ?? payload;
  expect(detail).toEqual(expect.any(Object));
  expect(detail).not.toBeNull();
});

});

describe('search and filters', () => {
test.each([
['search', { search: 'medical' }],
['country filter', { countryCode: 'IN' }],
['course filter', { course: 'MBBS' }],
])('handles the %s query safely', async (_label, query) => {
const response = await request(app)
.get(baseUrl)
.set('Accept', 'application/json')
.query(query);

  expectNoServerError(response);
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
    expect(getResponseData(response.body)).not.toBeNull();
  }
});
test('handles unexpected query values safely', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json')
    .query({
      search: '<script>alert(1)</script>',
      countryCode: '../../etc/passwd',
    });
  expectNoServerError(response);
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
  }
});
test('handles SQL injection-like search input safely', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json')
    .query({
      search: "' OR 1=1 --",
    });
  expectNoServerError(response);
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
  }
});

});

describe('data validation and response safety', () => {
test('does not expose database errors or stack traces', async () => {
const response = await request(app)
.get(`${baseUrl}/INVALID-COLLEGE-ID`)
.set('Accept', 'application/json');

  expectSafeError(response);
  expect(responseTextForTest(response)).not.toMatch(
    /at\s+\w+\s+\([^)]*\.js:\d+:\d+\)/i,
  );
});
test('does not expose sensitive fields in successful listings', async () => {
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json');
  if (response.status >= 200 && response.status < 300) {
    expectJsonResponse(response);
    expectNoSensitiveFields(response.body);
  } else {
    expectNoServerError(response);
  }
});
test('does not permit unauthorized college creation', async () => {
  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .send({
      name: 'Unauthorized Test College',
      status: 'approved',
    });
  expect([401, 403, 404, 405]).toContain(response.status);
  expectSafeError(response);
});
test('does not permit unauthenticated college deletion', async () => {
  const response = await request(app)
    .delete(`${baseUrl}/COLLEGE-001`)
    .set('Accept', 'application/json');
  expect([401, 403, 404, 405]).toContain(response.status);
  expectSafeError(response);
});

});
});

function responseTextForTest(response) {
if (typeof response.text === 'string') {
return response.text;
}

return JSON.stringify(response.body ?? {});
}