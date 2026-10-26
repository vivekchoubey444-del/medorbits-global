/**

* MedOrbits Local Agent
* File: src/services/ollama.service.js
* Responsibilities:
* ●	Manage the Ollama provider.
* ●	Expose health and model-listing operations.
* ●	Validate generation requests.
* ●	Normalize provider errors without leaking sensitive details.
* ●	Enforce configurable input limits and request timeouts.
* Security:
* ●	Does not execute shell commands.
* ●	Does not write, delete, or patch repository files.
* ●	Does not deploy applications.
* ●	Does not expose provider credentials.
* Runtime: Node.js 20+
    */

import OllamaProvider from "../providers/ollama.provider.js";
import { ProviderError } from "../providers/provider.interface.js";

const DEFAULT_MAX_PROMPT_LENGTH = 100_000;
const DEFAULT_MAX_SYSTEM_LENGTH = 30_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 600_000;

const ERROR_CODES = Object.freeze({
INVALID_REQUEST: "INVALID_GENERATION_REQUEST",
PROMPT_REQUIRED: "PROMPT_REQUIRED",
PROMPT_TOO_LARGE: "PROMPT_TOO_LARGE",
SYSTEM_PROMPT_TOO_LARGE: "SYSTEM_PROMPT_TOO_LARGE",
INVALID_TIMEOUT: "INVALID_TIMEOUT",
INVALID_SIGNAL: "INVALID_ABORT_SIGNAL",
INVALID_PROVIDER_RESULT: "INVALID_PROVIDER_RESULT",
INVALID_MODEL_LIST: "INVALID_MODEL_LIST",
SERVICE_ERROR: "OLLAMA_SERVICE_ERROR",
REQUEST_ABORTED: "REQUEST_ABORTED",
REQUEST_TIMEOUT: "REQUEST_TIMEOUT"
});

function isPlainObject(value) {
if (value === null || typeof value !== "object") {
return false;
}

const prototype = Object.getPrototypeOf(value);
return prototype === Object.prototype || prototype === null;
}

function createProviderError(message, code, options = {}) {
return new ProviderError(message, {
code,
…options
});
}

function normalizeTimeout(value, fallback) {
if (value === undefined) {
return fallback;
}

if (
!Number.isInteger(value) ||
value < MIN_TIMEOUT_MS ||
value > MAX_TIMEOUT_MS
) {
throw createProviderError(
timeoutMs must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.,
ERROR_CODES.INVALID_TIMEOUT
);
}

return value;
}

