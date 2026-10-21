‘use strict’;

const request = require(‘supertest’);
const app = require(’../../src/app’);

const baseUrl = ‘/api/payments’;
const webhookUrl = ${baseUrl}/webhook;

const validInitiationPayload = {
applicationId: ‘TEST-APPLICATION-001’,
amount: 1000,
currency: ‘INR’,
purpose: ‘application_fee’,
};

const sensitiveResponsePatterns = [
/stack trace/i,
/node_modules[\/]/i,
/\bsqlstate\b/i,
/\bDATABASE_URL\s*=/i,
/\bSESSION_SECRET\s*=/i,
/\bAI_API_KEY\s*=/i,
/\bpassword_hash\b/i,
/\bprivate_key\b/i,
/\bBEGIN\s+(?:RSA|OPENSSH|EC)\s+PRIVATE KEY\b/i,
/\bECONNREFUSED\b/i,
/mysql:///i,
/postgres(?:ql)?:///i,
];

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

function expectSafeResponse(response) {
const text = responseText(response);

for (const pattern of sensitiveResponsePatterns) {
expect(text).not.toMatch(pattern);
}
}

function expectJsonResponse(response) {
expect(response.headers[‘content-type’]).toMatch(/application/json/i);
expect(response.body).toEqual(expect.any(Object));
expect(response.body).not.toBeNull();
expect(Array.isArray(response.body)).toBe(false);
}

function expectClientError(response, allowedStatuses = [400, 401, 403, 404, 405, 422]) {
expect(allowedStatuses).toContain(response.status);
expectSafeResponse(response);
}

function expectPaymentNotPrivileged(payment) {
expect(payment).toEqual(expect.any(Object));

for (const field of [
‘password’,
‘passwordHash’,
‘password_hash’,
‘privateKey’,
‘private_key’,
‘databaseUrl’,
‘secretKey’,
‘apiSecret’,
]) {
expect(payment).not.toHaveProperty(field);
}
}

/*

* REQUIRED TEST ADAPTERS
* Provide a test-only adapter through MEDORBITS_TEST_PAYMENT_ADAPTER.
* The adapter must export:
* authenticateAs(role, userId) -> { token: string }
* getPaymentStatus(paymentId) -> payment status
* Use a dedicated test database and seeded test records.
* Never use production payment records or live gateway credentials.
    */
    function loadTestAdapter() {
    const adapterPath = process.env.MEDORBITS_TEST_PAYMENT_ADAPTER;

if (!adapterPath) {
throw new Error(
‘Set MEDORBITS_TEST_PAYMENT_ADAPTER to a test-only payment adapter module.’,
);
}

// CommonJS test suite: adapter path must resolve from the project root.
const path = require(‘node:path’);
const resolvedPath = path.isAbsolute(adapterPath)
? adapterPath
: path.resolve(process.cwd(), adapterPath);

return require(resolvedPath);
}

let testAdapter;

async function authenticateAs(role, userId) {
if (!testAdapter) {
testAdapter = loadTestAdapter();
}

if (typeof testAdapter.authenticateAs !== ‘function’) {
throw new Error(‘Test adapter must export authenticateAs(role, userId).’);
}

const identity = await testAdapter.authenticateAs(role, userId);

if (!identity || typeof identity.token !== ‘string’ || !identity.token.trim()) {
throw new Error(‘authenticateAs must return a non-empty token.’);
}

return identity;
}

async function getPaymentStatus(paymentId) {
if (!testAdapter) {
testAdapter = loadTestAdapter();
}

if (typeof testAdapter.getPaymentStatus !== ‘function’) {
throw new Error(‘Test adapter must export getPaymentStatus(paymentId).’);
}

return testAdapter.getPaymentStatus(paymentId);
}

function requireTestRecordEnvironment() {
if (process.env.NODE_ENV !== ‘test’ && process.env.JEST_WORKER_ID === undefined) {
throw new Error(
‘Payment integration tests must run in a test environment.’,
);
}
}

beforeAll(() => {
requireTestRecordEnvironment();
});

