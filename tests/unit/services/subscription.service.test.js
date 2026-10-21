"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/subscription.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service[name] === "function") return service[name];
  }
  return null;
}

test("subscription service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("subscription service exposes subscription operations", () => {
  const methods = [
    "createSubscription",
    "getSubscriptionById",
    "getUserSubscription",
    "cancelSubscription",
    "renewSubscription",
  ];

  assert.ok(
    methods.some((name) => typeof service[name] === "function"),
    "Expected at least one subscription service operation"
  );
});

test("subscription creation rejects missing input when implemented", async (t) => {
  const create = getMethod("createSubscription", "subscribe", "create");

  if (!create) {
    t.skip("No subscription creation method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => create({})),
    "Expected invalid subscription input to be rejected"
  );
});

test("subscription lookup rejects an empty identifier when implemented", async (t) => {
  const find = getMethod("getSubscriptionById", "findById", "getById");

  if (!find) {
    t.skip("No subscription lookup method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => find("")),
    "Expected an empty subscription ID to be rejected"
  );
});

test("subscription cancellation rejects an empty identifier when implemented", async (t) => {
  const cancel = getMethod("cancelSubscription", "cancel");

  if (!cancel) {
    t.skip("No subscription cancellation method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => cancel("")),
    "Expected an empty subscription ID to be rejected"
  );
});
