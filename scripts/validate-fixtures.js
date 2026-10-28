#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- Database Fixture Schema Validator
 * File: scripts/validate-fixtures.js
 *
 * Requirements:
 *   npm install ajv ajv-formats
 *
 * Expected structure:
 *   database/fixtures/*.fixture.json
 *   schemas/*.schema.json
 *
 * Usage:
 *   node scripts/validate-fixtures.js
 *   node scripts/validate-fixtures.js --json
 *   node scripts/validate-fixtures.js --help
 *
 * Safety:
 * - Read-only validation.
 * - Never changes fixture or schema files.
 * - Suitable for local development and CI.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(ROOT_DIR, "database", "fixtures");
const SCHEMAS_DIR = path.join(ROOT_DIR, "schemas");

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes("--json");
const HELP = args.includes("--help") || args.includes("-h");

const FIXTURE_SCHEMA_MAP = [
  {
    fixture: "applications.fixture.json",
    schema: "application-fixture.schema.json",
  },
  {
    fixture: "colleges.fixture.json",
    schema: "college-fixture.schema.json",
  },
  {
    fixture: "courses.fixture.json",
    schema: "course-fixture.schema.json",
  },
  {
    fixture: "payments.fixture.json",
    schema: "payment-fixture.schema.json",
  },
];

function relative(filePath) {
  return path.relative(ROOT_DIR, filePath) || ".";
}

function readJson(filePath) {
  let content;

  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read "${relative(filePath)}": ${error.message}`
    );
  }

  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  if (!content.trim()) {
    throw new Error(`File is empty: "${relative(filePath)}"`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON in "${relative(filePath)}": ${error.message}`
    );
  }
}

function getAjv() {
  try {
    const Ajv2020 = require("ajv/dist/2020").default;

    return new Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: true,
      allowUnionTypes: true,
    });
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  throw new Error(
    "AJV draft 2020-12 support is unavailable. " +
    "Install a compatible AJV version: npm install ajv ajv-formats."
  );
}

function addFormats(ajv) {
  try {
    const addFormatsPlugin = require("ajv-formats");
    const addFormats =
      addFormatsPlugin.default || addFormatsPlugin;

    addFormats(ajv);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing ajv-formats dependency. Install it using " +
        "npm install ajv-formats."
      );
    }

    throw error;
  }
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    const instancePath = error.instancePath || "/";
    const keyword = error.keyword || "schema";
    const detail = error.message || "Schema validation failed";

    let extra = "";

    if (error.params && Object.keys(error.params).length > 0) {
      extra = `; details=${JSON.stringify(error.params)}`;
    }

    return {
      path: instancePath,
      keyword,
      message: `${instancePath}: ${detail}${extra}`,
    };
  });
}

function checkMappings() {
  const seenFixtures = new Set();
  const seenSchemas = new Set();
  const problems = [];

  for (const item of FIXTURE_SCHEMA_MAP) {
    if (seenFixtures.has(item.fixture)) {
      problems.push(`Duplicate fixture mapping: ${item.fixture}`);
    }

    if (seenSchemas.has(item.schema)) {
      problems.push(`Duplicate schema mapping: ${item.schema}`);
    }

    seenFixtures.add(item.fixture);
    seenSchemas.add(item.schema);

    for (const name of [item.fixture, item.schema]) {
      if (
        typeof name !== "string" ||
        name !== path.basename(name) ||
        name.includes("..") ||
        !name.endsWith(".json")
      ) {
        problems.push(`Unsafe mapping filename: ${String(name)}`);
      }
    }
  }

  return problems;
}

function validateFixtures() {
  const failures = [];
  const results = [];
  let validatedCount = 0;

  let ajv;

  try {
    ajv = getAjv();
    addFormats(ajv);
  } catch (error) {
    console.error(`[SETUP ERROR] ${error.message}`);
    return 2;
  }

  const mappingProblems = checkMappings();

  if (mappingProblems.length > 0) {
    for (const message of mappingProblems) {
      failures.push({
        fixture: "(mapping configuration)",
        messages: [message],
      });
    }
  }

  for (const item of FIXTURE_SCHEMA_MAP) {
    const fixturePath = path.join(FIXTURES_DIR, item.fixture);
    const schemaPath = path.join(SCHEMAS_DIR, item.schema);

    if (!fs.existsSync(fixturePath)) {
      failures.push({
        fixture: item.fixture,
        messages: ["Fixture file does not exist."],
      });
      continue;
    }

    if (!fs.existsSync(schemaPath)) {
      failures.push({
        fixture: item.fixture,
        messages: [
          `Schema file does not exist: ${relative(schemaPath)}`,
        ],
      });
      continue;
    }

    let data;
    let schema;

    try {
      data = readJson(fixturePath);
      schema = readJson(schemaPath);
    } catch (error) {
      failures.push({
        fixture: item.fixture,
        messages: [error.message],
      });
      continue;
    }

    if (
      schema === null ||
      typeof schema !== "object" ||
      Array.isArray(schema)
    ) {
      failures.push({
        fixture: item.fixture,
        messages: [
          `Schema must be a JSON object: ${item.schema}`,
        ],
      });
      continue;
    }

    let validate;

    try {
      validate = ajv.compile(schema);
    } catch (error) {
      failures.push({
        fixture: item.fixture,
        messages: [
          `Schema compilation failed (${item.schema}): ${error.message}`,
        ],
      });
      continue;
    }

    let valid;

    try {
      valid = validate(data);
    } catch (error) {
      failures.push({
        fixture: item.fixture,
        messages: [
          `Validation execution failed: ${error.message}`,
        ],
      });
      continue;
    }

    if (!valid) {
      const messages = formatAjvErrors(validate.errors).map(
        (item) => item.message
      );

      failures.push({
        fixture: item.fixture,
        messages,
      });

      results.push({
        fixture: item.fixture,
        schema: item.schema,
        valid: false,
        errors: formatAjvErrors(validate.errors),
      });

      continue;
    }

    validatedCount++;

    results.push({
      fixture: item.fixture,
      schema: item.schema,
      valid: true,
      errors: [],
    });

    if (!JSON_OUTPUT) {
      console.log(`[PASS] ${item.fixture} → ${item.schema}`);
    }
  }

  const report = {
    ok: failures.length === 0,
    total: FIXTURE_SCHEMA_MAP.length,
    passed: validatedCount,
    failed: failures.length,
    results,
    failures,
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `\nFixture validation: ${validatedCount}/` +
      `${FIXTURE_SCHEMA_MAP.length} passed.`
    );

    if (failures.length > 0) {
      console.error("\nValidation errors:");

      for (const failure of failures) {
        console.error(`\n[FAIL] ${failure.fixture}`);

        for (const message of failure.messages) {
          console.error(`  - ${message}`);
        }
      }
    } else {
      console.log("All configured fixtures passed schema validation.");
    }
  }

  return failures.length > 0 ? 1 : 0;
}

function main() {
  if (HELP) {
    console.log(`
MedOrbits Fixture Validator

Usage:
  node scripts/validate-fixtures.js [options]

Options:
  --json       Output a machine-readable JSON report
  --help, -h   Show help
`);
    return 0;
  }

  return validateFixtures();
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  validateFixtures,
  FIXTURE_SCHEMA_MAP,
  formatAjvErrors,
  checkMappings,
};
