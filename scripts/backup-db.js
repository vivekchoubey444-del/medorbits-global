
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- Database Backup Utility
 * File: scripts/backup-db.js
 *
 * Requirements:
 *   - Node.js 20+
 *   - PostgreSQL client utilities: pg_dump and pg_restore
 *   - DATABASE_URL environment variable
 *
 * Usage:
 *   node scripts/backup-db.js
 *   node scripts/backup-db.js --dry-run
 *   node scripts/backup-db.js --json
 *   node scripts/backup-db.js --keep=14
 *   node scripts/backup-db.js --output=storage/backups/database
 *
 * Environment:
 *   DATABASE_URL
 *   PG_DUMP_PATH
 *   PG_RESTORE_PATH
 *   BACKUP_DIR
 *   BACKUP_KEEP
 *   BACKUP_TIMEOUT_MS
 *
 * Safety:
 *   - Never logs DATABASE_URL or raw PostgreSQL stderr.
 *   - Uses custom-format PostgreSQL archives.
 *   - Uses private temporary credential/config files.
 *   - Rejects symlinked backup paths.
 *   - Verifies archives before finalizing them.
 *   - Prunes only matching backup files after successful verification.
 *
 * Note:
 *   Keep database backups outside public web roots and source control.
 *   A local backup is not an encrypted off-site backup.
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
const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
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

  if (!isInside(ROOT, resolved) || resolved === ROOT) {
    throw new Error(
      'Backup directory must be a subdirectory of the repository.'
    );
  }

  return resolved;
}

function assertNoSymlinkPath(target) {
  const relative = path.relative(ROOT, target);
  const components = relative.split(path.sep).filter(Boolean);
  let current = ROOT;

  for (const component of components) {
    current = path.join(current, component);

    try {
      const stat = fs.lstatSync(current);

      if (stat.isSymbolicLink()) {
        throw new Error(
          `Backup path contains a symbolic link: ${
            path.relative(ROOT, current)
          }`
        );
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }

      throw error;
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

function parseDatabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('DATABASE_URL is required.');
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URI.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  if (!url.hostname) {
    throw new Error('DATABASE_URL must include a database hostname.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (!database) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  if (!username && password) {
    throw new Error('DATABASE_URL has invalid authentication fields.');
  }

  const port = url.port || '5432';

  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('DATABASE_URL contains an invalid port.');
  }

  const allowedOptions = new Set([
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'application_name',
    'connect_timeout',
    'target_session_attrs',
    'options',
  ]);

  const parameters = {};

  for (const [key, parameterValue] of url.searchParams.entries()) {
    if (!allowedOptions.has(key)) {
      throw new Error(
        `Unsupported DATABASE_URL query parameter "${key}". ` +
        'Configure it explicitly before using this backup utility.'
      );
    }

    if (Object.prototype.hasOwnProperty.call(parameters, key)) {
      throw new Error(
        `Duplicate DATABASE_URL query parameter "${key}".`
      );
    }

    parameters[key] = parameterValue;
  }

  if (parameters.sslmode &&
      ![
        'disable',
        'allow',
        'prefer',
        'require',
        'verify-ca',
        'verify-full',
      ].includes(parameters.sslmode)) {
    throw new Error('DATABASE_URL contains an invalid sslmode.');
  }

  return {
    host: url.hostname,
    port,
    database,
    username,
    password,
    parameters,
  };
}

function getExecutable(name, override) {
  if (!override) {
    return name;
  }

  if (
    typeof override !== 'string' ||
    !path.isAbsolute(override)
  ) {
    throw new Error(`${name} must be an absolute executable path.`);
  }

  let stat;

  try {
    stat = fs.statSync(override);
  } catch {
    throw new Error(`${name} executable was not found.`);
  }

  if (!stat.isFile()) {
    throw new Error(`${name} must point to a file.`);
  }

  return override;
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
    let timedOut = false;

    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    function finish(error, result) {
      if (settled) return;

      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);

      if (error) reject(error);
      else resolve(result);
    }

    const timeout = setTimeout(() => {
      timedOut = true;

      try {
        child.kill('SIGTERM');
      } catch {
        // The process may already have exited.
      }

      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill('SIGKILL');
          } catch {
            // The process may already have exited.
          }
        }
      }, 5000);

      forceKillTimer.unref();
    }, timeoutMs);

    let forceKillTimer;
    timeout.unref();

    child.stdout.on('data', (chunk) => {
      if (!captureStdout) return;

      stdout += chunk.toString('utf8');

      if (Buffer.byteLength(stdout, 'utf8') > MAX_CAPTURE_BYTES) {
        try {
          child.kill('SIGTERM');
        } catch {
          // Ignore process-exit race.
        }

        finish(new Error('Command output exceeded the allowed limit.'));
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
      if (timedOut) {
        finish(
          new Error(
            `${path.basename(command)} timed out after ${timeoutMs} ms.`
          )
        );
        return;
      }

      if (code !== 0) {
        finish(
          new Error(
            `${path.basename(command)} failed ` +
            `(exit=${code}, signal=${signal || 'none'}).`
          )
        );
        return;
      }

      finish(null, { stdout, code });
    });
  });
}

