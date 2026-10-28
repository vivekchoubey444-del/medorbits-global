
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/agent/planner.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Convert requested work into a validated, dependency-aware task plan.
 *
 * Features:
 *   - Deterministic planning without requiring an AI provider.
 *   - Explicit task types and dependency validation.
 *   - Cycle detection and topological ordering.
 *   - Safe-by-default task classification.
 *   - Bounded task counts and input sizes.
 *   - Resume planning for unfinished tasks.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 *
 * This planner does not execute tasks or modify repository files.
 */

const crypto = require('node:crypto');

const PLANNER_VERSION = '1.0.0';

const DEFAULTS = Object.freeze({
  maxTasks: 500,
  maxDependenciesPerTask: 50,
  maxDescriptionLength: 4000,
  maxPlanTitleLength: 200,
  allowUnknownTaskTypes: false,
  defaultReadOnly: true
});

const TASK_TYPES = Object.freeze([
  'audit',
  'check',
  'command',
  'create-file',
  'inspect-file',
  'inventory',
  'provider-health',
  'repository-status',
  'test',
  'validate-file'
]);

const MUTATING_TASK_TYPES = new Set([
  'create-file'
]);

const READ_ONLY_TASK_TYPES = new Set([
  'audit',
  'check',
  'inspect-file',
  'inventory',
  'provider-health',
  'repository-status',
  'test',
  'validate-file'
]);

class PlannerError extends Error {
  constructor(message, code = 'PLANNER_ERROR', options = {}) {
    super(message, options);
    this.name = 'PlannerError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function validateOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new PlannerError('Planner options must be an object.', 'INVALID_OPTIONS');
  }

  const config = { ...DEFAULTS, ...options };

  for (const key of [
    'maxTasks',
    'maxDependenciesPerTask',
    'maxDescriptionLength',
    'maxPlanTitleLength'
  ]) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1) {
      throw new PlannerError(`${key} must be a positive integer.`, 'INVALID_OPTIONS');
    }
  }

  if (config.maxTasks > 10_000) {
    throw new PlannerError('maxTasks cannot exceed 10000.', 'INVALID_OPTIONS');
  }

  if (typeof config.allowUnknownTaskTypes !== 'boolean' ||
      typeof config.defaultReadOnly !== 'boolean') {
    throw new PlannerError(
      'Planner boolean options are invalid.',
      'INVALID_OPTIONS'
    );
  }

  return config;
}

function createId(prefix = 'plan') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function normalizeText(value, field, maxLength, required = false) {
  if (value === undefined || value === null) {
    if (required) {
      throw new PlannerError(`${field} is required.`, 'INVALID_PLAN');
    }

    return '';
  }

  if (typeof value !== 'string') {
    throw new PlannerError(`${field} must be a string.`, 'INVALID_PLAN');
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new PlannerError(`${field} cannot be empty.`, 'INVALID_PLAN');
  }

  if (normalized.length > maxLength) {
    throw new PlannerError(`${field} exceeds its length limit.`, 'INPUT_TOO_LARGE');
  }

  if (normalized.includes('\0')) {
    throw new PlannerError(`${field} contains a null byte.`, 'INVALID_PLAN');
  }

  return normalized;
}

function normalizeTaskType(value, options) {
  if (typeof value !== 'string') {
    throw new PlannerError('Task type must be a string.', 'INVALID_TASK_TYPE');
  }

  const type = value.trim().toLowerCase();

  if (!/^[a-z][a-z0-9-]{0,63}$/.test(type)) {
    throw new PlannerError('Task type has an invalid format.', 'INVALID_TASK_TYPE');
  }

  if (!options.allowUnknownTaskTypes && !TASK_TYPES.includes(type)) {
    throw new PlannerError(`Unsupported task type "${type}".`, 'UNKNOWN_TASK_TYPE');
  }

  return type;
}

function normalizeDependencies(value, taskId, options) {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throw new PlannerError(
      `Dependencies for "${taskId}" must be an array.`,
      'INVALID_DEPENDENCIES'
    );
  }

  if (value.length > options.maxDependenciesPerTask) {
    throw new PlannerError(
      `Task "${taskId}" exceeds the dependency limit.`,
      'TOO_MANY_DEPENDENCIES'
    );
  }

  const seen = new Set();
  const dependencies = [];

  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      throw new PlannerError(
        `Task "${taskId}" contains an invalid dependency.`,
        'INVALID_DEPENDENCIES'
      );
    }

    const dependency = item.trim();

    if (dependency === taskId) {
      throw new PlannerError(
        `Task "${taskId}" cannot depend on itself.`,
        'DEPENDENCY_CYCLE'
      );
    }

    if (!seen.has(dependency)) {
      seen.add(dependency);
      dependencies.push(dependency);
    }
  }

  return dependencies;
}

