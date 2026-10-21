‘use strict’;

const request = require(‘supertest’);
const path = require(‘node:path’);
const app = require(’../../src/app’);

const baseUrl = ‘/api/users’;
const jsonContentType = /application/json/i;

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

const authModulePath = process.env.MEDORBITS_TEST_AUTH_MODULE;
const isTestEnvironment =
process.env.NODE_ENV === ‘test’ ||
process.env.JEST_WORKER_ID !== undefined;

let authenticationAdapter;

if (authModulePath) {
if (!isTestEnvironment) {
throw new Error(
‘MEDORBITS_TEST_AUTH_MODULE may only be loaded in a test environment.’,
);
}

// Only load a trusted, repository-controlled test adapter.
authenticationAdapter = require(path.resolve(authModulePath));
}

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

function responsePayload(response) {
return response.body?.data ?? response.body;
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

function expectSafeUserShape(user) {
expect(user).toEqual(
expect.objectContaining({
id: expect.any(String),
}),
);

for (const field of [
‘password’,
‘passwordHash’,
‘password_hash’,
‘resetToken’,
‘reset_token’,
‘refreshToken’,
‘refresh_token’,
‘accessToken’,
‘access_token’,
‘privateKey’,
‘private_key’,
‘mfaSecret’,
‘mfa_secret’,
‘secretAccessKey’,
‘clientSecret’,
]) {
expect(user).not.toHaveProperty(field);
}
}

async function authenticateAs(role, userId) {
if (
!isTestEnvironment ||
!authenticationAdapter ||
typeof authenticationAdapter.authenticateAsUser !== ‘function’
) {
throw new Error(
’Configure MEDORBITS_TEST_AUTH_MODULE with a trusted test-only module ’ +
’exporting authenticateAsUser(userId, role). The adapter must issue ’ +
‘tokens accepted by the real application authentication middleware.’,
);
}

const identity = await authenticationAdapter.authenticateAsUser(
userId,
role,
);

if (
!identity ||
typeof identity.token !== ‘string’ ||
identity.token.trim() === ‘’
) {
throw new Error(
‘The test authentication adapter must return a non-empty token.’,
);
}

return identity;
}

function userUrl(userId) {
return ${baseUrl}/${encodeURIComponent(userId)};
}

function expectNoServerError(response) {
expect(response.status).toBeLessThan(500);
expectSafeResponse(response);
}

describe(‘Users API security’, () => {
beforeAll(() => {
expect(typeof app).toBe(‘function’);
});

describe(‘Authentication requirements’, () => {
test.each([
[‘GET users’, ‘get’, baseUrl],
[‘GET profile’, ‘get’, userUrl(‘TEST-USER-001’)],
[‘PATCH profile’, ‘patch’, userUrl(‘TEST-USER-001’)],
[‘DELETE profile’, ‘delete’, userUrl(‘TEST-USER-001’)],
])(
‘rejects unauthenticated %s requests’,
async (_label, method, url) => {
let operation = request(app)method
.set(‘Accept’, ‘application/json’);

    if (method === 'patch') {
      operation = operation.send({
        displayName: 'Unauthenticated Update',
      });
    }
    const response = await operation;
    expect([401, 403]).toContain(response.status);
    expectSafeResponse(response);
  },
);

});

describe(‘GET /api/users’, () => {
test(‘does not expose the user directory to unauthenticated callers’, async () => {
const response = await request(app)
.get(baseUrl)
.set(‘Accept’, ‘application/json’);

  expect([401, 403]).toContain(response.status);
  expectSafeResponse(response);
});
test('restricts user-directory access to authorized roles', async () => {
  const user = await authenticateAs('user', 'test-regular-user');
  const response = await request(app)
    .get(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  // This endpoint is assumed to be administrative. If the application
  // intentionally exposes a public directory, define and test that
  // contract separately instead of weakening this assertion.
  expect([403, 404]).toContain(response.status);
  expectSafeResponse(response);
});

});

describe(‘GET /api/users/:id’, () => {
test(‘returns a safe error for a nonexistent user’, async () => {
const user = await authenticateAs(‘user’, ‘test-regular-user’);

  const response = await request(app)
    .get(userUrl('USER-DOES-NOT-EXIST'))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect([400, 403, 404, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('prevents access to another user’s private profile', async () => {
  const user = await authenticateAs('user', 'test-profile-other');
  const targetUserId = process.env.TEST_OTHER_USER_ID;
  if (!targetUserId) {
    throw new Error(
      'Set TEST_OTHER_USER_ID to the ID of a separate seeded test user.',
    );
  }
  const response = await request(app)
    .get(userUrl(targetUserId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  // This test assumes profiles are private by default.
  expect([403, 404]).toContain(response.status);
  expectSafeResponse(response);
});
test('handles malformed user IDs without exposing server errors', async () => {
  const user = await authenticateAs('user', 'test-regular-user');
  const response = await request(app)
    .get(`${baseUrl}/%00invalid`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expectNoServerError(response);
});

});

describe(‘Profile updates’, () => {
test(‘requires authentication to update a profile’, async () => {
const response = await request(app)
.patch(userUrl(‘TEST-USER-001’))
.set(‘Accept’, ‘application/json’)
.send({
displayName: ‘Unauthenticated Update’,
});

  expect([401, 403]).toContain(response.status);
  expectSafeResponse(response);
});
test('prevents a user from updating another user’s profile', async () => {
  const user = await authenticateAs('user', 'test-profile-other');
  const targetUserId = process.env.TEST_OTHER_USER_ID;
  if (!targetUserId) {
    throw new Error(
      'Set TEST_OTHER_USER_ID to the ID of a separate seeded test user.',
    );
  }
  const response = await request(app)
    .patch(userUrl(targetUserId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      displayName: 'Unauthorized Profile Change',
    });
  expect([403, 404]).toContain(response.status);
  expectSafeResponse(response);
});
test('rejects an invalid profile update payload', async () => {
  const user = await authenticateAs('user', 'test-profile-owner');
  const userId = user.userId;
  if (!userId) {
    throw new Error(
      'The authentication adapter must return userId for profile tests.',
    );
  }
  const response = await request(app)
    .patch(userUrl(userId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      email: 'not-an-email',
    });
  expect([400, 422]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not allow mass assignment of privileged fields', async () => {
  const user = await authenticateAs('user', 'test-profile-owner');
  if (!user.userId) {
    throw new Error(
      'The authentication adapter must return userId for profile tests.',
    );
  }
  const response = await request(app)
    .patch(userUrl(user.userId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      displayName: 'Test Profile',
      role: 'admin',
      isAdmin: true,
      isVerified: true,
      accountStatus: 'active',
      permissions: ['*'],
      userId: 'ADMIN-USER-ID',
    });
  expectSafeResponse(response);
  if (response.status >= 200 && response.status < 300) {
    const profile = responsePayload(response);
    expect(profile.role).not.toBe('admin');
    expect(profile.isAdmin).not.toBe(true);
    expect(profile.permissions).not.toEqual(['*']);
    expect(profile.userId).not.toBe('ADMIN-USER-ID');
  } else {
    expect([400, 403, 404, 422]).toContain(response.status);
  }
  // Verify that the attempted escalation was not persisted.
  const readBack = await request(app)
    .get(userUrl(user.userId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect(readBack.status).toBe(200);
  const persisted = responsePayload(readBack);
  expect(persisted.role).not.toBe('admin');
  expect(persisted.isAdmin).not.toBe(true);
  expect(persisted.permissions).not.toEqual(['*']);
});
test('does not allow a user to change their own role', async () => {
  const user = await authenticateAs('user', 'test-profile-owner');
  if (!user.userId) {
    throw new Error(
      'The authentication adapter must return userId for profile tests.',
    );
  }
  const response = await request(app)
    .patch(userUrl(user.userId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      role: 'admin',
      isAdmin: true,
    });
  expectSafeResponse(response);
  if (response.status >= 200 && response.status < 300) {
    const profile = responsePayload(response);
    expect(profile.role).not.toBe('admin');
    expect(profile.isAdmin).not.toBe(true);
  } else {
    expect([400, 403, 404, 422]).toContain(response.status);
  }
});

});

describe(‘User creation and registration’, () => {
test(‘does not allow unauthenticated creation of privileged user accounts’, async () => {
const response = await request(app)
.post(baseUrl)
.set(‘Accept’, ‘application/json’)
.send({
email: ‘unauthorized-user@example.invalid’,
role: ‘admin’,
isAdmin: true,
permissions: [’*’],
});

  expect([401, 403, 404, 405]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not accept client-supplied administrator privileges during registration', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Accept', 'application/json')
    .send({
      name: 'Test Registration',
      email: `security-test-${Date.now()}@example.invalid`,
      password: 'TestOnlyPassword123!',
      role: 'admin',
      isAdmin: true,
      permissions: ['*'],
    });
  expectSafeResponse(response);
  if (response.status === 200 || response.status === 201) {
    const payload = responsePayload(response);
    const registeredUser =
      payload?.user ?? payload?.data?.user ?? payload;
    expect(registeredUser.role).not.toBe('admin');
    expect(registeredUser.isAdmin).not.toBe(true);
    expect(registeredUser.permissions).not.toEqual(['*']);
    for (const field of [
      'password',
      'passwordHash',
      'password_hash',
      'refreshToken',
      'accessToken',
    ]) {
      expect(registeredUser).not.toHaveProperty(field);
    }
  } else {
    expect([400, 403, 404, 409, 422]).toContain(response.status);
  }
});

});

describe(‘User deletion’, () => {
test(‘does not permit unauthenticated deletion’, async () => {
const response = await request(app)
.delete(userUrl(‘USER-DOES-NOT-EXIST’))
.set(‘Accept’, ‘application/json’);

  expect([401, 403]).toContain(response.status);
  expectSafeResponse(response);
});
test('does not allow a regular user to delete another account', async () => {
  const user = await authenticateAs('user', 'test-regular-user');
  const targetUserId = process.env.TEST_OTHER_USER_ID;
  if (!targetUserId) {
    throw new Error(
      'Set TEST_OTHER_USER_ID to the ID of a separate seeded test user.',
    );
  }
  const response = await request(app)
    .delete(userUrl(targetUserId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect([403, 404, 405]).toContain(response.status);
  expectSafeResponse(response);
});

});

describe(‘Sensitive data and error handling’, () => {
test(‘does not expose password hashes or authentication secrets’, async () => {
const user = await authenticateAs(‘user’, ‘test-profile-owner’);

  if (!user.userId) {
    throw new Error(
      'The authentication adapter must return userId for profile tests.',
    );
  }
  const response = await request(app)
    .get(userUrl(user.userId))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect(response.status).toBe(200);
  expectJsonResponse(response);
  expectSafeResponse(response);
  expectSafeUserShape(responsePayload(response));
});
test('does not expose internal stack traces for missing users', async () => {
  const user = await authenticateAs('user', 'test-regular-user');
  const response = await request(app)
    .get(userUrl('USER-DOES-NOT-EXIST'))
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect([400, 403, 404, 422]).toContain(response.status);
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