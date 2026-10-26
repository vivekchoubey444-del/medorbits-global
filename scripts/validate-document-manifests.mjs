
#!/usr/bin/env node

/**
 * MedOrbits -- Document Manifest Validator
 *
 * Validates document manifest JSON files.
 *
 * Checks:
 * - Valid JSON syntax
 * - Required manifest fields
 * - Correct field types
 * - Duplicate document IDs
 * - Missing referenced document files
 * - Invalid manifest entries
 *
 * Usage:
 *   node scripts/validate-document-manifests.mjs
 *   node scripts/validate-document-manifests.mjs --help
 *
 * Optional environment variables:
 *   MANIFEST_DIR=./documents/manifests
 *   DOCUMENT_ROOT=./documents
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

const errors = [];
const warnings = [];
const seenIds = new Map();

let manifestsChecked = 0;
let documentsChecked = 0;

function reportError(file, message) {
  errors.push({ file, message });
}

function reportWarning(file, message) {
  warnings.push({ file, message });
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isInsideDirectory(parent, target) {
  const relative = path.relative(parent, target);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function getJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
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

      return entry.isFile() && entry.name.endsWith(".json")
        ? [fullPath]
        : [];
    });
}

function validateDocument(document, manifestPath, index) {
  const location = `${manifestPath} [entry ${index + 1}]`;

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

  if (typeof document.id === "string" && document.id.trim()) {
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

  if (
    typeof document.title === "string" &&
    document.title.trim() !== "" &&
    document.title.length > 300
  ) {
    reportError(location, 'Field "title" must not exceed 300 characters.');
  }

  if (typeof document.file !== "string" || !document.file.trim()) {
    return;
  }

  const fileReference = document.file.trim();

  if (
    path.isAbsolute(fileReference) ||
    fileReference.includes("\0") ||
    fileReference.includes("\\")
  ) {
    reportError(
      location,
      `Invalid document file path "${fileReference}". Use a relative path with forward slashes.`
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

  const extension = path.extname(resolvedFile).toLowerCase();

  if (!VALID_EXTENSIONS.has(extension)) {
    reportWarning(
      location,
      `Unexpected document extension "${extension || "(none)"}".`
    );
  }

  let stat;

  try {
    stat = fs.lstatSync(resolvedFile);
  } catch (error) {
    if (error.code === "ENOENT") {
      reportError(
        location,
        `Referenced document does not exist: ${fileReference}`
      );
    } else {
      reportError(
        location,
        `Cannot access "${fileReference}": ${error.message}`
      );
    }
    return;
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    reportError(
      location,
      `Referenced document must be a regular, non-symlink file: ${fileReference}`
    );
    return;
  }

  documentsChecked += 1;
}

function validateManifest(manifestPath) {
  manifestsChecked += 1;

  let parsed;

  try {
    const source = fs.readFileSync(manifestPath, "utf8");
    parsed = JSON.parse(source);
  } catch (error) {
    reportError(manifestPath, `Invalid JSON: ${error.message}`);
    return;
  }

  let documents;

  if (Array.isArray(parsed)) {
    documents = parsed;
  } else if (isPlainObject(parsed) && Array.isArray(parsed.documents)) {
    documents = parsed.documents;
  } else {
    reportError(
      manifestPath,
      'Manifest must be a JSON array or an object containing a "documents" array.'
    );
    return;
  }

  if (documents.length === 0) {
    reportWarning(manifestPath, "Manifest contains no documents.");
  }

  documents.forEach((document, index) => {
    validateDocument(document, manifestPath, index);
  });
}

function printResults() {
  console.log("\nMedOrbits Document Manifest Validation\n");

  for (const error of errors) {
    console.error(`ERROR: ${error.file}\n  ${error.message}`);
  }

  for (const warning of warnings) {
    console.warn(`WARNING: ${warning.file}\n  ${warning.message}`);
  }

  console.log("\nSummary");
  console.log(`Manifests checked: ${manifestsChecked}`);
  console.log(`Documents verified: ${documentsChecked}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.error("\nValidation FAILED.");
    process.exitCode = 1;
  } else {
    console.log("\nValidation PASSED.");
  }
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
MedOrbits Document Manifest Validator

Usage:
  node scripts/validate-document-manifests.mjs

Options:
  -h, --help   Show this help message

Environment variables:
  MANIFEST_DIR    Manifest directory (default: documents/manifests)
  DOCUMENT_ROOT   Referenced document root (default: documents)
`);
    return;
  }

  if (!fs.existsSync(MANIFEST_DIR)) {
    console.error(`Manifest directory not found: ${MANIFEST_DIR}`);
    console.error(
      "Set MANIFEST_DIR to the directory containing your manifest JSON files."
    );
    process.exitCode = 1;
    return;
  }

  let manifestStat;

  try {
    manifestStat = fs.lstatSync(MANIFEST_DIR);
  } catch (error) {
    console.error(`Cannot access manifest directory: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!manifestStat.isDirectory() || manifestStat.isSymbolicLink()) {
    console.error("MANIFEST_DIR must be a real directory, not a symlink.");
    process.exitCode = 1;
    return;
  }

  const manifestFiles = getJsonFiles(MANIFEST_DIR);

  if (manifestFiles.length === 0) {
    reportError(
      MANIFEST_DIR,
      "No JSON manifest files found in the manifest directory."
    );
  }

  for (const manifestPath of manifestFiles) {
    validateManifest(manifestPath);
  }

  printResults();
}

main();
