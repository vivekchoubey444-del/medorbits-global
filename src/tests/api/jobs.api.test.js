
'use strict';

const request = require('supertest');
const app = require('../../src/app');

const baseUrl = '/api/jobs';
const jsonContentType = /application\/json/i;

const configuredMax = Number(
  process.env.JOBS_TEST_MAX_LIMIT || 100,
);

const sensitiveResponsePatterns = [
  /stack trace/i,
  /node_modules[\\/]/i,
  /\bsqlstate\b/i,
  /\bDATABASE_URL\s*=/i,
  /\bSESSION_SECRET\s*=/i,
  /\bAI_API_KEY\s*=/i,
  /\bpassword_hash\b/i,
  /\bprivate_key\b/i,
  /\bECONNREFUSED\b/i,
  /\bBEGIN\s+(?:RSA|OPENSSH|EC)\s+PRIVATE KEY\b/i,
  /mysql:\/\//i,
  /postgres(?:ql)?:\/\//i,
];

const forbiddenFields = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'databaseurl',
  'database_url',
  'privatekey',
  'private_key',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
]);

function responseText(response) {
  if (typeof response.text === 'string') {
    return response.text;
  }

  try {
    return JSON.stringify(response.body ?? {});
  } catch {
    return '';
  }
}

function expectSafeResponse(response) {
  const text = responseText(response);

  for (const pattern of sensitiveResponsePatterns) {
    expect(text).not.toMatch(pattern);
  }
}

function expectJsonResponse(response) {
  expect(response.headers['content-type']).toMatch(
    jsonContentType,
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

function expectJobShape(job) {
  expect(job).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      title: expect.any(String),
    }),
  );

  expect(job.id.trim()).not.toBe('');
  expect(job.title.trim()).not.toBe('');
  expectNoSensitiveFields(job);
}

function expectListingResponse(response, maxItems) {
  expectJsonResponse(response);

  expect(response.body).toEqual(
    expect.objectContaining({
      success: true,
      data: expect.any(Array),
    }),
  );

  if (Number.isInteger(maxItems)) {
    expect(response.body.data.length).toBeLessThanOrEqual(
      maxItems,
    );
  }

  for (const job of response.body.data) {
    expectJobShape(job);
  }
}

function expectSafeError(response, allowedStatuses) {
  expect(allowedStatuses).toContain(response.status);
  expectSafeResponse(response);
}

function getJobPayload(body) {
  const payload = body?.data ?? body;

  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    payload.job &&
    typeof payload.job === 'object'
  ) {
    return payload.job;
  }

  return payload;
}

