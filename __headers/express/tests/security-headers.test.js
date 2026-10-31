"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders } = require("../middleware/security-headers");

function createResponse() {
  const headers = new Map();

  return {
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    removeHeader(name) {
      headers.delete(name.toLowerCase());
    }
  };
}

test("sets baseline security headers", () => {
  const middleware = securityHeaders();
  const res = createResponse();
  let nextCalled = false;

  middleware({}, res, () => {
    nextCalled = true;
  });

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    res.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin"
  );
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(
    res.headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=()"
  );
  assert.equal(nextCalled, true);
});

test("does not enable CSP or HSTS by default", () => {
  const middleware = securityHeaders();
  const res = createResponse();

  middleware({}, res, () => {});

  assert.equal(res.headers.has("content-security-policy"), false);
  assert.equal(res.headers.has("strict-transport-security"), false);
});

test("supports an explicitly configured CSP", () => {
  const middleware = securityHeaders({
    contentSecurityPolicy: "default-src 'self'; object-src 'none'"
  });
  const res = createResponse();

  middleware({}, res, () => {});

  assert.equal(
    res.headers.get("content-security-policy"),
    "default-src 'self'; object-src 'none'"
  );
});

test("rejects CRLF header injection in configuration", () => {
  assert.throws(
    () => securityHeaders({ referrerPolicy: "safe\r\nX-Evil: yes" }),
    /must not contain CR or LF/
  );
});

test("rejects simultaneous enforced and report-only CSP settings", () => {
  assert.throws(
    () => securityHeaders({
      contentSecurityPolicy: "default-src 'self'",
      contentSecurityPolicyReportOnly: "default-src 'none'"
    }),
    /Set either/
  );
});

test("removes X-Powered-By when removePoweredBy is enabled", () => {
  const middleware = securityHeaders();
  const res = createResponse();
  res.setHeader("X-Powered-By", "Express");

  middleware({}, res, () => {});

  assert.equal(res.headers.has("x-powered-by"), false);
});
