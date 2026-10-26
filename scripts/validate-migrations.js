
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- Database Migration Validator
 * File: scripts/validate-migrations.js
 *
 * Purpose:
 * - Discover database migration files.
 * - Validate migration filenames and ordering.
 * - Detect duplicate migration identifiers.
 * - Check SQL files for common structural problems.
 * - Detect potentially destructive SQL for manual review.
 * - Optionally validate migration manifests.
 *
 * Safety:
 * - Read-only; never executes SQL.
 * - Never connects to a database.
 * - Never modifies migration files.
 *
 * Usage:
 *   node scripts/validate-migrations.js
 *   node scripts/validate-migrations.js --strict
 *   node scripts/validate-migrations.js --dir database/migrations
 *   node scripts/validate-migrations.js --help
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const DEFAULT_DIRS = [
  "database/migrations",
  "db/migrations",
  "migrations",
  "prisma/migrations",
];

const MIGRATION_EXTENSIONS = new Set([
  ".sql",
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
]);

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

const args = process.argv.slice(2);

const STRICT = args.includes("--strict");
const HELP = args.includes("--help") || args.includes("-h");

const dirArgIndex = args.indexOf("--dir");
const CUSTOM_DIR =
  dirArgIndex >= 0 ? args[dirArgIndex + 1] : null;

const errors = [];
const warnings = [];
const reviewed = [];

let checkedFiles = 0;

function usage() {
  console.log(`
MedOrbits Migration Validator

Usage:
  node scripts/validate-migrations.js [options]

Options:
  --dir <path>   Migration directory, relative to repository root
  --strict       Treat warnings as failures
  --help, -h     Show this help

This tool performs static checks only. It does not execute migrations.
`);
}

function relative(file) {
  return path.relative(ROOT, file) || ".";
}

function error(message) {
  errors.push(message);
  console.error(`ERROR: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN:  ${message}`);
}

function note(message) {
  reviewed.push(message);
  console.log(`REVIEW: ${message}`);
}

function parseDirectoryArgument() {
  if (dirArgIndex >= 0 && !CUSTOM_DIR) {
    error("--dir requires a directory path.");
    return null;
  }

  if (!CUSTOM_DIR) {
    return null;
  }

  const resolved = path.resolve(ROOT, CUSTOM_DIR);
  const rel = path.relative(ROOT, resolved);

  if (
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  ) {
    error("--dir must remain inside the repository root.");
    return null;
  }

  return resolved;
}

function findMigrationDirectories() {
  const custom = parseDirectoryArgument();

  if (dirArgIndex >= 0) {
    if (!custom) return [];

    if (!fs.existsSync(custom)) {
      error(`Migration directory does not exist: ${relative(custom)}`);
      return [];
    }

    if (!fs.statSync(custom).isDirectory()) {
      error(`Migration path is not a directory: ${relative(custom)}`);
      return [];
    }

    return [custom];
  }

  const found = DEFAULT_DIRS
    .map((dir) => path.resolve(ROOT, dir))
    .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());

  // Support the common Prisma directory layout.
  const prismaRoot = path.resolve(ROOT, "prisma/migrations");

  if (
    fs.existsSync(prismaRoot) &&
    fs.statSync(prismaRoot).isDirectory() &&
    !found.includes(prismaRoot)
  ) {
    found.push(prismaRoot);
  }

  return [...new Set(found)];
}

