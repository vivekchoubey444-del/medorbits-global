'use strict';

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const process = require('node:process');

const BASE_URL = process.env.SMOKE_TEST_URL || 'http://localhost:3000';
const TIMEOUT_MS = parsePositiveInteger(
  process.env.SMOKE_TEST_TIMEOUT_MS,
  8000
);

const HEALTH_PATHS = parsePaths(
  process.env.SMOKE_TEST_PATHS,
  ['/health', '/']
);

const EXPECTED_STATUS = parsePositiveInteger(
  process.env.SMOKE_TEST_EXPECT_STATUS,
  200
);

const results = [];
let failed = false;

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`Invalid positive integer configuration: ${value}`);
    process.exit(2);
  }

  return parsed;
}

function parsePaths(value, fallback) {
  if (!value) return fallback;

  const paths = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    paths.length === 0 ||
    paths.some((item) => !item.startsWith('/') || item.startsWith('//'))
  ) {
    console.error(
      'SMOKE_TEST_PATHS must contain comma-separated absolute URL paths, such as /health,/.'
    );
    process.exit(2);
  }

  return paths;
}

function validateBaseUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SMOKE_TEST_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SMOKE_TEST_URL must use HTTP or HTTPS.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Do not include credentials in SMOKE_TEST_URL.');
  }

  if (parsed.search || parsed.hash) {
    throw new Error(
      'SMOKE_TEST_URL must not include a query string or fragment.'
    );
  }

  return parsed;
}

function checkEndpoint(baseUrl, pathname) {
  return new Promise((resolve) => {
    const target = new URL(pathname, baseUrl);
    const transport = target.protocol === 'https:' ? https : http;
    const startedAt = Date.now();

    const request = transport.request(
      target,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
          'User-Agent': 'MedOrbits-Smoke-Test/1.0'
        }
      },
      (response) => {
        const statusCode = response.statusCode || 0;

        // Consume the response without printing its body.
        response.resume();

        response.on('end', () => {
          const durationMs = Date.now() - startedAt;
          const ok = statusCode === EXPECTED_STATUS;

          resolve({
            path: pathname,
            status: statusCode,
            expectedStatus: EXPECTED_STATUS,
            durationMs,
            ok,
            message: ok
              ? 'Expected HTTP status received.'
              : `Expected HTTP ${EXPECTED_STATUS}, received HTTP ${statusCode}.`
          });
        });
      }
    );

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timed out after ${TIMEOUT_MS} ms.`));
    });

    request.on('error', (error) => {
      resolve({
        path: pathname,
        status: null,
        expectedStatus: EXPECTED_STATUS,
        durationMs: Date.now() - startedAt,
        ok: false,
        message: error.message
      });
    });

    request.end();
  });
}

async function main() {
  let baseUrl;

  try {
    baseUrl = validateBaseUrl(BASE_URL);
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  console.log('MedOrbits smoke test');
  console.log(`Target: ${baseUrl.origin}`);
  console.log(`Timeout: ${TIMEOUT_MS} ms`);
  console.log(`Endpoints: ${HEALTH_PATHS.length}`);
  console.log('');

  for (const pathname of HEALTH_PATHS) {
    const result = await checkEndpoint(baseUrl, pathname);
    results.push(result);

    if (result.ok) {
      console.log(
        `PASS ${result.path} -- HTTP ${result.status} (${result.durationMs} ms)`
      );
    } else {
      failed = true;
      console.error(
        `FAIL ${result.path} -- ${result.message}`
      );
    }
  }

  const passed = results.filter((result) => result.ok).length;

  console.log('');
  console.log(
    `Results: ${passed}/${results.length} endpoint checks passed.`
  );

  if (process.env.SMOKE_TEST_JSON === '1') {
    console.log(
      JSON.stringify(
        {
          ok: !failed,
          baseUrl: baseUrl.origin,
          timeoutMs: TIMEOUT_MS,
          results
        },
        null,
        2
      )
    );
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
