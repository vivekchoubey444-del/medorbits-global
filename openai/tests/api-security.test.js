"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAiAuthMiddleware } = require("../middleware/ai-auth.middleware");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("AI auth rejects missing token", () => {
  const middleware = createAiAuthMiddleware({ token: "x".repeat(40) });
  const res = response();
  middleware({ get: () => "" }, res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 401);
});

test("AI auth accepts valid bearer token", () => {
  const token = "a".repeat(40);
  const middleware = createAiAuthMiddleware({ token });
  const res = response();
  let nextCalled = false;

  middleware(
    { get: () => `Bearer ${token}` },
    res,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
});

test("AI auth fails closed when server token is not configured", () => {
  const middleware = createAiAuthMiddleware({ token: undefined });
  const res = response();
  middleware({ get: () => "Bearer token" }, res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 503);
});
