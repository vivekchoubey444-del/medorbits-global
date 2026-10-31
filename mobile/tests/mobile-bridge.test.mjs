import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp, getPlatform } from '../src/mobile-bridge.js';

test('bridge degrades safely in a normal browser', () => {
  assert.equal(isNativeApp(), false);
  assert.equal(getPlatform(), 'web');
});
