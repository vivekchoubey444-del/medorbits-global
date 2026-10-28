
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveInsideRoot } = require('../index');

function createSandbox() {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), 'medorbits-path-guard-')
  );

  const root = path.join(parent, 'repository');
  const outside = path.join(parent, 'outside');

  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });

  fs.writeFileSync(path.join(root, 'safe.txt'), 'safe');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');

  return {
    parent,
    root,
    outside,
    cleanup() {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  };
}

function resolvePath(root, candidate, options = {}) {
  return resolveInsideRoot(root, candidate, options);
}

test('accepts a file inside the repository root', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const resolved = resolvePath(sandbox.root, 'safe.txt');

  assert.equal(resolved, path.join(sandbox.root, 'safe.txt'));
});

test('accepts a nested file inside the repository root', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const nestedDirectory = path.join(sandbox.root, 'src', 'utils');
  fs.mkdirSync(nestedDirectory, { recursive: true });

  const nestedFile = path.join(nestedDirectory, 'helper.js');
  fs.writeFileSync(nestedFile, 'module.exports = {};');

  assert.equal(
    resolvePath(sandbox.root, 'src/utils/helper.js'),
    nestedFile
  );
});

test('rejects paths that traverse outside the repository', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  assert.throws(
    () => resolvePath(sandbox.root, '../outside/secret.txt'),
    (error) => {
      assert.ok(
        ['PATH_NOT_ALLOWED', 'PATH_OUTSIDE_ROOT'].includes(error.code),
        `Unexpected error code: ${error.code}`
      );
      return true;
    }
  );
});

test('rejects absolute paths outside the repository', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const externalFile = path.join(sandbox.outside, 'secret.txt');

  assert.throws(
    () => resolvePath(sandbox.root, externalFile),
    (error) => {
      assert.ok(error instanceof Error);
      return true;
    }
  );
});

test('rejects the repository root parent traversal', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  assert.throws(
    () => resolvePath(sandbox.root, '..'),
    (error) => error instanceof Error
  );
});

test('rejects empty and non-string candidate paths', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  for (const candidate of ['', '   ', null, undefined, 42, {}, []]) {
    assert.throws(
      () => resolvePath(sandbox.root, candidate),
      Error,
      `Expected candidate ${String(candidate)} to be rejected`
    );
  }
});

test('rejects a symbolic link pointing outside the repository', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const linkPath = path.join(sandbox.root, 'external-link.txt');

  try {
    fs.symlinkSync(
      path.join(sandbox.outside, 'secret.txt'),
      linkPath,
      'file'
    );
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Symbolic links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => resolvePath(sandbox.root, 'external-link.txt'),
    (error) => {
      assert.ok(error instanceof Error);
      return true;
    }
  );
});

test('rejects a directory symbolic link pointing outside the repository', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const linkPath = path.join(sandbox.root, 'external-directory');

  try {
    fs.symlinkSync(sandbox.outside, linkPath, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Directory symbolic links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => resolvePath(sandbox.root, 'external-directory/secret.txt'),
    Error
  );
});

test('rejects paths that escape through a symlinked parent directory', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const linkPath = path.join(sandbox.root, 'external-parent');

  try {
    fs.symlinkSync(sandbox.outside, linkPath, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Directory symbolic links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => resolvePath(sandbox.root, 'external-parent/secret.txt'),
    Error
  );
});

test('rejects symlink escapes when the target file does not exist', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const linkPath = path.join(sandbox.root, 'external-parent');

  try {
    fs.symlinkSync(sandbox.outside, linkPath, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Directory symbolic links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  assert.throws(
    () => resolvePath(sandbox.root, 'external-parent/new-file.txt'),
    Error
  );
});

test('rejects symlinked repository roots that resolve elsewhere', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const rootLink = path.join(sandbox.parent, 'repository-link');

  try {
    fs.symlinkSync(sandbox.root, rootLink, 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Directory symbolic links are unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  // A symlinked root may be valid if the implementation canonicalizes it.
  // This test only requires the resolved file to remain inside the actual root.
  const resolved = resolvePath(rootLink, 'safe.txt');

  assert.equal(
    fs.realpathSync(resolved),
    fs.realpathSync(path.join(sandbox.root, 'safe.txt'))
  );
});

test('rejects null bytes in candidate paths', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  assert.throws(
    () => resolvePath(sandbox.root, 'safe.txt\u0000unexpected'),
    Error
  );
});

test('does not permit a sibling directory with a shared prefix', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const sibling = `${sandbox.root}-outside`;
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret');

  t.after(() => {
    fs.rmSync(sibling, { recursive: true, force: true });
  });

  assert.throws(
    () => resolvePath(sandbox.root, path.join(sibling, 'secret.txt')),
    Error
  );
});

test('rejects a path that normalizes to a parent traversal', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  assert.throws(
    () => resolvePath(sandbox.root, 'src/../../outside/secret.txt'),
    Error
  );
});

test('does not allow the outside directory as a relative path', (t) => {
  const sandbox = createSandbox();
  t.after(() => sandbox.cleanup());

  const relative = path.relative(
    sandbox.root,
    path.join(sandbox.outside, 'secret.txt')
  );

  assert.throws(
    () => resolvePath(sandbox.root, relative),
    Error
  );
});