describe(‘Payments API’, () => {
describe(‘Payment record authorization’, () => {
test(‘requires authorization to access payment records’, async () => {
const endpoints = [
{ method: ‘get’, url: baseUrl },
{ method: ‘get’, url: ${baseUrl}/TEST-PAYMENT-001 },
{ method: ‘post’, url: baseUrl },
];

  for (const endpoint of endpoints) {
    const response = await request(app)[endpoint.method](endpoint.url)
      .set('Accept', 'application/json');
    expectClientError(response, [401, 403]);
  }
});
test("prevents users from accessing another user's payment record", async () => {
  const otherUser = await authenticateAs('user', 'test-payment-other');
  const paymentId = process.env.TEST_OWNED_PAYMENT_ID;
  if (!paymentId) {
    throw new Error(
      'Set TEST_OWNED_PAYMENT_ID to a seeded payment owned by test-payment-owner.',
    );
  }
  const response = await request(app)
    .get(`${baseUrl}/${encodeURIComponent(paymentId)}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${otherUser.token}`);
  expectClientError(response, [403, 404]);
});
test('allows the owner to access an existing payment', async () => {
  const owner = await authenticateAs('user', 'test-payment-owner');
  const paymentId = process.env.TEST_OWNED_PAYMENT_ID;
  if (!paymentId) {
    throw new Error(
      'Set TEST_OWNED_PAYMENT_ID to a seeded payment owned by test-payment-owner.',
    );
  }
  const response = await request(app)
    .get(`${baseUrl}/${encodeURIComponent(paymentId)}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${owner.token}`);
  expect(response.status).toBe(200);
  expectJsonResponse(response);
  expectSafeResponse(response);
  const payment = response.body.data ?? response.body.payment ?? response.body;
  expectPaymentNotPrivileged(payment);
});
test('prevents a regular user from accessing administrative payment functions', async () => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .get(`${baseUrl}/admin`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expectClientError(response, [401, 403, 404]);
});

});

describe(‘Payment initiation validation’, () => {
test(‘rejects an empty payment initiation payload’, async () => {
const user = await authenticateAs(‘user’, ‘test-payment-user’);

  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({});
  expectClientError(response, [400, 422]);
});
test.each([
  ['negative amount', { amount: -1 }],
  ['zero amount', { amount: 0 }],
  ['invalid currency', { currency: 'INVALID' }],
  ['missing application ID', { applicationId: '' }],
  ['non-numeric amount', { amount: 'not-a-number' }],
  ['null amount', { amount: null }],
  ['unsupported purpose', { purpose: 'unsupported-purpose' }],
])('rejects invalid initiation: %s', async (_case, overrides) => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      ...validInitiationPayload,
      ...overrides,
    });
  expectClientError(response, [400, 422]);
});
test('does not trust client-supplied payment status or verification fields', async () => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      ...validInitiationPayload,
      status: 'paid',
      paymentStatus: 'success',
      verified: true,
      amountPaid: 0,
      gatewayTransactionId: 'CLIENT-FORGED-TRANSACTION',
    });
  expectSafeResponse(response);
  if (response.status === 201) {
    expectJsonResponse(response);
    const payment = response.body.data ?? response.body.payment ?? response.body;
    expectPaymentNotPrivileged(payment);
    expect(payment.status).not.toBe('paid');
    expect(payment.paymentStatus).not.toBe('success');
    expect(payment.verified).not.toBe(true);
    expect(payment.gatewayTransactionId).not.toBe(
      'CLIENT-FORGED-TRANSACTION',
    );
  } else {
    expectClientError(response, [400, 401, 403, 422]);
  }
});
test('does not allow alternate amount fields to override the payable amount', async () => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      ...validInitiationPayload,
      amountPaid: 1,
      total: 1,
      payableAmount: 1,
      discount: 1000,
    });
  expectSafeResponse(response);
  if (response.status === 201) {
    expectJsonResponse(response);
    const payment = response.body.data ?? response.body.payment ?? response.body;
    if (payment.amount !== undefined) {
      expect(Number(payment.amount)).toBe(1000);
    }
  } else {
    expectClientError(response, [400, 401, 403, 422]);
  }
});
test("does not allow payment initiation for another user's application", async () => {
  const user = await authenticateAs('user', 'test-payment-other');
  const foreignApplicationId =
    process.env.TEST_FOREIGN_APPLICATION_ID ||
    'TEST-APPLICATION-OWNED-BY-ANOTHER-USER';
  const response = await request(app)
    .post(baseUrl)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      ...validInitiationPayload,
      applicationId: foreignApplicationId,
    });
  expectClientError(response, [400, 403, 404, 422]);
});

});

