
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits Cloudflare Live Header Tester
 *
 * File: /__headers/cloudflare/test-headers.js
 * Runtime: Node.js >= 20
 *
 * Tests deployed HTTP response headers.
 * Does not modify Cloudflare configuration.
 */

const DEFAULT_URLS = [
  "https://medorbits.in/",
  "https://www.medorbits.in/"
];

const REQUIRED_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin"
};

const RECOMMENDED_HEADERS = {
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=()"
};

const TIMEOUT_MS = 15000;

const results = {
  passed: 0,
  warnings: 0,
  failed: 0
};

function log(type, message) {
  const labels = {
    pass: "PASS",
    warn: "WARN",
    fail: "FAIL"
  };

  console.log(`[${labels[type]}] ${message}`);

  results[
    type === "pass" ? "passed" :
    type === "warn" ? "warnings" : "failed"
  ]++;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function checkHeader(headers, name, expected, required) {
  const actual = headers.get(name);

  if (!actual) {
    if (required) {
      log("fail", `Missing required header: ${name}`);
    } else {
      log("warn", `Recommended header missing: ${name}`);
    }
    return;
  }

  if (normalize(actual) !== normalize(expected)) {
    log(
      "warn",
      `${name}: expected "${expected}", received "${actual}"`
    );
    return;
  }

  log("pass", `${name}: ${actual}`);
}

function validateUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      throw new Error("HTTPS is required");
    }

    return url;
  } catch (error) {
    log("fail", `Invalid URL "${value}": ${error.message}`);
    return null;
  }
}

async function testUrl(value) {
  console.log(`\nTesting: ${value}`);

  const url = validateUrl(value);
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "MedOrbits-Security-Header-Tester/1.0",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    log(
      response.ok ? "pass" : "warn",
      `HTTP status: ${response.status}`
    );

    log(
      "pass",
      `Final URL: ${response.url}`
    );

    const headers = response.headers;

    for (const [name, expected] of Object.entries(
      REQUIRED_HEADERS
    )) {
      checkHeader(headers, name, expected, true);
    }

    for (const [name, expected] of Object.entries(
      RECOMMENDED_HEADERS
    )) {
      checkHeader(headers, name, expected, false);
    }

    const csp = headers.get("content-security-policy");
    const reportOnly = headers.get(
      "content-security-policy-report-only"
    );

    if (csp) {
      log("pass", "Content-Security-Policy is present");
    } else if (reportOnly) {
      log("pass", "Content-Security-Policy-Report-Only is present");
    } else {
      log("warn", "No Content Security Policy header detected");
    }

    const hsts = headers.get("strict-transport-security");

    if (hsts) {
      log("pass", `HSTS detected: ${hsts}`);

      if (!/max-age=\d+/i.test(hsts)) {
        log("fail", "HSTS is missing a valid max-age directive");
      }

      if (/preload/i.test(hsts)) {
        log(
          "warn",
          "HSTS preload detected; verify domain-wide eligibility"
        );
      }
    } else {
      log("warn", "HSTS is not enabled");
    }

    const server = headers.get("server");

    if (server) {
      log("pass", `Server response header: ${server}`);
    }

    const poweredBy = headers.get("x-powered-by");

    if (poweredBy) {
      log(
        "warn",
        `X-Powered-By is exposed: ${poweredBy}`
      );
    } else {
      log("pass", "X-Powered-By is not exposed");
    }

    await response.body?.cancel();
  } catch (error) {
    if (error.name === "AbortError") {
      log("fail", `Request timed out after ${TIMEOUT_MS}ms`);
    } else {
      log("fail", `Request failed: ${error.message}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log("========================================");
  console.log(" MEDORBITS CLOUDFLARE HEADER TESTER");
  console.log("========================================");

  const urls = process.argv.slice(2);
  const targets = urls.length > 0 ? urls : DEFAULT_URLS;

  for (const url of targets) {
    await testUrl(url);
  }

  console.log("\n========================================");
  console.log(" TEST SUMMARY");
  console.log("========================================");
  console.log(`Passed:   ${results.passed}`);
  console.log(`Warnings: ${results.warnings}`);
  console.log(`Failed:   ${results.failed}`);

  if (results.failed > 0) {
    console.error("\nHeader testing completed with failures.");
    process.exitCode = 1;
  } else if (results.warnings > 0) {
    console.warn("\nTesting completed with warnings.");
    process.exitCode = 0;
  } else {
    console.log("\nAll checks passed.");
  }
}

main().catch((error) => {
  console.error("Unexpected tester error:", error);
  process.exitCode = 1;
});
