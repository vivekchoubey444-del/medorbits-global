
'use strict';

const {
  createOllamaService
} = require('../services/ollama-services');

async function main() {
  const service = createOllamaService({
    host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    timeoutMs: 60000
  });

  try {
    const health = await service.health();

    if (!health.ok) {
      throw new Error(
        `Ollama is unavailable: ${health.error?.message || 'unknown error'}`
      );
    }

    const response = await service.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a concise coding assistant.'
        },
        {
          role: 'user',
          content: 'Explain what a repository syntax check does.'
        }
      ]
    });

    process.stdout.write(`${response.message.content}\n`);
  } finally {
    service.close();
  }
}

main().catch((error) => {
  process.stderr.write(`Ollama example failed: ${error.message}\n`);
  process.exitCode = 1;
});
