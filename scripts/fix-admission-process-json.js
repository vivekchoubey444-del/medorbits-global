
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- Admission Process JSON Repair Utility
 *
 * File: scripts/repair-admission-process.cjs
 *
 * Purpose:
 *   Safely repair assets/data/admission-process.json when it contains
 *   exactly two concatenated JSON objects.
 *
 * Safety:
 *   - Does not modify the source until both JSON objects validate.
 *   - Requires schemaVersion 1.1.0 and a non-empty processes array.
 *   - Rejects duplicate process IDs and slugs.
 *   - Rejects symlinked input files.
 *   - Creates a backup without overwriting an existing backup.
 *   - Writes a temporary file and verifies it before replacement.
 *   - Preserves the original if validation or preparation fails.
 *
 * Usage:
 *   node scripts/repair-admission-process.cjs
 *   node scripts/repair-admission-process.cjs --dry-run
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();

const filePath = path.resolve(
  ROOT,
  "assets/data/admission-process.json"
);

const backupPath = `${filePath}.bak`;

function assertInsideRoot(target) {
  const relative = path.relative(ROOT, target);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Target path escapes the current working directory.");
  }
}

function assertRegularNonSymlinkFile(target) {
  const stat = fs.lstatSync(target);

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Target must be a regular, non-symlink file.");
  }
}

function extractJsonDocuments(source) {
  const documents = [];

  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }

      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth < 0) {
        throw new Error("Unexpected closing brace.");
      }

      if (depth === 0 && start !== -1) {
        documents.push(source.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (inString || depth !== 0) {
    throw new Error("Incomplete JSON document.");
  }

  if (source.trim() === "") {
    throw new Error("Source file is empty.");
  }

  return documents;
}

function validateExpandedDocument(expanded) {
  if (
    !expanded ||
    typeof expanded !== "object" ||
    Array.isArray(expanded)
  ) {
    throw new Error("Expanded document must be a JSON object.");
  }

  if (expanded.schemaVersion !== "1.1.0") {
    throw new Error(
      `Expected schemaVersion 1.1.0; received ${String(
        expanded.schemaVersion
      )}.`
    );
  }

  if (
    !Array.isArray(expanded.processes) ||
    expanded.processes.length === 0
  ) {
    throw new Error(
      "Expanded document must contain a non-empty processes array."
    );
  }

  const ids = [];
  const slugs = [];

  for (const [index, process] of expanded.processes.entries()) {
    if (
      !process ||
      typeof process !== "object" ||
      Array.isArray(process)
    ) {
      throw new Error(`Process entry ${index + 1} must be an object.`);
    }

    if (
      typeof process.id !== "string" ||
      !process.id.trim()
    ) {
      throw new Error(
        `Process entry ${index + 1} requires a non-empty string ID.`
      );
    }

    if (
      typeof process.slug !== "string" ||
      !process.slug.trim()
    ) {
      throw new Error(
        `Process entry ${index + 1} requires a non-empty string slug.`
      );
    }

    ids.push(process.id.trim());
    slugs.push(process.slug.trim());
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate process IDs detected.");
  }

  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Duplicate process slugs detected.");
  }
}

function verifyJsonFile(target, expected) {
  const actual = JSON.parse(fs.readFileSync(target, "utf8"));

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Written JSON does not match the validated document.");
  }

  return actual;
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const help = process.argv.includes("--help") ||
    process.argv.includes("-h");

  const allowed = new Set(["--dry-run", "--help", "-h"]);

  for (const arg of process.argv.slice(2)) {
    if (!allowed.has(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (help) {
    console.log(`MedOrbits Admission JSON Repair

Usage:
  node scripts/repair-admission-process.cjs [options]

Options:
  --dry-run    Validate without changing files
  --help, -h   Show this help

Target:
  assets/data/admission-process.json

Backup:
  assets/data/admission-process.json.bak
`);
    return;
  }

  assertInsideRoot(filePath);
  assertInsideRoot(backupPath);

  assertRegularNonSymlinkFile(filePath);

  const original = fs.readFileSync(filePath, "utf8");
  const documents = extractJsonDocuments(original);

  if (documents.length !== 2) {
    throw new Error(
      `Expected exactly 2 JSON documents; found ${documents.length}. ` +
      "No changes were made."
    );
  }

  // Parse and validate both documents before writing anything.
  const first = JSON.parse(documents[0]);
  const expanded = JSON.parse(documents[1]);

  if (
    !first ||
    typeof first !== "object" ||
    Array.isArray(first)
  ) {
    throw new Error("The first JSON document must be an object.");
  }

  validateExpandedDocument(expanded);

  const output = `${JSON.stringify(expanded, null, 2)}\n`;

  // Validate the exact serialized output before preparing the backup.
  const serializedCheck = JSON.parse(output);
  validateExpandedDocument(serializedCheck);

  if (dryRun) {
    console.log("Dry run passed.");
    console.log(`Target: ${path.relative(ROOT, filePath)}`);
    console.log(`Processes: ${expanded.processes.length}`);
    console.log("No files were modified.");
    return;
  }

  if (fs.existsSync(backupPath)) {
    throw new Error(
      `Backup already exists: ${backupPath}. ` +
      "Preserve it and inspect it before attempting another repair."
    );
  }

  // Recheck the original immediately before writing.
  assertRegularNonSymlinkFile(filePath);

  const currentOriginal = fs.readFileSync(filePath, "utf8");

  if (currentOriginal !== original) {
    throw new Error(
      "Source changed during validation. No changes were made."
    );
  }

  const tempPath = path.join(
    path.dirname(filePath),
    `.admission-process-${process.pid}-${crypto
      .randomBytes(8)
      .toString("hex")}.tmp`
  );

  let backupCreated = false;
  let tempCreated = false;

  try {
    // Create a non-overwriting backup.
    fs.writeFileSync(backupPath, original, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    backupCreated = true;

    // Confirm the backup contains the exact original bytes.
    const backupContents = fs.readFileSync(backupPath, "utf8");

    if (backupContents !== original) {
      throw new Error("Backup verification failed.");
    }

    fs.writeFileSync(tempPath, output, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    tempCreated = true;

    verifyJsonFile(tempPath, expanded);

    // Ensure the source still has the contents validated above.
    assertRegularNonSymlinkFile(filePath);

    if (fs.readFileSync(filePath, "utf8") !== original) {
      throw new Error(
        "Source changed before replacement. Original was preserved."
      );
    }

    // Same-directory rename makes replacement atomic on typical local
    // filesystems. The verified backup remains available for recovery.
    fs.renameSync(tempPath, filePath);
    tempCreated = false;

    const verified = verifyJsonFile(filePath, expanded);

    console.log("Admission JSON repaired successfully.");
    console.log(`Processes: ${verified.processes.length}`);
    console.log(`Target: ${path.relative(ROOT, filePath)}`);
    console.log(`Backup: ${path.relative(ROOT, backupPath)}`);
  } catch (error) {
    if (tempCreated) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Preserve the original failure.
      }
    }

    /*
     * Do not automatically delete the backup on failure. It contains
     * the original source and is useful for manual recovery.
     */
    if (backupCreated) {
      console.error(
        `Original backup preserved at: ${path.relative(ROOT, backupPath)}`
      );
    }

    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`Repair failed: ${error.message}`);
  process.exitCode = 1;
}
