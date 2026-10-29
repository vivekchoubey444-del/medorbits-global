
'use strict';

/**
 * MedOrbits Local Agent -- Automated Tests
 * File: /local-agent/src/tests/agent.test.js
 * Version: 1.0.0
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-in test runner only
 *
 * Run:
 *   node --test local-agent/src/tests/agent.test.js
 *
 * Coverage:
 * - Configuration validation
 * - Logger integration
 * - Repository metadata
 * - Filesystem path confinement
 * - Task registration and execution
 * - JSON validation
 * - Backup scope validation
 * - Task failure handling
 * - Task concurrency
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  AgentError,
  loadConfiguration,
  resolveInsideRoot,
  getRepositoryMetadata,
  TaskRunner,
  createAgent
} = require('../index');

const {
  createLogger,
  sanitizeString,
  sanitizeValue,
  isSensitiveKey
} = require('../utils/logger');

function createTempDirectory() {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), 'medorbits-agent-test-')
  );
}

function removeTempDirectory(directory) {
  fs.rmSync(directory, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100
  });
}

function createTestConfig(root, overrides = {}) {
  return Object.freeze({
    repositoryRoot: fs.realpathSync(root),
    logLevel: 'silent',
    taskTimeoutMs: 2000,
    maxConcurrentTasks: 2,
    continueOnIndependentFailure: true,
    backupScript: 'local-agent/agent-backup/agent-backup.sh',
    allowExternalPaths: false,
    ...overrides
  });
}

function createSilentLogger() {
  return Object.freeze({
    debug() {},
    info() {},
    warn() {},
    error() {}
  });
}

test('configuration resolves a valid repository root', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  const config = loadConfiguration({
    MEDORBITS_REPO_ROOT: root,
    MEDORBITS_AGENT_LOG_LEVEL: 'info',
    MEDORBITS_AGENT_TIMEOUT_MS: '5000',
    MEDORBITS_AGENT_MAX_CONCURRENCY: '3'
  });

  assert.equal(config.repositoryRoot, fs.realpathSync(root));
  assert.equal(config.logLevel, 'info');
  assert.equal(config.taskTimeoutMs, 5000);
  assert.equal(config.maxConcurrentTasks, 3);
});

test('configuration rejects an unsupported log level', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  assert.throws(
    () => loadConfiguration({
      MEDORBITS_REPO_ROOT: root,
      MEDORBITS_AGENT_LOG_LEVEL: 'verbose'
    }),
    (error) => {
      assert.equal(error.code, 'INVALID_CONFIGURATION');
      return true;
    }
  );
});

test('configuration rejects invalid task timeouts', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  for (const timeout of ['0', '-1', 'abc', '3600001']) {
    assert.throws(
      () => loadConfiguration({
        MEDORBITS_REPO_ROOT: root,
        MEDORBITS_AGENT_TIMEOUT_MS: timeout
      }),
      (error) => error.code === 'INVALID_CONFIGURATION'
    );
  }
});

test('configuration rejects invalid concurrency limits', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  for (const concurrency of ['0', '-2', 'abc', '17']) {
    assert.throws(
      () => loadConfiguration({
        MEDORBITS_REPO_ROOT: root,
        MEDORBITS_AGENT_MAX_CONCURRENCY: concurrency
      }),
      (error) => error.code === 'INVALID_CONFIGURATION'
    );
  }
});

test('configuration rejects nonexistent repository roots', () => {
  assert.throws(
    () => loadConfiguration({
      MEDORBITS_REPO_ROOT: path.join(
        os.tmpdir(),
        `missing-${Date.now()}-${Math.random()}`
      )
    }),
    (error) => error.code === 'REPOSITORY_NOT_FOUND'
  );
});

test('resolveInsideRoot accepts a valid relative path', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  const resolved = resolveInsideRoot(root, 'src/example.js');

  assert.equal(
    resolved,
    path.join(fs.realpathSync(root), 'src', 'example.js')
  );
});

test('resolveInsideRoot rejects absolute paths', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  assert.throws(
    () => resolveInsideRoot(root, path.join(os.tmpdir(), 'example.js')),
    (error) => error.code === 'PATH_NOT_ALLOWED'
  );
});

test('resolveInsideRoot rejects parent traversal', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  assert.throws(
    () => resolveInsideRoot(root, '../outside.txt'),
    (error) => error.code === 'PATH_NOT_ALLOWED'
  );
});

test('resolveInsideRoot rejects empty and non-string paths', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  for (const candidate of ['', '  ', null, undefined, 42]) {
    assert.throws(
      () => resolveInsideRoot(root, candidate),
      (error) => error.code === 'INVALID_PATH'
    );
  }
});

test('resolveInsideRoot rejects symlink escapes where supported', (t) => {
  const root = createTempDirectory();
  const outside = createTempDirectory();

  t.after(() => removeTempDirectory(root));
  t.after(() => removeTempDirectory(outside));

  const outsideFile = path.join(outside, 'outside.txt');
  fs.writeFileSync(outsideFile, 'external');

  const linkPath = path.join(root, 'external-link');

  try {
    fs.symlinkSync(outside, linkPath, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symlink creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => resolveInsideRoot(root, 'external-link/outside.txt'),
    (error) => error.code === 'PATH_NOT_ALLOWED'
  );
});

test('repository metadata reads valid package.json', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'medorbits-test',
      version: '1.2.3'
    })
  );

  const metadata = getRepositoryMetadata(createTestConfig(root));

  assert.equal(metadata.packageName, 'medorbits-test');
  assert.equal(metadata.packageVersion, '1.2.3');
  assert.equal(metadata.packageJsonFound, true);
});

test('repository metadata rejects malformed package.json', (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  fs.writeFileSync(
    path.join(root, 'package.json'),
    '{invalid-json'
  );

  assert.throws(
    () => getRepositoryMetadata(createTestConfig(root)),
    (error) => error.code === 'INVALID_PACKAGE_METADATA'
  );
});

test('task runner executes a registered task', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  runner.register('test.success', async ({ parameters }) => ({
    value: parameters.value
  }));

  const result = await runner.run('test.success', { value: 42 });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.data.value, 42);
  assert.ok(result.taskId);
  assert.ok(result.startedAt);
  assert.ok(result.finishedAt);
});

test('task runner rejects unknown task types', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  const result = await runner.run('unknown.task');

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'UNKNOWN_TASK_TYPE');
});

test('task runner rejects invalid parameters', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  runner.register('test.parameters', async () => ({ ok: true }));

  for (const parameters of [null, [], 'invalid', 12]) {
    const result = await runner.run('test.parameters', parameters);

    assert.equal(result.status, 'failed');
    assert.equal(result.error.code, 'INVALID_TASK_PARAMETERS');
  }
});

test('task runner rejects duplicate task registrations', () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  runner.register('test.duplicate', async () => null);

  assert.throws(
    () => runner.register('test.duplicate', async () => null),
    (error) => error.code === 'DUPLICATE_TASK_HANDLER'
  );
});

test('task runner records handler failures', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  runner.register('test.failure', async () => {
    throw new AgentError('Expected failure', 'EXPECTED_FAILURE');
  });

  const result = await runner.run('test.failure');

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'EXPECTED_FAILURE');
});

test('task runner times out a non-cooperative handler', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir(), {
      taskTimeoutMs: 50
    }),
    createSilentLogger()
  );

  runner.register('test.timeout', async () =>
    new Promise(() => {})
  );

  const result = await runner.run('test.timeout');

  assert.equal(result.status, 'timed_out');
  assert.equal(result.error.code, 'TASK_TIMEOUT');
});

test('task runner limits concurrent registered tasks', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir(), {
      maxConcurrentTasks: 1,
      taskTimeoutMs: 2000
    }),
    createSilentLogger()
  );

  let releaseTask;

  runner.register('test.wait', async () =>
    new Promise((resolve) => {
      releaseTask = resolve;
    })
  );

  const firstPromise = runner.run('test.wait');

  // Wait until the first task has registered as active.
  while (runner.getStatus().activeTasks.length === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  const secondResult = await runner.run('test.wait');

  assert.equal(secondResult.status, 'skipped');
  assert.equal(secondResult.error.code, 'CONCURRENCY_LIMIT');

  releaseTask({ done: true });

  const firstResult = await firstPromise;
  assert.equal(firstResult.status, 'succeeded');
});

test('task runner removes completed tasks from active status', async () => {
  const runner = new TaskRunner(
    createTestConfig(os.tmpdir()),
    createSilentLogger()
  );

  runner.register('test.cleanup', async () => 'done');

  const result = await runner.run('test.cleanup');

  assert.equal(result.status, 'succeeded');
  assert.equal(runner.getStatus().activeTasks.length, 0);
});

test('agent validates JSON files successfully', async (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  fs.writeFileSync(
    path.join(root, 'valid.json'),
    JSON.stringify({ enabled: true })
  );

  const agent = createAgent({
    config: createTestConfig(root),
    logger: createSilentLogger()
  });

  const result = await agent.execute('repository.validate-json', {
    paths: ['valid.json']
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.data.status, 'passed');
  assert.equal(result.data.passed, 1);
  assert.equal(result.data.failed, 0);
});

test('agent reports malformed JSON without crashing the batch', async (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  fs.writeFileSync(path.join(root, 'valid.json'), '{"ok":true}');
  fs.writeFileSync(path.join(root, 'invalid.json'), '{bad');

  const agent = createAgent({
    config: createTestConfig(root),
    logger: createSilentLogger()
  });

  const result = await agent.execute('repository.validate-json', {
    paths: ['valid.json', 'invalid.json']
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.data.status, 'failed');
  assert.equal(result.data.passed, 1);
  assert.equal(result.data.failed, 1);
});

test('agent rejects invalid JSON validation batches', async (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  const agent = createAgent({
    config: createTestConfig(root),
    logger: createSilentLogger()
  });

  for (const paths of [[], 'file.json', Array(101).fill('a.json')]) {
    const result = await agent.execute('repository.validate-json', {
      paths
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.error.code, 'INVALID_PARAMETERS');
  }
});

test('agent refuses to inspect symlinked files', async (t) => {
  const root = createTempDirectory();
  const outside = createTempDirectory();

  t.after(() => removeTempDirectory(root));
  t.after(() => removeTempDirectory(outside));

  fs.writeFileSync(path.join(outside, 'secret.txt'), 'private');

  try {
    fs.symlinkSync(
      path.join(outside, 'secret.txt'),
      path.join(root, 'link.txt')
    );
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symlink creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  const agent = createAgent({
    config: createTestConfig(root),
    logger: createSilentLogger()
  });

  const result = await agent.execute('repository.inspect-file', {
    path: 'link.txt'
  });

  assert.equal(result.status, 'failed');
  assert.ok(['UNSAFE_FILE', 'PATH_NOT_ALLOWED'].includes(result.error.code));
});

test('backup task rejects unsupported scopes', async (t) => {
  const root = createTempDirectory();
  t.after(() => removeTempDirectory(root));

  const agent = createAgent({
    config: createTestConfig(root),
    logger: createSilentLogger()
  });

  const result = await agent.execute('backup.create', {
    scope: 'external'
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'INVALID_BACKUP_SCOPE');
});

test('logger redacts sensitive metadata keys', () => {
  assert.equal(isSensitiveKey('apiToken'), true);
  assert.equal(isSensitiveKey('password'), true);
  assert.equal(isSensitiveKey('privateKey'), true);
  assert.equal(isSensitiveKey('requestId'), false);

  const sanitized = sanitizeValue({
    username: 'example',
    apiToken: 'sensitive-value',
    nested: {
      clientSecret: 'another-secret'
    }
  });

  assert.equal(sanitized.username, 'example');
  assert.equal(sanitized.apiToken, '[REDACTED]');
  assert.equal(sanitized.nested.clientSecret, '[REDACTED]');
});

test('logger sanitizes known credential patterns in strings', () => {
  const value = sanitizeString(
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'
  );

  assert.doesNotMatch(value, /Bearer abcdefghijklmnopqrstuvwxyz123456/);
  assert.match(value, /\[REDACTED\]/);
});

test('logger handles circular metadata safely', () => {
  const value = {};
  value.self = value;

  const sanitized = sanitizeValue(value);

  assert.equal(sanitized.self, '[Circular]');
});

test('logger handles oversized strings', () => {
  const sanitized = sanitizeString('a'.repeat(5000), 100);

  assert.ok(sanitized.length < 200);
  assert.match(sanitized, /\[TRUNCATED\]/);
});

test('logger rejects invalid output configuration', () => {
  assert.throws(
    () => createLogger({ level: 'trace' }),
    /Unsupported log level/
  );

  assert.throws(
    () => createLogger({ destination: 'file' }),
    /filePath is required/
  );
});