describe(‘Webhook signature verification’, () => {
test(‘rejects webhook requests without a signature’, async () => {
const response = await request(app)
.post(webhookUrl)
.set(‘Accept’, ‘application/json’)
.send({
event: ‘payment.succeeded’,
data: { paymentId: ‘TEST-PAYMENT-001’ },
});

  expectClientError(response, [400, 401, 403]);
});
test('rejects a webhook with an invalid signature', async () => {
  const response = await request(app)
    .post(webhookUrl)
    .set('Accept', 'application/json')
    .set('x-webhook-signature', 'invalid-signature')
    .send({
      event: 'payment.succeeded',
      data: { paymentId: 'TEST-PAYMENT-001' },
    });
  expectClientError(response, [400, 401, 403]);
});
test('does not mark a payment successful after an invalid webhook', async () => {
  const paymentId = process.env.TEST_PENDING_PAYMENT_ID;
  if (!paymentId) {
    throw new Error(
      'Set TEST_PENDING_PAYMENT_ID to a seeded pending payment.',
    );
  }
  const before = await getPaymentStatus(paymentId);
  const response = await request(app)
    .post(webhookUrl)
    .set('Accept', 'application/json')
    .set('x-webhook-signature', 'invalid-signature')
    .send({
      event: 'payment.succeeded',
      data: { paymentId },
    });
  expectClientError(response, [400, 401, 403]);
  const after = await getPaymentStatus(paymentId);
  expect(after).toEqual(before);
});
test('rejects a malformed webhook payload', async () => {
  const response = await request(app)
    .post(webhookUrl)
    .set('Accept', 'application/json')
    .set('x-webhook-signature', 'invalid-signature')
    .send({});
  expectClientError(response, [400, 401, 403, 422]);
});
test('does not accept a client-supplied success flag as proof of payment', async () => {
  const response = await request(app)
    .post(webhookUrl)
    .set('Accept', 'application/json')
    .set('x-webhook-signature', 'invalid-signature')
    .send({
      event: 'payment.succeeded',
      success: true,
      verified: true,
      status: 'paid',
      data: {
        paymentId: 'TEST-PAYMENT-001',
        status: 'paid',
      },
    });
  expectClientError(response, [400, 401, 403, 422]);
});

});

describe(‘Payment error handling’, () => {
test(‘returns a safe not-found response for an unknown payment ID’, async () => {
const user = await authenticateAs(‘user’, ‘test-payment-user’);

  const response = await request(app)
    .get(`${baseUrl}/PAYMENT-DOES-NOT-EXIST`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expectClientError(response, [404, 422]);
});
test('handles SQL injection-like payment IDs safely', async () => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .get(`${baseUrl}/${encodeURIComponent("' OR 1=1 --")}`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expect(response.status).toBeLessThan(500);
  expectSafeResponse(response);
});
test('does not expose internal database or gateway details', async () => {
  const user = await authenticateAs('user', 'test-payment-user');
  const response = await request(app)
    .get(`${baseUrl}/PAYMENT-DOES-NOT-EXIST`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${user.token}`);
  expectSafeResponse(response);
  const text = responseText(response);
  expect(text).not.toMatch(/process\.env/i);
  expect(text).not.toMatch(/authorization:\s*bearer/i);
  expect(text).not.toMatch(/secret key/i);
});

});
});