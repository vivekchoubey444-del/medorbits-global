
"use strict";

/**
 * =============================================================================
 * MedOrbits -- Vercel Security Header Validator
 * File: /__headers/vercel/validate-headers.js
 *
 * Purpose:
 *   - Validate Vercel header configuration.
 *   - Validate security header names and values.
 *   - Detect duplicate rules and headers.
 *   - Validate security policy metadata.
 *   - Compare header fragments with reference configuration.
 *   - Return CI/CD-compatible exit codes.
 *
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only.
 * =============================================================================
 */

const fs = require("node:fs");
const path = require("node:path");

const DIR = __dirname;

const FILES = {
  fragment: path.join(DIR, "headers.fragment.json"),
  policy: path.join(DIR, "security-policy.json"),
  reference: path.join(DIR, "vercel.config.json")
};

const ALLOWED_HEADERS = new Set([
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

const VALID_VALUES = {
  "x-content-type-options": ["nosniff"],

  "referrer-policy": [
    "no-referrer",
    "no-referrer-when-downgrade",
    "origin",
    "origin-when-cross-origin",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
    "unsafe-url"
  ],

  "x-frame-options": [
    "DENY",
    "SAMEORIGIN"
  ],

  "cross-origin-opener-policy": [
    "unsafe-none",
    "same-origin-allow-popups",
    "same-origin",
    "noopener-allow-popups"
  ],

  "cross-origin-resource-policy": [
    "same-site",
    "same-origin",
    "cross-origin"
  ]
};

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

function success(message) {
  console.log(`[OK] ${message}`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    error(`${path.basename(filePath)} does not exist.`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");

    if (!content.trim()) {
      error(`${path.basename(filePath)} is empty.`);
      return null;
    }

    return JSON.parse(content);
  } catch (err) {
    error(`${path.basename(filePath)}: ${err.message}`);
    return null;
  }
}

/**
 * Normalize JSON for reliable comparison.
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();

    return `{${keys.map(
      key => `${JSON.stringify(key)}:${stableStringify(value[key])}`
    ).join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Validate source patterns.
 */
function validateSource(source, label) {
  if (
    typeof source !== "string" ||
    !source.startsWith("/") ||
    source.includes("?") ||
    source.includes("#")
  ) {
    error(`${label} has an invalid Vercel source pattern.`);
    return false;
  }

  if (/[\r\n]/.test(source)) {
    error(`${label} contains invalid control characters.`);
    return false;
  }

  return true;
}

/**
 * Validate individual header values.
 */
function validateHeaderValue(key, value, label) {
  const normalized = key.toLowerCase();

  if (/[\r\n]/.test(value)) {
    error(`${label} contains invalid newline characters.`);
    return;
  }

  if (VALID_VALUES[normalized]) {
    const allowed = VALID_VALUES[normalized];

    if (!allowed.includes(value)) {
      error(
        `${label} has an invalid value: "${value}".`
      );
    }
  }

  switch (normalized) {
    case "permissions-policy":
      if (!value.includes("=")) {
        error(`${label} must contain a valid policy directive.`);
      }
      break;

    case "strict-transport-security":
      if (!/max-age=\d+/i.test(value)) {
        error(`${label} must contain a valid max-age directive.`);
      }

      if (/max-age=0/i.test(value)) {
        warn(`${label} disables HSTS.`);
      }

      warn(
        "Review HSTS domain coverage and HTTPS availability before deployment."
      );

      break;

    case "content-security-policy":
      if (!value.includes("default-src") &&
          !value.includes("script-src")) {
        warn(
          `${label} should be reviewed for missing restrictive directives.`
        );
      }

      if (/(^|;)\s*default-src\s+\*/i.test(value)) {
        warn(`${label} contains a wildcard default-src directive.`);
      }

      if (/\bunsafe-inline\b|\bunsafe-eval\b/i.test(value)) {
        warn(`${label} contains an unsafe CSP directive.`);
      }

      break;

    case "cache-control":
      if (/\bpublic\b/i.test(value) && /\bno-store\b/i.test(value)) {
        error(`${label} cannot combine public and no-store.`);
      }
      break;

    default:
      break;
  }
}

/**
 * Validate Vercel header rules.
 */
function validateHeaderRules(rules, label) {
  if (!Array.isArray(rules) || rules.length === 0) {
    error(`${label} must be a non-empty array.`);
    return;
  }

  const seenSources = new Set();

  for (const [index, rule] of rules.entries()) {
    const ruleLabel = `${label}[${index}]`;

    if (
      !rule ||
      typeof rule !== "object" ||
      Array.isArray(rule)
    ) {
      error(`${ruleLabel} must be an object.`);
      continue;
    }

    if (validateSource(rule.source, ruleLabel)) {
      if (seenSources.has(rule.source)) {
        warn(`Duplicate source pattern: ${rule.source}`);
      }

      seenSources.add(rule.source);
    }

    if (!Array.isArray(rule.headers) || rule.headers.length === 0) {
      error(`${ruleLabel} must contain a non-empty headers array.`);
      continue;
    }

    const seenHeaders = new Set();

    for (const [headerIndex, header] of rule.headers.entries()) {
      const headerLabel =
        `${ruleLabel}.headers[${headerIndex}]`;

      if (
        !header ||
        typeof header !== "object" ||
        Array.isArray(header)
      ) {
        error(`${headerLabel} must be an object.`);
        continue;
      }

      if (
        typeof header.key !== "string" ||
        !header.key.trim()
      ) {
        error(`${headerLabel} has no valid key.`);
        continue;
      }

      if (
        typeof header.value !== "string" ||
        !header.value.trim()
      ) {
        error(`${headerLabel} has no valid value.`);
        continue;
      }

      const key = header.key.toLowerCase();

      if (!/^[a-z0-9-]+$/.test(key)) {
        error(`${headerLabel} contains an invalid header name.`);
        continue;
      }

      if (!ALLOWED_HEADERS.has(key)) {
        warn(`Header is not in the security allowlist: ${header.key}`);
      }

      if (seenHeaders.has(key)) {
        warn(`Duplicate header "${header.key}" in ${rule.source}.`);
      }

      seenHeaders.add(key);

      validateHeaderValue(
        key,
        header.value.trim(),
        headerLabel
      );
    }
  }
}

/**
 * Validate Vercel configuration.
 */
function validateVercelConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    error("Invalid Vercel configuration.");
    return;
  }

  if (config.version !== 2) {
    error("Vercel configuration must use version 2.");
  }

  if (
    config.$schema !== undefined &&
    config.$schema !== "https://openapi.vercel.sh/vercel.json"
  ) {
    warn("Unexpected Vercel JSON schema URL.");
  }

  validateHeaderRules(
    config.headers,
    "vercel.config.json headers"
  );

  success("Vercel configuration inspection completed.");
}

/**
 * Validate project security policy.
 */
function validateSecurityPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    error("Invalid security-policy.json.");
    return;
  }

  if (policy.project !== "MedOrbits") {
    error("Unexpected project name in security-policy.json.");
  }

  if (
    !policy.headers ||
    typeof policy.headers !== "object" ||
    Array.isArray(policy.headers) ||
    Object.keys(policy.headers).length === 0
  ) {
    error("security-policy.json must define a non-empty headers object.");
  }

  if (
    policy.version !== undefined &&
    typeof policy.version !== "string"
  ) {
    error("Security policy version must be a string.");
  }

  success("Security policy metadata inspection completed.");
}

