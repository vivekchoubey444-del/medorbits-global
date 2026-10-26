
'use strict';

const request = require('supertest');
const app = require('../../src/app');

const baseUrl = '/api/courses';

const configuredMax = Number(
  process.env.COURSES_TEST_MAX_LIMIT || 100,
);

const sensitiveResponsePatterns = [
  /stack trace/i,
  /node_modules[\\/]/i,
  /\bsqlstate\b/i,
  /\bdatabase url\b/i,
  /\bpassword hash\b/i,
  /\bDATABASE_URL\s*=/i,
  /\bSESSION_SECRET\s*=/i,
  /\bAI_API_KEY\s*=/i,
  /mysql:\/\//i,
  /postgres:\/\//i,
  /postgresql:\/\//i,
];

function responseText(response) {
  if (typeof response.text === 'string') {
    return response.text;
  }

  return JSON.stringify(response.body ?? {});
}

function expectSafeResponse(response) {
  const text = responseText(response);

  for (const pattern of sensitiveResponsePatterns) {
    expect(text).not.toMatch(pattern);
  }
}

function expectJsonResponse(response) {
  expect(response.headers['content-type']).toMatch(
    /application\/json/i,
  );

  expect(response.body).toEqual(expect.any(Object));
  expect(response.body).not.toBeNull();
  expect(Array.isArray(response.body)).toBe(false);
}

function expectCourseListResponse(response) {
  expectJsonResponse(response);

  expect(response.body).toEqual(
    expect.objectContaining({
      success: expect.any(Boolean),
      data: expect.any(Array),
    }),
  );

  expect(response.body.success).toBe(true);

  for (const course of response.body.data) {
    expect(course).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
      }),
    );

    expect(course.id.trim()).not.toBe('');
    expect(course.name.trim()).not.toBe('');
  }
}

function expectInvalidInput(response) {
  expect([400, 422]).toContain(response.status);
  expectSafeResponse(response);
}

describe('MedOrbits Courses API', () => {
  beforeAll(() => {
    expect(typeof app).toBe('function');

    expect(Number.isInteger(configuredMax)).toBe(true);
    expect(configuredMax).toBeGreaterThan(0);
  });

  describe('course list response', () => {
    test('returns the documented course list response', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expectSafeResponse(response);
    });

    test('returns a success flag and array when the list is empty or populated', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
    });

    test('does not expose sensitive implementation details', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectSafeResponse(response);
    });

    test('returns unique course identifiers', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectCourseListResponse(response);

      const ids = response.body.data.map(
        (course) => course.id,
      );

      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('filters and pagination', () => {
    test('accepts valid pagination parameters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    test.each([
      ['page', '0'],
      ['page', '-1'],
      ['page', 'invalid'],
      ['page', '1.5'],
      ['limit', '0'],
      ['limit', '-5'],
      ['limit', 'invalid'],
      ['limit', '1.5'],
    ])(
      'rejects invalid %s parameter: %s',
      async (parameter, value) => {
        const response = await request(app)
          .get(baseUrl)
          .set('Accept', 'application/json')
          .query({
            page: 1,
            limit: 10,
            [parameter]: value,
          });

        expectInvalidInput(response);
      },
    );

    test('rejects pagination limits above the configured maximum', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          page: 1,
          limit: configuredMax + 1,
        });

      expectInvalidInput(response);
    });

    test('supports category, search, and pagination together', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          category: 'medical',
          search: 'medicine',
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
      expectSafeResponse(response);
    });

    test('handles an empty search query safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: '',
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expectSafeResponse(response);
    });

    test('handles SQL injection-like search input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: "' OR 1=1 --",
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expectSafeResponse(response);
    });

    test('handles HTML-like search input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: '<script>alert(1)</script>',
        });

      expect(response.status).toBe(200);
      expectCourseListResponse(response);
      expectSafeResponse(response);
    });
  });

  describe('course identifiers', () => {
    test('returns a safe not-found response for an unknown course', async () => {
      const response = await request(app)
        .get(`${baseUrl}/COURSE-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expect([400, 404, 422]).toContain(response.status);
      expectSafeResponse(response);
    });

    test('rejects malformed course identifiers safely', async () => {
      const response = await request(app)
        .get(`${baseUrl}/%00invalid`)
        .set('Accept', 'application/json');

      expect([400, 404, 422]).toContain(response.status);
      expectSafeResponse(response);
    });

    test('rejects encoded path traversal-like identifiers', async () => {
      const response = await request(app)
        .get(
          `${baseUrl}/${encodeURIComponent('../../etc/passwd')}`,
        )
        .set('Accept', 'application/json');

      expect([400, 404, 422]).toContain(response.status);
      expectSafeResponse(response);
    });
  });

  describe('HTTP method handling', () => {
    test('does not allow unauthorized course creation', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({
          id: 'COURSE-UNAUTHORIZED-TEST',
          name: 'Unauthorized Test Course',
        });

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);
    });

    test('does not allow unauthorized course deletion', async () => {
      const response = await request(app)
        .delete(`${baseUrl}/COURSE-001`)
        .set('Accept', 'application/json');

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeResponse(response);
    });
  });
});
