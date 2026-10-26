#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Environment Secret Validator
 * Suggested path: /scripts/check-secrets.js
 *
 * Validates required environment secrets before startup or deployment.
 *
 * Exit codes:
 *   0 = Validation passed
 *   1 = Validation failed
 *   2 = Configuration or dependency error
 */
const REQUIRED_SECRETS = ['SESSION_SECRET', 'JWT_SECRET'];
const MIN_SECRET_LENGTH = 32;
const RECOMMENDED_SECRET_LENGTH = 48;
const PLACEHOLDER_PATTERNS = [
  /^change[-_ ]?me$/i,
  /^your[-_ ].*$/i,
  /^replace[-_ ].*$/i,
  /^example$/i,
  /^placeholder$/i,
  /^secret$/i,
  /^password$/i,
  /^123456+$/,
  /^<.*>$/,
  /^insert[-_ ].*$/i,
  /^generate[-_ ].*$/i,
  /^todo$/i,
  /^test$/i,
  /^development$/i,
  /^default$/i,
];
const isProduction =
  String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const errors = [];
const warnings = [];
const checkedNames = new Set();
function addUnique(collection, message) {
  if (!collection.includes(message)) {
    collection.push(message);
  }
}
function isPlaceholder(value) {
  const normalized = value.trim();
  return (
    PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    /\b(change.?me|replace.?this|your.?secret|sample.?secret)\b/i.test(
      normalized,
    )
  );
}
function validateSecret(name) {
  if (checkedNames.has(name)) {
    return;
  }
  checkedNames.add(name);
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    addUnique(errors, `${name} is missing or empty.`);
    return;
  }
  if (value !== value.trim()) {
    addUnique(
      warnings,
      `${name} has leading or trailing whitespace. Remove it if unintended.`,
    );
  }
  if (isPlaceholder(value)) {
    addUnique(errors, `${name} contains a placeholder or default value.`);
    return;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    const message =
      `${name} must contain at least ${MIN_SECRET_LENGTH} characters; ` +
      `the configured value is too short.`;
    if (isProduction) {
      addUnique(errors, message);
    } else {
      addUnique(warnings, message);
    }
  } else if (value.length < RECOMMENDED_SECRET_LENGTH) {
    addUnique(
      warnings,
      `${name} meets the minimum length but should preferably contain at least ${RECOMMENDED_SECRET_LENGTH} characters.`,
    );
  }
  if (/\s/.test(value)) {
    addUnique(
      warnings,
      `${name} contains whitespace. Ensure all components use the same exact value.`,
    );
  }
  if (/(.)\1{11,}/.test(value)) {
    addUnique(
      warnings,
      `${name} contains a long repeated-character sequence and may be weak.`,
    );
  }
  if (/^(.)\1+$/.test(value)) {
    addUnique(errors, `${name} cannot consist of one repeated character.`);
  }
}
function printHelp() {
  console.log(`
MedOrbits Environment Secret Validator
Usage:
  node scripts/check-secrets.js
  node scripts/check-secrets.js --strict
  node scripts/check-secrets.js --help
Options:
  --strict   Enforce production-strength checks regardless of NODE_ENV
  --help     Show this help
Required environment variables:
  SESSION_SECRET
  JWT_SECRET
Notes:
  - Secret values are never printed.
  - Production mode rejects secrets shorter than ${MIN_SECRET_LENGTH} characters.
  - Prefer randomly generated secrets of at least ${RECOMMENDED_SECRET_LENGTH} characters.
`);
}
function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }
  const unknownArgs = args.filter((arg) => arg !== '--strict');
  if (unknownArgs.length > 0) {
    console.error(`Unknown argument: ${unknownArgs[0]}`);
    console.error('Run with --help for usage.');
    return 2;
  }
  const strict = isProduction || args.includes('--strict');
  /*
   * Load .env only when dotenv is installed.
   * Existing process environment variables take precedence over .env.
   * In production, configure secrets in the deployment environment.
   */
  try {
    require('dotenv').config({
      override: false,
      quiet: true,
    });
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      console.error(
        'Configuration error: dotenv is not installed. Install it or remove the dotenv loading requirement.',
      );
      return 2;
    }
    console.error('Configuration error: unable to load environment configuration.');
    return 2;
  }
  /*
   * Required environment values are checked after dotenv loads.
   * NODE_ENV is re-evaluated so values loaded from .env are respected.
   */
  const production =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  for (const name of REQUIRED_SECRETS) {
    validateSecret(name);
  }
  /*
   * Strict mode enforces the same minimum-length rule as production.
   * validateSecret() uses isProduction, so explicitly enforce this
   * additional condition when --strict is supplied outside production.
   */
  if (strict && !production) {
    for (const name of REQUIRED_SECRETS) {
      const value = process.env[name];
      if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        !isPlaceholder(value) &&
        value.length < MIN_SECRET_LENGTH
      ) {
        addUnique(
          errors,
          `${name} must contain at least ${MIN_SECRET_LENGTH} characters in strict mode.`,
        );
      }
    }
  }
  for (const warning of warnings) {
    console.warn(`WARNING: ${warning}`);
  }
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    console.error(
      'Environment validation failed. Do not start the application until the errors are resolved.',
    );
    return 1;
  }
  console.log('Required environment secrets are configured.');
  if (warnings.length > 0) {
    console.warn(
      `Environment validation completed with ${warnings.length} warning(s).`,
    );
  } else {
    console.log('Environment secret validation passed.');
  }
  return 0;
}
process.exitCode = main();