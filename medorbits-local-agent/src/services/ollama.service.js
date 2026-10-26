/**

* MedOrbits Local Agent
* File: src/services/ollama.service.js
* Responsibilities:
* ●	Manage the Ollama provider.
* ●	Expose health and model-listing operations.
* ●	Validate generation requests.
* ●	Enforce request timeouts and cancellation.
* ●	Normalize provider errors.
* This service does not execute shell commands, write files,
* apply patches, or deploy applications.
* Requires Node.js 20+.
    */

import OllamaProvider from "../providers/ollama.provider.js";
import { ProviderError } from "../providers/provider.interface.js";

const DEFAULT_MAX_PROMPT_LENGTH = 100_000;
const DEFAULT_MAX_SYSTEM_LENGTH = 30_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;

const ERROR_CODES = Object.freeze({
INVALID_OPTIONS: "INVALID_GENERATION_OPTIONS",
PROMPT_REQUIRED: "PROMPT_REQUIRED",
PROMPT_TOO_LARGE: "PROMPT_TOO_LARGE",
SYSTEM_TOO_LARGE: "SYSTEM_PROMPT_TOO_LARGE",
INVALID_TIMEOUT: "INVALID_TIMEOUT",
INVALID_SIGNAL: "INVALID_ABORT_SIGNAL",
REQUEST_ABORTED: "REQUEST_ABORTED",
REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
INVALID_RESULT: "INVALID_PROVIDER_RESULT",
INVALID_MODELS: "INVALID_MODEL_LIST",
SERVICE_ERROR: "OLLAMA_SERVICE_ERROR"
});

function providerError(message, code, options = {}) {
return new ProviderError(message, {
code,
…options
});
}

function isPlainObject(value) {
if (value === null || typeof value !== "object") {
return false;
}

const prototype = Object.getPrototypeOf(value);

return prototype === Object.prototype || prototype === null;
}

function validateLimit(value, name) {
if (!Number.isSafeInteger(value) || value < 1) {
throw new TypeError(${name} must be a positive safe integer.);
}
}

function validateSignal(signal) {
if (signal === undefined) {
return;
}

if (
signal === null ||
typeof signal !== "object" ||
typeof signal.aborted !== "boolean" ||
typeof signal.addEventListener !== "function"
) {
throw providerError(
"signal must be a valid AbortSignal.",
ERROR_CODES.INVALID_SIGNAL
);
}
}

function normalizeError(error) {
if (error instanceof ProviderError) {
return error;
}

if (error?.name === "AbortError") {
return providerError(
"The generation request was cancelled.",
ERROR_CODES.REQUEST_ABORTED,
{ retryable: false }
);
}

if (error?.name === "TimeoutError") {
return providerError(
"The generation request timed out.",
ERROR_CODES.REQUEST_TIMEOUT,
{ retryable: true }
);
}

return providerError(
"The Ollama service could not complete the request.",
ERROR_CODES.SERVICE_ERROR,
{
retryable: false,
cause: error instanceof Error ? error : undefined
}
);
}

function normalizeModel(model) {
if (
!model ||
typeof model !== "object" ||
typeof model.name !== "string" ||
model.name.trim().length === 0
) {
return null;
}

const normalized = {
name: model.name.trim()
};

if (Number.isFinite(model.size) && model.size >= 0) {
normalized.size = model.size;
}

const modifiedAt = model.modifiedAt ?? model.modified_at;

if (typeof modifiedAt === "string") {
normalized.modifiedAt = modifiedAt;
}

if (typeof model.digest === "string") {
normalized.digest = model.digest;
}

return normalized;
}

