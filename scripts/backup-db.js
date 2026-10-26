#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Database Backup Utility
 * File: /scripts/backup-db.js
 *
 * Requirements:
 *   - Node.js 20+
 *   - PostgreSQL client utility: pg_dump
 *   - DATABASE_URL environment variable
 *
 * Usage:
 *   node scripts/backup-db.js
 *   node scripts/backup-db.js --dry-run
 *   node scripts/backup-db.js --json
 *   node scripts/backup-db.js --keep=14
 *   node scripts/backup-db.js --output=storage/backups/database
 *
 * Optional environment variables:
 *   DATABASE_URL       PostgreSQL connection URI
 *   PG_DUMP_PATH       Explicit path to pg_dump
 *   BACKUP_DIR         Repository-relative backup directory
 *   BACKUP_KEEP        Number of backups to retain (default 14)
 *   BACKUP_TIMEOUT_MS  Backup timeout (default 15 minutes)
 *
 * Security:
 *   - Never logs the database connection URI.
 *   - Uses pg_dump custom format.
 *   - Creates backups with restrictive permissions.
 *   - Rejects symlinked backup directories.
 *   - Writes to a temporary file before finalizing the backup.
 *   - Verifies the dump using pg_restore --list.
 *   - Does not automatically restore or delete database data.
 *
 * Important:
 *   A local backup is not a substitute for an encrypted off-site backup.
 *   Test restoration regularly in a separate environment.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const process = require('node:process');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BACKUP_DIR = 'storage/backups/database';
