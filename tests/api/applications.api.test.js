‘use strict’;

const request = require(‘supertest’);
const path = require(‘node:path’);
const { randomUUID } = require(‘node:crypto’);
const app = require(’../../src/app’);

const API_PREFIX = app.locals.apiPrefix || ‘/api’;
const baseUrl = ${API_PREFIX.replace(/\/+$/, '')}/applications;

const validApplication = {
courseId: ‘COURSE-001’,
collegeId: ‘COLLEGE-001’,
applicantName: ‘Test Applicant’,
applicantEmail: ‘applicant@example.com’,
notes: ‘Application security test’,
};

const authModulePath = process.env.MEDORBITS_TEST_AUTH_MODULE;
const isTestEnvironment =
process.env.NODE_ENV === ‘test’ ||
process.env.JEST_WORKER_ID !== undefined;

let authenticationAdapter;

if (authModulePath) {
if (!isTestEnvironment) {
throw new Error(
‘MEDORBITS_TEST_AUTH_MODULE must only be loaded in a test environment.’,
);
}

// Only load a trusted, repository-controlled test adapter.
const resolvedPath = path.resolve(authModulePath);
authenticationAdapter = require(resolvedPath);
}

function authorization(token) {
return Bearer ${token};
}

function applicationIdOf(application) {
return application?.id || application?.applicationId;
}

function responsePayload(response) {
return response.body?.data ?? response.body;
}

