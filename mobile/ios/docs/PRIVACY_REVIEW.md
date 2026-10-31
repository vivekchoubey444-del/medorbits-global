# Privacy configuration review

The supplied privacy manifest is deliberately minimal and declares no tracking or
collected data. This is a starter only, not a legal or SDK compliance determination.

Before release:
- Inventory data collected by MedOrbits and every third-party SDK.
- Declare applicable collected-data categories and purposes accurately.
- Declare required-reason APIs used by the app or its dependencies.
- Add tracking domains and tracking declarations only if tracking is actually used.
- Add purpose strings for any permission requested by the final app.
- Re-check the manifest whenever Capacitor plugins or SDKs change.

Do not submit the starter manifest unchanged without validating the final binary.
