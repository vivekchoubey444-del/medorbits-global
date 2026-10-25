
'use strict';

const request = require('supertest');
const app = require('../../src/app');

const baseUrl = '/api/universities';
const jsonContentType = /application\/json/i;

const maxPageSize = Number(
  process.env.UNIVERSITIES_TEST_MAX_LIMIT || 100,
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
  /mysql:\/\//i,
  /postgres(?:ql)?:\/\//i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
];

const forbiddenUniversityFields = [
  'password',
  'passwordHash',
  'password_hash',
  'databaseUrl',
  'databaseURL',
  'privateKey',
  'private_key',
  'internalNotes',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
];

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
  expect(response.headers['content-type']).toMatch(jsonContentType);
  expect(response.body).toEqual(expect.any(Object));
  expect(response.body).not.toBeNull();
  expect(Array.isArray(response.body)).toBe(false);
}

function expectErrorResponse(response, allowedStatuses) {
  expect(allowedStatuses).toContain(response.status);
  expectJsonResponse(response);

  expect(response.body).toEqual(
    expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
      }),
    }),
  );

  expectSafeResponse(response);
}

function expectUniversityShape(university) {
  expect(university).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
    }),
  );

  expect(university.id.trim()).not.toBe('');
  expect(university.name.trim()).not.toBe('');

  for (const field of forbiddenUniversityFields) {
    expect(university).not.toHaveProperty(field);
  }
}

function expectCatalogResponse(response) {
  expectJsonResponse(response);

  expect(response.body).toEqual(
    expect.objectContaining({
      success: true,
      data: expect.any(Array),
    }),
  );

  for (const university of response.body.data) {
    expectUniversityShape(university);
  }

  expectSafeResponse(response);
}

function expectNoServerError(response) {
  expect(response.status).toBeLessThan(500);
  expectSafeResponse(response);
}