async function authenticateAsUser(userId, role = ‘user’) {
if (
!authenticationAdapter ||
typeof authenticationAdapter.authenticateAsUser !== ‘function’
) {
throw new Error(
’Configure MEDORBITS_TEST_AUTH_MODULE with a trusted test-only module ’ +
‘implementing authenticateAsUser(userId, role).’,
);
}

const identity = await authenticationAdapter.authenticateAsUser(userId, role);

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

async function createApplicationAs(owner, overrides = {}) {
const response = await request(app)
.post(baseUrl)
.set(‘Authorization’, authorization(owner.token))
.send({
…validApplication,
applicantEmail: applicant-${randomUUID()}@example.test,
…overrides,
});

expect([200, 201]).toContain(response.status);

const application = responsePayload(response);
const applicationId = applicationIdOf(application);

expect(applicationId).toBeTruthy();

return application;
}

function expectNoPrivilegeEscalation(application) {
expect(application).toBeDefined();

if (Object.hasOwn(application, ‘ownerId’)) {
expect(application.ownerId).not.toBe(‘another-user’);
}

if (Object.hasOwn(application, ‘userId’)) {
expect(application.userId).not.toBe(‘another-user’);
}

if (Object.hasOwn(application, ‘role’)) {
expect(application.role).not.toBe(‘admin’);
}

if (Object.hasOwn(application, ‘status’)) {
expect(application.status).not.toBe(‘approved’);
}
}

function expectValidationFailure(response) {
expect([400, 422]).toContain(response.status);
}

function applicationUrl(applicationId) {
return ${baseUrl}/${encodeURIComponent(applicationId)};
}

describe(‘Applications API security and validation’, () => {
beforeAll(() => {
expect(typeof app).toBe(‘function’);
expect(typeof baseUrl).toBe(‘string’);
expect(baseUrl.startsWith(’/’)).toBe(true);
});

describe(‘authentication’, () => {
test(‘requires authentication for private application endpoints’, async () => {
const endpoints = [
{ method: ‘get’, url: baseUrl },
{ method: ‘get’, url: ${baseUrl}/APP-001 },
{ method: ‘post’, url: baseUrl, body: validApplication },
{
method: ‘patch’,
url: ${baseUrl}/APP-001,
body: { notes: ‘Updated notes’ },
},
{ method: ‘delete’, url: ${baseUrl}/APP-001 },
];

  for (const endpoint of endpoints) {
    let operation = request(app)[endpoint.method](endpoint.url);
    if (endpoint.body) {
      operation = operation.send(endpoint.body);
    }
    const response = await operation;
    expect(
      [401, 403],
      `${endpoint.method.toUpperCase()} ${endpoint.url} should reject unauthenticated access; received ${response.status}`,
    ).toContain(response.status);
  }
});

});

describe(‘ownership and role permissions’, () => {
test(‘prevents one applicant from reading another applicant application’, async () => {
const owner = await authenticateAsUser(‘test-owner’, ‘user’);
const otherUser = await authenticateAsUser(‘test-other’, ‘user’);

  const application = await createApplicationAs(owner);
  const id = applicationIdOf(application);
  const response = await request(app)
    .get(applicationUrl(id))
    .set('Authorization', authorization(otherUser.token));
  expect([403, 404]).toContain(response.status);
});
test('prevents applicants from changing ownership or privileged fields', async () => {
  const owner = await authenticateAsUser('test-owner', 'user');
  const application = await createApplicationAs(owner);
  const id = applicationIdOf(application);
  const response = await request(app)
    .patch(applicationUrl(id))
    .set('Authorization', authorization(owner.token))
    .send({
      ownerId: 'another-user',
      userId: 'another-user',
      role: 'admin',
      status: 'approved',
    });
  if (response.status >= 200 && response.status < 300) {
    expectNoPrivilegeEscalation(responsePayload(response));
  } else {
    expect([400, 403, 404, 422]).toContain(response.status);
  }
  // Verify persisted state through the real API, not only the update response.
  const readBack = await request(app)
    .get(applicationUrl(id))
    .set('Authorization', authorization(owner.token));
  if (readBack.status === 200) {
    expectNoPrivilegeEscalation(responsePayload(readBack));
  } else {
    // A read failure must not silently be treated as proof of security.
    expect(readBack.status).toBe(200);
  }
});
test('restricts privileged status operations to authorized roles', async () => {
  const applicant = await authenticateAsUser('test-applicant', 'user');
  const response = await request(app)
    .patch(`${baseUrl}/APP-001/status`)
    .set('Authorization', authorization(applicant.token))
    .send({ status: 'approved' });
  expect([401, 403, 404, 405, 422]).toContain(response.status);
});
test('prevents an applicant from deleting another applicant application', async () => {
  const owner = await authenticateAsUser('delete-owner', 'user');
  const otherUser = await authenticateAsUser('delete-other', 'user');
  const application = await createApplicationAs(owner);
  const id = applicationIdOf(application);
  const response = await request(app)
    .delete(applicationUrl(id))
    .set('Authorization', authorization(otherUser.token));
  expect([403, 404]).toContain(response.status);
  // The owner should still be able to retrieve the record if the API
  // supports reads after a denied delete.
  const readBack = await request(app)
    .get(applicationUrl(id))
    .set('Authorization', authorization(owner.token));
  expect(readBack.status).toBe(200);
});

});

describe(‘payload validation’, () => {
test(‘rejects creation when required fields are missing’, async () => {
const user = await authenticateAsUser(‘validation-user’, ‘user’);

  const response = await request(app)
    .post(baseUrl)
    .set('Authorization', authorization(user.token))
    .send({});
  expectValidationFailure(response);
});
test('rejects malformed applicant email addresses', async () => {
  const user = await authenticateAsUser('invalid-email-user', 'user');
  const response = await request(app)
    .post(baseUrl)
    .set('Authorization', authorization(user.token))
    .send({
      ...validApplication,
      applicantEmail: 'not-an-email',
    });
  expectValidationFailure(response);
});
test('rejects invalid update payloads', async () => {
  const user = await authenticateAsUser('invalid-update-user', 'user');
  const application = await createApplicationAs(user);
  const id = applicationIdOf(application);
  const response = await request(app)
    .patch(applicationUrl(id))
    .set('Authorization', authorization(user.token))
    .send({
      applicantEmail: 'invalid-email',
    });
  expectValidationFailure(response);
});
test('rejects or safely ignores privileged fields during creation', async () => {
  const user = await authenticateAsUser('mass-assignment-user', 'user');
  const response = await request(app)
    .post(baseUrl)
    .set('Authorization', authorization(user.token))
    .send({
      ...validApplication,
      applicantEmail: `mass-assignment-${randomUUID()}@example.test`,
      ownerId: 'another-user',
      userId: 'another-user',
      role: 'admin',
      status: 'approved',
    });
  if (response.status >= 200 && response.status < 300) {
    expectNoPrivilegeEscalation(responsePayload(response));
  } else {
    expect([400, 403, 409, 422]).toContain(response.status);
  }
});
test('rejects unsupported application status values', async () => {
  const user = await authenticateAsUser('invalid-status-user', 'user');
  const application = await createApplicationAs(user);
  const id = applicationIdOf(application);
  const response = await request(app)
    .patch(applicationUrl(id))
    .set('Authorization', authorization(user.token))
    .send({
      status: 'arbitrary-unapproved-status',
    });
  if (response.status >= 200 && response.status < 300) {
    expect(responsePayload(response).status).not.toBe(
      'arbitrary-unapproved-status',
    );
  } else {
    expect([400, 403, 404, 422]).toContain(response.status);
  }
});

});

describe(‘response security’, () => {
test(‘does not expose authentication secrets in application responses’, async () => {
const user = await authenticateAsUser(‘response-security-user’, ‘user’);
const application = await createApplicationAs(user);
const id = applicationIdOf(application);

  const response = await request(app)
    .get(applicationUrl(id))
    .set('Authorization', authorization(user.token));
  expect(response.status).toBe(200);
  const body = responsePayload(response);
  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbiddenField of [
    '"password"',
    '"passwordhash"',
    '"password_hash"',
    '"accesstoken"',
    '"access_token"',
    '"refreshtoken"',
    '"refresh_token"',
    '"clientsecret"',
    '"client_secret"',
    '"privatekey"',
    '"private_key"',
  ]) {
    expect(serialized).not.toContain(forbiddenField);
  }
});

});
});