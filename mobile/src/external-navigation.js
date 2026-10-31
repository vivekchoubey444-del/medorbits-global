import { Browser } from '@capacitor/browser';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

export async function openExternalUrl(value) {
  const url = new URL(value, globalThis.location?.href);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new TypeError('Only HTTP(S) external links are permitted');
  }
  await Browser.open({ url: url.href });
}
