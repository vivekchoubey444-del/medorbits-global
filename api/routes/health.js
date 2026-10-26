"use strict";

/**

* MedOrbits -- Health Check Routes
* File: /api/routes/health.js
* Runtime: Node.js 20+
* Framework: Express
* Endpoints (when mounted at /api/health):
* GET /          Basic health / liveness
* GET /live      Liveness probe
* GET /ready     Readiness probe
* GET /startup   Startup probe
* Optional environment variables:
* SERVICE_NAME=medorbits-api
* HEALTH_CHECK_DATABASE=true|false
* HEALTH_CHECK_TIMEOUT_MS=2000
* Optional database adapter:
* globalThis.medorbitsDatabase.healthCheck()
* The database adapter must reuse the application’s existing
* connection pool or client. Do not open a new connection per request.
* Security:
* ●	No environment variables, credentials, stack traces, or raw errors.
* ●	No cacheable health responses.
* ●	Liveness does not depend on external services.
* ●	Readiness returns 503 when a required dependency is unavailable.
        */

const express = require("express");

const router = express.Router();

const SERVICE_NAME = getServiceName();
const STARTED_AT = Date.now();

const DEFAULT_CHECK_TIMEOUT_MS = 2000;
const MAX_CHECK_TIMEOUT_MS = 10000;

let startupComplete = true;
let shuttingDown = false;

/**

* Resolve a safe service identifier.
    */
    function getServiceName() {
    const configured = process.env.SERVICE_NAME;

if (
typeof configured === "string" &&
/^[a-zA-Z0-9]{0,63}$/.test(configured)
) {
return configured;
}

return "medorbits-api";
}

/**

* Parse a bounded positive integer from an environment variable.
    */
    function getBoundedInteger(value, fallback, maximum) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return fallback;
    }

const parsed = Number(value);

if (!Number.isSafeInteger(parsed) || parsed < 1) {
return fallback;
}

return Math.min(parsed, maximum);
}

/**

* Readiness dependency timeout.
    */
    function getCheckTimeoutMs() {
    return getBoundedInteger(
    process.env.HEALTH_CHECK_TIMEOUT_MS,
    DEFAULT_CHECK_TIMEOUT_MS,
    MAX_CHECK_TIMEOUT_MS
    );
    }

/**

* Add headers that prevent caching and reduce information leakage.
    */
    function setHealthHeaders(res) {
    res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff"
    });
    }

/**

* Return process uptime in seconds.
    */
    function getUptimeSeconds() {
    return Math.floor((Date.now() - STARTED_AT) / 1000);
    }

/**

* Construct the standard response body.
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

* Respond with a standard health payload.
    */
    function sendHealthResponse(res, statusCode, status, checks) {
    setHealthHeaders(res);

return res.status(statusCode).json(
healthPayload(status, checks)
);
}

/**

* Race an asynchronous dependency check against a timeout.
* A timeout does not cancel the underlying database operation.
* Configure the database driver’s own query/connection timeout too.
    */
    async function withTimeout(operation, timeoutMs) {
    let timeout;

try {
return await Promise.race([
Promise.resolve().then(operation),
new Promise((_, reject) => {
timeout = setTimeout(() => {
const error = new Error("Health check timed out");
error.code = "HEALTH_CHECK_TIMEOUT";
reject(error);
}, timeoutMs);

    if (typeof timeout.unref === "function") {
      timeout.unref();
    }
  })
]);

} finally {
if (timeout) {
clearTimeout(timeout);
}
}
}

/**

* Determine whether database readiness is required.
    */
    function isDatabaseCheckRequired() {
    return process.env.HEALTH_CHECK_DATABASE === "true";
    }

/**

* Perform a database check using the existing application adapter.
* Expected adapter contract:
* globalThis.medorbitsDatabase.healthCheck()
* The adapter should reject or throw when connectivity is unhealthy.
* It must not return sensitive database details.
    */
    async function checkDatabase() {
    if (!isDatabaseCheckRequired()) {
    return {
    status: "not-configured",
    required: false
    };
    }

const database = globalThis.medorbitsDatabase;

if (
!database ||
typeof database.healthCheck !== "function"
) {
return {
status: "unavailable",
required: true
};
}

try {
await withTimeout(
() => database.healthCheck(),
getCheckTimeoutMs()
);

return {
  status: "ok",
  required: true
};

} catch {
// Intentionally do not return raw errors or connection details.
return {
status: "unavailable",
required: true
};
}
}

/**

* Liveness handler.
* Keep this independent of databases, external APIs, and other
* dependencies. A failed dependency should not cause a restart loop.
    */
    function liveHandler(req, res) {
    if (shuttingDown) {
    return sendHealthResponse(res, 503, "unavailable", {
    application: "shutting-down"
    });
    }

return sendHealthResponse(res, 200, "ok", {
application: "ok"
});
}

/**

* Readiness handler.
* Returns 503 if startup is incomplete, shutdown has begun, or a
* configured required dependency is unavailable.
    */
    async function readyHandler(req, res) {
    if (shuttingDown) {
    return sendHealthResponse(res, 503, "unavailable", {
    application: "shutting-down"
    });
    }

if (!startupComplete) {
return sendHealthResponse(res, 503, "unavailable", {
application: "starting"
});
}

const database = await checkDatabase();

const ready =
!database.required || database.status === "ok";

return sendHealthResponse(
res,
ready ? 200 : 503,
ready ? "ok" : "unavailable",
{
application: "ok",
database
}
);
}

/**

* GET /
* Basic health endpoint; equivalent to liveness.
    */
    router.get("/", liveHandler);

/**

* GET /live
* Container/platform liveness probe.
    */
    router.get("/live", liveHandler);

/**

* GET /ready
* Readiness probe.
    */
    router.get("/ready", (req, res, next) => {
    readyHandler(req, res).catch(next);
    });

/**

* GET /startup
* Indicates whether application startup has completed.
    */
    router.get("/startup", (req, res) => {
    if (shuttingDown) {
    return sendHealthResponse(res, 503, "unavailable", {
    application: "shutting-down"
    });
    }

return sendHealthResponse(
res,
startupComplete ? 200 : 503,
startupComplete ? "ok" : "starting",
{
application: startupComplete ? "started" : "starting"
}
);
});

/**

* Optional explicit readiness control for the application bootstrap.
* Call setStartupComplete(false) before initializing required
* application resources, then setStartupComplete(true) after
* initialization succeeds.
    */
    function setStartupComplete(value) {
    startupComplete = value === true;
    }

/**

* Mark the service as shutting down so readiness checks fail
* and load balancers can stop sending new traffic.
    */
    function setShuttingDown(value) {
    shuttingDown = value === true;
    }

module.exports = router;
module.exports.setStartupComplete = setStartupComplete;
module.exports.setShuttingDown = setShuttingDown;
module.exports.checkDatabase = checkDatabase;