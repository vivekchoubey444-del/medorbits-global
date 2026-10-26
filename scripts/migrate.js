
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- MySQL Migration Runner
 * File: scripts/migrate.js
 *
 * Requirements:
 *   npm install mysql2 dotenv
 *
 * Environment:
 *   DB_HOST
 *   DB_PORT=3306
 *   DB_USER
 *   DB_PASSWORD
 *   DB_NAME
 *
 * Usage:
 *   node scripts/migrate.js --status
 *   node scripts/migrate.js --dry-run
 *   node scripts/migrate.js --apply
 *
 * Safety:
 * - Dry-run is the default.
 * - --apply explicitly enables migration execution.
 * - Uses a MySQL advisory lock.
 * - Verifies checksums of previously applied migrations.
 * - Never automatically rolls back migrations.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");

try {
  require("dotenv").config({
    path: path.resolve(__dirname, "..", ".env"),
    quiet: true,
  });
} catch {
  // dotenv is optional if environment variables are injected by the host.
}

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");

const MIGRATION_TABLE = "schema_migrations";
const LOCK_NAME = "medorbits_schema_migrations";
const LOCK_TIMEOUT_SECONDS = 30;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = args.includes("--dry-run");
const STATUS_ONLY = args.includes("--status");
const HELP = args.includes("--help") || args.includes("-h");

function showHelp() {
  console.log(`
MedOrbits MySQL Migration Runner

Usage:
  node scripts/migrate.js [option]

Options:
  --dry-run   Preview pending migrations (default)
  --status    Show applied and pending migration status
  --apply     Execute pending migrations
  --help      Show this help

Required environment variables:
  DB_HOST, DB_USER, DB_NAME

Optional:
  DB_PORT, DB_PASSWORD

Migration directory:
  db/migrations/
`);
}

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value.trim();
}

function databaseConfig() {
  const rawPort = process.env.DB_PORT || "3306";

  if (!/^\d+$/.test(rawPort)) {
    throw new Error("DB_PORT must be a valid integer.");
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be between 1 and 65535.");
  }

  return {
    host: requiredEnv("DB_HOST"),
    port,
    user: requiredEnv("DB_USER"),
    password: process.env.DB_PASSWORD || "",
    database: requiredEnv("DB_NAME"),
    connectTimeout: 10000,
    multipleStatements: false,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}

async function listMigrations() {
  let entries;

  try {
    entries = await fs.readdir(MIGRATIONS_DIR, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw new Error(
      `Cannot read db/migrations: ${error.message}`
    );
  }

  const files = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(".sql")) {
      continue;
    }

    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(
        `Migration must be a regular file: ${entry.name}`
      );
    }

    if (
      !/^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/.test(entry.name)
    ) {
      throw new Error(
        `Invalid migration filename "${entry.name}". ` +
        "Expected 001_create_users.sql."
      );
    }

    files.push(entry.name);
  }

  files.sort((a, b) => a.localeCompare(b, "en"));

  const prefixes = new Set();

  for (const filename of files) {
    const prefix = filename.split("_", 1)[0];

    if (prefixes.has(prefix)) {
      throw new Error(
        `Duplicate migration sequence number: ${prefix}`
      );
    }

    prefixes.add(prefix);
  }

  return files;
}

async function readMigration(filename) {
  if (
    path.basename(filename) !== filename ||
    !/^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/.test(filename)
  ) {
    throw new Error(`Unsafe migration filename: ${filename}`);
  }

  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const stat = await fs.lstat(fullPath);

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `Migration is not a regular file: ${filename}`
    );
  }

  const content = await fs.readFile(fullPath, "utf8");

  if (content.charCodeAt(0) === 0xfeff) {
    throw new Error(`${filename} contains a UTF-8 BOM.`);
  }

  if (!content.trim()) {
    throw new Error(`${filename} is empty.`);
  }

  return content;
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${MIGRATION_TABLE}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_migration (migration)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function acquireLock(connection) {
  const [rows] = await connection.execute(
    "SELECT GET_LOCK(?, ?) AS acquired",
    [LOCK_NAME, LOCK_TIMEOUT_SECONDS]
  );

  if (!rows[0] || Number(rows[0].acquired) !== 1) {
    throw new Error(
      `Could not acquire migration lock within ` +
      `${LOCK_TIMEOUT_SECONDS} seconds.`
    );
  }
}

async function releaseLock(connection) {
  const [rows] = await connection.execute(
    "SELECT RELEASE_LOCK(?) AS released",
    [LOCK_NAME]
  );

  if (!rows[0] || Number(rows[0].released) !== 1) {
    throw new Error("Could not release migration lock.");
  }
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(`
    SELECT migration, checksum, applied_at
    FROM \`${MIGRATION_TABLE}\`
    ORDER BY migration
  `);

  return new Map(
    rows.map((row) => [
      row.migration,
      {
        checksum: row.checksum,
        appliedAt: row.applied_at,
      },
    ])
  );
}

