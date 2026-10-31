import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api-client.js';

test('API client requires same-origin relative paths', async () => {
  const api = createApiClient({ baseUrl: 'https://medorbits.in/api', fetchImpl: async () => new Response('{}') });
  await assert.rejects(api.get('https://attacker.example'), TypeError);
});
