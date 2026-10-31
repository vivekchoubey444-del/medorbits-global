# MedOrbits Android native project

Capacitor 7 Android host project for `in.medorbits.app`.

## Requirements
- Node.js 20+
- JDK 21 (recommended for current Android Gradle Plugin toolchains)
- Android Studio with Android SDK / platform tools
- Android SDK platform and build-tools installed

## Build
From this `mobile/` directory:

```bash
npm install
npm run stage:web
npm run cap:sync
npm run android:open
```

Build a debug APK from Android Studio, or from this directory:

```bash
cd android
gradle assembleDebug
```

The Gradle wrapper scripts/JAR are intentionally not included. Use Android Studio's
bundled Gradle or install a compatible Gradle distribution. Do not run `cap add android`
over this populated project; use `npm run cap:sync` to update it.

## Release signing
Configure signing in Android Studio or via local, untracked Gradle properties.
Never commit keystores, passwords, service-account JSON, API secrets, or signing files.
Use Play App Signing for Google Play releases.

## Security notes
- HTTPS only; cleartext traffic is disabled.
- WebView debugging is disabled in the shipped app configuration.
- Do not add document/payment/auth endpoints to public asset caching.
- Keep authorization, payment verification, eligibility decisions and document access
  enforcement on the MedOrbits backend.
- Review Android permissions and privacy disclosures before release.
