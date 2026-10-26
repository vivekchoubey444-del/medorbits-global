
#!/usr/bin/env node

/**
 * MedOrbits -- Document Manifest Validator
 *
 * File: scripts/validate-document-manifests.mjs
 *
 * Validates document manifest JSON files without modifying repository files.
 *
 * Checks:
 * - Valid JSON syntax, including UTF-8 BOM handling
 * - Required manifest fields and field types
 * - Duplicate document IDs across all manifests
 * - Document title length
 * - Safe relative document paths
 * - Path traversal and symlink protection
 * - Referenced file existence and regular-file status
 * - Allowed document extensions
 * - Empty manifests and empty discovery results
 *
 * Usage:
 *   node scripts/validate-document-manifests.mjs
 *   node scripts/validate-document-manifests.mjs --strict
 *   node scripts/validate-document-manifests.mjs --json
 *   node scripts/validate-document-manifests.mjs --help
 *
 * Environment variables:
 *   MANIFEST_DIR=./documents/manifests
 *   DOCUMENT_ROOT=./documents
 *
 * Exit codes:
 *   0 = validation passed
 *   1 = validation errors, or warnings in strict mode
 *   2 = invalid configuration or runtime failure
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const MANIFEST_DIR = path.resolve(
  REPO_ROOT,
  process.env.MANIFEST_DIR || "documents/manifests"
);

const DOCUMENT_ROOT = path.resolve(
  REPO_ROOT,
  process.env.DOCUMENT_ROOT || "documents"
);

const REQUIRED_FIELDS = ["id", "title", "file"];
const VALID_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const MAX_TITLE_LENGTH = 300;

const args = new Set(process.argv.slice(2));
const HELP = args.has("--help") || args.has("-h");
const STRICT = args.has("--strict");
const JSON_OUTPUT = args.has("--json");

const errors = [];
const warnings = [];
const seenIds = new Map();

let manifestsChecked = 0;
let documentsChecked = 0;
let entriesChecked = 0;

function reportError(file, message) {
  errors.push({ file, message });
}

function reportWarning(file, message) {
  warnings.push({ file, message });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isInsideDirectory(parent, target) {
  const relative = path.relative(parent, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function readJsonFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

  if (source.trim() === "") {
    throw new Error("File is empty.");
  }

  return JSON.parse(source);
}

function getJsonFiles(directory) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    reportError(directory, `Cannot read directory: ${error.message}`);
    return [];
  }

  return entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        reportWarning(
          fullPath,
          "Symbolic link skipped during manifest discovery."
        );
        return [];
      }

      if (entry.isDirectory()) {
        return getJsonFiles(fullPath);
      }

      return entry.isFile() && entry.name.toLowerCase().endsWith(".json")
        ? [fullPath]
        : [];
    });
}

function validateDocument(document, manifestPath, index) {
  const location = `${path.relative(REPO_ROOT, manifestPath)} [entry ${index + 1}]`;
  entriesChecked += 1;

  if (!isPlainObject(document)) {
    reportError(location, "Document entry must be a JSON object.");
    return;
  }

  for (const field of REQUIRED_FIELDS) {
    if (
      typeof document[field] !== "string" ||
      document[field].trim() === ""
    ) {
      reportError(
        location,
        `Required field "${field}" must be a non-empty string.`
      );
    }
  }

  if (typeof document.id === "string" && document.id.trim() !== "") {
    const id = document.id.trim();

    if (seenIds.has(id)) {
      reportError(
        location,
        `Duplicate document ID "${id}". First defined in ${seenIds.get(id)}.`
      );
    } else {
      seenIds.set(id, location);
    }
  }

  if (typeof document.title === "string") {
    if (document.title.trim() === "") {
      reportError(location, 'Field "title" must not be blank.');
    } else if (document.title.length > MAX_TITLE_LENGTH) {
      reportError(
        location,
        `Field "title" must not exceed ${MAX_TITLE_LENGTH} characters.`
      );
    }
  }

  if (typeof document.file !== "string" || document.file.trim() === "") {
    return;
  }

  const fileReference = document.file.trim();

  if (
    fileReference.includes("\0") ||
    fileReference.includes("\\") ||
    path.posix.isAbsolute(fileReference) ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(fileReference)
  ) {
    reportError(
      location,
      `Invalid document path "${fileReference}". Use a relative path with forward slashes.`
    );
    return;
  }

  const resolvedFile = path.resolve(DOCUMENT_ROOT, fileReference);

  if (!isInsideDirectory(DOCUMENT_ROOT, resolvedFile)) {
    reportError(
      location,
      `Document path "${fileReference}" escapes the document root.`
    );
    return;
  }

  const extension = path.extname(fileReference).toLowerCase();

  if (!VALID_EXTENSIONS.has(extension)) {
    reportWarning(
      location,
      `Unexpected document extension "${extension || "(none)"}". Allowed: ${[
        ...VALID_EXTENSIONS,
      ].join(", ")}.`
    );
  }

  /*
   * Check every existing path component for symlinks. This prevents a
   * reference from escaping DOCUMENT_ROOT through a symlinked subdirectory.
   */
  const relativePath = path.relative(DOCUMENT_ROOT, resolvedFile);
  const segments = relativePath.split(path.sep);
  let currentPath = DOCUMENT_ROOT;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);

    let componentStat;

    try {
      componentStat = fs.lstatSync(currentPath);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        reportError(
          location,
          `Referenced document does not exist: ${fileReference}`
        );
      } else {
        reportError(
          location,
          `Cannot inspect "${fileReference}": ${error.message}`
        );
      }

      return;
    }

    if (componentStat.isSymbolicLink()) {
      reportError(
        location,
        `Document path contains a symbolic link: ${fileReference}`
      );
      return;
    }

    if (
      currentPath !== resolvedFile &&
      !componentStat.isDirectory()
    ) {
      reportError(
        location,
        `Path component is not a directory: ${segment}`
      );
      return;
    }

    if (currentPath === resolvedFile && !componentStat.isFile()) {
      reportError(
        location,
        `Referenced document must be a regular file: ${fileReference}`
      );
      return;
    }
  }

  documentsChecked += 1;
}