/**
 * Compare header fragment and reference configuration.
 */
function compareConfigurations(fragment, reference) {
  if (!fragment || !reference) {
    return;
  }

  if (!Array.isArray(reference.headers)) {
    return;
  }

  const fragmentHeaders = stableStringify(fragment);
  const referenceHeaders = stableStringify(reference.headers);

  if (fragmentHeaders !== referenceHeaders) {
    warn(
      "Header fragment and Vercel reference differ. Review synchronization."
    );
  } else {
    success("Header fragment matches Vercel reference.");
  }
}

/**
 * Main execution.
 */
function main() {
  console.log("\n========================================");
  console.log(" MedOrbits -- Vercel Header Validator");
  console.log("========================================\n");

  const fragment = readJson(FILES.fragment);
  const policy = readJson(FILES.policy);
  const reference = readJson(FILES.reference);

  if (fragment) {
    validateHeaderRules(
      fragment,
      "headers.fragment.json"
    );
  }

  if (policy) {
    validateSecurityPolicy(policy);
  }

  if (reference) {
    validateVercelConfig(reference);
  }

  compareConfigurations(fragment, reference);

  console.log("\n========================================");
  console.log(" VALIDATION SUMMARY");
  console.log("========================================");

  console.log(`Errors:   ${errors}`);
  console.log(`Warnings: ${warnings}`);

  if (errors > 0) {
    console.error("\n[FAILED] Security configuration validation failed.\n");
    process.exitCode = 1;
    return;
  }

  if (warnings > 0) {
    console.warn("\n[WARNING] Review security warnings before deployment.\n");
    return;
  }

  console.log("\n[SUCCESS] All validation checks passed.\n");
}

main();
