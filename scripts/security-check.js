
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const problems = [];
const warnings = [];

const GITIGNORE_REQUIRED = [
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.sample'
];

const SENSITIVE_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development.local',
  'credentials.json',
  'service-account.json',
  'id_rsa',
  'id_ed25519'
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readText(relativePath) {
  const file = path.join(root, relativePath);

  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function normalizeIgnorePattern(line) {
  return line.trim().replace(/\/+$/, '');
}

function isGitRepository() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root,
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

function isTracked(relativePath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
      cwd: root,
      stdio: 'ignore'
    });
    return true;
  } catch {
    return false;
  }
}

function checkGitignore() {
  const gitignorePath = path.join(root, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    problems.push('.gitignore is missing');
    return;
  }

  const lines = readText('.gitignore')
    .split(/\r?\n/)
    .map(normalizeIgnorePattern)
    .filter(Boolean);

  if (!lines.includes('.env') && !lines.includes('.env/')) {
    problems.push('.gitignore must ignore .env');
  }

  if (!lines.includes('.env.*') && !lines.includes('.env.*/')) {
    warnings.push(
      '.gitignore should ignore .env.* files to reduce accidental secret exposure'
    );
  }

  if (!lines.includes('!.env.example')) {
    warnings.push(
      '.gitignore should explicitly allow the safe template file !.env.example'
    );
  }
}

function checkEnvironmentFiles() {
  for (const relativePath of SENSITIVE_FILES) {
    if (!exists(relativePath)) continue;

    if (relativePath === '.env' && process.env.CI) {
      problems.push('.env must not exist in the CI checkout');
    }

    if (isGitRepository() && isTracked(relativePath)) {
      problems.push(
        `${relativePath} is tracked by Git; remove it from tracking and rotate any exposed secrets`
      );
    }
  }

  if (exists('.env.example')) {
    const example = readText('.env.example');

    if (/=\s*(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})/m.test(example)) {
      problems.push(
        '.env.example appears to contain a credential-like value; replace it with a placeholder'
      );
    }
  }
}

function checkGitAvailability() {
  try {
    execFileSync('git', ['--version'], {
      cwd: root,
      stdio: 'ignore'
    });
  } catch {
    warnings.push(
      'Git is unavailable; tracked-file checks could not be performed'
    );
  }
}

function main() {
  checkGitignore();
  checkEnvironmentFiles();
  checkGitAvailability();

  for (const warning of warnings) {
    console.warn(`WARNING: ${warning}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`ERROR: ${problem}`);
    }

    console.error(
      `Security check failed: ${problems.length} problem(s), ${warnings.length} warning(s).`
    );

    process.exitCode = 1;
    return;
  }

  console.log('Security configuration checks passed.');
  console.log(`Warnings: ${warnings.length}`);
}

main();
