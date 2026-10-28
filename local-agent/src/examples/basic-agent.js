
'use strict';

const path = require('node:path');
const { createAgent } = require('../index');

async function main() {
  const repositoryRoot = path.resolve(
    process.env.MEDORBITS_REPO_ROOT || process.cwd()
  );

  const agent = createAgent({
    root: repositoryRoot
  });

  const result = await agent.run('agent.status');

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.status !== 'succeeded') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`Agent failed: ${error.message}\n`);
  process.exitCode = 1;
});
