
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const AGENT_ROOT = path.resolve(__dirname, '..');

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build',
  '.next',
  '.cache',
  'vendor',
  'venv',
  '.venv'
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml'
]);

const MAX_FILES = 5000;

function isInsideRoot(root, target) {
  const relative = path.relative(root, target);

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function collectJavaScriptFiles(startDirectory) {
  const results = [];
  const visitedDirectories = new Set();

  function walk(directory) {
    if (results.length >= MAX_FILES) {
      throw new Error(
        `JavaScript file limit exceeded (${MAX_FILES}).`
      );
    }

    const realDirectory = fs.realpathSync(directory);

    if (!isInsideRoot(AGENT_ROOT, realDirectory)) {
      throw new Error(
        `Directory resolves outside local-agent: ${directory}`
      );
    }

    if (visitedDirectories.has(realDirectory)) {
      return;
    }

    visitedDirectories.add(realDirectory);

    const entries = fs.readdirSync(directory, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        // Do not follow symlinks during syntax discovery.
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || EXCLUDED_FILES.has(entry.name)) {
        continue;
      }

      if (/\.(?:cjs|js|mjs)$/i.test(entry.name)) {
        results.push(fullPath);

        if (results.length > MAX_FILES) {
          throw new Error(
            `JavaScript file limit exceeded (${MAX_FILES}).`
          );
        }
      }
    }
  }

  if (!fs.existsSync(startDirectory)) {
    return results;
  }

  walk(startDirectory);
  return results.sort();
}

function checkJavaScriptSyntax(filePath) {
  const result = spawnSync(
    process.execPath,
    ['--check', filePath],
    {
      cwd: REPOSITORY_ROOT,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      shell: false
    }
  );

  if (result.error) {
    return {
      file: path.relative(REPOSITORY_ROOT, filePath),
      ok: false,
      message: result.error.message
    };
  }

  if (result.signal) {
    return {
      file: path.relative(REPOSITORY_ROOT, filePath),
      ok: false,
      message: `Node syntax check terminated by signal ${result.signal}`
    };
  }

  if (result.status !== 0) {
    return {
      file: path.relative(REPOSITORY_ROOT, filePath),
      ok: false,
      message: (result.stderr || result.stdout || 'Syntax check failed')
        .trim()
    };
  }

  return {
    file: path.relative(REPOSITORY_ROOT, filePath),
    ok: true,
    message: 'Syntax OK'
  };
}

test('local-agent directory exists', () => {
  assert.ok(
    fs.existsSync(AGENT_ROOT),
    `Missing local-agent directory: ${AGENT_ROOT}`
  );

  assert.ok(fs.statSync(AGENT_ROOT).isDirectory());
});

test('Node.js runtime is available', () => {
  const result = spawnSync(
    process.execPath,
    ['--version'],
    {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      shell: false
    }
  );

  assert.equal(result.status, 0, result.error?.message);
  assert.match(result.stdout.trim(), /^v\d+\.\d+\.\d+/);

  const major = Number(result.stdout.trim().replace(/^v/, '').split('.')[0]);

  assert.ok(
    major >= 20,
    `Node.js 20 or newer is required; found ${result.stdout.trim()}`
  );
});

test('main local-agent entry point exists', () => {
  const entryPoint = path.join(AGENT_ROOT, 'src', 'index.js');

  assert.ok(
    fs.existsSync(entryPoint),
    `Missing entry point: ${entryPoint}`
  );

  assert.ok(fs.statSync(entryPoint).isFile());
});

test('all discovered local-agent JavaScript files have valid syntax', (t) => {
  const sourceDirectory = path.join(AGENT_ROOT, 'src');

  if (!fs.existsSync(sourceDirectory)) {
    t.skip('No local-agent/src directory exists yet.');
    return;
  }

  const files = collectJavaScriptFiles(sourceDirectory);

  assert.ok(
    files.length > 0,
    `No JavaScript files found in ${sourceDirectory}`
  );

  const failures = [];

  for (const file of files) {
    const result = checkJavaScriptSyntax(file);

    if (!result.ok) {
      failures.push(result);
    }
  }

  assert.deepEqual(
    failures,
    [],
    failures.map((failure) =>
      `\n${failure.file}\n${failure.message}`
    ).join('\n')
  );
});

test('JavaScript syntax checks do not follow symbolic links', (t) => {
  const sandbox = fs.mkdtempSync(
    path.join(require('node:os').tmpdir(), 'agent-syntax-')
  );

  t.after(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  const inside = path.join(sandbox, 'inside');
  const outside = path.join(sandbox, 'outside');

  fs.mkdirSync(inside);
  fs.mkdirSync(outside);

  fs.writeFileSync(
    path.join(inside, 'valid.js'),
    "'use strict';\nconst valid = true;\n"
  );

  fs.writeFileSync(
    path.join(outside, 'outside.js'),
    'const outside = true;\n'
  );

  try {
    fs.symlinkSync(
      outside,
      path.join(inside, 'linked-outside'),
      'dir'
    );
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symbolic links are unavailable: ${error.code}`);
      return;
    }

    throw error;
  }

  const files = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.js$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(inside);

  assert.deepEqual(
    files.map((file) => path.basename(file)),
    ['valid.js']
  );
});

test('syntax checker reports malformed JavaScript', (t) => {
  const sandbox = fs.mkdtempSync(
    path.join(require('node:os').tmpdir(), 'agent-syntax-invalid-')
  );

  t.after(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  const invalidFile = path.join(sandbox, 'invalid.js');

  fs.writeFileSync(
    invalidFile,
    'function broken( {\n  return true;\n'
  );

  const result = spawnSync(
    process.execPath,
    ['--check', invalidFile],
    {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
      shell: false
    }
  );

  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stderr}\n${result.stdout}`,
    /SyntaxError|Unexpected|missing|expected/i
  );
});
