
'use strict';

function createRequestMonitor({ metrics, logger, slowRequestMs = 2000 }) {
  if (!metrics || !logger) {
    throw new TypeError('Request monitor requires metrics and logger.');
  }

  return function requestMonitor(req, res, next) {
    const finishMetric = metrics.beginRequest();

    metrics.recordMethod(req.method);

    const startedAt = process.hrtime.bigint();

    res.once('finish', () => {
      const elapsedMs = Number(
        process.hrtime.bigint() - startedAt
      ) / 1e6;

      finishMetric(res.statusCode);

      const fields = {
        requestId: res.locals.requestId || null,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Number(elapsedMs.toFixed(2)),
      };

      if (res.statusCode >= 500) {
        logger.error('http.request.failed', fields);
      } else if (elapsedMs >= slowRequestMs) {
        logger.warn('http.request.slow', fields);
      } else {
        logger.info('http.request.completed', fields);
      }
    });

    next();
  };
}

module.exports = { createRequestMonitor };
