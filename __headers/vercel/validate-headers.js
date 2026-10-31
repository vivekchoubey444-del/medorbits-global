"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DIR = __dirname;
const fragmentPath = path.join(DIR, "headers.fragment.json");
const policyPath = path.join(DIR, "security-policy.json");
const referencePath = path.join(DIR, "vercel.config.json");

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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    error(`${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

function validateHeaderRules(rules, label) {
  if (!Array.isArray(rules) || rules.length === 0) {
    error(`${label} must be a non-empty array.`);
    return;
  }

  const allowed = new Set([
    "x-content-type-options",
    "referrer-policy",
    "x-frame-options",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "cache-control",
    "content-security-policy",
    "strict-transport-security"
  ]);

  for (const [index, rule] of rules.entries()) {
    if (!rule || typeof rule !== "object") {
      error(`${label}[${index}] must be an object.`);
      continue;
    }

    if (typeof rule.source !== "string" || !rule.source.startsWith("/")) {
      error(`${label}[${index}] has an invalid source pattern.`);
    }

    if (!Array.isArray(rule.headers) || rule.headers.length === 0) {
      error(`${label}[${index}] must contain a non-empty headers array.`);
      continue;
    }

    const seen = new Set();

    for (const [headerIndex, header] of rule.headers.entries()) {
      if (!header || typeof header !== "object") {
        error(`${label}[${index}].headers[${headerIndex}] must be an object.`);
        continue;
      }

      if (typeof header.key !== "string" || !header.key.trim()) {
        error(`${label}[${index}].headers[${headerIndex}] has no key.`);
        continue;
      }

      if (typeof header.value !== "string" || !header.value.trim()) {
        error(`${label}[${index}].headers[${headerIndex}] has no value.`);
        continue;
      }

      const normalized = header.key.toLowerCase();

      if (!allowed.has(normalized)) {
        warn(`Unrecognized header in validator allowlist: ${header.key}`);
      }

      if (seen.has(normalized)) {
        warn(`Duplicate ${header.key} in rule ${rule.source}.`);
      }

      seen.add(normalized);

      if (normalized === "strict-transport-security") {
        warn("Review HSTS coverage before enabling it on production.");
      }

      if (normalized === "content-security-policy") {
        warn("CSP must be tested against all MedOrbits integrations.");
      }
    }
  }
}

function main() {
  console.log("\nMedOrbits -- Vercel Header Validator\n");

  const fragment = readJson(fragmentPath);
  const policy = readJson(policyPath);
  const reference = readJson(referencePath);

  if (fragment) validateHeaderRules(fragment, "headers.fragment.json");

  if (reference) {
    if (reference.version !== 2) {
      error("Reference configuration must use Vercel config version 2.");
    }
    validateHeaderRules(reference.headers, "vercel.config.json headers");
  }

  if (policy) {
    if (policy.project !== "MedOrbits") {
      error("Unexpected project name in security-policy.json.");
    }
    if (!policy.headers || typeof policy.headers !== "object") {
      error("security-policy.json must define a headers object.");
    }
  }

  if (fragment && reference) {
    const fragmentText = JSON.stringify(fragment);
    const referenceText = JSON.stringify(reference.headers);

    if (fragmentText !== referenceText) {
      warn("Fragment and reference configuration differ. Review before deployment.");
    }
  }

  console.log(`\nValidation finished: ${errors} error(s), ${warnings} warning(s).`);

  if (errors > 0) process.exitCode = 1;
}

main();
