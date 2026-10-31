/*
 * Optional browser/native bridge.
 * Safe to include in the website: it degrades gracefully in an ordinary browser.
 * Load as a module or bundle it with the existing frontend.
 */
export function isNativeApp() {
  return Boolean(globalThis.Capacitor?.isNativePlatform?.());
}

export function getPlatform() {
  return globalThis.Capacitor?.getPlatform?.() || 'web';
}

export function onAppResume(callback) {
  if (typeof callback !== 'function') throw new TypeError('callback must be a function');
  const appPlugin = globalThis.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return () => {};
  let handle;
  appPlugin.addListener('appStateChange', ({ isActive }) => {
    if (isActive) callback();
  }).then(value => { handle = value; }).catch(() => {});
  return () => { handle?.remove?.(); };
}

export function openExternal(url) {
  const parsed = new URL(url, globalThis.location?.href);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new TypeError('Only HTTP(S) URLs are allowed');
  }
  globalThis.open(parsed.href, '_blank', 'noopener,noreferrer');
}