function normalizeTask(input, index, options) {
  if (!isPlainObject(input)) {
    throw new PlannerError(`Task ${index + 1} must be an object.`, 'INVALID_TASK');
  }

  const id = normalizeText(
    input.id === undefined ? createId('task') : input.id,
    `Task ${index + 1} id`,
    128,
    true
  );

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    throw new PlannerError(`Task id "${id}" has an invalid format.`, 'INVALID_TASK_ID');
  }

  const type = normalizeTaskType(input.type, options);
  const title = normalizeText(
    input.title === undefined ? type : input.title,
    `Task "${id}" title`,
    options.maxPlanTitleLength,
    true
  );

  const description = normalizeText(
    input.description,
    `Task "${id}" description`,
    options.maxDescriptionLength
  );

  const dependencies = normalizeDependencies(input.dependsOn, id, options);

  const defaultReadOnly = READ_ONLY_TASK_TYPES.has(type)
    ? true
    : MUTATING_TASK_TYPES.has(type)
      ? false
      : options.defaultReadOnly;

  const readOnly = input.readOnly === undefined
    ? defaultReadOnly
    : input.readOnly;

  if (typeof readOnly !== 'boolean') {
    throw new PlannerError(
      `Task "${id}" readOnly must be a boolean.`,
      'INVALID_TASK'
    );
  }

  if (MUTATING_TASK_TYPES.has(type) && readOnly) {
    throw new PlannerError(
      `Task "${id}" is a mutating task and cannot be marked read-only.`,
      'INVALID_TASK'
    );
  }

  if (READ_ONLY_TASK_TYPES.has(type) && !readOnly) {
    throw new PlannerError(
      `Task "${id}" is classified as read-only and cannot be marked mutating.`,
      'INVALID_TASK'
    );
  }

  const priority = input.priority === undefined ? 50 : input.priority;

  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    throw new PlannerError(
      `Task "${id}" priority must be between 0 and 100.`,
      'INVALID_PRIORITY'
    );
  }

  const required = input.required === true;

  if (input.required !== undefined && typeof input.required !== 'boolean') {
    throw new PlannerError(
      `Task "${id}" required must be a boolean.`,
      'INVALID_TASK'
    );
  }

  const args = input.args === undefined ? {} : input.args;

  if (!isPlainObject(args)) {
    throw new PlannerError(
      `Task "${id}" args must be a plain object.`,
      'INVALID_TASK'
    );
  }

  // Copy input data so later caller mutations do not change the plan.
  const copiedArgs = JSON.parse(JSON.stringify(args));

  return {
    id,
    type,
    title,
    description,
    dependsOn: dependencies,
    priority,
    required,
    readOnly,
    args: copiedArgs,
    status: 'pending'
  };
}

function assertUniqueTaskIds(tasks) {
  const ids = new Set();

  for (const task of tasks) {
    if (ids.has(task.id)) {
      throw new PlannerError(`Duplicate task id "${task.id}".`, 'DUPLICATE_TASK_ID');
    }

    ids.add(task.id);
  }
}

function validateDependencies(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  for (const task of tasks) {
    for (const dependencyId of task.dependsOn) {
      if (!taskById.has(dependencyId)) {
        throw new PlannerError(
          `Task "${task.id}" depends on unknown task "${dependencyId}".`,
          'UNKNOWN_DEPENDENCY'
        );
      }
    }
  }

  return taskById;
}

function detectCycles(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];

      throw new PlannerError(
        `Dependency cycle detected: ${cycle.join(' -> ')}`,
        'DEPENDENCY_CYCLE'
      );
    }

    if (visited.has(id)) return;

    visiting.add(id);
    stack.push(id);

    const task = taskById.get(id);

    for (const dependencyId of task.dependsOn) {
      visit(dependencyId);
    }

    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const task of tasks) {
    visit(task.id);
  }
}

function topologicalSort(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const indegree = new Map();
  const dependents = new Map();

  for (const task of tasks) {
    indegree.set(task.id, task.dependsOn.length);
    dependents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const dependencyId of task.dependsOn) {
      dependents.get(dependencyId).push(task.id);
    }
  }

  const ready = tasks
    .filter((task) => indegree.get(task.id) === 0)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .map((task) => task.id);

  const ordered = [];

  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(taskById.get(id));

    for (const dependentId of dependents.get(id)) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);

      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort((a, b) => {
          const taskA = taskById.get(a);
          const taskB = taskById.get(b);

          return taskB.priority - taskA.priority || a.localeCompare(b);
        });
      }
    }
  }

  if (ordered.length !== tasks.length) {
    throw new PlannerError(
      'Tasks could not be ordered because the dependency graph contains a cycle.',
      'DEPENDENCY_CYCLE'
    );
  }

  return ordered;
}

function calculatePlanHash(plan) {
  const stableRepresentation = {
    title: plan.title,
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description,
      dependsOn: [...task.dependsOn].sort(),
      priority: task.priority,
      required: task.required,
      readOnly: task.readOnly,
      args: task.args
    }))
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableRepresentation))
    .digest('hex');
}

