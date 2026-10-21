"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/application.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service[name] === "function") return service[name];
  }
  return null;
}

test("application service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("application service exposes application operations", () => {
  const methods = [
    "createApplication",
    "getApplicationById",
    "getApplications",
    "updateApplication",
    "deleteApplication",
  ];

  const available = methods.filter((name) => typeof service[name] === "function");

  assert.ok(
    available.length > 0,
    "Expected at least one supported application service method"
  );
});

test("createApplication rejects missing input when implemented", async (t) => {
  const create = getMethod("createApplication", "create");

  if (!create) {
    t.skip("No create application method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => create()),
    "Expected invalid application input to be rejected"
  );
});

test("application lookup rejects an invalid identifier when implemented", async (t) => {
  const find = getMethod("getApplicationById", "findById", "getById");

  if (!find) {
    t.skip("No application lookup method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => find("")),
    "Expected an empty application ID to be rejected"
  );
});

test("application update rejects missing identifiers when implemented", async (t) => {
  const update = getMethod("updateApplication", "update");

  if (!update) {
    t.skip("No application update method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => update("", {})),
    "Expected an empty application ID to be rejected"
  );
});
