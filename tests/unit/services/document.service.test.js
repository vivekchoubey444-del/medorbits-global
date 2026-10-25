"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/document.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service[name] === "function") return service[name];
  }
  return null;
}

test("document service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("document service exposes document operations", () => {
  const methods = [
    "uploadDocument",
    "createDocument",
    "getDocumentById",
    "getDocuments",
    "deleteDocument",
  ];

  assert.ok(
    methods.some((name) => typeof service[name] === "function"),
    "Expected at least one document service operation"
  );
});

test("document creation rejects missing metadata when implemented", async (t) => {
  const create = getMethod("uploadDocument", "createDocument", "create");

  if (!create) {
    t.skip("No document creation method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => create()),
    "Expected missing document data to be rejected"
  );
});

test("document lookup rejects an empty identifier when implemented", async (t) => {
  const find = getMethod("getDocumentById", "findById", "getById");

  if (!find) {
    t.skip("No document lookup method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => find("")),
    "Expected an empty document ID to be rejected"
  );
});

test("document deletion rejects an empty identifier when implemented", async (t) => {
  const remove = getMethod("deleteDocument", "removeDocument", "remove");

  if (!remove) {
    t.skip("No document deletion method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => remove("")),
    "Expected an empty document ID to be rejected"
  );
});
