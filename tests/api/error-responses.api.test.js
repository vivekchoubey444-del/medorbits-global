
'use strict';

const request = require('supertest');
const app = require('../../src/app');

const jsonContentType = /application\/json/i;

const sensitiveResponsePatterns = [
  /stack trace/i,
  /node_modules[\\/]/i,
  /\bsqlstate\b/i,
  /\bdatabase_url\b/i,
  /\bpassword_hash\b/i,
  /\bpasswordhash\b/i,
  /\bprivate_key\b/i,
  /\bsecret_access_key\b/i,
  /\bBEGIN\s+(?:RSA|OPENSSH|EC)\s+PRIVATE KEY\b/i,
  /\bER_ACCESS_DENIED_ERROR\b/i,
  /\bECONNREFUSED\b/i,
  /\bDATABASE_URL\s*=/i,
  /\bSESSION_SECRET\s*=/i,
  /\bAI_API_KEY\s*=/i,
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

function expectSafeErrorResponse(response) {
  const text = responseText(response);

  for (const pattern of sensitiveResponsePatterns) {
    expect(text).not.toMatch(pattern);
  }
}

function expectJsonErrorResponse(response) {
  expect(response.headers['content-type']).toMatch(
    jsonContentType,
  );

  expect(response.body).toEqual(expect.any(Object));
  expect(response.body).not.toBeNull();
  expect(Array.isArray(response.body)).toBe(false);
}

function expectClientError(
  response,
  allowedStatuses = [400, 404, 405, 415, 422],
) {
  expect(allowedStatuses).toContain(response.status);
  expectSafeErrorResponse(response);
}

function expectNoServerError(response) {
  expect(response.status).toBeLessThan(500);
  expectSafeErrorResponse(response);
}

describe('MedOrbits API error responses', () => {
  describe('Unknown routes', () => {
    test('returns a safe 404 for an unknown API endpoint', async () => {
      const response = await request(app)
        .get('/api/this-endpoint-does-not-exist')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });

    test('handles unknown nested API routes safely', async () => {
      const response = await request(app)
        .get('/api/unknown/resource/123')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });

    test('returns a safe error for unknown routes regardless of HTTP method', async () => {
      const response = await request(app)
        .post('/api/unknown-method-test')
        .set('Accept', 'application/json')
        .send({ test: true });

      expect(response.status).toBe(404);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });
  });

  describe('Malformed requests', () => {
    test('returns a client error for malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send('{"email":');

      expectClientError(response, [400, 404, 405, 415, 422]);

      if (![404, 405].includes(response.status)) {
        expectJsonErrorResponse(response);
      }
    });

    test('handles unsupported content types safely', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .set('Content-Type', 'text/plain')
        .send('not-json');

      expectClientError(response, [400, 404, 405, 415, 422]);
    });

    test('handles empty JSON input safely', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({});

      expectClientError(response, [400, 404, 405, 422]);
    });

    test('handles invalid URL encoding without an internal server error', async () => {
      const response = await request(app)
        .get('/api/courses/%E0%A4%A')
        .set('Accept', 'application/json');

      expectNoServerError(response);
    });

    test('handles null-byte path input safely', async () => {
      const response = await request(app)
        .get('/api/documents/%00invalid')
        .set('Accept', 'application/json');

      expectNoServerError(response);
    });
  });

  describe('Validation errors', () => {
    test('rejects login requests with required fields missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({});

      expectClientError(response, [400, 404, 405, 422]);

      if (![404, 405].includes(response.status)) {
        expectJsonErrorResponse(response);
      }
    });

    test('handles invalid pagination without an internal server error', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Accept', 'application/json')
        .query({
          page: 'invalid',
          limit: '-1',
        });

      expectNoServerError(response);
    });

    test('handles unexpected query parameters safely', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Accept', 'application/json')
        .query({
          unexpectedField: 'unexpected-value',
          isAdmin: 'true',
          role: 'admin',
        });

      expectNoServerError(response);
    });

    test('handles SQL injection-like input without an internal server error', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Accept', 'application/json')
        .query({
          search: "' OR 1=1 --",
        });

      expectNoServerError(response);
    });

    test('handles script-like input without returning an HTML error page', async () => {
      const response = await request(app)
        .get('/api/courses')
        .set('Accept', 'application/json')
        .query({
          search: '<script>alert(1)</script>',
        });

      expectNoServerError(response);

      if (response.status >= 400) {
        expectJsonErrorResponse(response);
      }
    });
  });

  describe('Authentication and authorization errors', () => {
    test('rejects missing authentication on a protected endpoint', async () => {
      const response = await request(app)
        .get('/api/applications')
        .set('Accept', 'application/json');

      expect([401, 403]).toContain(response.status);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });

    test('rejects invalid bearer credentials', async () => {
      const response = await request(app)
        .get('/api/applications')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer invalid.test.token');

      expect([401, 403]).toContain(response.status);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });

    test('does not disclose credential details in authentication errors', async () => {
      const email = 'nonexistent-user@example.invalid';
      const password = 'InvalidTestPassword123!';

      const response = await request(app)
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email, password });

      expect(response.status).toBeLessThan(500);
      expectSafeErrorResponse(response);

      const text = responseText(response);

      expect(text).not.toContain(password);
      expect(text).not.toMatch(/password_hash/i);
      expect(text).not.toMatch(/invalid password for .*@/i);

      if (response.status >= 400) {
        expectJsonErrorResponse(response);
      }
    });
  });

  describe('HTTP method handling', () => {
    test('rejects deletion through the read-only courses endpoint', async () => {
      const response = await request(app)
        .delete('/api/courses')
        .set('Accept', 'application/json');

      expect([401, 403, 404, 405]).toContain(response.status);
      expectSafeErrorResponse(response);
    });

    test('handles unsupported document update methods safely', async () => {
      const response = await request(app)
        .put('/api/documents/DOCUMENT-DOES-NOT-EXIST')
        .set('Accept', 'application/json')
        .send({
          status: 'approved',
          isAdmin: true,
        });

      expect([400, 401, 403, 404, 405, 422]).toContain(
        response.status,
      );

      expectSafeErrorResponse(response);
    });
  });

  describe('Error response consistency', () => {
    test.each([
      '/api/this-endpoint-does-not-exist',
      '/api/unknown/resource/123',
    ])(
      'returns a JSON 404 for unknown endpoint %s',
      async (url) => {
        const response = await request(app)
          .get(url)
          .set('Accept', 'application/json');

        expect(response.status).toBe(404);
        expectJsonErrorResponse(response);
        expectSafeErrorResponse(response);
      },
    );

    test('does not expose environment variables in error responses', async () => {
      const response = await request(app)
        .get('/api/this-endpoint-does-not-exist')
        .set('Accept', 'application/json');

      expectSafeErrorResponse(response);

      const text = responseText(response);

      expect(text).not.toMatch(/process\.env/i);
      expect(text).not.toMatch(/DATABASE_URL\s*=/i);
      expect(text).not.toMatch(/SESSION_SECRET\s*=/i);
      expect(text).not.toMatch(/AI_API_KEY\s*=/i);
    });

    test('does not return raw database errors to clients', async () => {
      const response = await request(app)
        .get('/api/courses/COURSE-DOES-NOT-EXIST')
        .set('Accept', 'application/json');

      expectNoServerError(response);
    });

    test('returns JSON for unknown API routes when JSON is requested', async () => {
      const response = await request(app)
        .get('/api/this-endpoint-does-not-exist')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expectJsonErrorResponse(response);
      expectSafeErrorResponse(response);
    });
  });
});
