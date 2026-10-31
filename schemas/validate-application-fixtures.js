
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const root = path.resolve(__dirname, "..");

const schemaPath = path.join(
  root,
  "data/schemas/application-fixture.schema.json"
);

const fixturePath = path.join(
  root,
  "data/fixtures/applications.fixture.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const schema = readJson(schemaPath);
  const fixture = readJson(fixturePath);

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true
  });

  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(fixture);

  if (!valid) {
    console.error("Application fixture validation failed.");

    for (const error of validate.errors || []) {
      console.error(
        `${error.instancePath || "/"}: ${error.message}`
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log("Application fixture validation passed.");
  console.log(`Validated records: ${fixture.applications.length}`);
}

try {
  main();
} catch (error) {
  console.error("Validation error:", error.message);
  process.exitCode = 1;
}
