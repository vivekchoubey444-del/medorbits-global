import { mobileConfig } from './config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createApiClient({ baseUrl = mobileConfig.apiBaseUrl, getToken = async () => null,
  timeoutMs = mobileConfig.requestTimeoutMs, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');

  async function request(path, options = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      throw new TypeError('API path must be an absolute path beginning with one slash');
    }
    const url = new URL(path, `${baseUrl.replace(/\/+$/, '')}/`);
    if (url.origin !== new URL(baseUrl).origin) throw new TypeError('Cross-origin API path rejected');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await getToken();
      const headers = new Headers(options.headers || {});
      headers.set('Accept', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      let body = options.body;
      if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(body);
      }
      const response = await fetchImpl(url, {
        ...options, headers, body, signal: controller.signal,
        credentials: options.credentials || 'include'
      });
      const raw = await response.text();
      let data = null;
      if (raw) {
        try { data = JSON.parse(raw); }
        catch { throw new ApiError('Server returned invalid JSON', { status: response.status, code: 'INVALID_RESPONSE' }); }
      }
      if (!response.ok) {
        throw new ApiError(data?.message || `Request failed (${response.status})`, {
          status: response.status, code: data?.code || 'HTTP_ERROR', details: data
        });
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new ApiError('Request timed out', { code: 'TIMEOUT' });
      if (error instanceof ApiError || error instanceof TypeError) throw error;
      throw new ApiError('Network request failed', { code: 'NETWORK_ERROR' });
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' })
  });
}