function validateManifest(manifestPath) {
  manifestsChecked += 1;

  let parsed;

  try {
    parsed = readJsonFile(manifestPath);
  } catch (error) {
    reportError(
      path.relative(REPO_ROOT, manifestPath),
      `Invalid JSON: ${error.message}`
    );
    return;
  }

  let documents;

  if (Array.isArray(parsed)) {
    documents = parsed;
  } else if (isPlainObject(parsed) && Array.isArray(parsed.documents)) {
    documents = parsed.documents;
  } else {
    reportError(
      path.relative(REPO_ROOT, manifestPath),
      'Manifest must be a JSON array or an object containing a "documents" array.'
    );
    return;
  }

  if (documents.length === 0) {
    reportWarning(
      path.relative(REPO_ROOT, manifestPath),
      "Manifest contains no documents."
    );
  }

  documents.forEach((document, index) => {
    validateDocument(document, manifestPath, index);
  });
}

function printTextResults() {
  console.log("\nMedOrbits Document Manifest Validation\n");

  for (const error of errors) {
    console.error(`ERROR: ${error.file}\n  ${error.message}`);
  }

  for (const warning of warnings) {
    console.warn(`WARNING: ${warning.file}\n  ${warning.message}`);
  }

  console.log("\nSummary");
  console.log(`Manifests checked: ${manifestsChecked}`);
  console.log(`Entries checked: ${entriesChecked}`);
  console.log(`Documents verified: ${documentsChecked}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (errors.length > 0 || (STRICT && warnings.length > 0)) {
    console.error("\nValidation FAILED.");
  } else {
    console.log("\nValidation PASSED.");
  }
}

function printJsonResults() {
  console.log(
    JSON.stringify(
      {
        validator: "MedOrbits Document Manifest Validator",
        status:
          errors.length > 0 || (STRICT && warnings.length > 0)
            ? "failed"
            : "passed",
        strict: STRICT,
        directories: {
          manifest: path.relative(REPO_ROOT, MANIFEST_DIR),
          documents: path.relative(REPO_ROOT, DOCUMENT_ROOT),
        },
        summary: {
          manifestsChecked,
          entriesChecked,
          documentsChecked,
          errors: errors.length,
          warnings: warnings.length,
        },
        errors,
        warnings,
      },
      null,
      2
    )
  );
}

function main() {
  const supportedArgs = new Set(["--help", "-h", "--strict", "--json"]);
  const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg));

  if (unknownArgs.length > 0) {
    console.error(`Unknown option(s): ${unknownArgs.join(", ")}`);
    console.error("Use --help to see supported options.");
    process.exitCode = 2;
    return;
  }

  if (HELP) {
    console.log(`
MedOrbits Document Manifest Validator

Usage:
  node scripts/validate-document-manifests.mjs [options]

Options:
  -h, --help   Show this help message
  --strict     Treat warnings as validation failures
  --json       Print machine-readable JSON results

Environment variables:
  MANIFEST_DIR    Manifest directory (default: documents/manifests)
  DOCUMENT_ROOT   Referenced document root (default: documents)

Examples:
  node scripts/validate-document-manifests.mjs
  node scripts/validate-document-manifests.mjs --strict
  node scripts/validate-document-manifests.mjs --json
`);
    return;
  }

  let manifestStat;

  try {
    manifestStat = fs.lstatSync(MANIFEST_DIR);
  } catch (error) {
    console.error(`Manifest directory not found or inaccessible: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (!manifestStat.isDirectory() || manifestStat.isSymbolicLink()) {
    console.error("MANIFEST_DIR must be a real directory, not a symlink.");
    process.exitCode = 2;
    return;
  }

  let documentRootStat;

  try {
    documentRootStat = fs.lstatSync(DOCUMENT_ROOT);
  } catch (error) {
    console.error(`Document root not found or inaccessible: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (!documentRootStat.isDirectory() || documentRootStat.isSymbolicLink()) {
    console.error("DOCUMENT_ROOT must be a real directory, not a symlink.");
    process.exitCode = 2;
    return;
  }

  const manifestFiles = getJsonFiles(MANIFEST_DIR);

  if (manifestFiles.length === 0) {
    reportError(
      path.relative(REPO_ROOT, MANIFEST_DIR),
      "No JSON manifest files found in the manifest directory."
    );
  }

  for (const manifestPath of manifestFiles) {
    validateManifest(manifestPath);
  }

  if (JSON_OUTPUT) {
    printJsonResults();
  } else {
    printTextResults();
  }

  if (errors.length > 0 || (STRICT && warnings.length > 0)) {
    process.exitCode = 1;
  }
}

main();
