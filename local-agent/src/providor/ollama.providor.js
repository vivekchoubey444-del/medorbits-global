
'use strict';

/**
 * MedOrbits Local Agent -- Ollama Provider Adapter
 * ------------------------------------------------
 * Connects the provider interface to the local Ollama service.
 *
 * Runtime: Node.js 20+
 * Dependencies: local-agent/src/services/ollama-services.js
 *               local-agent/src/services/providor-interface.js
 */

const {
  ProviderInterface,
  ProviderError
} = require('../services/providor-interface');

const {
  OLLAMA_SERVICE_VERSION,
  createOllamaService,
  OllamaServiceError
} = require('../services/ollama-services');

const OLLAMA_PROVIDER_VERSION = '1.0.0';

class OllamaProvider extends ProviderInterface {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name || 'ollama',
      model: options.model || process.env.OLLAMA_MODEL || 'llama3.2'
    });

    this.service = options.service || createOllamaService({
      host: options.host || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
      model: this.defaultModel,
      timeoutMs: options.timeoutMs,
      connectTimeoutMs: options.connectTimeoutMs,
      keepAlive: options.keepAlive,
      fetch: options.fetch
    });

    this.ownsService = !options.service;
  }

  /**
   * Translate Ollama-specific errors into normalized provider errors.
   */
  translateError(error) {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error instanceof OllamaServiceError) {
      return new ProviderError(error.message, {
        provider: this.name,
        code: error.code || 'OLLAMA_ERROR',
        retryable: error.retryable,
        status: error.status,
        cause: error
      });
    }

    return new ProviderError('Ollama provider operation failed.', {
      provider: this.name,
      code: 'OLLAMA_OPERATION_FAILED',
      cause: error
    });
  }

  async generate({ model, prompt, system, options, signal }) {
    this.ensureOpen();

    try {
      const result = await this.service.generate({
        model,
        prompt,
        system,
        options,
        signal
      });

      return {
        model: result.model || model,
        content: result.response,
        done: result.done === true,
        metadata: {
          totalDuration: result.totalDuration ?? null,
          promptEvalCount: result.promptEvalCount ?? null,
          evalCount: result.evalCount ?? null
        }
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async chat({ model, messages, options, signal }) {
    this.ensureOpen();

    try {
      const result = await this.service.chat({
        model,
        messages,
        options,
        signal
      });

      return {
        model: result.model || model,
        content: result.message.content,
        done: result.done === true,
        metadata: {
          totalDuration: result.totalDuration ?? null,
          promptEvalCount: result.promptEvalCount ?? null,
          evalCount: result.evalCount ?? null
        }
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async health() {
    this.ensureOpen();

    try {
      const result = await this.service.health();

      return {
        ok: result.ok === true,
        provider: this.name,
        model: this.defaultModel,
        host: result.host || null,
        version: result.version || null,
        ...(result.error ? { error: result.error } : {})
      };
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async listModels() {
    this.ensureOpen();

    try {
      const models = await this.service.listModels();

      return models.map((model) => model.name);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async hasModel(model) {
    this.ensureOpen();

    try {
      return await this.service.hasModel(model);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async ensureModel(model) {
    this.ensureOpen();

    try {
      return await this.service.ensureModel(model);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /**
   * Stream chat chunks from Ollama.
   *
   * Each yielded item is the original Ollama NDJSON response object.
   */
  async *streamChat(input = {}) {
    this.ensureOpen();

    const model = input.model || this.defaultModel;

    if (!model) {
      throw new ProviderError(
        'An Ollama model must be specified before streaming.',
        {
          provider: this.name,
          code: 'MODEL_REQUIRED'
        }
      );
    }

    try {
      for await (const chunk of this.service.streamChat({
        model,
        messages: input.messages,
        options: input.options,
        keepAlive: input.keepAlive,
        timeoutMs: input.timeoutMs,
        signal: input.signal
      })) {
        yield {
          provider: this.name,
          model: chunk.model || model,
          content: chunk.message?.content || '',
          done: chunk.done === true,
          metadata: {
            totalDuration: chunk.total_duration ?? null,
            promptEvalCount: chunk.prompt_eval_count ?? null,
            evalCount: chunk.eval_count ?? null
          }
        };
      }
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async close() {
    if (this.closed) {
      return;
    }

    await super.close();

    if (this.ownsService && typeof this.service.close === 'function') {
      this.service.close();
    }
  }

  getInfo() {
    return {
      name: this.name,
      version: OLLAMA_PROVIDER_VERSION,
      serviceVersion: OLLAMA_SERVICE_VERSION,
      model: this.defaultModel,
      host: this.service.host || null,
      closed: this.closed
    };
  }
}

function createOllamaProvider(options = {}) {
  return new OllamaProvider(options);
}

module.exports = {
  OLLAMA_PROVIDER_VERSION,
  OllamaProvider,
  createOllamaProvider
};