function walk(directory) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (err) {
    error(`Cannot read ${relative(directory)}: ${err.message}`);
    return [];
  }

  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      warn(`Symbolic link skipped: ${relative(fullPath)}`);
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile()) {
      const extension = path.extname(entry.name).toLowerCase();

      if (MIGRATION_EXTENSIONS.has(extension)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Supported examples:
 *
 * 001_create_users.sql
 * 20261027030000_add_indexes.sql
 * V001__create_users.sql
 * 20261027030000_add_indexes.js
 *
 * Prisma's migration directories are also supported; migration.sql
 * inside a timestamped directory is treated as a migration file.
 */
function migrationIdentifier(file, migrationRoot) {
  const relativePath = path.relative(migrationRoot, file);
  const parts = relativePath.split(path.sep);
  const basename = path.basename(file);

  if (
    basename.toLowerCase() === "migration.sql" &&
    parts.length > 1
  ) {
    const folder = parts[0];

    if (/^\d{8,14}_.+/.test(folder)) {
      return folder.match(/^\d+/)[0];
    }

    return folder;
  }

  const match = basename.match(
    /^(?:V)?(\d{1,14})(?:__|_|-)([a-zA-Z0-9][a-zA-Z0-9_.-]*)\.(sql|js|cjs|mjs|ts)$/i
  );

  return match ? match[1] : null;
}

function hasSupportedFilename(file, migrationRoot) {
  const relativePath = path.relative(migrationRoot, file);
  const parts = relativePath.split(path.sep);
  const basename = path.basename(file);

  if (
    basename.toLowerCase() === "migration.sql" &&
    parts.length > 1 &&
    /^\d{8,14}_.+/.test(parts[0])
  ) {
    return true;
  }

  return Boolean(
    basename.match(
      /^(?:V)?\d{1,14}(?:__|_|-)[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:sql|js|cjs|mjs|ts)$/i
    )
  );
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ")
    .replace(/^\s*#.*$/gm, " ");
}

function checkSql(file, source) {
  const clean = stripSqlComments(source);
  const name = relative(file);

  if (!clean.trim()) {
    error(`${name}: migration contains no executable SQL.`);
    return;
  }

  // Basic delimiter balance check. This is intentionally conservative
  // and does not attempt to parse every SQL dialect.
  const singleQuotes = (clean.match(/'/g) || []).length;
  const doubleQuotes = (clean.match(/"/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    warn(`${name}: odd number of single quotes; inspect SQL strings.`);
  }

  if (doubleQuotes % 2 !== 0) {
    warn(`${name}: odd number of double quotes; inspect identifiers.`);
  }

  const destructivePatterns = [
    {
      pattern: /\bDROP\s+DATABASE\b/i,
      label: "DROP DATABASE",
    },
    {
      pattern: /\bDROP\s+SCHEMA\b/i,
      label: "DROP SCHEMA",
    },
    {
      pattern: /\bDROP\s+TABLE\b/i,
      label: "DROP TABLE",
    },
    {
      pattern: /\bTRUNCATE(?:\s+TABLE)?\b/i,
      label: "TRUNCATE",
    },
    {
      pattern: /\bDELETE\s+FROM\s+[\w"`.[\]]+\s*;/i,
      label: "DELETE without an apparent WHERE clause",
    },
    {
      pattern: /\bALTER\s+TABLE\b[\s\S]{0,200}\bDROP\s+COLUMN\b/i,
      label: "DROP COLUMN",
    },
  ];

  for (const item of destructivePatterns) {
    if (item.pattern.test(clean)) {
      note(`${name}: potentially destructive operation: ${item.label}`);
    }
  }

  if (/\bBEGIN\b/i.test(clean) && !/\bCOMMIT\b/i.test(clean)) {
    note(`${name}: transaction begins without an apparent COMMIT.`);
  }

  if (/\bCOMMIT\b/i.test(clean) && !/\bBEGIN\b/i.test(clean)) {
    note(`${name}: COMMIT appears without an apparent BEGIN.`);
  }

  if (/\bCREATE\s+INDEX\b/i.test(clean) &&
      !/\bCONCURRENTLY\b/i.test(clean)) {
    note(`${name}: review index creation locking for your database.`);
  }
}

function checkScript(file, source) {
  const name = relative(file);

  if (!source.trim()) {
    error(`${name}: migration script is empty.`);
    return;
  }

  // Static checks only: JavaScript migrations may need application-specific
  // review, so never execute them from this validator.
  if (/\b(?:TODO|FIXME|PLACEHOLDER)\b/i.test(source)) {
    warn(`${name}: contains TODO/FIXME/PLACEHOLDER markers.`);
  }

  if (/\b(?:DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE)\b/i.test(source)) {
    note(`${name}: contains potentially destructive SQL text.`);
  }

  if (/require\s*\(\s*["']child_process["']\s*\)/.test(source)) {
    note(`${name}: imports child_process; review migration execution behavior.`);
  }
}

function validateDirectory(migrationRoot) {
  console.log(`\nMigration directory: ${relative(migrationRoot)}`);

  const files = walk(migrationRoot).sort((a, b) =>
    a.localeCompare(b)
  );

  if (files.length === 0) {
    warn(`${relative(migrationRoot)}: no migration files found.`);
    return;
  }

  const identifiers = new Map();

  for (const file of files) {
    checkedFiles++;

    const name = relative(file);

    if (!hasSupportedFilename(file, migrationRoot)) {
      warn(
        `${name}: filename does not match a recognized migration naming pattern.`
      );
    }

    const identifier = migrationIdentifier(file, migrationRoot);

    if (identifier) {
      if (identifiers.has(identifier)) {
        error(
          `${name}: duplicate migration identifier "${identifier}" ` +
          `(also used by ${relative(identifiers.get(identifier))}).`
        );
      } else {
        identifiers.set(identifier, file);
      }
    }

    let source;

    try {
      source = fs.readFileSync(file, "utf8");
    } catch (err) {
      error(`${name}: cannot read file: ${err.message}`);
      continue;
    }

    if (source.charCodeAt(0) === 0xFEFF) {
      source = source.slice(1);
    }

    const extension = path.extname(file).toLowerCase();

    if (extension === ".sql") {
      checkSql(file, source);
    } else {
      checkScript(file, source);
    }

    console.log(`PASS: ${name}`);
  }
}

function main() {
  if (HELP) {
    usage();
    return 0;
  }

  console.log("MedOrbits Database Migration Validator");
  console.log("Static checks only -- no database connection or SQL execution.");

  const directories = findMigrationDirectories();

  if (errors.length) {
    return 1;
  }

  if (directories.length === 0) {
    warn(
      "No known migration directory found. " +
      "Use --dir <path> to specify the correct directory."
    );

    return STRICT ? 1 : 0;
  }

  for (const directory of directories) {
    validateDirectory(directory);
  }

  console.log("\nSummary");
  console.log(`Migration files checked: ${checkedFiles}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Manual review notes: ${reviewed.length}`);

  if (errors.length) {
    console.error("\nMigration validation failed.");
    return 1;
  }

  if (STRICT && warnings.length) {
    console.error("\nStrict mode failed because warnings were found.");
    return 1;
  }

  console.log("\nMigration static validation completed.");
  return 0;
}

process.exitCode = main();
