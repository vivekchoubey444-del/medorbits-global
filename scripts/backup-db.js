
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'storage', 'backups', 'database');
const MAX_DUMP_BYTES = 2 * 1024 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 10 * 60 * 1000;

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getConfig() {
  const rawPort = process.env.DB_PORT || '3306';
  const port = Number(rawPort);

  if (
    !/^\d+$/.test(rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('DB_PORT must be between 1 and 65535.');
  }

  return {
    host: requiredEnv('DB_HOST'),
    port,
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    database: requiredEnv('DB_NAME'),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runDump(config, outputPath) {
  return new Promise((resolve, reject) => {
    const executable = process.env.MYSQLDUMP_PATH || 'mysqldump';

    const args = [
      '--host', config.host,
      '--port', String(config.port),
      '--user', config.user,
      '--single-transaction',
      '--quick',
      '--skip-lock-tables',
      '--routines',
      '--triggers',
      '--events',
      '--hex-blob',
      '--default-character-set=utf8mb4',
      '--no-tablespaces',
      '--databases', config.database,
    ];

    // Use a private temporary defaults file so the password does not
    // appear in command-line arguments or environment variables.
    const credentialsPath = path.join(
      path.dirname(outputPath),
      `.mysql-client-${process.pid}-${crypto.randomUUID()}.cnf`,
    );

    let child;
    let output;
    let credentialsHandle;
    let stderr = '';
    let settled = false;
    let timeout;
    let outputBytes = 0;

    const finish = async (error, result) => {
      if (settled) return;
      settled = true;

      clearTimeout(timeout);

      if (child && child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }

      try {
        if (output) {
          await output.close();
          output = null;
        }
      } catch (closeError) {
        if (!error) error = closeError;
      }

      try {
        if (credentialsHandle) {
          await credentialsHandle.close();
          credentialsHandle = null;
        }

        await fs.rm(credentialsPath, { force: true });
      } catch (cleanupError) {
        if (!error) error = cleanupError;
      }

      if (error) reject(error);
      else resolve(result);
    };

    (async () => {
      try {
        const escapedPassword = config.password
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r');

        const credentials = [
          '[client]',
          `user="${config.user.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
          `password="${escapedPassword}"`,
          `host="${config.host.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
          `port=${config.port}`,
          'default-character-set=utf8mb4',
          '',
        ].join('\n');

        credentialsHandle = await fs.open(
          credentialsPath,
          'wx',
          0o600,
        );

        await credentialsHandle.writeFile(credentials, 'utf8');
        await credentialsHandle.close();
        credentialsHandle = null;

        const stat = await fs.stat(credentialsPath);

        if ((stat.mode & 0o077) !== 0) {
          throw new Error('Database credentials file permissions are too broad.');
        }

        output = await fs.open(outputPath, 'wx', 0o600);
        const outputStream = output.createWriteStream({ autoClose: false });

        child = spawn(
          executable,
          [
            `--defaults-extra-file=${credentialsPath}`,
            ...args.filter((arg, index) => {
              // Remove CLI user/host/port arguments; credentials file supplies them.
              return !['--host', '--port', '--user'].includes(arg);
            }),
          ],
          {
            cwd: ROOT,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );

        timeout = setTimeout(() => {
          child.kill('SIGTERM');
          finish(new Error('Database backup timed out.'));
        }, PROCESS_TIMEOUT_MS);

        child.stdout.on('data', (chunk) => {
          outputBytes += chunk.length;

          if (outputBytes > MAX_DUMP_BYTES) {
            child.kill('SIGTERM');
            finish(new Error('Database backup exceeded the maximum allowed size.'));
            return;
          }

          if (!outputStream.write(chunk)) {
            child.stdout.pause();
            outputStream.once('drain', () => child.stdout.resume());
          }
        });

        child.stderr.on('data', (chunk) => {
          // Keep only a bounded amount of diagnostic output.
          if (stderr.length < 8192) {
            stderr += chunk.toString('utf8').slice(0, 8192 - stderr.length);
          }
        });

        child.on('error', (error) => {
          finish(
            new Error(
              `Could not start mysqldump. Ensure it is installed and accessible: ${error.message}`,
            ),
          );
        });

        child.on('close', async (code, signal) => {
          try {
            outputStream.end();
            await new Promise((resolveStream, rejectStream) => {
              outputStream.once('finish', resolveStream);
              outputStream.once('error', rejectStream);
            });
          } catch (error) {
            return finish(error);
          }

          if (code !== 0) {
            return finish(
              new Error(
                `mysqldump failed (exit ${code ?? 'unknown'}, signal ${signal || 'none'}). ` +
                (stderr.trim() || 'No diagnostic details were provided.'),
              ),
            );
          }

          if (outputBytes === 0) {
            return finish(new Error('mysqldump produced an empty backup.'));
          }

          finish(null, { bytes: outputBytes });
        });
      } catch (error) {
        finish(error);
      }
    })();
  });
}

async function sha256File(filename) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = require('node:fs').createReadStream(filename);

    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function main() {
  const config = getConfig();

  await fs.mkdir(BACKUP_DIR, {
    recursive: true,
    mode: 0o700,
  });

  const backupName = `${config.database}-${timestamp()}.sql`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  const checksumPath = `${backupPath}.sha256`;

  try {
    const result = await runDump(config, backupPath);
    const digest = await sha256File(backupPath);

    const checksumFile = await fs.open(checksumPath, 'wx', 0o600);

    try {
      await checksumFile.writeFile(
        `${digest}  ${backupName}\n`,
        'utf8',
      );
      await checksumFile.sync();
    } finally {
      await checksumFile.close();
    }

    console.log('Database backup completed.');
    console.log(`File: ${path.relative(ROOT, backupPath)}`);
    console.log(`Size: ${result.bytes} bytes`);
    console.log(`SHA-256: ${digest}`);
  } catch (error) {
    await fs.rm(backupPath, { force: true }).catch(() => {});
    await fs.rm(checksumPath, { force: true }).catch(() => {});
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[database-backup] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  getConfig,
  sha256File,
  timestamp,
};
