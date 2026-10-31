"use strict";

const REQUIRED_HEADERS = [
  "x-content-type-options",
  "referrer-policy"
];

const RECOMMENDED_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "permissions-policy",
  "x-frame-options"
];

async function main() {
  const target = process.argv[2];

  if (!target) {
    console.error(
      "Usage: node check-live-headers.js https://medorbits.in"
    );
    process.exit(1);
  }

  let url;

  try {
    url = new URL(target);
  } catch {
    console.error("Invalid URL.");
    process.exit(1);
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    console.error("Only HTTP and HTTPS URLs are supported.");
    process.exit(1);
  }

  console.log(`\nChecking: ${url.origin}\n`);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "MedOrbits-Security-Header-Checker/1.0"
      }
    });

    console.log(`HTTP Status: ${response.status}`);
    console.log(`Final URL: ${response.url}\n`);

    const missing = [];

    for (const name of REQUIRED_HEADERS) {
      const value = response.headers.get(name);

      if (!value) {
        missing.push(name);
        console.error(`[MISSING] ${name}`);
      } else {
        console.log(`[PRESENT] ${name}: ${value}`);
      }
    }

    console.log("\nRecommended headers:");

    for (const name of RECOMMENDED_HEADERS) {
      const value = response.headers.get(name);

      console.log(
        value
          ? `[PRESENT] ${name}: ${value}`
          : `[REVIEW] ${name} not detected`
      );
    }

    if (url.protocol !== "https:") {
      console.warn("\n[WARNING] Production should use HTTPS.");
    }

    console.log("\nHeader inspection completed.");

    if (missing.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 1;
  }
}

main();