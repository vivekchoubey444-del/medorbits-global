
'use strict';

const path = require('node:path');

const {
  createReadOnlyRepository
} = require('../safety/read-only');

function main() {
  const root = path.resolve(
    process.env.MEDORBITS_REPO_ROOT || process.cwd()
  );

  const repository = createReadOnlyRepository({
    root,
    maxFileBytes: 2 * 1024 * 1024,
    maxTotalBytes: 10 * 1024 * 1024,
    maxDirectoryEntries: 100,
    maxDepth: 5
  });

  try {
    const inventory = repository.inventory('.', {
      maxDepth: 3,
      maxEntries: 100
    });

    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  } finally {
    repository.close();
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`Inspection failed: ${error.message}\n`);
  process.exitCode = 1;
}