const DEFAULT_KEEP = 14;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 2 * 60 * 60 * 1000;
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
function parsePositiveInteger(value, name, maximum) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${name} must be a positive integer.`);
  }
  const number = Number(value);
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > maximum
  ) {
    throw new Error(`${name} must be between 1 and ${maximum}.`);
  }
  return number;
}
function parseArguments(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    keep: process.env.BACKUP_KEEP || String(DEFAULT_KEEP),
    output:
      process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
  };
  const seen = new Set();
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--(keep|output)=(.*)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const [, name, value] = match;
    if (seen.has(name)) {
      throw new Error(`Option --${name} was provided more than once.`);
    }
    seen.add(name);
    if (!value.trim()) {
      throw new Error(`Option --${name} cannot be empty.`);
    }
    options[name] = value;
  }
  options.keep = parsePositiveInteger(
    options.keep,
    'Backup retention count',
    1000
  );
  return options;
}
function resolveBackupDirectory(input) {
  if (
    typeof input !== 'string' ||
    !input.trim() ||
    input.includes('\0')
  ) {
    throw new Error('Backup directory is invalid.');
  }
  const resolved = path.resolve(ROOT, input);
  if (!isInside(ROOT, resolved)) {
    throw new Error('Backup directory must remain inside the repository.');
  }
  if (resolved === ROOT) {
    throw new Error('The repository root cannot be the backup directory.');
  }
  return resolved;
}
function assertNoSymlinkPath(target) {
  const relative = path.relative(ROOT, target);
  const components = relative.split(path.sep).filter(Boolean);
  let current = ROOT;
  for (const component of components) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) {
      continue;
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `Backup path contains a symbolic link: ${path.relative(ROOT, current)}`
      );
    }
  }
}
function ensureBackupDirectory(directory) {
  assertNoSymlinkPath(directory);
  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700,
  });
  assertNoSymlinkPath(directory);
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Backup destination must be a real directory.');
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(directory, 0o700);
  }
}
function validateDatabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('DATABASE_URL is required.');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URI.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  if (!parsed.hostname) {
    throw new Error('DATABASE_URL must include a database hostname.');
  }
  if (parsed.username === '' && parsed.password) {
    throw new Error('DATABASE_URL has invalid authentication fields.');
  }
  return parsed;
}
function getExecutable(name, override) {
  if (override) {
    if (
      typeof override !== 'string' ||
      !path.isAbsolute(override) ||
      !fs.existsSync(override) ||
      !fs.statSync(override).isFile()
    ) {
      throw new Error(`${name} must be an existing absolute executable path.`);
    }
    return override;
  }
  return name;
}
function runCommand(command, args, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    env = process.env,
    captureStdout = false,
  } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      const forceKill = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
      forceKill.unref();
      finish(
        new Error(
          `${path.basename(command)} timed out after ${timeoutMs} ms.`
        )
      );
    }, timeoutMs);
    timeout.unref();
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result);
    }
    child.stdout.on('data', (chunk) => {
      if (captureStdout) {
        stdout += chunk.toString('utf8');
        if (stdout.length > 5 * 1024 * 1024) {
          child.kill('SIGTERM');
          finish(new Error('Command output exceeded the allowed limit.'));
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      // Never print raw stderr. It may contain connection details.
      if (stderr.length < 4096) {
        stderr += chunk.toString('utf8');
      }
    });
    child.on('error', (error) => {
      finish(
        new Error(
          `Unable to execute ${path.basename(command)}: ${messageOf(error)}`
        )
      );
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0) {
        finish(
          new Error(
            `${path.basename(command)} failed (exit=${code}, signal=${signal || 'none'}).`
          )
        );
        return;
      }
      finish(null, {
        stdout,
        stderr,
        code,
      });
    });
  });
}
function createTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}
function listBackupFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^medorbits-db-\d{4}-\d{2}-\d{2}T.*\.dump$/.test(entry.name)
    )
    .map((entry) => {
      const file = path.join(directory, entry.name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        return null;
      }
      return {
        file,
        name: entry.name,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}
function pruneBackups(directory, keep, dryRun) {
  const backups = listBackupFiles(directory);
  const obsolete = backups.slice(keep);
  const removed = [];
  for (const backup of obsolete) {
    if (!dryRun) {
      fs.unlinkSync(backup.file);
    }
    removed.push({
      name: backup.name,
      deleted: !dryRun,
    });
  }
  return {
    existingBackups: backups.length,
    removed,
  };
}
async function backupDatabase({
  dryRun = false,
  keep = DEFAULT_KEEP,
  output = DEFAULT_BACKUP_DIR,
  env = process.env,
} = {}) {
  const connectionString = env.DATABASE_URL;
  validateDatabaseUrl(connectionString);
  const backupDirectory = resolveBackupDirectory(output);
  const timeoutValue = env.BACKUP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS;
  const timeoutMs = parsePositiveInteger(
    timeoutValue,
    'BACKUP_TIMEOUT_MS',
    MAX_TIMEOUT_MS
  );
  if (timeoutMs < MIN_TIMEOUT_MS) {
    throw new Error(
      `BACKUP_TIMEOUT_MS must be at least ${MIN_TIMEOUT_MS}.`
    );
  }
  const retention = parsePositiveInteger(keep, 'Retention count', 1000);
  const pgDump = getExecutable('pg_dump', env.PG_DUMP_PATH);
  const pgRestore = getExecutable('pg_restore', env.PG_RESTORE_PATH);
  const timestamp = createTimestamp();
  const backupName = `medorbits-db-${timestamp}.dump`;
  const finalPath = path.join(backupDirectory, backupName);
  const temporaryPath = path.join(
    backupDirectory,
    `.${backupName}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
  );
  assertNoSymlinkPath(backupDirectory);
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      backupFile: path.relative(ROOT, finalPath).split(path.sep).join('/'),
      retentionCount: retention,
      message: 'Dry run completed. No database backup or deletion was performed.',
    };
  }
  ensureBackupDirectory(backupDirectory);
  // Avoid accidental overwrite of an existing backup.
  if (fs.existsSync(finalPath) || fs.existsSync(temporaryPath)) {
    throw new Error('Backup destination already exists.');
  }
  const pgEnv = {
    ...env,
    // Prevent password prompts and interactive hangs.
    PGPASSFILE: env.PGPASSFILE,
    PGPASSWORD: undefined,
  };
  // Use a temporary PGPASSFILE if credentials are present in the URI.
  // The file is created with restrictive permissions and removed later.
  let passFile = null;
  let passFilePath = null;
  try {
    const parsed = new URL(connectionString);
    const password = decodeURIComponent(parsed.password || '');
    if (password) {
      const host = parsed.hostname.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      const username = decodeURIComponent(parsed.username || '');
      const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      const escapePgPass = (value) =>
        String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      passFile = [
        [
          host,
          parsed.port || '5432',
          database,
          username,
          password,
        ]
          .map(escapePgPass)
          .join(':'),
        '',
      ].join('\n');
      passFilePath = path.join(
        os.tmpdir(),
        `medorbits-pgpass-${process.pid}-${crypto.randomBytes(8).toString('hex')}`
      );
      fs.writeFileSync(passFilePath, passFile, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      pgEnv.PGPASSFILE = passFilePath;
    }
    // Avoid passing the credential-bearing URI as a command-line argument.
    // pg_dump reads the connection string through its environment.
    pgEnv.PGDATABASE_URL = connectionString;
    const args = [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file',
      temporaryPath,
      '--dbname',
      'service=medorbits_backup',
    ];
    // A temporary pg_service.conf supplies the connection string via an
    // environment-controlled service definition, not process arguments.
    const serviceConfigPath = path.join(
      os.tmpdir(),
      `medorbits-pgservice-${process.pid}-${crypto.randomBytes(8).toString('hex')}.conf`
    );
    const serviceConfig = [
      '[medorbits_backup]',
      `dbname=${decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''))}`,
      `host=${new URL(connectionString).hostname}`,
      `port=${new URL(connectionString).port || '5432'}`,
      `user=${decodeURIComponent(new URL(connectionString).username || '')}`,
      ...(passFile ? [] : []),
      '',
    ].join('\n');
    // Use a private service file. Password is supplied only through
    // PGPASSFILE when available; no password is written into this file.
    fs.writeFileSync(serviceConfigPath, serviceConfig, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    try {
      await runCommand(pgDump, args, {
        timeoutMs,
        env: {
          ...pgEnv,
          PGSERVICEFILE: serviceConfigPath,
        },
      });
    } finally {
      try {
        fs.unlinkSync(serviceConfigPath);
      } catch {
        // Best-effort cleanup.
      }
    }
    const tempStat = fs.lstatSync(temporaryPath);
    if (!tempStat.isFile() || tempStat.isSymbolicLink() || tempStat.size === 0) {
      throw new Error('pg_dump did not produce a valid non-empty backup file.');
    }
    // Verify the archive structure before making it the final backup.
    await runCommand(
      pgRestore,
      ['--list', temporaryPath],
      {
        timeoutMs: Math.min(timeoutMs, 60_000),
      }
    );
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, finalPath);
    const retentionResult = pruneBackups(
      backupDirectory,
      retention,
      false
    );
    return {
      ok: true,
      dryRun: false,
      backupFile: path.relative(ROOT, finalPath).split(path.sep).join('/'),
      sizeBytes: fs.statSync(finalPath).size,
      retentionCount: retention,
      removedBackups: retentionResult.removed,
      message: 'Database backup created and archive verification passed.',
    };
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Temporary file may not exist.
    }
    throw error;
  } finally {
    if (passFilePath) {
      try {
        fs.unlinkSync(passFilePath);
      } catch {
        // Best-effort credential-file cleanup.
      }
    }
  }
}
function parseCli(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    keep: process.env.BACKUP_KEEP || String(DEFAULT_KEEP),
    output: process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
  };
  const seen = new Set();
  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      const match = arg.match(/^--(keep|output)=(.*)$/);
      if (!match) {
        throw new Error(`Unknown argument: ${arg}`);
      }
      const [, key, value] = match;
      if (seen.has(key)) {
        throw new Error(`Option --${key} was provided more than once.`);
      }
      seen.add(key);
      if (!value.trim()) {
        throw new Error(`Option --${key} cannot be empty.`);
      }
      options[key] = value;
    }
  }
  options.keep = parsePositiveInteger(
    options.keep,
    'Retention count',
    1000
  );
  return options;
}
async function main() {
  let options;
  try {
    options = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(`[MedOrbits Backup] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(`MedOrbits Database Backup
Usage:
  node scripts/backup-db.js [options]
Options:
  --dry-run         Validate configuration without creating or deleting backups
  --json             Print machine-readable JSON
  --keep=N           Number of backups to retain (default 14)
  --output=PATH      Repository-relative backup directory
  --help             Show this help
Required:
  DATABASE_URL
Optional:
  PG_DUMP_PATH
  PG_RESTORE_PATH
  BACKUP_DIR
  BACKUP_KEEP
  BACKUP_TIMEOUT_MS`);
    return;
  }
  try {
    const result = await backupDatabase({
      dryRun: options.dryRun,
      keep: options.keep,
      output: options.output,
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('MedOrbits Database Backup');
      console.log(`Status: ${result.ok ? 'success' : 'failed'}`);
      console.log(`Dry run: ${result.dryRun ? 'yes' : 'no'}`);
      console.log(`Backup: ${result.backupFile}`);
      if (typeof result.sizeBytes === 'number') {
        console.log(`Size: ${result.sizeBytes} bytes`);
      }
      console.log(result.message);
    }
  } catch (error) {
    const result = {
      ok: false,
      error: messageOf(error),
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`[MedOrbits Backup] ${result.error}`);
    }
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}
module.exports = {
  backupDatabase,
  isInside,
  parseArguments,
  parsePositiveInteger,
  resolveBackupDirectory,
  validateDatabaseUrl,
};