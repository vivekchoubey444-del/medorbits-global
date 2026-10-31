
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits Cloudflare Configuration Validator
 *
 * File: /__headers/cloudflare/validate-config.js
 * Runtime: Node.js >= 20
 *
 * Validates:
 * - security-headers.json
 * - transform-rule.json
 * - deployment-checklist.md
 * - Related policy files
 *
 * This script performs local validation only.
 * It does not connect to Cloudflare or deploy rules.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;

const FILES = {
  security: path.join(ROOT, "security-headers.json"),
  transform: path.join(ROOT, "transform-rule.json"),
  checklist: path.join(ROOT, "deployment-checklist.md"),
  policy: path.resolve(ROOT, "../policy/policy.json"),
  matrix: path.resolve(ROOT, "../policy/header-matrix.json"),
  exceptions: path.resolve(ROOT, "../policy/exceptions.json")
};

const REQUIRED_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=()"
};

const REQUIRED_RULE_FIELDS = [
  "name",
  "description",
  "enabled",
  "expression",
  "operation",
  "header",
  "value"
];

const state = {
  errors: [],
  warnings: [],
  passed: 0
};

function pass(message) {
  state.passed++;
  console.log(`  PASS  ${message}`);
}

function warn(message) {
  state.warnings.push(message);
  console.warn(`  WARN  ${message}`);
}

function fail(message) {
  state.errors.push(message);
  console.error(`  FAIL  ${message}`);
}

function checkFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    fail(`${description} not found: ${filePath}`);
    return false;
  }

  if (!fs.statSync(filePath).isFile()) {
    fail(`${description} is not a file: ${filePath}`);
    return false;
  }

  pass(`${description} exists`);
  return true;
}

