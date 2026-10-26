
/**
 * MedOrbits Local Agent
 * File: src/agent/agent.js
 *
 * Core coordinator.
 * Does not execute shell commands or modify repository files.
 */

import config from "../config/env.js";
import {
  getRepositoryRoot,
  resolveRepositoryPath
} from "../config/paths.js";

const MAX_PROMPT_LENGTH = 12_000;

const ALLOWED_OPERATIONS = new Set([
  "get_status",
  "inspect_file",
  "propose_change"
]);

function validateText(value, name, maxLength = MAX_PROMPT_LENGTH) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  if (value.length > maxLength) {
    throw new Error(`${name} exceeds the maximum allowed length.`);
  }

  return value.trim();
}

function createResult(operation, data = {}) {
  return {
    success: true,
    operation,
    mode: config.app.mode,
    timestamp: new Date().toISOString(),
    data
  };
}

/**
 * Returns basic agent information.
 */
export function getAgentInfo() {
  return {
    name: config.app.name,
    version: config.app.version,
    mode: config.app.mode,
    readOnly: config.safety.readOnly,
    approvalRequired: config.safety.requireApproval,
    shellExecutionEnabled: config.safety.allowShellExecution,
    automaticGitChangesEnabled:
      config.safety.allowAutomaticGitChanges,
    automaticDeploymentEnabled:
      config.safety.allowAutomaticDeployment
  };
}

/**
 * Inspect a repository-relative text file.
 *
 * Secret paths are rejected by the path resolver.
 * File size and UTF-8 decoding are checked before returning content.
 */
export async function inspectFile(relativePath) {
  const { readFile, stat } = await import("node:fs/promises");

  const target = resolveRepositoryPath(relativePath, {
    mustExist: true,
    expectedType: "file"
  });

  const metadata = await stat(target);

  if (metadata.size > config.safety.maxFileBytes) {
    throw new Error("File exceeds the configured inspection size limit.");
  }

  const content = await readFile(target, "utf8");

  if (content.includes("\u0000")) {
    throw new Error("Binary files cannot be inspected as text.");
  }

  return createResult("inspect_file", {
    path: relativePath,
    sizeBytes: metadata.size,
    content
  });
}

/**
 * Return basic repository information.
 * This does not execute Git or modify files.
 */
export function getRepositoryInfo() {
  return createResult("get_status", {
    repositoryRoot: getRepositoryRoot(),
    agent: getAgentInfo(),
    note: "Git status inspection is not connected yet."
  });
}

/**
 * Prepare a change proposal without applying it.
 *
 * A later approval service must independently validate any proposal
 * before it can be applied. This function never writes files.
 */
export function proposeChange({ path, instructions }) {
  const relativePath = validateText(path, "path", 1024);
  const request = validateText(instructions, "instructions");

  // Validate that the proposed target is within the allowed repository.
  // Existing protected paths are rejected by the resolver.
  resolveRepositoryPath(relativePath);

  return createResult("propose_change", {
    path: relativePath,
    instructions: request,
    applied: false,
    requiresApproval: true,
    message:
      "Proposal recorded in memory only. No file has been changed."
  });
}

/**
 * Public operation dispatcher.
 * Only explicitly supported operation names are accepted.
 */
export async function runOperation(operation, payload = {}) {
  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error(`Unsupported agent operation: ${operation}`);
  }

  switch (operation) {
    case "get_status":
      return getRepositoryInfo();

    case "inspect_file":
      return inspectFile(
        validateText(payload.path, "path", 1024)
      );

    case "propose_change":
      return proposeChange({
        path: payload.path,
        instructions: payload.instructions
      });

    default:
      throw new Error("Operation dispatch failed.");
  }
}

/**
 * Placeholder for the future model integration.
 * No model call is made until a dedicated provider is implemented.
 */
export async function askAgent(prompt) {
  const question = validateText(prompt, "prompt");

  return createResult("assistant_response", {
    prompt: question,
    providerConnected: false,
    answer:
      "Ollama integration is not connected yet. " +
      "No external model request was made."
  });
}

export default {
  getAgentInfo,
  getRepositoryInfo,
  inspectFile,
  proposeChange,
  runOperation,
  askAgent
};
