
"use strict";

/**
 * MedOrbits -- Payment Service Unit Tests
 *
 * File: tests/unit/services/payment.service.test.js
 *
 * Runtime: Node.js >= 20
 * Test runner: node:test
 *
 * Run:
 *   node --test tests/unit/services/payment.service.test.js
 *
 * Security coverage:
 * - Service module and operation exports
 * - Rejection of missing or invalid payment inputs
 * - Safe handling of synchronous and asynchronous errors
 * - No mutation of caller-provided input
 *
 * Note:
 * These tests validate the service's observable contract. They do not
 * prove that a payment provider, database, authorization layer, or
 * webhook signature verification is correctly configured.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/payment.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service?.[name] === "function") {
      return {
        name,
        fn: service[name],
      };
    }
  }

  return null;
}

async function expectRejected(fn, args, message) {
  await assert.rejects(
    async () => fn(...args),
    undefined,
    message
  );
}

test("payment service exports a valid module", () => {
  assert.ok(
    service !== null &&
      (typeof service === "object" || typeof service === "function"),
    "Payment service should export an object or function"
  );
});

test("payment service exposes at least one recognized payment operation", () => {
  const methods = [
    "createPayment",
    "initiatePayment",
    "verifyPayment",
    "refundPayment",
    "getPaymentById",
  ];

  const available = methods.filter(
    (name) => typeof service?.[name] === "function"
  );

  assert.ok(
    available.length > 0,
    `Expected at least one recognized payment operation. Available exports: ${
      Object.keys(service || {}).join(", ") || "(none)"
    }`
  );
});

test("payment creation rejects missing payment details when supported", async (t) => {
  const method = getMethod(
    "createPayment",
    "initiatePayment",
    "create"
  );

  if (!method) {
    t.skip("No recognized payment creation method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [{}],
    `${method.name} should reject an empty payment payload`
  );
});

test("payment creation rejects null input when supported", async (t) => {
  const method = getMethod(
    "createPayment",
    "initiatePayment",
    "create"
  );

  if (!method) {
    t.skip("No recognized payment creation method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject null payment details`
  );
});

test("payment verification rejects a missing reference when supported", async (t) => {
  const method = getMethod(
    "verifyPayment",
    "verify",
    "confirmPayment"
  );

  if (!method) {
    t.skip("No recognized payment verification method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [""],
    `${method.name} should reject an empty payment reference`
  );
});

test("payment verification rejects null reference input when supported", async (t) => {
  const method = getMethod(
    "verifyPayment",
    "verify",
    "confirmPayment"
  );

  if (!method) {
    t.skip("No recognized payment verification method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject a null payment reference`
  );
});

test("refund operation rejects a missing reference when supported", async (t) => {
  const method = getMethod("refundPayment", "refund");

  if (!method) {
    t.skip("No recognized refund operation is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [""],
    `${method.name} should reject an empty refund reference`
  );
});

test("refund operation rejects null input when supported", async (t) => {
  const method = getMethod("refundPayment", "refund");

  if (!method) {
    t.skip("No recognized refund operation is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject null refund input`
  );
});

test("payment lookup rejects an invalid identifier when supported", async (t) => {
  const method = getMethod("getPaymentById", "findPaymentById");

  if (!method) {
    t.skip("No recognized payment lookup method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [""],
    `${method.name} should reject an empty payment identifier`
  );
});

test("payment creation does not mutate the supplied payload when supported", async (t) => {
  const method = getMethod(
    "createPayment",
    "initiatePayment",
    "create"
  );

  if (!method) {
    t.skip("No recognized payment creation method is exported");
    return;
  }

  const payload = {
    amount: -1,
    currency: "",
    metadata: {
      testCase: "invalid-payment",
    },
  };

  const original = structuredClone(payload);

  try {
    await method.fn(payload);
  } catch {
    // Invalid input is expected to fail. The immutability assertion
    // below is the purpose of this test.
  }

  assert.deepStrictEqual(
    payload,
    original,
    `${method.name} should not mutate caller-owned input`
  );
});

test("payment service does not expose obvious secret-bearing exports", () => {
  const exportNames = Object.keys(service || {});

  const suspiciousNames = exportNames.filter((name) =>
    /^(secret|apiSecret|privateKey|webhookSecret|providerSecret|paymentSecret)$/i.test(
      name
    )
  );

  assert.deepStrictEqual(
    suspiciousNames,
    [],
    "Payment service should not export raw provider secrets or private keys"
  );
});
