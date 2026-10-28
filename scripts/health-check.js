#!/usr/bin/env node
'use strict';

require('dotenv').config();

const DEFAULT_PORT = 3000;
const TIMEOUT_MS = 5000;

function getHealthUrl() {
  const rawUrl =
    process.env.HEALTH_URL?.trim() ||
    `http://localhost:${process.env.PORT || DEFAULT_PORT}/health`;

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('HEALTH_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('HEALTH_URL must use HTTP or HTTPS.');
  }

  if (url.username || url.password) {
    throw new Error('HEALTH_URL must not contain embedded credentials.');
  }

  return url;
}

async function main() {
  const jsonOutput = process.argv.includes('--json');

  if (process.argv.slice(2).some((arg) => arg !== '--json')) {
    throw new Error('Usage: node scripts/health-check.js [--json]');
  }

  const url = getHealthUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
    });

    const result = {
      ok: response.ok,
      url: url.toString(),
      status: response.status,
      statusText: response.statusText,
    };

    // Avoid leaving the response body unread.
    await response.body?.cancel().catch(() => {});

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else if (response.ok) {
      console.log(`Healthy: ${url.toString()} (HTTP ${response.status})`);
    } else {
      console.error(
        `Unhealthy: ${url.toString()} (HTTP ${response.status})`,
      );
    }

    if (!response.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error.name === 'AbortError' ||
      error.name === 'TimeoutError'
      ? `Request timed out after ${TIMEOUT_MS} ms`
      : error.message;

    const result = {
      ok: false,
      url: url.toString(),
      error: message,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`Health check failed for ${url.toString()}: ${message}`);
    }

    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  } else {
    console.error(`[health-check] ${error.message}`);
  }

  process.exitCode = 1;
});
