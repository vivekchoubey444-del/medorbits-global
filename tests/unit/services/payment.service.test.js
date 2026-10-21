"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/payment.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service[name] === "function") return service[name];
  }
  return null;
}

test("payment service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("payment service exposes payment operations", () => {
  const methods = [
    "createPayment",
    "initiatePayment",
    "verifyPayment",
    "refundPayment",
    "getPaymentById",
  ];

  assert.ok(
    methods.some((name) => typeof service[name] === "function"),
    "Expected at least one payment service operation"
  );
});

test("payment creation rejects missing payment details when implemented", async (t) => {
  const create = getMethod("createPayment", "initiatePayment", "create");

  if (!create) {
    t.skip("No payment creation method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => create({})),
    "Expected invalid payment details to be rejected"
  );
});

test("payment verification rejects a missing reference when implemented", async (t) => {
  const verify = getMethod("verifyPayment", "verify", "confirmPayment");

  if (!verify) {
    t.skip("No payment verification method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => verify("")),
    "Expected an empty payment reference to be rejected"
  );
});

test("refund rejects invalid input when implemented", async (t) => {
  const refund = getMethod("refundPayment", "refund");

  if (!refund) {
    t.skip("No refund method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => refund("")),
    "Expected invalid refund input to be rejected"
  );
});
