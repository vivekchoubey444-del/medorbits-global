
'use strict';

/**
 * MedOrbits -- Health Routes
 *
 * File: src/routes/health.routes.js
 * Runtime: Node.js >= 20
 *
 * Endpoints:
 * GET /         Basic API health information.
 * GET /live     Liveness probe.
 * GET /ready    Readiness probe.
 *
 * Security and reliability:
 * - Health endpoints must not expose secrets or infrastructure details.
 * - Liveness checks should not depend on external services.
 * - Readiness checks must reflect actual application dependencies.
 * - Return HTTP 503 when the application cannot safely accept traffic.
 * - Keep health responses small and suitable for automated probes.
 */

const express = require('express');

const router = express.Router();

function getRequestId(req) {
  return typeof req.id === 'string' && req.id.length > 0
    ? req.id
    : null;
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * GET /
 *
 * Basic process-level health information.
 * This endpoint does not prove that dependencies are available.
 */
router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    service: 'medorbits-api',
    status: 'healthy',
    timestamp: getTimestamp(),
    requestId: getRequestId(req),
  });
});

/**
 * GET /live
 *
 * Liveness probe: indicates that the process can respond.
 * Avoid database or third-party dependency checks here.
 */
router.get('/live', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'alive',
    timestamp: getTimestamp(),
    requestId: getRequestId(req),
  });
});

/**
 * GET /ready
 *
 * Readiness probe.
 *
 * Inject a readiness service when mounting this router:
 *
 *   createHealthRouter({ checkReadiness })
 *
 * checkReadiness should resolve to:
 *   { ready: true }
 * or
 *   { ready: false }
 *
 * It should perform bounded checks against dependencies required
 * to serve requests safely. Do not expose dependency details publicly.
 */
function createHealthRouter(options = {}) {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Health route options must be an object.');
  }

  const checkReadiness = options.checkReadiness;

  if (
    checkReadiness !== undefined &&
    typeof checkReadiness !== 'function'
  ) {
    throw new TypeError(
      'checkReadiness must be a function when provided.',
    );
  }

  const healthRouter = express.Router();

  healthRouter.get('/', (req, res) => {
    return res.status(200).json({
      success: true,
      service: 'medorbits-api',
      status: 'healthy',
      timestamp: getTimestamp(),
      requestId: getRequestId(req),
    });
  });

  healthRouter.get('/live', (req, res) => {
    return res.status(200).json({
      success: true,
      status: 'alive',
      timestamp: getTimestamp(),
      requestId: getRequestId(req),
    });
  });

  healthRouter.get('/ready', async (req, res, next) => {
    if (!checkReadiness) {
      return res.status(503).json({
        success: false,
        status: 'not_ready',
        dependenciesChecked: false,
        timestamp: getTimestamp(),
        requestId: getRequestId(req),
      });
    }

    try {
      const result = await checkReadiness();

      if (
        !result ||
        typeof result !== 'object' ||
        typeof result.ready !== 'boolean'
      ) {
        throw new TypeError(
          'Readiness check must return an object with a boolean ready property.',
        );
      }

      if (!result.ready) {
        return res.status(503).json({
          success: false,
          status: 'not_ready',
          dependenciesChecked: true,
          timestamp: getTimestamp(),
          requestId: getRequestId(req),
        });
      }

      return res.status(200).json({
        success: true,
        status: 'ready',
        dependenciesChecked: true,
        timestamp: getTimestamp(),
        requestId: getRequestId(req),
      });
    } catch (error) {
      return next(error);
    }
  });

  return healthRouter;
}

// Preserve the existing default export for compatibility.
// The default router reports readiness as unavailable until a real
// dependency check is configured.
router.get('/ready', (req, res) => {
  return res.status(503).json({
    success: false,
    status: 'not_ready',
    dependenciesChecked: false,
    timestamp: getTimestamp(),
    requestId: getRequestId(req),
  });
});

module.exports = router;
module.exports.createHealthRouter = createHealthRouter;
