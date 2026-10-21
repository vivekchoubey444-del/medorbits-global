‘use strict’;

const request = require(‘supertest’);
const app = require(’../../src/app’);

const registerUrl = ‘/api/auth/register’;
const loginUrl = ‘/api/auth/login’;

const validRegistration = {
name: ‘Test Applicant’,
email: registration-${require('node:crypto').randomUUID()}@example.test,
password: ‘Test-Only-Password-91!x’,
};

const validLogin = {
email: process.env.AUTH_TEST_EXISTING_EMAIL || ‘existing-user@example.com’,
password: ‘Incorrect-Test-Password-91!x’,
};

function expectValidationFailure(response) {
expect([400, 422]).toContain(response.status);
}

function expectSafeAuthenticationError(response) {
expect([400, 401, 422]).toContain(response.status);

const serializedBody = JSON.stringify(response.body ?? {});
const normalizedBody = serializedBody.toLowerCase();

for (const pattern of [
/stack trace/i,
/password hash/i,
/database url/i,
/\bsqlstate\b/i,
/node_modules/i,
/\bSESSION_SECRET\s*=/i,
/\bAI_API_KEY\s*=/i,
]) {
expect(serializedBody).not.toMatch(pattern);
}

for (const sensitiveValue of [
validLogin.password,
validRegistration.password,
]) {
expect(serializedBody).not.toContain(sensitiveValue);
}

const forbiddenFields = [
‘"password"’,
‘"passwordhash"’,
‘"password_hash"’,
‘"accesstoken"’,
‘"access_token"’,
‘"refreshtoken"’,
‘"refresh_token"’,
‘"clientsecret"’,
‘"privatekey"’,
];

for (const field of forbiddenFields) {
expect(normalizedBody).not.toContain(field);
}
}

function expectNoToken(response) {
const body = response.body ?? {};
const payload = body.data ?? body;

for (const field of [
‘accessToken’,
‘access_token’,
‘refreshToken’,
‘refresh_token’,
]) {
expect(payload).not.toHaveProperty(field);
}
}

describe(‘MedOrbits Authentication API’, () => {
describe(‘registration validation’, () => {
test(‘rejects a registration payload with required fields missing’, async () => {
const response = await request(app)
.post(registerUrl)
.send({});

  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
});
test('rejects malformed email addresses', async () => {
  const response = await request(app)
    .post(registerUrl)
    .send({
      ...validRegistration,
      email: 'not-an-email',
    });
  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
});
test('rejects passwords that do not meet the configured policy', async () => {
  const response = await request(app)
    .post(registerUrl)
    .send({
      ...validRegistration,
      password: '123',
    });
  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
});
test('rejects registration with an invalid name', async () => {
  const response = await request(app)
    .post(registerUrl)
    .send({
      ...validRegistration,
      name: '',
    });
  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
});
test('does not expose submitted passwords in registration errors', async () => {
  const response = await request(app)
    .post(registerUrl)
    .send({
      ...validRegistration,
      email: 'invalid-email',
    });
  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
});

});

describe(‘login validation’, () => {
test(‘rejects a login payload with required fields missing’, async () => {
const response = await request(app)
.post(loginUrl)
.send({});

  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
  expectNoToken(response);
});
test('rejects malformed email addresses', async () => {
  const response = await request(app)
    .post(loginUrl)
    .send({
      email: 'invalid-email',
      password: validLogin.password,
    });
  expectValidationFailure(response);
  expectSafeAuthenticationError(response);
  expectNoToken(response);
});
test('returns a safe error for invalid credentials', async () => {
  const response = await request(app)
    .post(loginUrl)
    .send(validLogin);
  expectSafeAuthenticationError(response);
  expectNoToken(response);
});
test('does not return authentication tokens for invalid credentials', async () => {
  const response = await request(app)
    .post(loginUrl)
    .send(validLogin);
  expect([400, 401, 422]).toContain(response.status);
  expectNoToken(response);
  expectSafeAuthenticationError(response);
});
test('does not disclose whether an account exists', async () => {
  const existingAccountResponse = await request(app)
    .post(loginUrl)
    .send({
      email: validLogin.email,
      password: validLogin.password,
    });
  const nonexistentAccountResponse = await request(app)
    .post(loginUrl)
    .send({
      email: `missing-${require('node:crypto').randomUUID()}@example.test`,
      password: validLogin.password,
    });
  for (const response of [
    existingAccountResponse,
    nonexistentAccountResponse,
  ]) {
    expect([400, 401, 422]).toContain(response.status);
    expectSafeAuthenticationError(response);
    expectNoToken(response);
  }
  const existingMessage = existingAccountResponse.body?.message;
  const missingMessage = nonexistentAccountResponse.body?.message;
  if (
    typeof existingMessage === 'string' &&
    typeof missingMessage === 'string'
  ) {
    expect(existingMessage).toBe(missingMessage);
  }
});

});

describe(‘rate limiting’, () => {
test(‘applies rate limits to sensitive authentication routes’, async () => {
const configuredLimit = Number(
process.env.AUTH_TEST_RATE_LIMIT,
);

  if (
    !Number.isInteger(configuredLimit) ||
    configuredLimit < 1
  ) {
    throw new Error(
      'Set AUTH_TEST_RATE_LIMIT to the configured test limit.',
    );
  }
  const configuredWindowMs = Number(
    process.env.AUTH_TEST_RATE_LIMIT_WINDOW_MS || 60000,
  );
  if (
    !Number.isFinite(configuredWindowMs) ||
    configuredWindowMs <= 0
  ) {
    throw new Error(
      'AUTH_TEST_RATE_LIMIT_WINDOW_MS must be positive.',
    );
  }
  // A test-only IP or rate-limit key should be isolated from other
  // tests. Do not disable the production rate limiter to make this pass.
  const responses = [];
  for (
    let index = 0;
    index <= configuredLimit;
    index += 1
  ) {
    const response = await request(app)
      .post(loginUrl)
      .set('X-Rate-Limit-Test-Run', require('node:crypto').randomUUID())
      .send({
        email: `rate-limit-${index}-${require('node:crypto').randomUUID()}@example.test`,
        password: 'Invalid-Test-Password-91!x',
      });
    responses.push(response);
    if (response.status === 429) {
      break;
    }
  }
  expect(
    responses.some((response) => response.status === 429),
  ).toBe(true);
});

});
});