function readJson(filePath, description) {
  if (!checkFile(filePath, description)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);

    pass(`${description} contains valid JSON`);
    return parsed;
  } catch (error) {
    fail(`${description} has invalid JSON: ${error.message}`);
    return null;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateSecurityConfig(config) {
  console.log("\n[1] Security header configuration");

  if (!config) return;

  if (!isNonEmptyString(config.name)) {
    fail("Security configuration requires a name");
  } else {
    pass("Security configuration has a name");
  }

  if (!config.headers || typeof config.headers !== "object") {
    fail("Security configuration must contain a headers object");
    return;
  }

  for (const [header, expectedValue] of Object.entries(
    REQUIRED_HEADERS
  )) {
    const definition = config.headers[header];

    if (!definition || typeof definition !== "object") {
      fail(`Missing required header definition: ${header}`);
      continue;
    }

    if (definition.enabled !== true) {
      warn(`${header} is not enabled`);
    } else {
      pass(`${header} is enabled`);
    }

    if (definition.value !== expectedValue) {
      warn(
        `${header} differs from the expected baseline value`
      );
    } else {
      pass(`${header} has the expected value`);
    }
  }

  const hsts = config.headers["Strict-Transport-Security"];

  if (hsts?.enabled === true) {
    if (hsts.enable_only_after_review !== true) {
      fail("HSTS must require explicit review");
    } else {
      pass("HSTS has an explicit review requirement");
    }

    if (hsts.value?.includes("preload")) {
      warn("HSTS preload requires separate domain-wide approval");
    }
  }

  const csp = config.headers["Content-Security-Policy"];

  if (csp?.enabled === true) {
    if (csp.mode !== "report-only-first") {
      warn("CSP should begin in report-only mode");
    }

    if (!isNonEmptyString(csp.initial_policy)) {
      fail("Enabled CSP requires an initial policy");
    } else {
      pass("CSP policy is present");
    }
  }

  if (config.cors?.cloudflare_managed === true) {
    warn(
      "CORS is marked as Cloudflare-managed; verify origin-level CORS requirements"
    );
  }
}

function validateTransformRules(config) {
  console.log("\n[2] Cloudflare transform rules");

  if (!config) return;

  if (!Array.isArray(config.rules)) {
    fail("Transform configuration must contain a rules array");
    return;
  }

  if (config.rules.length === 0) {
    fail("Transform rules array is empty");
    return;
  }

  pass(`${config.rules.length} transform rule(s) found`);

  const names = new Set();

  config.rules.forEach((rule, index) => {
    const label = `Rule ${index + 1}`;

    if (!rule || typeof rule !== "object") {
      fail(`${label} is not an object`);
      return;
    }

    for (const field of REQUIRED_RULE_FIELDS) {
      if (!(field in rule)) {
        fail(`${label} is missing required field: ${field}`);
      }
    }

    if (names.has(rule.name)) {
      fail(`Duplicate rule name: ${rule.name}`);
    } else if (isNonEmptyString(rule.name)) {
      names.add(rule.name);
      pass(`${label} has a unique name`);
    }

    if (typeof rule.enabled !== "boolean") {
      fail(`${label} enabled must be a boolean`);
    }

    if (rule.operation !== "set") {
      warn(`${label} uses an operation other than set`);
    }

    if (!isNonEmptyString(rule.expression)) {
      fail(`${label} has no Cloudflare expression`);
    }

    if (!isNonEmptyString(rule.header)) {
      fail(`${label} has no response-header name`);
    }

    if (!isNonEmptyString(rule.value)) {
      fail(`${label} has no response-header value`);
    }

    if (
      rule.header === "Strict-Transport-Security" &&
      rule.enabled === true &&
      rule.approval_required !== true
    ) {
      fail(`${label} enables HSTS without approval_required`);
    }

    if (
      rule.header === "Content-Security-Policy" &&
      rule.enabled === true
    ) {
      warn(
        `${label} enforces CSP; verify all application integrations`
      );
    }

    if (
      rule.header === "Content-Security-Policy-Report-Only" &&
      rule.enabled === true
    ) {
      pass(`${label} uses CSP report-only mode`);
    }
  });

  if (config.deployment?.automatic_deployment !== false) {
    warn("Automatic deployment should remain disabled in this reference");
  }
}

function validateRelatedFiles() {
  console.log("\n[3] Related policy files");

  checkFile(FILES.checklist, "Deployment checklist");
  checkFile(FILES.policy, "Central security policy");
  checkFile(FILES.matrix, "Provider header matrix");
  checkFile(FILES.exceptions, "Policy exceptions");
}

function validateScope(config) {
  console.log("\n[4] Deployment scope");

  if (!config) return;

  const hostnames = config.scope?.hostnames;

  if (!Array.isArray(hostnames) || hostnames.length === 0) {
    fail("Security configuration requires scoped hostnames");
    return;
  }

  for (const hostname of hostnames) {
    if (
      typeof hostname !== "string" ||
      !/^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/i.test(hostname)
    ) {
      fail(`Invalid hostname: ${hostname}`);
    } else {
      pass(`Valid hostname: ${hostname}`);
    }
  }

  if (!hostnames.includes("medorbits.in")) {
    warn("Primary domain medorbits.in is not in the configured scope");
  }

  if (
    config.scope?.exclude_paths &&
    !Array.isArray(config.scope.exclude_paths)
  ) {
    fail("scope.exclude_paths must be an array");
  }
}

function printSummary() {
  console.log("\n======================================");
  console.log(" MEDORBITS CLOUDFLARE VALIDATION");
  console.log("======================================");
  console.log(`Passed:   ${state.passed}`);
  console.log(`Warnings: ${state.warnings.length}`);
  console.log(`Errors:   ${state.errors.length}`);

  if (state.errors.length > 0) {
    console.error("\nValidation failed.");

    for (const error of state.errors) {
      console.error(`- ${error}`);
    }

    process.exitCode = 1;
    return;
  }

  if (state.warnings.length > 0) {
    console.warn("\nValidation passed with warnings.");
    process.exitCode = 0;
    return;
  }

  console.log("\nAll local configuration checks passed.");
  process.exitCode = 0;
}

function main() {
  console.log("MedOrbits Cloudflare Configuration Validator");
  console.log(`Directory: ${ROOT}`);

  const securityConfig = readJson(
    FILES.security,
    "Security header configuration"
  );

  const transformConfig = readJson(
    FILES.transform,
    "Transform rule configuration"
  );

  validateSecurityConfig(securityConfig);
  validateTransformRules(transformConfig);
  validateRelatedFiles();
  validateScope(securityConfig);

  printSummary();
}

main();