describe('MedOrbits Jobs API', () => {
  beforeAll(() => {
    expect(typeof app).toBe('function');
    expect(Number.isInteger(configuredMax)).toBe(true);
    expect(configuredMax).toBeGreaterThan(0);
  });

  describe('GET /api/jobs', () => {
    test('returns a valid job listing response', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectListingResponse(response);
      expectSafeResponse(response);
    });

    test('supports pagination', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ page: 1, limit: 10 })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectListingResponse(response, 10);
      expectSafeResponse(response);
    });

    test.each([
      ['page', '0'],
      ['page', '-1'],
      ['page', 'invalid'],
      ['page', '1.5'],
      ['limit', '0'],
      ['limit', '-1'],
      ['limit', 'invalid'],
      ['limit', '1.5'],
    ])(
      'validates invalid pagination parameter %s=%s',
      async (key, value) => {
        const response = await request(app)
          .get(baseUrl)
          .query({ [key]: value })
          .set('Accept', 'application/json');

        expect([400, 422]).toContain(response.status);
        expectJsonResponse(response);
        expectSafeResponse(response);
      },
    );

    test('rejects a page size above the configured maximum', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          page: 1,
          limit: configuredMax + 1,
        })
        .set('Accept', 'application/json');

      expect([400, 422]).toContain(response.status);
      expectJsonResponse(response);
      expectSafeResponse(response);
    });
  });

  describe('Job search and filtering', () => {
    test.each([
      ['search', 'software engineer'],
      ['keyword', 'developer'],
      ['location', 'Noida'],
      ['category', 'technology'],
      ['employmentType', 'full-time'],
      ['workMode', 'remote'],
    ])(
      'handles the %s filter safely',
      async (key, value) => {
        const response = await request(app)
          .get(baseUrl)
          .query({ [key]: value })
          .set('Accept', 'application/json');

        expect(response.status).toBe(200);
        expectListingResponse(response);
        expectSafeResponse(response);
      },
    );

    test('handles combined search filters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          search: 'medical',
          location: 'India',
          category: 'healthcare',
          page: 1,
          limit: 10,
        })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectListingResponse(response, 10);
      expectSafeResponse(response);
    });

    test('handles SQL injection-like search input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ search: "' OR 1=1 --" })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectListingResponse(response);
      expectSafeResponse(response);
    });

    test('handles script-like search input without returning HTML', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ search: '<script>alert(1)</script>' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectListingResponse(response);
      expectSafeResponse(response);
    });

    test('ignores or safely rejects unexpected privilege parameters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          isAdmin: 'true',
          role: 'admin',
          status: 'approved',
        })
        .set('Accept', 'application/json');

      expect([200, 400, 422]).toContain(response.status);
      expectSafeResponse(response);

      if (response.status === 200) {
        expectListingResponse(response);
      } else {
        expectJsonResponse(response);
      }
    });
  });

  describe('GET /api/jobs/:id', () => {
    test('returns a JSON not-found response for an unknown job ID', async () => {
      const response = await request(app)
        .get(`${baseUrl}/JOB-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expect([404, 422]).toContain(response.status);
      expectJsonResponse(response);
      expectSafeResponse(response);
    });

    test('handles a malformed job ID safely', async () => {
      const response = await request(app)
        .get(`${baseUrl}/%00invalid`)
        .set('Accept', 'application/json');

      expect([400, 404, 422]).toContain(response.status);
      expectSafeResponse(response);
    });

    test('does not disclose internal fields in job details', async () => {
      const response = await request(app)
        .get(`${baseUrl}/JOB-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      if (response.status === 200) {
        expectJsonResponse(response);
        expectJobShape(getJobPayload(response.body));
      } else {
        expect([404, 422]).toContain(response.status);
      }
    });
  });

  describe('Job creation and mass-assignment protection', () => {
    test('rejects an empty job creation request', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({});

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });

    test('does not allow unauthenticated callers to assign privileged fields', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({
          title: 'Test Job',
          companyName: 'Test Company',
          ownerId: 'ADMIN-USER-ID',
          createdBy: 'ADMIN-USER-ID',
          isAdmin: true,
          isVerified: true,
          isFeatured: true,
          status: 'approved',
          moderationStatus: 'approved',
        });

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });

    test('does not permit unauthorized job creation', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({
          title: 'Unauthorized Test Job',
          description: 'This record must not bypass access controls.',
          employmentType: 'full-time',
          location: 'Noida',
        });

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });
  });

  describe('Job update and deletion', () => {
    test('rejects unauthorized updates to an unknown job', async () => {
      const response = await request(app)
        .patch(`${baseUrl}/JOB-DOES-NOT-EXIST`)
        .set('Accept', 'application/json')
        .send({
          status: 'approved',
          isFeatured: true,
          ownerId: 'ADMIN-USER-ID',
        });

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });

    test('rejects unauthorized deletion of an unknown job', async () => {
      const response = await request(app)
        .delete(`${baseUrl}/JOB-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });

    test('does not allow arbitrary user IDs to grant ownership', async () => {
      const response = await request(app)
        .patch(`${baseUrl}/JOB-DOES-NOT-EXIST`)
        .set('Accept', 'application/json')
        .send({
          ownerId: 'ANOTHER-USER-ID',
          createdBy: 'ANOTHER-USER-ID',
          userId: 'ADMIN-USER-ID',
        });

      expect(response.status).toBeLessThan(500);
      expectSafeResponse(response);
    });
  });

  describe('HTTP method and error handling', () => {
    test('handles unsupported collection methods safely', async () => {
      const response = await request(app)
        .put(baseUrl)
        .set('Accept', 'application/json')
        .send({ isAdmin: true });

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);

      expectSafeResponse(response);
    });

    test('does not expose stack traces for missing jobs', async () => {
      const response = await request(app)
        .get(`${baseUrl}/JOB-DOES-NOT-EXIST`)
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

    test('does not expose database connection errors to clients', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expectSafeResponse(response);
    });
  });
});
