"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const requiredFiles = [
  "netlify.toml",
  "_headers.fragment",
  "security-policy.json",
  "deployment-checklist.md"
];

let errors = 0;
let warnings = 0;

function error(message) {
  errors += 1;
  console.error(`[ERROR] ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`[WARN] ${message}`);
}

function main() {
  console.log("\nMedOrbits — Netlify Header Validator\n");

  for (const file of requiredFiles) {
    const target = path.join(ROOT, file);

    if (!fs.existsSync(target)) {
      error(`Missing required file: ${file}`);
    } else {
      console.log(`[FOUND] ${file}`);
    }
  }

  const policyPath = path.join(ROOT, "security-policy.json");

  if (fs.existsSync(policyPath)) {
    try {
      const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));

      if (policy.project !== "MedOrbits") {
        error("Unexpected project name in security-policy.json.");
      }

      if (policy.provider !== "Netlify") {
        error("Provider must be Netlify.");
      }

      for (const name of [
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy"
      ]) {
        if (!policy.headers || !policy.headers[name]) {
          error(`Policy is missing ${name}.`);
        }
      }

      console.log("[VALID JSON] security-policy.json");
    } catch (err) {
      error(`Invalid security-policy.json: ${err.message}`);
    }
  }

  const tomlPath = path.join(ROOT, "netlify.toml");

  if (fs.existsSync(tomlPath)) {
    const toml = fs.readFileSync(tomlPath, "utf8");

    if (!/^\s*\[\[headers\]\]/m.test(toml)) {
      error("netlify.toml has no [[headers]] section.");
    }

    if (!/^\s*for\s*=\s*["']\/\(\.\*\)["']/m.test(toml)) {
      warn("Could not confirm the global /* header rule.");
    }

    if (/Strict-Transport-Security\s*=/.test(toml)) {
      warn("HSTS is present. Confirm HTTPS coverage for every affected hostname.");
    }

    if (/Content-Security-Policy\s*=/.test(toml)) {
      warn("CSP is present. Test all application integrations and policy violations.");
    }

    console.log("[CHECKED] netlify.toml structure (basic text checks only)");
  }

  const headersPath = path.join(ROOT, "_headers.fragment");

  if (fs.existsSync(headersPath)) {
    const content = fs.readFileSync(headersPath, "utf8");

    for (const name of [
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy"
    ]) {
      if (!new RegExp(`^\\s+${name}:`, "mi").test(content)) {
        warn(`Static headers fragment does not contain ${name}.`);
      }
    }
  }

  console.log(`\nFinished: ${errors} error(s), ${warnings} warning(s).`);

  if (errors > 0) {
    process.exitCode = 1;
  } else {
    console.log("Basic Netlify header checks passed.");
  }
}

main();
