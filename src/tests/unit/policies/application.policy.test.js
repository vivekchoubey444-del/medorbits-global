
"use strict";

/**
 * MedOrbits -- Application Authorization Policy Tests
 *
 * File: tests/unit/policies/application.policy.test.js
 *
 * Runtime: Node.js >= 20
 * Runner: node:test
 *
 * Run:
 *   node --test tests/unit/policies/application.policy.test.js
 *
 * Security boundary:
 * These tests validate the policy function's decisions. They do not
 * prove that controllers, routes, or service methods enforce the policy.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const applicationPolicy = require("../../../src/policies/application.policy");

const authorize =
  applicationPolicy?.authorize ||
  applicationPolicy?.canAccess ||
  (typeof applicationPolicy === "function" ? applicationPolicy : null);

const hasPolicy = typeof authorize === "function";

function decision(input) {
  return authorize(input);
}

function assertDenied(input, message) {
  assert.notEqual(
    decision(input),
    true,
    message
  );
}

const owner = { id: "user-1", role: "student" };
const otherStudent = { id: "user-2", role: "student" };
const application = {
  id: "application-1",
  userId: "user-1",
  status: "submitted",
};

test("application policy module exports an authorization function", () => {
  assert.equal(
    hasPolicy,
    true,
    "Expected authorize, canAccess, or a policy function export"
  );
});

test("denies unauthenticated application access", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: null,
    action: "read",
    resource: application,
  }, "Unauthenticated users must not access applications");
});

test("denies missing user context", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    action: "read",
    resource: application,
  }, "Missing user context must not grant access");
});

test("denies users with an empty identity", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: { id: "", role: "student" },
    action: "read",
    resource: application,
  }, "A missing user identity must not grant access");
});

test("allows an owner to read their application when permitted", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assert.equal(
    decision({
      user: owner,
      action: "read",
      resource: application,
    }),
    true,
    "An application owner should be allowed to read their own application"
  );
});

test("denies a non-owner access to a private application", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: otherStudent,
    action: "read",
    resource: application,
  }, "A student must not read another user's private application");
});

test("denies students from approving applications", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    action: "approve",
    resource: application,
  }, "Students must not approve applications");
});

test("denies students from deleting applications when not permitted", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    action: "delete",
    resource: application,
  }, "Ownership alone must not grant permission to delete an application");
});

test("denies attempts to modify protected ownership and role fields", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    action: "update",
    resource: application,
    input: {
      userId: "user-2",
      ownerId: "user-2",
      role: "admin",
    },
  }, "Protected-field modification must not be authorized");
});

test("denies unknown actions", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: { id: "admin-1", role: "admin" },
    action: "bypass-security",
    resource: application,
  }, "Unknown actions must be denied even for administrators");
});

test("denies missing actions", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    resource: application,
  }, "Missing actions must not grant access");
});

test("denies missing resources", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    action: "read",
    resource: null,
  }, "Missing resources must not grant access");
});

test("denies malformed resource ownership data", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  assertDenied({
    user: owner,
    action: "read",
    resource: {
      id: "application-1",
    },
  }, "A resource without ownership data must not grant student access by default");
});

test("does not mutate the supplied authorization context", (t) => {
  if (!hasPolicy) {
    t.skip("Authorization function is not available");
    return;
  }

  const context = {
    user: { id: "user-1", role: "student" },
    action: "update",
    resource: {
      id: "application-1",
      userId: "user-1",
      status: "submitted",
    },
    input: {
      userId: "user-2",
      role: "admin",
    },
  };

  const original = structuredClone(context);

  try {
    decision(context);
  } catch {
    // Some policy implementations throw for malformed or forbidden input.
  }

  assert.deepStrictEqual(
    context,
    original,
    "Authorization evaluation must not mutate the caller's context"
  );
});