function createPlan(input = {}, inputOptions = {}) {
  const options = validateOptions(inputOptions);

  if (!isPlainObject(input)) {
    throw new PlannerError('Plan input must be an object.', 'INVALID_PLAN');
  }

  const title = normalizeText(
    input.title === undefined ? 'MedOrbits Local Agent Plan' : input.title,
    'Plan title',
    options.maxPlanTitleLength,
    true
  );

  if (!Array.isArray(input.tasks)) {
    throw new PlannerError('Plan tasks must be an array.', 'INVALID_PLAN');
  }

  if (input.tasks.length > options.maxTasks) {
    throw new PlannerError(
      `Plan exceeds the ${options.maxTasks}-task limit.`,
      'TOO_MANY_TASKS'
    );
  }

  const tasks = input.tasks.map((task, index) =>
    normalizeTask(task, index, options)
  );

  assertUniqueTaskIds(tasks);
  validateDependencies(tasks);
  detectCycles(tasks);

  const ordered = topologicalSort(tasks);

  const plan = {
    version: PLANNER_VERSION,
    id: typeof input.id === 'string' && input.id.trim()
      ? input.id.trim().slice(0, 128)
      : createId('plan'),
    title,
    createdAt: new Date().toISOString(),
    mode: tasks.every((task) => task.readOnly) ? 'read-only' : 'mixed',
    taskCount: tasks.length,
    tasks: ordered
  };

  plan.hash = calculatePlanHash(plan);

  return plan;
}

function validatePlan(plan, inputOptions = {}) {
  const options = validateOptions(inputOptions);

  if (!isPlainObject(plan) || !Array.isArray(plan.tasks)) {
    throw new PlannerError('Invalid plan object.', 'INVALID_PLAN');
  }

  const normalized = createPlan({
    id: plan.id,
    title: plan.title,
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description,
      dependsOn: task.dependsOn,
      priority: task.priority,
      required: task.required,
      readOnly: task.readOnly,
      args: task.args
    }))
  }, options);

  if (plan.hash && plan.hash !== normalized.hash) {
    throw new PlannerError(
      'Plan hash does not match its task definitions.',
      'PLAN_HASH_MISMATCH'
    );
  }

  return {
    valid: true,
    hash: normalized.hash,
    taskCount: normalized.taskCount,
    mode: normalized.mode
  };
}

function createResumePlan(plan, taskResults = {}, inputOptions = {}) {
  const options = validateOptions(inputOptions);

  if (!isPlainObject(taskResults)) {
    throw new PlannerError('Task results must be an object.', 'INVALID_RESULTS');
  }

  validatePlan(plan, options);

  const completed = new Set();
  const failed = new Set();

  for (const [taskId, result] of Object.entries(taskResults)) {
    if (!isPlainObject(result)) continue;

    if (result.status === 'success') completed.add(taskId);
    if (result.status === 'failed') failed.add(taskId);
  }

  const remaining = plan.tasks.filter((task) => !completed.has(task.id));

  for (const task of remaining) {
    const blockedDependency = task.dependsOn.find((dependencyId) =>
      failed.has(dependencyId)
    );

    if (blockedDependency) {
      throw new PlannerError(
        `Task "${task.id}" is blocked by failed dependency "${blockedDependency}".`,
        'RESUME_BLOCKED'
      );
    }
  }

  const remainingIds = new Set(remaining.map((task) => task.id));

  const resumeTasks = remaining.map((task) => ({
    id: task.id,
    type: task.type,
    title: task.title,
    description: task.description,
    dependsOn: task.dependsOn.filter((id) => remainingIds.has(id)),
    priority: task.priority,
    required: task.required,
    readOnly: task.readOnly,
    args: task.args
  }));

  return createPlan({
    title: `${plan.title} (resume)`,
    tasks: resumeTasks
  }, options);
}

function getReadyTasks(plan, taskResults = {}) {
  validatePlan(plan);

  if (!isPlainObject(taskResults)) {
    throw new PlannerError('Task results must be an object.', 'INVALID_RESULTS');
  }

  const completed = new Set(
    Object.entries(taskResults)
      .filter(([, result]) => result && result.status === 'success')
      .map(([taskId]) => taskId)
  );

  const failed = new Set(
    Object.entries(taskResults)
      .filter(([, result]) => result && result.status === 'failed')
      .map(([taskId]) => taskId)
  );

  return plan.tasks.filter((task) => {
    if (completed.has(task.id) || failed.has(task.id)) return false;

    return task.dependsOn.every((dependencyId) => completed.has(dependencyId));
  }).map((task) => ({ ...task }));
}

function summarizePlan(plan) {
  validatePlan(plan);

  return {
    id: plan.id,
    title: plan.title,
    version: plan.version,
    mode: plan.mode,
    taskCount: plan.taskCount,
    hash: plan.hash,
    tasks: plan.tasks.map((task, index) => ({
      order: index + 1,
      id: task.id,
      type: task.type,
      title: task.title,
      dependsOn: [...task.dependsOn],
      priority: task.priority,
      required: task.required,
      readOnly: task.readOnly
    }))
  };
}

module.exports = {
  PLANNER_VERSION,
  DEFAULTS,
  TASK_TYPES,
  PlannerError,
  validateOptions,
  normalizeTask,
  detectCycles,
  topologicalSort,
  createPlan,
  validatePlan,
  createResumePlan,
  getReadyTasks,
  summarizePlan
};
