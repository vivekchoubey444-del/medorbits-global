import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/api-client.js';

test('rejects paths that are not root-relative', async () => {
  const api = createApiClient({ baseUrl: 'https://example.test/api', fetchImpl: async () => new Response('{}') });
  await assert.rejects(api.get('courses'), TypeError);
  await assert.rejects(api.get('//evil.test/path'), TypeError);
});

test('returns parsed JSON on success', async () => {
  const api = createApiClient({
    baseUrl: 'https://example.test/api',
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  });
  assert.deepEqual(await api.get('/courses'), { ok: true });
});

test('wraps HTTP errors with status and code', async () => {
  const api = createApiClient({
    baseUrl: 'https://example.test/api',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Denied', code: 'FORBIDDEN' }), { status: 403 })
  });
  await assert.rejects(api.get('/admin'), error =>
    error instanceof ApiError && error.status === 403 && error.code === 'FORBIDDEN');
});
