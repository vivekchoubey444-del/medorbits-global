
#!/usr/bin/env node
'use strict';

require('dotenv').config();

const REQUIRED_SECRETS = ['SESSION_SECRET', 'JWT_SECRET'];

const PLACEHOLDER_PATTERNS = [
  /^change[-_ ]?me$/i,
  /^your[-_ ].*$/i,
  /^replace[-_ ].*$/i,
  /^example$/i,
  /^placeholder$/i,
  /^secret$/i,
  /^password$/i,
  /^123456+$/,
  /^<.*>$/
];

const isProduction = process.env.NODE_ENV === 'production';
const errors = [];
const warnings = [];

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function validateSecret(name) {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${name} is missing or empty.`);
    return;
  }

  if (isPlaceholder(value)) {
    errors.push(`${name} contains a placeholder value.`);
    return;
  }

  if (value.length < 32) {
    const message = `${name} should contain at least 32 characters.`;

    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (/\s/.test(value)) {
    warnings.push(`${name} contains whitespace; check that this is intentional.`);
  }
}

for (const name of REQUIRED_SECRETS) {
  validateSecret(name);
}

for (const warning of warnings) {
  console.warn(`WARNING: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }

  console.error(
    isProduction
      ? 'Environment validation failed. Production startup must not continue.'
      : 'Environment validation failed.'
  );

  process.exitCode = 1;
} else {
  console.log('Required environment secrets are configured.');

  if (warnings.length > 0) {
    console.warn(`Environment validation completed with ${warnings.length} warning(s).`);
  } else {
    console.log('Environment validation passed.');
  }
}
