
'use strict';

function withTimeout(promise, timeoutMs) {
  let timeout;

  return Promise.race([
    Promise.resolve().then(promise),
    new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Health check timed out.')),
        timeoutMs
      );

      timeout.unref?.();
    }),
  ]).finally(() => clearTimeout(timeout));
}

function createHealthHandlers(options = {}) {
  const serviceName = options.serviceName || 'medorbits-api';
  const version = options.version || '1.0.0';
  const timeoutMs = options.timeoutMs || 3000;
  const checks = options.checks || {};

  function live(req, res) {
    return res.status(200).json({
      status: 'alive',
      service: serviceName,
      version,
      timestamp: new Date().toISOString(),
    });
  }

  async function ready(req, res) {
    const results = {};
    let healthy = true;

    for (const [name, check] of Object.entries(checks)) {
      try {
        if (typeof check !== 'function') {
          throw new Error('Health check is not configured.');
        }

        await withTimeout(() => check(), timeoutMs);
        results[name] = 'ok';
      } catch {
        healthy = false;
        results[name] = 'unavailable';
      }
    }

    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ready' : 'not_ready',
      service: serviceName,
      dependencies: results,
      timestamp: new Date().toISOString(),
    });
  }

  return { live, ready };
}

module.exports = {
  createHealthHandlers,
  withTimeout,
};