async function inspectMigrations(connection, files) {
  const applied = await getAppliedMigrations(connection);
  const knownFiles = new Set(files);
  const pending = [];

  for (const filename of files) {
    const content = await readMigration(filename);
    const checksum = sha256(content);
    const record = applied.get(filename);

    if (record) {
      if (record.checksum !== checksum) {
        throw new Error(
          `Applied migration "${filename}" was modified. ` +
          "Create a new migration instead."
        );
      }

      console.log(`APPLIED  ${filename}`);
      continue;
    }

    pending.push({
      filename,
      content,
      checksum,
    });

    console.log(`PENDING  ${filename}`);
  }

  for (const filename of applied.keys()) {
    if (!knownFiles.has(filename)) {
      throw new Error(
        `Applied migration "${filename}" is missing from ` +
        "db/migrations. Restore it instead of silently deleting history."
      );
    }
  }

  return pending;
}

async function runMigrations(connection, pending) {
  let appliedCount = 0;

  for (const migration of pending) {
    console.log(`Applying ${migration.filename}...`);

    /*
     * IMPORTANT:
     * mysql2 with multipleStatements:false is not a general SQL
     * script runner for files containing multiple statements.
     *
     * This runner intentionally rejects files with multiple SQL
     * statements rather than enabling unrestricted multi-statements.
     * Use a proper SQL parser or migration framework for complex files.
     */
    const statements = splitSimpleStatements(migration.content);

    if (statements.length !== 1) {
      throw new Error(
        `${migration.filename} contains ${statements.length} SQL ` +
        "statements. This runner supports one statement per file. " +
        "Split the migration into separate files or use a proper SQL parser."
      );
    }

    await connection.query(statements[0]);

    await connection.execute(
      `INSERT INTO \`${MIGRATION_TABLE}\` ` +
      "(migration, checksum) VALUES (?, ?)",
      [migration.filename, migration.checksum]
    );

    appliedCount += 1;
    console.log(`Applied ${migration.filename}`);
  }

  return appliedCount;
}

/**
 * Conservative statement splitter.
 *
 * Supports one SQL statement per migration file only.
 * It rejects common delimiter changes and does not claim to parse
 * stored procedures, triggers, or every MySQL SQL dialect feature.
 */
function splitSimpleStatements(source) {
  const normalized = source.trim();

  if (/^\s*DELIMITER\b/im.test(normalized)) {
    throw new Error(
      "DELIMITER directives are not supported by this runner."
    );
  }

  const withoutComments = normalized
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--[^\r\n]*/gm, "")
    .trim();

  if (!withoutComments) {
    return [];
  }

  const statements = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const char of withoutComments) {
    current += char;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && quote) {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === ";") {
      const statement = current.slice(0, -1).trim();

      if (statement) statements.push(statement);

      current = "";
    }
  }

  if (quote) {
    throw new Error("Unclosed SQL quote detected.");
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function main() {
  if (HELP) {
    showHelp();
    return;
  }

  if (APPLY && DRY_RUN) {
    throw new Error(
      "Choose either --apply or --dry-run, not both."
    );
  }

  if (STATUS_ONLY && APPLY) {
    throw new Error("--status cannot be combined with --apply.");
  }

  const files = await listMigrations();

  if (files.length === 0) {
    console.log("No SQL migration files found; nothing to do.");
    return;
  }

  console.log(`Found ${files.length} migration file(s).`);

  const connection = await mysql.createConnection(databaseConfig());

  let locked = false;
  let failure = null;

  try {
    await acquireLock(connection);
    locked = true;

    // Creating the bookkeeping table is itself a database change.
    // Status mode therefore requires an existing migration table.
    if (STATUS_ONLY) {
      const [tables] = await connection.execute(
        `SELECT COUNT(*) AS count
         FROM information_schema.tables
         WHERE table_schema = ?
           AND table_name = ?`,
        [process.env.DB_NAME.trim(), MIGRATION_TABLE]
      );

      if (Number(tables[0].count) === 0) {
        console.log(
          "Migration tracking table does not exist yet."
        );
        return;
      }
    } else if (APPLY) {
      await ensureMigrationTable(connection);
    } else {
      const [tables] = await connection.execute(
        `SELECT COUNT(*) AS count
         FROM information_schema.tables
         WHERE table_schema = ?
           AND table_name = ?`,
        [process.env.DB_NAME.trim(), MIGRATION_TABLE]
      );

      if (Number(tables[0].count) === 0) {
        console.log(
          "Dry run: migration tracking table does not exist. " +
          "All migration files are treated as pending."
        );

        for (const filename of files) {
          await readMigration(filename);
          console.log(`PENDING  ${filename}`);
        }

        return;
      }
    }

    const pending = await inspectMigrations(connection, files);

    if (STATUS_ONLY) {
      console.log("Status inspection complete.");
      return;
    }

    if (!APPLY) {
      console.log(
        `Dry run complete: ${pending.length} migration(s) pending.`
      );
      console.log("No migration SQL was executed.");
      return;
    }

    const applied = await runMigrations(connection, pending);

    console.log(
      `Migration complete: ${applied} applied, ` +
      `${pending.length - applied} already applied, ` +
      `${files.length} total.`
    );
  } catch (error) {
    failure = error;
  } finally {
    if (locked) {
      try {
        await releaseLock(connection);
      } catch (error) {
        if (!failure) failure = error;
        else console.error(`Lock cleanup failed: ${error.message}`);
      }
    }

    try {
      await connection.end();
    } catch (error) {
      if (!failure) failure = error;
      else console.error(`Connection cleanup failed: ${error.message}`);
    }
  }

  if (failure) throw failure;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[migrate] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  databaseConfig,
  listMigrations,
  readMigration,
  sha256,
  splitSimpleStatements,
};
