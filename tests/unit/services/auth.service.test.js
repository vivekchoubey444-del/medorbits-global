
"use strict";

/**
 * MedOrbits -- Authentication Service Unit Tests
 *
 * File: tests/unit/services/auth.service.test.js
 *
 * Runtime: Node.js >= 20
 * Runner: node:test
 *
 * Run:
 *   node --test tests/unit/services/auth.service.test.js
 *
 * Coverage:
 * - Service module exports and supported operations
 * - Rejection of missing login credentials
 * - Rejection of incomplete registration data
 * - Rejection of empty or missing tokens
 * - Caller-input immutability
 * - Protection against accidental secret-bearing exports
 *
 * These tests do not replace integration tests for password hashing,
 * database persistence, authorization, token expiry, or session security.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/auth.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service?.[name] === "function") {
      return { name, fn: service[name] };
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

test("auth service exports a valid module", () => {
  assert.ok(
    service !== null &&
      (typeof service === "object" || typeof service === "function"),
    "Authentication service should export an object or function"
  );
});

test("auth service exposes at least one recognized authentication operation", () => {
  const methods = [
    "login",
    "authenticate",
    "register",
    "verifyToken",
    "refreshToken",
  ];

  const available = methods.filter(
    (name) => typeof service?.[name] === "function"
  );

  assert.ok(
    available.length > 0,
    `Expected at least one recognized authentication operation. Available exports: ${
      Object.keys(service || {}).join(", ") || "(none)"
    }`
  );
});

test("login rejects missing credentials when supported", async (t) => {
  const method = getMethod("login", "authenticate");

  if (!method) {
    t.skip("No recognized login/authentication method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [{}],
    `${method.name} should reject an empty credentials object`
  );
});

test("login rejects null credentials when supported", async (t) => {
  const method = getMethod("login", "authenticate");

  if (!method) {
    t.skip("No recognized login/authentication method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject null credentials`
  );
});

test("registration rejects missing user data when supported", async (t) => {
  const method = getMethod(
    "register",
    "registerUser",
    "createAccount"
  );

  if (!method) {
    t.skip("No recognized registration method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [{}],
    `${method.name} should reject an empty registration payload`
  );
});

test("registration rejects null user data when supported", async (t) => {
  const method = getMethod(
    "register",
    "registerUser",
    "createAccount"
  );

  if (!method) {
    t.skip("No recognized registration method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject null registration data`
  );
});

test("token verification rejects an empty token when supported", async (t) => {
  const method = getMethod(
    "verifyToken",
    "verifyAccessToken",
    "validateToken"
  );

  if (!method) {
    t.skip("No recognized token verification method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [""],
    `${method.name} should reject an empty token`
  );
});

test("token verification rejects null input when supported", async (t) => {
  const method = getMethod(
    "verifyToken",
    "verifyAccessToken",
    "validateToken"
  );

  if (!method) {
    t.skip("No recognized token verification method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [null],
    `${method.name} should reject a null token`
  );
});

test("token refresh rejects a missing token when supported", async (t) => {
  const method = getMethod(
    "refreshToken",
    "rotateRefreshToken",
    "renewToken"
  );

  if (!method) {
    t.skip("No recognized refresh-token method is exported");
    return;
  }

  await expectRejected(
    method.fn,
    [""],
    `${method.name} should reject an empty refresh token`
  );
});

test("login does not mutate caller-owned credentials when supported", async (t) => {
  const method = getMethod("login", "authenticate");

  if (!method) {
    t.skip("No recognized login/authentication method is exported");
    return;
  }

  const credentials = {
    email: "",
    password: "",
    metadata: {
      source: "unit-test",
    },
  };

  const original = structuredClone(credentials);

  try {
    await method.fn(credentials);
  } catch {
    // Invalid credentials are expected to fail.
  }

  assert.deepStrictEqual(
    credentials,
    original,
    `${method.name} should not mutate caller-owned credentials`
  );
});

test("registration does not mutate caller-owned data when supported", async (t) => {
  const method = getMethod(
    "register",
    "registerUser",
    "createAccount"
  );

  if (!method) {
    t.skip("No recognized registration method is exported");
    return;
  }

  const userData = {
    email: "",
    password: "",
    name: "",
    metadata: {
      source: "unit-test",
    },
  };

  const original = structuredClone(userData);

  try {
    await method.fn(userData);
  } catch {
    // Invalid registration data is expected to fail.
  }

  assert.deepStrictEqual(
    userData,
    original,
    `${method.name} should not mutate caller-owned registration data`
  );
});

test("auth service does not expose obvious raw-secret exports", () => {
  const exportNames = Object.keys(service || {});

  const suspiciousNames = exportNames.filter((name) =>
    /^(password|passwordHash|jwtSecret|accessTokenSecret|refreshTokenSecret|privateKey|apiSecret)$/i.test(
      name
    )
  );

  assert.deepStrictEqual(
    suspiciousNames,
    [],
    "Authentication service should not export raw secrets or password material"
  );
});
