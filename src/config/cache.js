/** Small process-local cache. Not shared across workers or server instances. */
const entries = new Map();
export function cacheGet(key) { const item = entries.get(key); if (!item) return undefined; if (item.expiresAt && item.expiresAt <= Date.now()) { entries.delete(key); return undefined; } return item.value; }
export function cacheSet(key, value, ttlMs = 0) { entries.set(key, { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0 }); return value; }
export function cacheDelete(key) { return entries.delete(key); }
export function cacheClear() { entries.clear(); }
export default { get: cacheGet, set: cacheSet, delete: cacheDelete, clear: cacheClear };
