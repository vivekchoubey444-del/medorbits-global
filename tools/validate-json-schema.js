
#!/usr/bin/env node

/**
 * MedOrbits JSON Schema Validator
 * File: tools/validate-json-schema.js
 * Version: 2.0.0
 *
 * Usage:
 *   node tools/validate-json-schema.js
 *   node tools/validate-json-schema.js api/schemas
 *   node tools/validate-json-schema.js api/schemas/career.schema.json
 *
 * Options:
 *   --help       Show help.
 *   --version    Show version.
 *
 * Validation:
 *   - JSON syntax validation is always performed.
 *   - JSON Schema semantic validation requires Ajv.
 *   - Recognizes files named *.schema.json or *.schema-*.json.
 *   - Supports standard Ajv drafts and Draft 2020-12 when available.
 *
 * Safety:
 *   - Read-only.
 *   - Does not install dependencies.
 *   - Does not execute application code.
 *   - Does not follow symbolic links.
 *   - Rejects paths outside the repository.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT = path.resolve(SCRIPT_DIR, "..");

const VERSION = "2.0.0";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "vendor",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".turbo",
  ".cache"
]);

const counters = {
  checked: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  syntaxPassed: 0,
  schemaPassed: 0
};

const failures = [];

function printHelp() {
  console.log(`
MedOrbits JSON Schema Validator v${VERSION}

Usage:
  node tools/validate-json-schema.js [options] [paths...]

Examples:
  node tools/validate-json-schema.js
  node tools/validate-json-schema.js api/schemas
  node tools/validate-json-schema.js api/schemas/career.schema.json

Options:
  --help       Show this help.
  --version    Show version.

Validation:
  JSON syntax is always checked.
  JSON Schema semantic checks require Ajv.
  Only recognized schema files receive schema semantic validation.

Safety:
  Read-only. No dependency installation or source modification.
`);
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function isInsideRoot(target) {
  const relative = path.relative(ROOT, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function isSchemaFile(file) {
  const filename = path.basename(file).toLowerCase();

  return (
    filename.endsWith(".schema.json") ||
    /\.schema-[^/]+\.json$/i.test(filename)
  );
}

function recordFailure(file, message) {
  counters.failed++;
  counters.checked++;

  const description = `${relativePath(file)}: ${message}`;
  failures.push(description);

  console.error(`[FAIL] ${description}`);
}

function recordPass(file, message) {
  counters.passed++;
  counters.checked++;

  console.log(`[PASS] ${relativePath(file)} -- ${message}`);
}

function recordSkip(message) {
  counters.skipped++;
  console.log(`[SKIP] ${message}`);
}

function getErrorLocation(error, source) {
  const message = String(error.message || error);

  const positionMatch = message.match(/position\s+(\d+)/i);

  if (positionMatch) {
    const position = Math.max(
      0,
      Math.min(Number(positionMatch[1]), source.length)
    );

    const before = source.slice(0, position);
    const lines = before.split("\n");

    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  const lineColumnMatch = message.match(
    /line\s+(\d+)\s+column\s+(\d+)/i
  );

  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2])
    };
  }

  return null;
}

function parseJson(file) {
  let stat;

  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    throw new Error(`Cannot inspect file: ${error.message}`);
  }

  if (stat.isSymbolicLink()) {
    throw new Error("Symbolic links are not permitted.");
  }

  if (!stat.isFile()) {
    throw new Error("Expected a regular file.");
  }

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB size limit.`
    );
  }

  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`Cannot read file: ${error.message}`);
  }

  if (source.charCodeAt(0) === 0xFEFF) {
    throw new Error(
      "UTF-8 BOM detected. Save the JSON file without a BOM."
    );
  }

  if (!source.trim()) {
    throw new Error("JSON file is empty.");
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    const location = getErrorLocation(error, source);

    if (location) {
      throw new Error(
        `${error.message} (line ${location.line}, column ${location.column})`
      );
    }

    throw error;
  }
}

function collectFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `Cannot read directory ${relativePath(directory)}: ${error.message}`
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectFiles(fullPath, results);
      }

      continue;
    }

    if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === ".json"
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function resolveTargets(targets) {
  const files = [];

  for (const target of targets) {
    const absolute = path.resolve(ROOT, target);

    if (!isInsideRoot(absolute)) {
      throw new Error(
        `Path outside repository rejected: ${target}`
      );
    }

    let stat;

    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      throw new Error(
        `Cannot access ${target}: ${error.message}`
      );
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are not permitted: ${target}`
      );
    }

    if (stat.isFile()) {
      if (path.extname(absolute).toLowerCase() !== ".json") {
        throw new Error(`Not a JSON file: ${target}`);
      }

      files.push(absolute);
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...collectFiles(absolute));
      continue;
    }

    throw new Error(`Unsupported path type: ${target}`);
  }

  return [...new Set(files)].sort();
}

async function loadAjv() {
  try {
    const module = await import("ajv");
    const Ajv = module.default ?? module.Ajv;

    if (typeof Ajv !== "function") {
      throw new Error("Ajv constructor was not exported.");
    }

    return {
      available: true,
      standard: Ajv,
      draft2020: null,
      draft2020Available: false
    };
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" ||
      error.code === "MODULE_NOT_FOUND"
    ) {
      return {
        available: false,
        reason: "Ajv is not installed."
      };
    }

    throw new Error(`Cannot load Ajv: ${error.message}`);
  }
}

async function loadDraft2020Ajv() {
  try {
    const module = await import("ajv/dist/2020.js");
    const Ajv2020 = module.default ?? module.Ajv2020;

    if (typeof Ajv2020 !== "function") {
      throw new Error("Ajv 2020 constructor was not exported.");
    }

    return Ajv2020;
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" ||
      error.code === "MODULE_NOT_FOUND"
    ) {
      return null;
    }

    throw new Error(
      `Cannot load Ajv Draft 2020-12 support: ${error.message}`
    );
  }
}

function getSchemaDraft(schema) {
  const declared = schema?.$schema;

  if (typeof declared !== "string") {
    return "default";
  }

  if (
    declared.includes("2020-12")
  ) {
    return "2020";
  }

  if (
    declared.includes("2019-09")
  ) {
    return "2019";
  }

  return "default";
}

function createValidator(Constructor) {
  return new Constructor({
    allErrors: true,
    strict: false,
    validateSchema: true
  });
}

function formatAjvErrors(errors = []) {
  return errors.map(error => {
    const location = error.instancePath || "/";
    const keyword = error.keyword || "schema";
    const message = error.message || "Validation error";

    return `${location}: ${message} [${keyword}]`;
  });
}

async function validateSchema(data, ajvModules, file) {
  if (!isSchemaFile(file)) {
    return {
      status: "NOT_SCHEMA"
    };
  }

  if (!ajvModules.available) {
    return {
      status: "SKIP",
      message: "Ajv is not installed."
    };
  }

  const draft = getSchemaDraft(data);
  let validator;

  try {
    if (draft === "2020") {
      if (!ajvModules.draft2020) {
        return {
          status: "SKIP",
          message: "Ajv Draft 2020-12 support is unavailable."
        };
      }

      validator = createValidator(ajvModules.draft2020);
    } else {
      validator = createValidator(ajvModules.standard);
    }

    const valid = validator.validateSchema(data);

    if (!valid) {
      return {
        status: "FAIL",
        message: formatAjvErrors(validator.errors)
      };
    }

    return {
      status: "PASS",
      message: `Valid JSON Schema (${draft === "default" ? "default draft" : `Draft ${draft}`}).`
    };
  } catch (error) {
    return {
      status: "FAIL",
      message: [error.message]
    };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version")) {
    console.log(`MedOrbits JSON Schema Validator v${VERSION}`);
    return;
  }

  if (args.some(arg => arg.startsWith("--"))) {
    console.error("[ERROR] Unknown option.");
    printHelp();
    process.exitCode = 2;
    return;
  }

  let files;

  try {
    files = args.length > 0
      ? resolveTargets(args)
      : collectFiles(ROOT);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (files.length === 0) {
    console.log("[SKIP] No JSON files found.");
    return;
  }

  let ajvModules;

  try {
    ajvModules = await loadAjv();

    if (ajvModules.available) {
      ajvModules.draft2020 = await loadDraft2020Ajv();
      ajvModules.draft2020Available = Boolean(
        ajvModules.draft2020
      );
    }
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  console.log("============================================================");
  console.log("MedOrbits JSON Schema Validation");
  console.log("============================================================");
  console.log(`Repository: ${ROOT}`);
  console.log(`Version:    ${VERSION}`);
  console.log(`Files:      ${files.length}`);
  console.log(`Ajv:        ${ajvModules.available ? "available" : "not installed"}`);
  console.log("============================================================");

  for (const file of files) {
    const relative = relativePath(file);

    let data;

    try {
      data = parseJson(file);
      counters.syntaxPassed++;
    } catch (error) {
      recordFailure(file, `JSON syntax: ${error.message}`);
      continue;
    }

    const result = await validateSchema(
      data,
      ajvModules,
      file
    );

    if (result.status === "FAIL") {
      recordFailure(
        file,
        `JSON Schema validation:\n${result.message.join("\n")}`
      );
      continue;
    }

    if (result.status === "SKIP") {
      counters.passed++;
      counters.checked++;
      counters.skipped++;

      console.log(
        `[PASS/SKIP] ${relative} -- JSON syntax valid; ${result.message}`
      );

      continue;
    }

    if (result.status === "PASS") {
      counters.schemaPassed++;
      recordPass(file, result.message);
      continue;
    }

    recordPass(file, "Valid JSON syntax; not a schema-named file.");
  }

  console.log("\n============================================================");
  console.log("MedOrbits JSON Schema Summary");
  console.log("============================================================");
  console.log(`Files checked:       ${counters.checked}`);
  console.log(`Passed:              ${counters.passed}`);
  console.log(`Failed:              ${counters.failed}`);
  console.log(`Schema checks passed:${String(counters.schemaPassed).padStart(4)}`);
  console.log(`Skipped:             ${counters.skipped}`);
  console.log("============================================================");

  if (counters.failed > 0) {
    console.error("\nFailure details:");

    for (const failure of failures) {
      console.error(` - ${failure}`);
    }

    console.error("\n[RESULT] VALIDATION FAILED");
    process.exitCode = 1;
    return;
  }

  if (counters.skipped > 0) {
    console.log(
      "\n[RESULT] JSON syntax checks completed; some schema checks were skipped."
    );
  } else {
    console.log(
      "\n[RESULT] All enabled JSON and JSON Schema checks passed."
    );
  }
}

main().catch(error => {
  console.error(`[FATAL] ${error.message}`);
  process.exitCode = 2;
});
