# Offline strategy

The mobile wrapper does not automatically make every page or API work offline.
Use the website's service worker and cache only public, non-sensitive resources.

Recommended:
- Cache the application shell, fonts, icons and approved public catalogue pages.
- Use network-first for admission deadlines, fees, seat availability and other
  time-sensitive data.
- Do not cache authentication responses, personal records, application documents,
  payment responses, or private dashboards in a shared WebView cache.
- Display an explicit offline state and the timestamp of cached public data.
- Revalidate server data after connectivity returns.
- Provide a clear cache-version strategy and test upgrades from previous releases.

Never imply that an offline submission was accepted by the server until the API
confirms successful receipt.
