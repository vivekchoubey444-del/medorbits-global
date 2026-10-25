
'use strict';

/**
 * MedOrbits -- Health Check API
 *
 * File: app/api/health/route.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 * - Provide a lightweight application health endpoint.
 * - Support deployment-platform health checks.
 * - Report application status and runtime metadata.
 * - Optionally check database connectivity.
 * - Avoid exposing secrets, credentials, or internal errors.
 *
 * Optional environment variables:
 * - DATABASE_URL
 * - HEALTH_CHECK_DATABASE=true
 * - HEALTH_CHECK_TIMEOUT_MS=3000
 *
 * Notes:
 * - GET /api/health performs a liveness check by default.
 * - Database checks are opt-in and should be used for readiness checks.
 * - A database check requires the `pg` package and a valid DATABASE_URL.
 * - Do not expose this endpoint's detailed diagnostics publicly if your
 *   deployment requires infrastructure information to remain private.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SERVICE_NAME = 'medorbits-api';
const STARTED_AT = new Date().toISOString();

const DEFAULT_TIMEOUT_MS = 3000;
const MAX_TIMEOUT_MS = 10000;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'X-Content-Type-Options': 'nosniff',
};

function getBoolean(value) {
  return typeof value === 'string' &&
    ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getTimeoutMs() {
  const raw = Number.parseInt(
    process.env.HEALTH_CHECK_TIMEOUT_MS ?? '',
    10,
  );

  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(raw, MAX_TIMEOUT_MS);
}

function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

/**
 * Checks whether PostgreSQL can execute a simple query.
 *
 * The `pg` dependency is loaded only when database checking is enabled.
 * The client is always closed after the check.
 */
async function checkDatabase(timeoutMs) {
  if (!process.env.DATABASE_URL) {
    return {
      status: 'not_configured',
      required: true,
    };
  }

  let client;

  try {
    const { Client } = await import('pg');

    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
      statement_timeout: timeoutMs,
      application_name: 'medorbits-health-check',
      keepAlive: false,
      ssl: getBoolean(process.env.DATABASE_SSL)
        ? { rejectUnauthorized: true }
        : undefined,
    });

    await client.connect();

    const result = await client.query('SELECT 1 AS health');

    if (result.rows?.[0]?.health !== 1) {
      throw new Error('Database health query returned an unexpected result.');
    }

    return {
      status: 'ok',
      required: true,
    };
  } catch {
    // Do not disclose connection strings, hostnames, or database errors.
    return {
      status: 'error',
      required: true,
    };
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {
        // Cleanup failures must not expose internal details.
      }
    }
  }
}

/**
 * GET /api/health
 *
 * Default mode is a liveness check. It does not contact external services.
 *
 * Optional readiness mode:
 * GET /api/health?check=readiness
 *
 * Database checking is performed only when:
 * HEALTH_CHECK_DATABASE=true
 */
export async function GET(request) {
  const requestId =
    request.headers.get('x-request-id')?.slice(0, 128) || undefined;

  const url = new URL(request.url);
  const mode = url.searchParams.get('check')?.trim().toLowerCase();

  if (mode && !['live', 'readiness'].includes(mode)) {
    return jsonResponse(
      {
        success: false,
        error: 'invalid_health_check_mode',
        message: 'Supported check modes are live and readiness.',
      },
      400,
    );
  }

  const isReadinessCheck = mode === 'readiness';

  const payload = {
    success: true,
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      application: 'ok',
    },
  };

  if (requestId) {
    payload.requestId = requestId;
  }

  if (!isReadinessCheck) {
    return jsonResponse(payload);
  }

  const databaseCheckEnabled = getBoolean(
    process.env.HEALTH_CHECK_DATABASE,
  );

  if (!databaseCheckEnabled) {
    payload.checks.database = 'not_checked';
    payload.readiness = 'ok';

    return jsonResponse(payload);
  }

  const timeoutMs = getTimeoutMs();
  const database = await checkDatabase(timeoutMs);

  payload.checks.database = database.status;

  if (database.status !== 'ok') {
    payload.success = false;
    payload.status = 'degraded';
    payload.readiness = 'not_ready';

    return jsonResponse(payload, 503);
  }

  payload.readiness = 'ready';

  return jsonResponse(payload);
}

/**
 * HEAD /api/health
 *
 * Returns status and headers without a response body.
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

/**
 * OPTIONS /api/health
 *
 * This endpoint does not require cross-origin access by default.
 * If cross-origin browser access is needed, configure an explicit allowlist
 * rather than enabling wildcard CORS.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...NO_STORE_HEADERS,
      Allow: 'GET, HEAD, OPTIONS',
    },
  });
}
