/**

* MedOrbits Local Coding Agent
* File: src/index.js
* Central public entry point for the agent package.
* Exports:
* ●	Agent and planner implementations
* ●	Ollama provider and service
* ●	Configuration helpers
* ●	Structured logger
* ●	Repository audit, project check, and route discovery commands
* This module does not start the HTTP server or modify repository files
* merely by being imported.
    */

import logger from "./utils/logger.js";

export { default as logger, createLogger, redactValue, serializeError }
from "./utils/logger.js";

export { Agent } from "./agent/agent.js";
export { Planner } from "./agent/planner.js";

export {
default as OllamaProvider,
} from "./providers/ollama.provider.js";

export * from "./providers/provider.interface.js";
export * from "./services/ollama.service.js";

export * from "./config/env.js";
export * from "./config/paths.js";

export {
auditRepository,
runAudit,
} from "./commands/audit.js";

export {
runCheck,
} from "./commands/check.js";

export {
discoverRoutes,
runRouteAudit,
} from "./commands/routes.js";

/**

* Basic package information.
    */
    export const VERSION = "1.0.0";
    export const PACKAGE_NAME = "medorbits-local-agent";

/**

* Create an agent instance.
* This factory deliberately supports the project’s common agent export
* shapes while keeping provider construction explicit. Pass a provider
* that implements the interface expected by your Agent class.
* Example:
* const agent = createAgent({ provider });
    */
    export function createAgent(options = {}) {
    const AgentImplementation = options.AgentClass;

if (typeof AgentImplementation !== "function") {
throw new TypeError(
"createAgent requires an AgentClass constructor in options.AgentClass. " +
"Use the exported Agent class or pass your project’s compatible implementation."
);
}

if (!options.provider) {
throw new TypeError(
"createAgent requires a provider instance."
);
}

const agentOptions = {
…options,
provider: options.provider,
};

delete agentOptions.AgentClass;

return new AgentImplementation(agentOptions);
}

/**

* Validate the minimal shape of a provider before passing it to an agent.
* This check intentionally does not make network requests.
    */
    export function validateProvider(provider) {
    if (!provider || typeof provider !== "object") {
    throw new TypeError("Provider must be an object.");
    }

const supportedMethods = [
"generate",
"chat",
"complete",
];

const hasSupportedMethod = supportedMethods.some(
(method) => typeof provider[method] === "function"
);

if (!hasSupportedMethod) {
throw new TypeError(
"Provider must implement at least one supported method: " +
supportedMethods.join(", ")
);
}

return true;
}

/**

* Lightweight health information for local diagnostics.
* This is not a network health check and does not contact Ollama.
    */
    export function getAgentInfo() {
    return {
    name: PACKAGE_NAME,
    version: VERSION,
    runtime: {
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    },
    modules: {
    agent: true,
    planner: true,
    logger: true,
    audit: true,
    check: true,
    routes: true,
    },
    };
    }

/**

* Log startup information when explicitly requested by a caller.
* Importing src/index.js does not emit startup logs.
    */
    export function logAgentInfo() {
    const info = getAgentInfo();

logger.info("MedOrbits Local Coding Agent initialized", {
name: info.name,
version: info.version,
node: info.runtime.node,
platform: info.runtime.platform,
});

return info;
}