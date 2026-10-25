
'use strict';

const express = require('express');
const request = require('supertest');
const publicDataRoutes = require('../../src/routes/public-data.routes');

const baseUrl = '/api/v1/public-data';

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(baseUrl, publicDataRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found.',
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
        code:
          status === 500
            ? 'INTERNAL_ERROR'
            : error.code || 'REQUEST_ERROR',
        message:
          status === 500
            ? 'An internal server error occurred.'
            : error.expose === false
              ? 'Request could not be processed.'
              : error.message || 'Request could not be processed.',
      },
    });
  });

  return app;
}

function expectJsonResponse(response) {
  expect(response.headers['content-type']).toMatch(
    /application\/json/i,
  );
  expect(response.body).toEqual(expect.any(Object));
  expect(response.body).not.toBeNull();
}

function expectSafeError(response) {
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

  const text = JSON.stringify(response.body);

  for (const pattern of [
    /stack trace/i,
    /node_modules[\\/]/i,
    /\bDATABASE_URL\s*=/i,
    /\bSESSION_SECRET\s*=/i,
    /\bAI_API_KEY\s*=/i,
    /\bpassword_hash\b/i,
    /\bprivate_key\b/i,
    /\bECONNREFUSED\b/i,
    /mysql:\/\//i,
    /postgres(?:ql)?:\/\//i,
  ]) {
    expect(text).not.toMatch(pattern);
  }
}

describe('Public data API', () => {
  describe('GET /universities', () => {
    test('serves the canonical public university snapshot', async () => {
      const response = await request(createApp())
        .get(`${baseUrl}/universities`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectJsonResponse(response);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
          updatedAt: expect.anything(),
        }),
      );

      expect(response.body.data.universities).toEqual(
        expect.any(Array),
      );
      expect(
        response.body.data.universities.length,
      ).toBeGreaterThan(0);
      expect(response.body.updatedAt).toBeTruthy();

      for (const university of response.body.data.universities) {
        expect(university).toEqual(expect.any(Object));

        const serialized = JSON.stringify(university);

        expect(serialized).not.toMatch(
          /password_hash|private_key|DATABASE_URL|SESSION_SECRET|AI_API_KEY/i,
        );
      }
    });

    test('returns a consistent response on repeated requests', async () => {
      const [first, second] = await Promise.all([
        request(createApp())
          .get(`${baseUrl}/universities`)
          .set('Accept', 'application/json'),

        request(createApp())
          .get(`${baseUrl}/universities`)
          .set('Accept', 'application/json'),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      expectJsonResponse(first);
      expectJsonResponse(second);

      expect(first.body.success).toBe(true);
      expect(second.body.success).toBe(true);

      expect(first.body.data.universities).toEqual(
        expect.any(Array),
      );
      expect(second.body.data.universities).toEqual(
        expect.any(Array),
      );

      // Compare the dataset, not timestamps that may legitimately change.
      expect(second.body.data.universities).toEqual(
        first.body.data.universities,
      );
    });

    test('does not expose internal server or filesystem details', async () => {
      const response = await request(createApp())
        .get(`${baseUrl}/universities`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expectJsonResponse(response);

      const text = JSON.stringify(response.body);

      expect(text).not.toMatch(/node_modules[\\/]/i);
      expect(text).not.toMatch(/process\.env/i);
      expect(text).not.toMatch(
        /\/(?:home|root|var|opt)\/[^"\s]+/i,
      );
    });
  });

  describe('Dataset path validation', () => {
    test('returns a structured 404 for an unknown dataset', async () => {
      const response = await request(createApp())
        .get(`${baseUrl}/server`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expectSafeError(response);
      expect(response.body.error.code).toBe(
        'PUBLIC_DATASET_NOT_FOUND',
      );
    });

    test.each([
      '../server.js',
      '..%2Fserver.js',
      '%2e%2e%2fserver.js',
      '%2e%2e%5cserver.js',
      'package.json',
      '.env',
    ])(
      'does not serve arbitrary path %s as a dataset',
      async (datasetPath) => {
        const response = await request(createApp())
          .get(`${baseUrl}/${datasetPath}`)
          .set('Accept', 'application/json');

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expectSafeError(response);
      },
    );

    test('does not expose files through encoded traversal attempts', async () => {
      const response = await request(createApp())
        .get(`${baseUrl}/%2e%2e%2f.env`)
        .set('Accept', 'application/json');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expectSafeError(response);
    });
  });

  describe('HTTP method handling', () => {
    test('does not allow POST to modify the public dataset endpoint', async () => {
      const response = await request(createApp())
        .post(`${baseUrl}/universities`)
        .set('Accept', 'application/json')
        .send({
          universities: [
            {
              id: 'FORGED-001',
              name: 'Forged University',
            },
          ],
        });

      expect([404, 405]).toContain(response.status);
      expectSafeError(response);
    });

    test('handles HEAD requests without an internal server error', async () => {
      const response = await request(createApp())
        .head(`${baseUrl}/universities`)
        .set('Accept', 'application/json');

      expect(response.status).toBeLessThan(500);
    });
  });
});
