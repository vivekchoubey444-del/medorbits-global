
'use strict';

const {
  createProvidorRegistry
} = require('../providor/providor.interface');

const {
  createOllamaProvider
} = require('../providor/ollama.providor');

const {
  createOllamaService
} = require('../services/ollama-services');

async function main() {
  const service = createOllamaService({
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2'
  });

  const provider = createOllamaProvider({
    service,
    model: process.env.OLLAMA_MODEL || 'llama3.2'
  });

  const registry = createProvidorRegistry();
  registry.register('ollama', provider);

  try {
    const health = await registry.healthAll();
    process.stdout.write(`${JSON.stringify(health, null, 2)}\n`);

    if (!health.some((item) => item.name === 'ollama' && item.ok)) {
      throw new Error('No registered Ollama provider is healthy.');
    }

    const result = await provider.runChat({
      messages: [
        {
          role: 'user',
          content: 'Say hello to MedOrbits.'
        }
      ]
    });

    process.stdout.write(`${result.content}\n`);
  } finally {
    await registry.closeAll();
  }
}

main().catch((error) => {
  process.stderr.write(`Provider example failed: ${error.message}\n`);
  process.exitCode = 1;
});