function escapePgPass(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:');
}

function escapeServiceValue(value) {
  const text = String(value);

  if (/[\r\n\0]/.test(text)) {
    throw new Error('A database connection setting contains invalid characters.');
  }

  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function createTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function listBackupFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => {
      return (
        entry.isFile() &&
        /^medorbits-db-\d{4}-\d{2}-\d{2}T.*\.dump$/.test(entry.name)
      );
    })
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

function pruneBackups(directory, keep) {
  assertNoSymlinkPath(directory);

  const backups = listBackupFiles(directory);
  const obsolete = backups.slice(keep);
  const removed = [];

  for (const backup of obsolete) {
    // Recheck immediately before deletion.
    const stat = fs.lstatSync(backup.file);

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(
        `Refusing to remove a non-regular backup file: ${backup.name}`
      );
    }

    fs.unlinkSync(backup.file);
    removed.push(backup.name);
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
  const connection = parseDatabaseUrl(env.DATABASE_URL);
  const backupDirectory = resolveBackupDirectory(output);

  const timeoutMs = parsePositiveInteger(
    env.BACKUP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    'BACKUP_TIMEOUT_MS',
    MAX_TIMEOUT_MS
  );

  if (timeoutMs < MIN_TIMEOUT_MS) {
    throw new Error(
      `BACKUP_TIMEOUT_MS must be at least ${MIN_TIMEOUT_MS}.`
    );
  }

  const retention = parsePositiveInteger(
    keep,
    'Retention count',
    1000
  );

  const pgDump = getExecutable('pg_dump', env.PG_DUMP_PATH);
  const pgRestore = getExecutable('pg_restore', env.PG_RESTORE_PATH);

  assertNoSymlinkPath(backupDirectory);

  const timestamp = createTimestamp();
  const backupName = `medorbits-db-${timestamp}.dump`;
  const finalPath = path.join(backupDirectory, backupName);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      backupFile: path.relative(ROOT, finalPath).split(path.sep).join('/'),
      retentionCount: retention,
      message:
        'Configuration and paths validated. No backup or deletion was performed.',
    };
  }

  ensureBackupDirectory(backupDirectory);

  if (fs.existsSync(finalPath)) {
    throw new Error('Backup destination already exists.');
  }

  const randomId = crypto.randomBytes(12).toString('hex');

  const temporaryPath = path.join(
    backupDirectory,
    `.${backupName}.${process.pid}.${randomId}.tmp`
  );

  const tempPrefix = path.join(
    os.tmpdir(),
    `medorbits-pg-${process.pid}-${randomId}`
  );

  const serviceConfigPath = `${tempPrefix}.conf`;
  const passFilePath = `${tempPrefix}.pass`;

  let temporaryCreated = false;

  try {
    const serviceLines = [
      '[medorbits_backup]',
      `host=${escapeServiceValue(connection.host)}`,
      `port=${escapeServiceValue(connection.port)}`,
      `dbname=${escapeServiceValue(connection.database)}`,
      `user=${escapeServiceValue(connection.username)}`,
    ];

    for (const [key, value] of Object.entries(connection.parameters)) {
      serviceLines.push(`${key}=${escapeServiceValue(value)}`);
    }

    fs.writeFileSync(
      serviceConfigPath,
      `${serviceLines.join('\n')}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );

    const childEnv = { ...env };
    delete childEnv.PGPASSWORD;
    delete childEnv.PGDATABASE_URL;
    childEnv.PGSERVICEFILE = serviceConfigPath;
    childEnv.PGSERVICE = 'medorbits_backup';

    if (connection.password) {
      const passLine = [
        connection.host,
        connection.port,
        connection.database,
        connection.username,
        connection.password,
      ].map(escapePgPass).join(':');

      fs.writeFileSync(
        passFilePath,
        `${passLine}\n`,
        { encoding: 'utf8', flag: 'wx', mode: 0o600 }
      );

      childEnv.PGPASSFILE = passFilePath;
    }

    const dumpArgs = [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file',
      temporaryPath,
      '--dbname=service=medorbits_backup',
    ];

    await runCommand(pgDump, dumpArgs, {
      timeoutMs,
      env: childEnv,
    });

    temporaryCreated = true;

    const tempStat = fs.lstatSync(temporaryPath);

    if (
      tempStat.isSymbolicLink() ||
      !tempStat.isFile() ||
      tempStat.size === 0
    ) {
      throw new Error(
        'pg_dump did not produce a valid, non-empty regular file.'
      );
    }

    await runCommand(
      pgRestore,
      ['--list', temporaryPath],
      {
        timeoutMs: Math.min(timeoutMs, 60_000),
        captureStdout: true,
        env: childEnv,
      }
    );

    if (process.platform !== 'win32') {
      fs.chmodSync(temporaryPath, 0o600);
    }

    assertNoSymlinkPath(backupDirectory);

    if (fs.existsSync(finalPath)) {
      throw new Error('Backup destination already exists.');
    }

    fs.renameSync(temporaryPath, finalPath);
    temporaryCreated = false;

    const retentionResult = pruneBackups(backupDirectory, retention);

    return {
      ok: true,
      dryRun: false,
      backupFile: path.relative(ROOT, finalPath).split(path.sep).join('/'),
      sizeBytes: fs.statSync(finalPath).size,
      retentionCount: retention,
      removedBackups: retentionResult.removed,
      message: 'Backup created and archive verification passed.',
    };
  } catch (error) {
    if (temporaryCreated || fs.existsSync(temporaryPath)) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {
        // Best-effort cleanup.
      }
    }

    throw error;
  } finally {
    for (const tempFile of [serviceConfigPath, passFilePath]) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

function printHelp() {
  console.log(`MedOrbits Database Backup Utility

Usage:
  node scripts/backup-db.js [options]

Options:
  --dry-run          Validate configuration without writing or deleting backups
  --json             Print machine-readable JSON
  --keep=N           Number of backups to retain (default: 14)
  --output=PATH      Repository-relative backup directory
  -h, --help         Show this help

Required environment:
  DATABASE_URL

Optional environment:
  PG_DUMP_PATH
  PG_RESTORE_PATH
  BACKUP_DIR
  BACKUP_KEEP
  BACKUP_TIMEOUT_MS
`);
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
    printHelp();
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

      if (result.removedBackups?.length) {
        console.log(
          `Removed old backups: ${result.removedBackups.length}`
        );
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
  parseCli,
  parsePositiveInteger,
  resolveBackupDirectory,
  parseDatabaseUrl,
};
