
"use strict";

/**
 * MedOrbits -- Health Check Routes
 * File: /api/routes/health.js
 * Runtime: Node.js 20+
 * Framework: Express
 *
 * Suggested endpoints:
 * GET /api/health          Basic liveness check
 * GET /api/health/live     Liveness probe
 * GET /api/health/ready    Readiness probe
 *
 * Security:
 * - Never expose environment variables or credentials.
 * - Do not return database connection strings or raw errors.
 * - Keep liveness checks independent of external services.
 * - Readiness checks may report dependency availability.
 */

const express = require("express");

const router = express.Router();

const SERVICE_NAME = "medorbits-api";
const STARTED_AT = Date.now();

/**
 * Returns the current service uptime in seconds.
 */
function getUptimeSeconds() {
  return Math.floor((Date.now() - STARTED_AT) / 1000);
}

/**
 * Standard health response.
 */
function healthPayload(status, checks = {}) {
  return {
    success: status === "ok",
    service: SERVICE_NAME,
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: getUptimeSeconds(),
    checks
  };
}

/**
 * Resolve an optional dependency check.
 *
 * The database integration is intentionally configurable because
 * the repository's actual database client has not been established
 * by this route definition.
 */
async function checkDatabase() {
  try {
    if (process.env.HEALTH_CHECK_DATABASE !== "true") {
      return {
        status: "not-configured"
      };
    }

    /*
     * Replace this section with the actual database client's
     * lightweight connectivity check.
     *
     * Examples:
     * PostgreSQL: await pool.query("SELECT 1");
     * MySQL: await pool.query("SELECT 1");
     *
     * Do not create a new database connection on every request.
     */

    if (
      !globalThis.medorbitsDatabase ||
      typeof globalThis.medorbitsDatabase.healthCheck !== "function"
    ) {
      return {
        status: "not-configured"
      };
    }

    await globalThis.medorbitsDatabase.healthCheck();

    return {
      status: "ok"
    };
  } catch {
    return {
      status: "unavailable"
    };
  }
}

/**
 * GET /
 *
 * Basic liveness endpoint.
 * Returns success when the HTTP process can respond.
 *
 * This endpoint does not depend on the database.
 */
router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.status(200).json(
    healthPayload("ok", {
      application: "ok"
    })
  );
});

/**
 * GET /live
 *
 * Container or platform liveness probe.
 * Use this to detect whether the application process responds.
 */
router.get("/live", (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.status(200).json(
    healthPayload("ok", {
      application: "ok"
    })
  );
});

/**
 * GET /ready
 *
 * Readiness probe.
 *
 * Returns HTTP 503 if a configured mandatory dependency is
 * unavailable. An unconfigured optional database check does not
 * automatically fail readiness.
 *
 * Customize dependency policy to match the actual deployment.
 */
router.get("/ready", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const database = await checkDatabase();

  const databaseRequired =
    process.env.HEALTH_CHECK_DATABASE === "true";

  const ready =
    !databaseRequired || database.status === "ok";

  const status = ready ? "ok" : "unavailable";

  return res.status(ready ? 200 : 503).json(
    healthPayload(status, {
      application: "ok",
      database
    })
  );
});

/**
 * GET /startup
 *
 * Startup probe.
 *
 * This confirms that the router has initialized and the process
 * is responding. It does not prove that all services are ready.
 */
router.get("/startup", (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.status(200).json(
    healthPayload("ok", {
      application: "started"
    })
  );
});

module.exports = router;