function validateSignal(signal) {
if (signal === undefined) {
return;
}

if (
signal === null ||
typeof signal !== "object" ||
typeof signal.aborted !== "boolean" ||
typeof signal.addEventListener !== "function" ||
typeof signal.removeEventListener !== "function"
) {
throw createProviderError(
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
return createProviderError(
"The generation request was cancelled.",
ERROR_CODES.REQUEST_ABORTED,
{
retryable: false
}
);
}

if (error?.name === "TimeoutError") {
return createProviderError(
"The generation request timed out.",
ERROR_CODES.REQUEST_TIMEOUT,
{
retryable: true
}
);
}

return createProviderError(
"The Ollama service could not complete the request.",
ERROR_CODES.SERVICE_ERROR,
{
retryable: false,
cause: error instanceof Error ? error : undefined
}
);
}

function validateProvider(provider) {
const requiredMethods = [
"generate",
"healthCheck",
"listModels"
];

if (
!provider ||
typeof provider !== "object" ||
requiredMethods.some(
(method) => typeof provider[method] !== "function"
)
) {
throw new TypeError(
"The Ollama service requires a provider implementing " +
"generate(), healthCheck(), and listModels()."
);
}
}

function validatePositiveInteger(value, name) {
if (!Number.isSafeInteger(value) || value < 1) {
throw new TypeError(${name} must be a positive safe integer.);
}
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

if (typeof model.modifiedAt === "string") {
normalized.modifiedAt = model.modifiedAt;
} else if (typeof model.modified_at === "string") {
normalized.modifiedAt = model.modified_at;
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
validateProvider(provider);

validatePositiveInteger(maxPromptLength, "maxPromptLength");
validatePositiveInteger(maxSystemLength, "maxSystemLength");
if (
  !Number.isInteger(defaultTimeoutMs) ||
  defaultTimeoutMs < MIN_TIMEOUT_MS ||
  defaultTimeoutMs > MAX_TIMEOUT_MS
) {
  throw new TypeError(
    `defaultTimeoutMs must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`
  );
}
this.provider = provider;
this.maxPromptLength = maxPromptLength;
this.maxSystemLength = maxSystemLength;
this.defaultTimeoutMs = defaultTimeoutMs;

}

/**

* Generate text through the configured provider.
* The provider must honor signal and timeoutMs for cancellation
* to interrupt its underlying HTTP request.
* @param {object} options
* @param {string} options.prompt
* @param {string} [options.system]
* @param {AbortSignal} [options.signal]
* @param {number} [options.timeoutMs]
* @returns {Promise<{text: string, model: string, done: boolean}>}
    */
    async generate(options = {}) {
    if (!isPlainObject(options)) {
    throw createProviderError(
    "Generation options must be a plain object.",
    ERROR_CODES.INVALID_REQUEST
    );
    }

const {
  prompt,
  system,
  signal,
  timeoutMs
} = options;
if (typeof prompt !== "string" || prompt.trim().length === 0) {
  throw createProviderError(
    "A non-empty prompt is required.",
    ERROR_CODES.PROMPT_REQUIRED
  );
}
if (prompt.length > this.maxPromptLength) {
  throw createProviderError(
    "The prompt exceeds the configured service limit.",
    ERROR_CODES.PROMPT_TOO_LARGE
  );
}
if (system !== undefined && typeof system !== "string") {
  throw createProviderError(
    "The system prompt must be a string.",
    ERROR_CODES.INVALID_REQUEST
  );
}
if (
  typeof system === "string" &&
  system.length > this.maxSystemLength
) {
  throw createProviderError(
    "The system prompt exceeds the configured service limit.",
    ERROR_CODES.SYSTEM_PROMPT_TOO_LARGE
  );
}
validateSignal(signal);
const effectiveTimeoutMs = normalizeTimeout(
  timeoutMs,
  this.defaultTimeoutMs
);
if (signal?.aborted) {
  throw createProviderError(
    "The generation request was cancelled before it started.",
    ERROR_CODES.REQUEST_ABORTED,
    {
      retryable: false
    }
  );
}
let timeoutSignal;
let timeoutController;
if (typeof AbortSignal.timeout === "function") {
  timeoutSignal = AbortSignal.timeout(effectiveTimeoutMs);
} else {
  timeoutController = new AbortController();
  timeoutSignal = timeoutController.signal;
}
let combinedSignal = signal;
if (signal && typeof AbortSignal.any === "function") {
  combinedSignal = AbortSignal.any([
    signal,
    timeoutSignal
  ]);
} else if (signal) {
  // Preserve caller cancellation where AbortSignal.any is unavailable.
  // The fallback timeout controller is triggered by the timer below.
  combinedSignal = signal;
} else {
  combinedSignal = timeoutSignal;
}
let timeoutHandle;
if (timeoutController) {
  timeoutHandle = setTimeout(
    () => timeoutController.abort(),
    effectiveTimeoutMs
  );
  timeoutHandle.unref?.();
}
try {
  const result = await this.provider.generate({
    prompt,
    ...(system !== undefined ? { system } : {}),
    signal: combinedSignal,
    timeoutMs: effectiveTimeoutMs
  });
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.text !== "string"
  ) {
    throw createProviderError(
      "The provider returned an invalid generation result.",
      ERROR_CODES.INVALID_PROVIDER_RESULT
    );
  }
  if (combinedSignal?.aborted) {
    const timedOut =
      timeoutController?.signal.aborted === true ||
      timeoutSignal?.aborted === true;
    throw createProviderError(
      timedOut
        ? "The generation request timed out."
        : "The generation request was cancelled.",
      timedOut
        ? ERROR_CODES.REQUEST_TIMEOUT
        : ERROR_CODES.REQUEST_ABORTED,
      {
        retryable: timedOut
      }
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
  if (timeoutSignal?.aborted || timeoutController?.signal.aborted) {
    throw createProviderError(
      "The generation request timed out.",
      ERROR_CODES.REQUEST_TIMEOUT,
      {
        retryable: true,
        cause: error instanceof Error ? error : undefined
      }
    );
  }
  if (signal?.aborted || error?.name === "AbortError") {
    throw normalizeError({
      name: "AbortError"
    });
  }
  throw normalizeError(error);
} finally {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
}

}

/**

* Return a normalized health status.
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
    // Do not expose internal URLs, credentials, or raw network errors.
    return {
    available: false,
    provider: "ollama",
    message: "The Ollama health check failed."
    };
    }
    }

/**

* List models installed in the local Ollama instance.
    */
    async listModels() {
    let models;

try {
  models = await this.provider.listModels();
} catch (error) {
  throw normalizeError(error);
}
if (!Array.isArray(models)) {
  throw createProviderError(
    "The provider returned an invalid model list.",
    ERROR_CODES.INVALID_MODEL_LIST
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
    supportsFileWrites: false,
    supportsShellExecution: false,
    supportsDeployment: false
    };
    }
    }

/**

* Construct an Ollama service.
    */
    export function createOllamaService(options = {}) {
    return new OllamaService(options);
    }

export default OllamaService;