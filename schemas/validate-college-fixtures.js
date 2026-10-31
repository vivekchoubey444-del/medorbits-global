
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(__dirname, "..");

const SCHEMA_PATH = path.join(
  ROOT,
  "data/schemas/college-fixture.schema.json"
);

const FIXTURE_PATH = path.join(
  ROOT,
  "data/fixtures/colleges.fixture.json"
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validate() {
  const schema = readJson(SCHEMA_PATH);
  const fixture = readJson(FIXTURE_PATH);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true
  });

  addFormats(ajv);

  const validateFixture = ajv.compile(schema);
  const valid = validateFixture(fixture);

  if (!valid) {
    console.error("College fixture validation failed.");

    for (const error of validateFixture.errors || []) {
      console.error(
        `${error.instancePath || "/"}: ${error.message}`
      );
    }

    process.exitCode = 1;
    return;
  }

  const slugs = fixture.colleges.map(
    (college) => college.slug
  );

  if (new Set(slugs).size !== slugs.length) {
    console.error("Duplicate college slugs detected.");
    process.exitCode = 1;
    return;
  }

  console.log("College fixture validation passed.");
  console.log(`College records: ${fixture.colleges.length}`);
  console.log("Synthetic markers: verified");
  console.log("Duplicate slug check: passed");
}

try {
  validate();
} catch (error) {
  console.error(`Validation error: ${error.message}`);
  process.exitCode = 1;
}
