
'use strict';

const { performance } = require('node:perf_hooks');

const BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000];

function createMetrics() {
  let requests = 0;
  let errors = 0;
  let activeRequests = 0;
  let totalDurationMs = 0;

  const statusCounts = new Map();
  const methodCounts = new Map();
  const latencyBuckets = new Map(
    BUCKETS_MS.map((bucket) => [bucket, 0])
  );

  function beginRequest() {
    requests += 1;
    activeRequests += 1;
    const startedAt = performance.now();
    let finished = false;

    return function finishRequest(statusCode) {
      if (finished) return;
      finished = true;

      activeRequests = Math.max(0, activeRequests - 1);

      const duration = Math.max(0, performance.now() - startedAt);
      totalDurationMs += duration;

      if (statusCode >= 500) errors += 1;

      statusCounts.set(
        String(statusCode),
        (statusCounts.get(String(statusCode)) || 0) + 1
      );

      for (const bucket of BUCKETS_MS) {
        if (duration <= bucket) {
          latencyBuckets.set(bucket, latencyBuckets.get(bucket) + 1);
        }
      }
    };
  }

  function recordMethod(method) {
    const safeMethod = /^[A-Z]{1,12}$/.test(method) ? method : 'OTHER';

    methodCounts.set(
      safeMethod,
      (methodCounts.get(safeMethod) || 0) + 1
    );
  }

  function snapshot() {
    return {
      requests,
      errors,
      activeRequests,
      averageDurationMs: requests
        ? Number((totalDurationMs / requests).toFixed(2))
        : 0,
      statusCounts: Object.fromEntries(statusCounts),
      methodCounts: Object.fromEntries(methodCounts),
      latencyBucketsMs: Object.fromEntries(latencyBuckets),
      uptimeSeconds: Math.floor(process.uptime()),
      capturedAt: new Date().toISOString(),
    };
  }

  function prometheus() {
    const current = snapshot();
    const lines = [
      '# HELP medorbits_http_requests_total Total HTTP requests.',
      '# TYPE medorbits_http_requests_total counter',
      `medorbits_http_requests_total ${current.requests}`,
      '# HELP medorbits_http_errors_total HTTP 5xx responses.',
      '# TYPE medorbits_http_errors_total counter',
      `medorbits_http_errors_total ${current.errors}`,
      '# HELP medorbits_http_active_requests Current active requests.',
      '# TYPE medorbits_http_active_requests gauge',
      `medorbits_http_active_requests ${current.activeRequests}`,
      '# HELP medorbits_http_request_duration_ms_sum Sum of request durations.',
      '# TYPE medorbits_http_request_duration_ms_sum counter',
      `medorbits_http_request_duration_ms_sum ${(current.averageDurationMs * current.requests).toFixed(2)}`,
    ];

    for (const [status, count] of Object.entries(current.statusCounts)) {
      lines.push(
        `medorbits_http_responses_total{status="${status}"} ${count}`
      );
    }

    for (const [method, count] of Object.entries(current.methodCounts)) {
      lines.push(
        `medorbits_http_methods_total{method="${method}"} ${count}`
      );
    }

    for (const [bucket, count] of Object.entries(current.latencyBucketsMs)) {
      lines.push(
        `medorbits_http_duration_bucket{le="${bucket}"} ${count}`
      );
    }

    lines.push(
      `medorbits_http_duration_bucket{le="+Inf"} ${current.requests}`
    );

    return `${lines.join('\n')}\n`;
  }

  return Object.freeze({
    beginRequest,
    recordMethod,
    snapshot,
    prometheus,
  });
}

module.exports = { createMetrics };
