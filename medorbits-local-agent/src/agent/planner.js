
/**
 * MedOrbits Local Agent
 * File: src/agent/planner.js
 *
 * Creates structured, reviewable plans.
 * Planning only -- no commands or file changes are executed.
 */

import config from "../config/env.js";

const MAX_REQUEST_LENGTH = 12_000;

const TASK_TYPES = new Set([
  "inspect",
  "validate",
  "explain",
  "propose_change",
  "review"
]);

const RISK_LEVELS = new Set([
  "low",
  "medium",
  "high"
]);

function validateRequest(request) {
  if (typeof request !== "string" || !request.trim()) {
    throw new TypeError("A non-empty task request is required.");
  }

  const normalized = request.trim();

  if (normalized.length > MAX_REQUEST_LENGTH) {
    throw new Error("Task request exceeds the maximum length.");
  }

  return normalized;
}

function classifyTask(request) {
  const text = request.toLowerCase();

  if (
    /\b(delete|remove|overwrite|reset|deploy|commit|push)\b/.test(text)
  ) {
    return {
      type: "propose_change",
      risk: "high",
      requiresApproval: true
    };
  }

  if (
    /\b(change|modify|edit|write|create|update|rename)\b/.test(text)
  ) {
    return {
      type: "propose_change",
      risk: "medium",
      requiresApproval: true
    };
  }

  if (
    /\b(validate|check|test|lint|audit|verify)\b/.test(text)
  ) {
    return {
      type: "validate",
      risk: "low",
      requiresApproval: false
    };
  }

  if (
    /\b(review|inspect|find|list|search|status)\b/.test(text)
  ) {
    return {
      type: "inspect",
      risk: "low",
      requiresApproval: false
    };
  }

  return {
    type: "explain",
    risk: "low",
    requiresApproval: false
  };
}

function buildSteps(type) {
  switch (type) {
    case "inspect":
      return [
        "Confirm the repository root.",
        "Identify the relevant files without exposing secrets.",
        "Inspect only the required files.",
        "Summarize observed facts and uncertainties."
      ];

    case "validate":
      return [
        "Identify the validation target and available checks.",
        "Confirm the checks are read-only or understand their side effects.",
        "Prepare the validation procedure.",
        "Report findings without automatically fixing files."
      ];

    case "propose_change":
      return [
        "Identify the intended files and requested outcome.",
        "Inspect the relevant code and existing project conventions.",
        "Prepare a minimal proposed change.",
        "Show the proposed diff and explain its impact.",
        "Require explicit approval before any write operation."
      ];

    case "review":
      return [
        "Identify the scope of the review.",
        "Inspect relevant code and configuration.",
        "Check for correctness, security and maintainability issues.",
        "Report findings with file references."
      ];

    case "explain":
    default:
      return [
        "Clarify the technical question from the provided context.",
        "Separate verified facts from assumptions.",
        "Provide an explanation and suggested next steps."
      ];
  }
}

/**
 * Produce a plan without performing any of its steps.
 */
export function createPlan(request) {
  const task = validateRequest(request);
  const classification = classifyTask(task);

  if (!TASK_TYPES.has(classification.type)) {
    throw new Error("Planner produced an unsupported task type.");
  }

  if (!RISK_LEVELS.has(classification.risk)) {
    throw new Error("Planner produced an unsupported risk level.");
  }

  return {
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    request: task,
    taskType: classification.type,
    risk: classification.risk,
    status: "proposed",
    executionEnabled: false,
    approvalRequired:
      classification.requiresApproval ||
      config.safety.requireApproval,
    steps: buildSteps(classification.type),
    safeguards: [
      "Stay within the configured repository boundary.",
      "Do not reveal environment variables or credentials.",
      "Do not execute arbitrary shell commands.",
      "Do not modify files while planning.",
      "Revalidate all paths before any future file operation."
    ]
  };
}

export default {
  createPlan
};
