const DEFAULTS = Object.freeze({
  apiBaseUrl: 'https://medorbits.in/api',
  requestTimeoutMs: 15000
});

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new TypeError('API base URL must use HTTPS outside localhost');
  }
  return url.toString().replace(/\/+$/, '');
}

export const mobileConfig = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(import.meta.env?.VITE_API_BASE_URL || DEFAULTS.apiBaseUrl),
  requestTimeoutMs: Number(import.meta.env?.VITE_API_TIMEOUT_MS || DEFAULTS.requestTimeoutMs)
});
