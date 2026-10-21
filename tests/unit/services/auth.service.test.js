"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../../../src/services/auth.service");

function getMethod(...names) {
  for (const name of names) {
    if (typeof service[name] === "function") return service[name];
  }
  return null;
}

test("auth service exports an object", () => {
  assert.ok(service && typeof service === "object");
});

test("auth service exposes authentication operations", () => {
  const methods = [
    "login",
    "authenticate",
    "register",
    "verifyToken",
    "refreshToken",
  ];

  assert.ok(
    methods.some((name) => typeof service[name] === "function"),
    "Expected at least one authentication operation"
  );
});

test("login rejects missing credentials when implemented", async (t) => {
  const login = getMethod("login", "authenticate");

  if (!login) {
    t.skip("No login/authentication method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => login({})),
    "Expected missing credentials to be rejected"
  );
});

test("registration rejects missing user data when implemented", async (t) => {
  const register = getMethod("register", "registerUser", "createAccount");

  if (!register) {
    t.skip("No registration method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => register({})),
    "Expected missing registration data to be rejected"
  );
});

test("token verification rejects an empty token when implemented", async (t) => {
  const verify = getMethod("verifyToken", "verifyAccessToken", "validateToken");

  if (!verify) {
    t.skip("No token verification method is exported");
    return;
  }

  await assert.rejects(
    Promise.resolve().then(() => verify("")),
    "Expected an empty token to be rejected"
  );
});
