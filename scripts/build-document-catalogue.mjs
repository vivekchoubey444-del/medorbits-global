#!/usr/bin/env node
/**
 * MedOrbits Document Catalogue Builder
 * File: /scripts/build-document-catalogue.mjs
 *
 * Purpose:
 *   Discover document manifests and generate a public JSON catalogue
 *   containing published resources only.
 *
 * Usage:
 *   node scripts/build-document-catalogue.mjs
 *   node scripts/build-document-catalogue.mjs --dry-run
 *   node scripts/build-document-catalogue.mjs --json
 *   node scripts/build-document-catalogue.mjs --dir=assets/documents
 *   node scripts/build-document-catalogue.mjs --output=assets/documents/catalogue.json
 *
 * Security:
 *   - Rejects unsafe resource paths and path traversal.
 *   - Skips symbolic links.
 *   - Prevents output outside the repository.
 *   - Detects duplicate IDs and resource paths.
 *   - Does not publish draft or archived resources.
 *   - Does not overwrite the output when validation fails.
 *   - Supports deterministic catalogue ordering.
 *
 * Requirements:
 *   Node.js 20+
 *   ES modules enabled by package.json or .mjs extension.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_DOCUMENTS_DIR = "assets/documents";
const DEFAULT_OUTPUT_FILE = "assets/documents/catalogue.json";
const ALLOWED_STATUSES = new Set([
  "published",
  "draft",
  "archived"
]);
const DEFAULTS = Object.freeze({
  category: "general",
  description: "",
  intendedUse: "",
  format: "application/pdf",
  language: "en",
  version: "1.0.0"
});
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jsonOutput = args.includes("--json");
const helpRequested = args.includes("--help") || args.includes("-h");
const errors = [];
const warnings = [];
const catalogue = [];
const seenIds = new Map();
const seenPaths = new Map();
const visitedDirectories = new Set();
function printHelp() {
  console.log(`MedOrbits Document Catalogue Builder
Usage:
  node scripts/build-document-catalogue.mjs [options]
Options:
  --dir=PATH       Documents directory, relative to repository root
  --output=PATH    Output JSON path, relative to repository root
  --dry-run        Validate and report without writing files
  --json           Output a machine-readable JSON report
  --help, -h       Display this help message
Examples:
  node scripts/build-document-catalogue.mjs --dry-run
  node scripts/build-document-catalogue.mjs --json
  node scripts/build-document-catalogue.mjs --dir=assets/documents
`);
}
function option(name, fallback) {
  const prefix = `--${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) {
    errors.push({
      file: "scripts/build-document-catalogue.mjs",
      message: `Option --${name} was provided more than once.`
    });
  }
  if (matches.length === 0) return fallback;
  const value = matches[matches.length - 1].slice(prefix.length).trim();
  if (!value) {
    errors.push({
      file: "scripts/build-document-catalogue.mjs",
      message: `Option --${name} cannot be empty.`
    });
    return fallback;
  }
  return value;
}
function relative(file) {
  return path.relative(ROOT_DIR, file).split(path.sep).join("/") || ".";
}
function addError(file, message) {
  errors.push({
    file: relative(file),
    message
  });
}
function addWarning(file, message) {
  warnings.push({
    file: relative(file),
    message
  });
}
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return (
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}
function resolveRepositoryPath(input, label) {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.includes("\0")
  ) {
    addError(
      ROOT_DIR,
      `${label} must be a non-empty valid path.`
    );
    return null;
  }
  const resolved = path.resolve(ROOT_DIR, input);
  if (!isInside(ROOT_DIR, resolved)) {
    addError(
      resolved,
      `${label} must remain inside the repository.`
    );
    return null;
  }
  return resolved;
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    addError(
      file,
      `Invalid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return null;
  }
}
function safeLstat(file) {
  try {
    return fs.lstatSync(file);
  } catch {
    return null;
  }
}
function normalizeKeywords(value, manifestFile, location) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addWarning(
      manifestFile,
      `${location}.keywords must be an array; using an empty array.`
    );
    return [];
  }
  const normalized = [];
  for (const item of value) {
    if (typeof item !== "string") {
      addWarning(
        manifestFile,
        `${location}.keywords contains a non-string value; skipped.`
      );
      continue;
    }
    const keyword = item.trim();
    if (keyword) normalized.push(keyword);
  }
  return [...new Set(normalized)];
}
function normalizeText(
  value,
  fallback,
  manifestFile,
  location,
  maxLength = 10000
) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") {
    addWarning(
      manifestFile,
      `${location} must be a string; using the default value.`
    );
    return fallback;
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    addError(
      manifestFile,
      `${location} exceeds the maximum length of ${maxLength}.`
    );
    return fallback;
  }
  return normalized;
}
function validateIdentifier(id, manifestFile, location) {
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.trim().length > 200 ||
    /[\u0000-\u001f\u007f]/.test(id)
  ) {
    addError(
      manifestFile,
      `${location}.id must be a non-empty string of at most 200 characters without control characters.`
    );
    return null;
  }
  return id.trim();
}
function resolveResourcePath(manifestFile, resourcePath) {
  if (
    typeof resourcePath !== "string" ||
    !resourcePath.trim() ||
    resourcePath.includes("\0") ||
    resourcePath.includes("\\") ||
    path.isAbsolute(resourcePath) ||
    /^[a-z][a-z0-9+.-]*:/i.test(resourcePath) ||
    resourcePath.startsWith("/")
  ) {
    return null;
  }
  const segments = resourcePath.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".."
    )
  ) {
    return null;
  }
  const resolved = path.resolve(
    path.dirname(manifestFile),
    resourcePath
  );
  if (!isInside(documentsDir, resolved)) {
    return null;
  }
  // Check every existing path component for symbolic links.
  // This prevents a resource from escaping the document tree
  // through a symlinked file or parent directory.
  const relativePath = path.relative(documentsDir, resolved);
  const components = relativePath.split(path.sep);
  let current = documentsDir;
  for (const component of components) {
    current = path.join(current, component);
    const stat = safeLstat(current);
    if (stat?.isSymbolicLink()) {
      return null;
    }
  }
  return resolved;
}
function publicResourceUrl(manifestFile, resourcePath) {
  const resolved = resolveResourcePath(manifestFile, resourcePath);
  if (!resolved) return null;
  const documentRelative = path.relative(documentsDir, resolved);
  return `/assets/documents/${documentRelative
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
function findManifests(directory) {
  const results = [];
  const rootStat = safeLstat(directory);
  if (!rootStat) {
    addError(directory, "Documents directory does not exist.");
    return results;
  }
  if (rootStat.isSymbolicLink()) {
    addError(directory, "Documents directory cannot be a symbolic link.");
    return results;
  }
  if (!rootStat.isDirectory()) {
    addError(directory, "Documents path is not a directory.");
    return results;
  }
  function walk(current) {
    const normalizedCurrent = path.resolve(current);
    if (visitedDirectories.has(normalizedCurrent)) {
      addWarning(current, "Directory already visited; skipped.");
      return;
    }
    visitedDirectories.add(normalizedCurrent);
    let entries;
    try {
      entries = fs.readdirSync(current, {
        withFileTypes: true
      });
    } catch (err) {
      addError(
        current,
        `Cannot read directory: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return;
    }
    entries.sort((a, b) =>
      a.name.localeCompare(b.name, "en", {
        sensitivity: "base"
      })
    );
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        addWarning(fullPath, "Symbolic link skipped.");
        continue;
      }
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (
        entry.isFile() &&
        entry.name.toLowerCase() === "manifest.json"
      ) {
        results.push(fullPath);
      }
    }
  }
  walk(directory);
  return results;
}
function processManifest(manifestFile) {
  const manifest = readJson(manifestFile);
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    addError(manifestFile, "Manifest root must be an object.");
    return;
  }
  if (!Array.isArray(manifest.resources)) {
    addWarning(
      manifestFile,
      "Manifest has no resources array; skipped."
    );
    return;
  }
  for (const [index, resource] of manifest.resources.entries()) {
    const location = `resources[${index}]`;
    if (
      !resource ||
      typeof resource !== "object" ||
      Array.isArray(resource)
    ) {
      addError(manifestFile, `${location} must be an object.`);
      continue;
    }
    const id = validateIdentifier(
      resource.id,
      manifestFile,
      location
    );
    const title =
      typeof resource.title === "string"
        ? resource.title.trim()
        : "";
    const resourcePath =
      typeof resource.path === "string"
        ? resource.path.trim()
        : "";
    if (!id || !title || !resourcePath) {
      addError(
        manifestFile,
        `${location} requires a valid id, title, and path.`
      );
      continue;
    }
    if (title.length > 500) {
      addError(
        manifestFile,
        `${location}.title exceeds 500 characters.`
      );
      continue;
    }
    if (seenIds.has(id)) {
      addError(
        manifestFile,
        `Duplicate resource ID "${id}" (also declared in ${relative(
          seenIds.get(id)
        )}).`
      );
      continue;
    }
    const resolved = resolveResourcePath(
      manifestFile,
      resourcePath
    );
    if (!resolved) {
      addError(
        manifestFile,
        `${location}.path is unsafe or resolves outside the documents directory.`
      );
      continue;
    }
    const normalizedPath = path
      .relative(documentsDir, resolved)
      .split(path.sep)
      .join("/");
    if (seenPaths.has(normalizedPath)) {
      addError(
        manifestFile,
        `Duplicate resource path "${normalizedPath}" (also declared in ${relative(
          seenPaths.get(normalizedPath)
        )}).`
      );
      continue;
    }
    const resourceStat = safeLstat(resolved);
    const status = resource.status;
    if (
      status === "published" &&
      (!resourceStat ||
        resourceStat.isSymbolicLink() ||
        !resourceStat.isFile())
    ) {
      addError(
        manifestFile,
        `Published resource file is missing or is not a regular file: ${normalizedPath}`
      );
      continue;
    }
    if (status === "published" && !resourceStat) {
      addError(
        manifestFile,
        `Published resource file does not exist: ${normalizedPath}`
      );
      continue;
    }
    if (
      typeof status !== "string" ||
      !ALLOWED_STATUSES.has(status)
    ) {
      addWarning(
        manifestFile,
        `${location} has unrecognized status "${String(status)}".`
      );
      continue;
    }
    seenIds.set(id, manifestFile);
    seenPaths.set(normalizedPath, manifestFile);
    // Only explicitly published resources enter the public catalogue.
    if (status !== "published") continue;
    const url = publicResourceUrl(
      manifestFile,
      resourcePath
    );
    if (!url) {
      addError(
        manifestFile,
        `${location} has an invalid public resource URL.`
      );
      continue;
    }
    const category = normalizeText(
      resource.category,
      DEFAULTS.category,
      manifestFile,
      `${location}.category`,
      150
    );
    const description = normalizeText(
      resource.description,
      DEFAULTS.description,
      manifestFile,
      `${location}.description`,
      10000
    );
    const intendedUse = normalizeText(
      resource.intendedUse,
      DEFAULTS.intendedUse,
      manifestFile,
      `${location}.intendedUse`,
      5000
    );
    const format = normalizeText(
      resource.format,
      DEFAULTS.format,
      manifestFile,
      `${location}.format`,
      150
    );
    const language = normalizeText(
      resource.language,
      DEFAULTS.language,
      manifestFile,
      `${location}.language`,
      35
    );
    const version = normalizeText(
      resource.version,
      DEFAULTS.version,
      manifestFile,
      `${location}.version`,
      100
    );
    catalogue.push({
      id,
      title,
      category,
      description,
      intendedUse,
      format,
      language,
      version,
      keywords: normalizeKeywords(
        resource.keywords,
        manifestFile,
        location
      ),
      url
    });
  }
}
function main() {
  if (helpRequested) {
    printHelp();
    return;
  }
  const documentsInput = option(
    "dir",
    DEFAULT_DOCUMENTS_DIR
  );
  const outputInput = option(
    "output",
    DEFAULT_OUTPUT_FILE
  );
  const resolvedDocumentsDir = resolveRepositoryPath(
    documentsInput,
    "--dir"
  );
  const resolvedOutputFile = resolveRepositoryPath(
    outputInput,
    "--output"
  );
  if (!resolvedDocumentsDir || !resolvedOutputFile) {
    report();
    process.exitCode = 1;
    return;
  }
  // Used by resource validation and URL generation.
  documentsDir = resolvedDocumentsDir;
  outputFile = resolvedOutputFile;
  if (!isInside(ROOT_DIR, outputFile)) {
    addError(
      outputFile,
      "Output path must remain inside the repository."
    );
  }
  if (isInside(documentsDir, outputFile)) {
    addWarning(
      outputFile,
      "Output is inside the scanned documents directory. Ensure the generated catalogue is not referenced as a resource."
    );
  }
  if (errors.length > 0) {
    report();
    process.exitCode = 1;
    return;
  }
  const manifestFiles = findManifests(documentsDir);
  for (const manifestFile of manifestFiles) {
    processManifest(manifestFile);
  }
  catalogue.sort((a, b) =>
    a.title.localeCompare(b.title, "en", {
      sensitivity: "base"
    })
  );
  const output = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    count: catalogue.length,
    resources: catalogue
  };
  report(manifestFiles.length, output);
  if (errors.length > 0) {
    if (!jsonOutput) {
      console.error(
        "Catalogue generation stopped; fix the errors first."
      );
    }
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    if (!jsonOutput) {
      console.log("Dry run complete; no files written.");
    }
    return;
  }
  try {
    fs.mkdirSync(path.dirname(outputFile), {
      recursive: true
    });
    // Recheck the output parent for symlinks before writing.
    // This is defense in depth; the repository should not be
    // writable by untrusted concurrent processes.
    const outputParent = path.dirname(outputFile);
    const relativeParent = path.relative(ROOT_DIR, outputParent);
    let current = ROOT_DIR;
    for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stat = safeLstat(current);
      if (stat?.isSymbolicLink()) {
        throw new Error(
          `Output path contains a symbolic-link directory: ${relative(current)}`
        );
      }
    }
    const temporaryFile = `${outputFile}.tmp-${process.pid}`;
    try {
      fs.writeFileSync(
        temporaryFile,
        `${JSON.stringify(output, null, 2)}\n`,
        {
          encoding: "utf8",
          flag: "wx",
          mode: 0o644
        }
      );
      fs.renameSync(temporaryFile, outputFile);
    } finally {
      try {
        if (fs.existsSync(temporaryFile)) {
          fs.unlinkSync(temporaryFile);
        }
      } catch {
        // Preserve the primary error; report cleanup failures separately
        // through deployment monitoring if necessary.
      }
    }
    if (!jsonOutput) {
      console.log(`Catalogue written to ${relative(outputFile)}`);
    }
  } catch (err) {
    console.error(
      `Unable to write catalogue: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    process.exitCode = 1;
  }
}
function report(manifestsFound = 0, output = null) {
  const result = {
    ok: errors.length === 0,
    manifestsFound,
    publishedResources: catalogue.length,
    output: typeof outputFile === "string"
      ? relative(outputFile)
      : null,
    errors,
    warnings
  };
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        output
          ? { ...result, catalogue: output }
          : result,
        null,
        2
      )
    );
    return;
  }
  console.log("MedOrbits document catalogue builder");
  console.log(`Manifests found: ${manifestsFound}`);
  console.log(`Published resources: ${catalogue.length}`);
  for (const warning of warnings) {
    console.warn(
      `WARNING: ${warning.file}: ${warning.message}`
    );
  }
  for (const error of errors) {
    console.error(
      `ERROR: ${error.file}: ${error.message}`
    );
  }
}
// Initialized only after validating the CLI path arguments.
let documentsDir = path.resolve(
  ROOT_DIR,
  DEFAULT_DOCUMENTS_DIR
);
let outputFile = path.resolve(
  ROOT_DIR,
  DEFAULT_OUTPUT_FILE
);
main();