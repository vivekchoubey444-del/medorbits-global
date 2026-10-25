
'use strict';

const request = require('supertest');
const app = require('../../src/app');

const baseUrl = '/api/documents';
const jsonContentType = /application\/json/i;

const configuredMax = Number(
  process.env.DOCUMENTS_TEST_MAX_LIMIT || 100,
);

const sensitiveResponsePatterns = [
  /stack trace/i,
  /node_modules[\\/]/i,
  /\bsqlstate\b/i,
  /\bDATABASE_URL\s*=/i,
  /\bSESSION_SECRET\s*=/i,
  /\bAI_API_KEY\s*=/i,
  /\bpassword_hash\b/i,
  /\bpasswordHash\b/i,
  /\bprivate_key\b/i,
  /\baccess_token\b/i,
  /\brefresh_token\b/i,
  /mysql:\/\//i,
  /postgres(?:ql)?:\/\//i,
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
  'storagepath',
  'storage_path',
  'absolutepath',
  'absolute_path',
  'databaseurl',
  'database_url',
  'sessionsecret',
  'session_secret',
  'aiapikey',
  'ai_api_key',
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

function expectDocumentShape(document) {
  expect(document).toEqual(
    expect.objectContaining({
      id: expect.any(String),
    }),
  );

  expect(document.id.trim()).not.toBe('');
  expectNoSensitiveFields(document);
}

function expectSafeErrorStatus(response, acceptedStatuses) {
  expect(acceptedStatuses).toContain(response.status);
  expectSafeResponse(response);
}

function expectDocumentListResponse(response, maxItems) {
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

  for (const document of response.body.data) {
    expectDocumentShape(document);
  }
}

function getDocumentPayload(body) {
  const payload = body?.data ?? body;

  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    payload.document &&
    typeof payload.document === 'object'
  ) {
    return payload.document;
  }

  return payload;
}