export class OllamaService {
constructor({
provider = new OllamaProvider(),
maxPromptLength = DEFAULT_MAX_PROMPT_LENGTH,
maxSystemLength = DEFAULT_MAX_SYSTEM_LENGTH,
defaultTimeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
if (
!provider ||
typeof provider.generate !== "function" ||
typeof provider.healthCheck !== "function" ||
typeof provider.listModels !== "function"
) {
throw new TypeError(
"The Ollama service requires a compatible provider."
);
}

validateLimit(maxPromptLength, "maxPromptLength");
validateLimit(maxSystemLength, "maxSystemLength");
if (
  !Number.isInteger(defaultTimeoutMs) ||
  defaultTimeoutMs < 1 ||
  defaultTimeoutMs > MAX_TIMEOUT_MS
) {
  throw new TypeError(
    `defaultTimeoutMs must be between 1 and ${MAX_TIMEOUT_MS}.`
  );
}
this.provider = provider;
this.maxPromptLength = maxPromptLength;
this.maxSystemLength = maxSystemLength;
this.defaultTimeoutMs = defaultTimeoutMs;

}

/**

* Generate text using the configured provider.
* @param {object} options
* @param {string} options.prompt
* @param {string} [options.system]
* @param {AbortSignal} [options.signal]
* @param {number} [options.timeoutMs]
* @returns {Promise<{text: string, model: string, done: boolean}>}
    */
    async generate(options = {}) {
    if (!isPlainObject(options)) {
    throw providerError(
    "Generation options must be a plain object.",
    ERROR_CODES.INVALID_OPTIONS
    );
    }

const {
  prompt,
  system,
  signal,
  timeoutMs
} = options;
if (typeof prompt !== "string" || prompt.trim().length === 0) {
  throw providerError(
    "A non-empty prompt is required.",
    ERROR_CODES.PROMPT_REQUIRED
  );
}
if (prompt.length > this.maxPromptLength) {
  throw providerError(
    "The prompt exceeds the configured service limit.",
    ERROR_CODES.PROMPT_TOO_LARGE
  );
}
if (system !== undefined && typeof system !== "string") {
  throw providerError(
    "The system prompt must be a string.",
    ERROR_CODES.INVALID_OPTIONS
  );
}
if (
  typeof system === "string" &&
  system.length > this.maxSystemLength
) {
  throw providerError(
    "The system prompt exceeds the configured service limit.",
    ERROR_CODES.SYSTEM_TOO_LARGE
  );
}
validateSignal(signal);
const effectiveTimeoutMs = timeoutMs ?? this.defaultTimeoutMs;
if (
  !Number.isInteger(effectiveTimeoutMs) ||
  effectiveTimeoutMs < 1 ||
  effectiveTimeoutMs > MAX_TIMEOUT_MS
) {
  throw providerError(
    `timeoutMs must be an integer between 1 and ${MAX_TIMEOUT_MS}.`,
    ERROR_CODES.INVALID_TIMEOUT
  );
}
if (signal?.aborted) {
  throw providerError(
    "The generation request was cancelled before it started.",
    ERROR_CODES.REQUEST_ABORTED,
    { retryable: false }
  );
}
const timeoutController = new AbortController();
const timer = setTimeout(
  () => timeoutController.abort(),
  effectiveTimeoutMs
);
timer.unref?.();
const signals = [timeoutController.signal];
if (signal) {
  signals.push(signal);
}
const combinedSignal =
  typeof AbortSignal.any === "function"
    ? AbortSignal.any(signals)
    : timeoutController.signal;
// If AbortSignal.any is unavailable, relay caller cancellation.
let abortListener;
if (signal && typeof AbortSignal.any !== "function") {
  abortListener = () => timeoutController.abort();
  signal.addEventListener("abort", abortListener, {
    once: true
  });
}
try {
  const result = await this.provider.generate({
    prompt,
    ...(system !== undefined ? { system } : {}),
    signal: combinedSignal,
    timeoutMs: effectiveTimeoutMs
  });
  if (timeoutController.signal.aborted) {
    throw providerError(
      "The generation request timed out.",
      ERROR_CODES.REQUEST_TIMEOUT,
      { retryable: true }
    );
  }
  if (signal?.aborted) {
    throw providerError(
      "The generation request was cancelled.",
      ERROR_CODES.REQUEST_ABORTED,
      { retryable: false }
    );
  }
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.text !== "string"
  ) {
    throw providerError(
      "The provider returned an invalid generation result.",
      ERROR_CODES.INVALID_RESULT
    );
  }
  return {
    text: result.text,
    model:
      typeof result.model === "string" && result.model.trim()
        ? result.model
        : "unknown",
    done: result.done === true
  };
} catch (error) {
  if (error instanceof ProviderError) {
    throw error;
  }
  if (timeoutController.signal.aborted) {
    throw providerError(
      "The generation request timed out or was cancelled.",
      signal?.aborted
        ? ERROR_CODES.REQUEST_ABORTED
        : ERROR_CODES.REQUEST_TIMEOUT,
      {
        retryable: !signal?.aborted,
        cause: error instanceof Error ? error : undefined
      }
    );
  }
  throw normalizeError(error);
} finally {
  clearTimeout(timer);
  if (abortListener) {
    signal.removeEventListener("abort", abortListener);
  }
}

}

/**

* Check whether the configured Ollama provider is available.
    */
    async healthCheck() {
    try {
    const result = await this.provider.healthCheck();
    return {
    available: result?.available === true,
    provider:
    typeof result?.provider === "string"
    ? result.provider
    : "ollama",
    …(typeof result?.message === "string"
    ? { message: result.message }
    : {})
    };
    } catch {
    return {
    available: false,
    provider: "ollama",
    message: "The Ollama health check failed."
    };
    }
    }

/**

* List locally available models.
    */
    async listModels() {
    let models;

try {
  models = await this.provider.listModels();
} catch (error) {
  throw normalizeError(error);
}
if (!Array.isArray(models)) {
  throw providerError(
    "The provider returned an invalid model list.",
    ERROR_CODES.INVALID_MODELS
  );
}
return models
  .map(normalizeModel)
  .filter(Boolean);

}

/**

* Return non-sensitive service capabilities.
    */
    getInfo() {
    return {
    provider: "ollama",
    capabilities: [
    "generate",
    "health",
    "models",
    "request-cancellation",
    "request-timeout"
    ],
    promptLimit: this.maxPromptLength,
    systemPromptLimit: this.maxSystemLength,
    defaultTimeoutMs: this.defaultTimeoutMs,
    maxTimeoutMs: MAX_TIMEOUT_MS,
    supportsFileWrites: false,
    supportsShellExecution: false,
    supportsDeployment: false
    };
    }
    }

export function createOllamaService(options = {}) {
return new OllamaService(options);
}

export default OllamaService;