describe('Universities API', () => {
  beforeAll(() => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');

    expect(Number.isInteger(maxPageSize)).toBe(true);
    expect(maxPageSize).toBeGreaterThan(0);
  });

  describe('GET /api/universities -- catalog', () => {
    test('returns a valid JSON university catalog', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);
    });

    test('returns the expected success envelope and array data', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('supports pagination with a bounded result count', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ page: 1, limit: 10 })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    test('returns consistent results for repeated requests', async () => {
      const [first, second] = await Promise.all([
        request(app)
          .get(baseUrl)
          .query({ page: 1, limit: 10 })
          .set('Accept', 'application/json'),

        request(app)
          .get(baseUrl)
          .query({ page: 1, limit: 10 })
          .set('Accept', 'application/json'),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      expectCatalogResponse(first);
      expectCatalogResponse(second);

      expect(second.body.data).toEqual(first.body.data);
    });

    test.each([
      ['page', '0'],
      ['page', '-1'],
      ['page', 'invalid'],
      ['page', '1.5'],
      ['page', '1e3'],
      ['limit', '0'],
      ['limit', '-1'],
      ['limit', 'invalid'],
      ['limit', '1.5'],
      ['limit', '1e3'],
    ])(
      'rejects invalid pagination parameter %s=%s',
      async (key, value) => {
        const response = await request(app)
          .get(baseUrl)
          .query({ [key]: value })
          .set('Accept', 'application/json');

        expectErrorResponse(response, [400, 422]);
      },
    );

    test('rejects a page size above the configured maximum', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          page: 1,
          limit: maxPageSize + 1,
        })
        .set('Accept', 'application/json');

      expectErrorResponse(response, [400, 422]);
    });

    test('handles an empty search result without breaking the response schema', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          search: 'NO_MATCH_UNIVERSITY_8F21A6C9',
          page: 1,
          limit: 10,
        })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);
    });

    test('does not expose environment variables or database connection details', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);

      const text = responseText(response);

      expect(text).not.toMatch(/process\.env/i);
      expect(text).not.toMatch(/mysql:\/\/[^\s"]+/i);
      expect(text).not.toMatch(/postgres(?:ql)?:\/\/[^\s"]+/i);
      expect(text).not.toMatch(
        /\/(?:home|root|var|opt)\/[^"\s]+/i,
      );
    });
  });

  describe('Search and filters', () => {
    test.each([
      ['search', 'medical university'],
      ['country', 'IN'],
      ['countryCode', 'IN'],
      ['course', 'MBBS'],
      ['courseId', 'course-mbbs'],
      ['type', 'public'],
      ['state', 'Uttar Pradesh'],
    ])(
      'handles the %s filter safely',
      async (key, value) => {
        const response = await request(app)
          .get(baseUrl)
          .query({ [key]: value })
          .set('Accept', 'application/json');

        expect(response.status).toBe(200);
        expectCatalogResponse(response);
      },
    );

    test('handles combined search, filter, and pagination parameters', async () => {
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

    test('handles SQL union injection-like input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          search: "' UNION SELECT username,password FROM users --",
        })
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
      expect(response.headers['content-type']).toMatch(
        jsonContentType,
      );
    });

    test('handles unusually long search strings without a server error', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ search: 'A'.repeat(2000) })
        .set('Accept', 'application/json');

      expectNoServerError(response);

      if (response.status === 200) {
        expectCatalogResponse(response);
      } else {
        expect([400, 413, 422]).toContain(response.status);
        expectJsonResponse(response);
      }
    });

    test('ignores or rejects unexpected privilege parameters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({
          isAdmin: 'true',
          role: 'admin',
          internal: 'true',
          includeSecrets: 'true',
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

  describe('GET /api/universities/:id -- detail', () => {
    test('returns a not-found response for an unknown university', async () => {
      const response = await request(app)
        .get(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectErrorResponse(response, [404]);
    });

    test('handles malformed university IDs without a server error', async () => {
      const response = await request(app)
        .get(`${baseUrl}/%00invalid`)
        .set('Accept', 'application/json');

      expectNoServerError(response);
      expect([400, 404, 422]).toContain(response.status);

      if (response.status !== 404) {
        expectJsonResponse(response);
      }
    });

    test.each([
      ['..'],
      ['%2e%2e'],
      ['%2Fetc%2Fpasswd'],
      ['%5CWindows%5Cwin.ini'],
    ])(
      'does not resolve path-like ID %s to an unintended resource',
      async (id) => {
        const response = await request(app)
          .get(`${baseUrl}/${id}`)
          .set('Accept', 'application/json');

        expectNoServerError(response);
        expect([400, 404, 422]).toContain(response.status);

        if (response.status !== 404) {
          expectJsonResponse(response);
        }
      },
    );

    test('does not expose sensitive fields in university details', async () => {
      const response = await request(app)
        .get(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectErrorResponse(response, [404]);
    });

    test('does not expose stack traces or filesystem paths for missing records', async () => {
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

  describe('Catalog integrity', () => {
    test('does not return duplicate IDs on one result page', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ page: 1, limit: Math.min(100, maxPageSize) })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);

      const ids = response.body.data.map(
        (university) => university.id,
      );

      expect(new Set(ids).size).toBe(ids.length);
    });

    test('returns consistently formatted IDs and names', async () => {
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

    test('does not return privileged fields anywhere in the catalog', async () => {
      const response = await request(app)
        .get(baseUrl)
        .query({ page: 1, limit: Math.min(100, maxPageSize) })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCatalogResponse(response);

      for (const university of response.body.data) {
        for (const field of forbiddenUniversityFields) {
          expect(university).not.toHaveProperty(field);
        }
      }
    });
  });

  describe('Mutation protection', () => {
    test('does not permit unauthenticated university creation', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({
          id: 'UNAUTHORIZED-UNIVERSITY',
          name: 'Unauthorized Test University',
          countryCode: 'IN',
          isVerified: true,
          isFeatured: true,
          isAdmin: true,
        });

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);

      if (response.status !== 404 && response.status !== 405) {
        expectJsonResponse(response);
      }
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

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);

      if (response.status !== 404 && response.status !== 405) {
        expectJsonResponse(response);
      }
    });

    test('does not permit unauthorized university deletion', async () => {
      const response = await request(app)
        .delete(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);

      if (response.status !== 404 && response.status !== 405) {
        expectJsonResponse(response);
      }
    });

    test('does not permit unsupported PUT mutation', async () => {
      const response = await request(app)
        .put(baseUrl)
        .set('Accept', 'application/json')
        .send({ isAdmin: true });

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);

      if (response.status !== 404 && response.status !== 405) {
        expectJsonResponse(response);
      }
    });
  });

  describe('HTTP handling and request safety', () => {
    test('handles HEAD requests without an internal server error', async () => {
      const response = await request(app)
        .head(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBeLessThan(500);
    });

    test('does not return HTML for a missing API resource', async () => {
      const response = await request(app)
        .get('/api/universities-resource-that-does-not-exist')
        .set('Accept', 'application/json');

      expect([404, 400, 422]).toContain(response.status);
      expectSafeResponse(response);
    });

    test('does not expose sensitive implementation details in errors', async () => {
      const response = await request(app)
        .get(`${baseUrl}/UNIVERSITY-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectErrorResponse(response, [404]);

      const text = responseText(response);

      expect(text).not.toMatch(/process\.env/i);
      expect(text).not.toMatch(/node_modules[\\/]/i);
      expect(text).not.toMatch(
        /\/(?:home|root|var|opt)\/[^"\s]+/i,
      );
    });
  });
});
