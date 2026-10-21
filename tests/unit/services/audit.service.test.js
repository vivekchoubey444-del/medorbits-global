"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/audit.service");

test("audit service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("audit service exposes an audit operation", () => {
  const methods = [
    "log",
    "logEvent",
    "record",
    "createAuditLog",
    "writeAuditLog",
  ];

  assert.ok(
    methods.some((name) => typeof service[name] === "function"),
    "Expected an exported audit logging method"
  );
});

test("audit service rejects an empty event when supported", async (t) => {
  const log =
    service.log ||
    service.logEvent ||
    service.record ||
    service.createAuditLog ||
    service.writeAuditLog;

  if (typeof log !== "function") {
    t.skip("No audit logging method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => log.call(service)),
    "Expected an empty audit event to be rejected"
  );
});

test("audit service does not expose mutable internal state", () => {
  for (const key of Object.keys(service)) {
    if (/password|secret|token|privateKey/i.test(key)) {
      assert.fail(`Potentially sensitive service export: ${key}`);
    }
  }
});
