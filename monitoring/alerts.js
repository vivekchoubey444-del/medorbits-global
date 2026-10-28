
'use strict';

function createAlertManager(options = {}) {
  const webhookUrl = options.webhookUrl || '';
  const cooldownMs = options.cooldownMs || 300000;
  const fetchImpl = options.fetch || globalThis.fetch;

  const lastSentAt = new Map();

  async function sendAlert({
    key,
    severity = 'warning',
    message,
    details = {},
  }) {
    if (!webhookUrl) {
      return { sent: false, reason: 'webhook_not_configured' };
    }

    if (typeof fetchImpl !== 'function') {
      return { sent: false, reason: 'fetch_unavailable' };
    }

    if (
      typeof key !== 'string' ||
      !/^[a-zA-Z0-9._:-]{1,100}$/.test(key)
    ) {
      throw new TypeError('Alert key is invalid.');
    }

    const now = Date.now();
    const lastSent = lastSentAt.get(key) || 0;

    if (now - lastSent < cooldownMs) {
      return { sent: false, reason: 'cooldown' };
    }

    const payload = {
      service: 'medorbits-api',
      key,
      severity,
      message: String(message || 'Monitoring alert').slice(0, 1000),
      timestamp: new Date().toISOString(),
      details,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    timeout.unref?.();

    try {
      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          sent: false,
          reason: 'webhook_rejected',
          status: response.status,
        };
      }

      lastSentAt.set(key, now);

      return { sent: true };
    } catch {
      return { sent: false, reason: 'webhook_request_failed' };
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({ sendAlert });
}

module.exports = { createAlertManager };