describe('MedOrbits Documents API', () => {
  beforeAll(() => {
    expect(typeof app).toBe('function');
    expect(Number.isInteger(configuredMax)).toBe(true);
    expect(configuredMax).toBeGreaterThan(0);
  });

  describe('GET /api/documents', () => {
    test('returns a safe response for document listing', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      if (response.status === 200) {
        expectDocumentListResponse(response);
      } else {
        expect([401, 403]).toContain(response.status);
      }
    });

    test('handles valid pagination parameters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          page: 1,
          limit: 10,
        });

      expectSafeResponse(response);

      if (response.status === 200) {
        expectDocumentListResponse(response, 10);
      } else {
        expect([400, 401, 403, 422]).toContain(
          response.status,
        );
      }
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
      'validates invalid pagination: %s=%s',
      async (key, value) => {
        const response = await request(app)
          .get(baseUrl)
          .set('Accept', 'application/json')
          .query({
            [key]: value,
          });

        expectSafeResponse(response);

        if ([400, 422].includes(response.status)) {
          expectJsonResponse(response);
        } else if (response.status === 200) {
          expectDocumentListResponse(
            response,
            key === 'limit' ? configuredMax : undefined,
          );
        } else {
          expect([401, 403]).toContain(response.status);
        }
      },
    );

    test('handles limits above the configured maximum safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          page: 1,
          limit: configuredMax + 1,
        });

      expectSafeResponse(response);

      if ([400, 422].includes(response.status)) {
        expectJsonResponse(response);
      } else if (response.status === 200) {
        expectDocumentListResponse(response, configuredMax);
      } else {
        expect([401, 403]).toContain(response.status);
      }
    });

    test('handles document search safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: 'admission document',
        });

      expectSafeResponse(response);

      if (response.status === 200) {
        expectJsonResponse(response);
        expect(response.body.data).toEqual(expect.any(Array));

        for (const document of response.body.data) {
          expectDocumentShape(document);
        }
      } else {
        expect([400, 401, 403, 422]).toContain(
          response.status,
        );
      }
    });
  });

  describe('GET /api/documents/:id', () => {
    test('returns a safe error for an unknown document ID', async () => {
      const response = await request(app)
        .get(`${baseUrl}/DOCUMENT-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectSafeErrorStatus(
        response,
        [400, 401, 403, 404, 422],
      );

      if (![401, 403].includes(response.status)) {
        expectJsonResponse(response);
      }
    });

    test('handles a malformed document ID safely', async () => {
      const response = await request(app)
        .get(`${baseUrl}/%00invalid`)
        .set('Accept', 'application/json');

      expectSafeErrorStatus(
        response,
        [400, 401, 403, 404, 422],
      );
    });

    test('does not expose filesystem paths or internal document metadata', async () => {
      const response = await request(app)
        .get(`${baseUrl}/DOCUMENT-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      if (response.status === 200) {
        expectJsonResponse(response);

        const document = getDocumentPayload(response.body);
        expectDocumentShape(document);
      } else {
        expect([400, 401, 403, 404, 422]).toContain(
          response.status,
        );
      }
    });
  });

  describe('Document authorization', () => {
    test('does not expose private documents to unauthenticated callers', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      // This test assumes document listing is private.
      expect([401, 403]).toContain(response.status);
    });

    test('does not disclose another user’s document through an arbitrary ID', async () => {
      const response = await request(app)
        .get(`${baseUrl}/DOCUMENT-OWNED-BY-ANOTHER-USER`)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      expect([400, 401, 403, 404, 422]).toContain(
        response.status,
      );
    });

    test('does not grant administrative access through query parameters', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          role: 'admin',
          isAdmin: true,
          userRole: 'admin',
        });

      expectSafeResponse(response);

      // Assumes the endpoint requires authenticated access.
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Document upload', () => {
    test('does not accept an empty unauthenticated upload as successful', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json');

      expectSafeErrorStatus(
        response,
        [400, 401, 403, 404, 405, 415, 422],
      );
    });

    test('rejects an unsupported document MIME type', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .attach('file', Buffer.from('not a valid document'), {
          filename: 'malicious.exe',
          contentType: 'application/x-msdownload',
        });

      expectSafeResponse(response);

      // A protected route may reject the request before file validation.
      expect([
        400, 401, 403, 404, 405, 415, 422,
      ]).toContain(response.status);
    });

    test('does not trust a filename containing path traversal sequences', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), {
          filename: '../../private/secret.pdf',
          contentType: 'application/pdf',
        });

      expectSafeResponse(response);

      if ([200, 201].includes(response.status)) {
        expectJsonResponse(response);

        const document = getDocumentPayload(response.body);
        expectDocumentShape(document);

        expect(JSON.stringify(document)).not.toMatch(
          /(?:^|[\\/])\.\.(?:[\\/])/,
        );
      } else {
        expect([
          400, 401, 403, 404, 405, 415, 422,
        ]).toContain(response.status);
      }
    });

    test('does not trust client-supplied ownership or approval fields', async () => {
      const response = await request(app)
        .post(baseUrl)
        .set('Accept', 'application/json')
        .send({
          title: 'Test document',
          userId: 'ADMIN-USER-ID',
          ownerId: 'ADMIN-USER-ID',
          uploadedBy: 'ADMIN-USER-ID',
          approved: true,
          isVerified: true,
          status: 'approved',
          storagePath: '../../private/secret.pdf',
        });

      expectSafeResponse(response);

      if ([200, 201].includes(response.status)) {
        expectJsonResponse(response);

        const document = getDocumentPayload(response.body);

        expect(document.ownerId).not.toBe('ADMIN-USER-ID');
        expect(document.userId).not.toBe('ADMIN-USER-ID');
        expect(document.uploadedBy).not.toBe('ADMIN-USER-ID');
        expect(document.approved).not.toBe(true);
        expect(document.isVerified).not.toBe(true);
        expect(document.status).not.toBe('approved');

        expectNoSensitiveFields(document);
      } else {
        expect([
          400, 401, 403, 404, 405, 415, 422,
        ]).toContain(response.status);
      }
    });
  });

  describe('Document download', () => {
    test('does not allow downloading an unknown document', async () => {
      const response = await request(app)
        .get(`${baseUrl}/DOCUMENT-DOES-NOT-EXIST/download`)
        .set('Accept', 'application/json');

      expectSafeErrorStatus(
        response,
        [400, 401, 403, 404, 405, 422],
      );
    });

    test('does not allow access to paths outside document storage', async () => {
      const response = await request(app)
        .get(`${baseUrl}/..%2F..%2F.env/download`)
        .set('Accept', 'application/json');

      expectSafeResponse(response);

      if (response.status === 200) {
        expect(
          response.headers['content-disposition'] || '',
        ).not.toMatch(/\.env/i);

        expect(response.headers['content-type'] || '').not.toMatch(
          /text\/html/i,
        );

        expect(response.headers['content-type'] || '').not.toMatch(
          /application\/x-msdownload/i,
        );
      } else {
        expect([
          400, 401, 403, 404, 405, 422,
        ]).toContain(response.status);
      }
    });

    test('does not expose server stack traces for missing downloads', async () => {
      const response = await request(app)
        .get(`${baseUrl}/MISSING-DOCUMENT/download`)
        .set('Accept', 'application/json');

      expectSafeResponse(response);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('HTTP methods and input safety', () => {
    test('handles unsupported document update methods safely', async () => {
      const response = await request(app)
        .put(`${baseUrl}/DOCUMENT-DOES-NOT-EXIST`)
        .set('Accept', 'application/json')
        .send({
          ownerId: 'ADMIN-USER-ID',
          status: 'approved',
          isVerified: true,
        });

      expectSafeResponse(response);

      expect([
        400, 401, 403, 404, 405, 422,
      ]).toContain(response.status);
    });

    test('does not allow unauthenticated deletion of an arbitrary document', async () => {
      const response = await request(app)
        .delete(`${baseUrl}/DOCUMENT-DOES-NOT-EXIST`)
        .set('Accept', 'application/json');

      expectSafeErrorStatus(
        response,
        [400, 401, 403, 404, 405, 422],
      );
    });

    test('handles SQL injection-like search input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: "' OR 1=1 --",
        });

      expectSafeResponse(response);
      expect(response.status).toBeLessThan(500);

      if (response.status === 200) {
        expectJsonResponse(response);
        expect(response.body.data).toEqual(expect.any(Array));
      }
    });

    test('handles HTML and script-like search input safely', async () => {
      const response = await request(app)
        .get(baseUrl)
        .set('Accept', 'application/json')
        .query({
          search: '<script>alert(1)</script>',
        });

      expectSafeResponse(response);
      expect(response.status).toBeLessThan(500);

      if (response.status === 200) {
        expectJsonResponse(response);
        expect(response.body.data).toEqual(expect.any(Array));
      }
    });
  });
});
