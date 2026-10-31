# MedOrbits iOS (Capacitor)

This directory contains the iOS setup, privacy configuration and helper scripts for
the MedOrbits Capacitor app (`in.medorbits.app`). It is a preparation scaffold, not
a complete Xcode project. Capacitor must generate the native Xcode project on macOS.

## Requirements
- macOS
- Xcode 16 or a compatible Xcode release for the installed Capacitor/iOS toolchain
- Xcode Command Line Tools (`xcode-select —install`)
- Node.js 20+
- CocoaPods (installed using the method recommended by the Capacitor documentation)

## Generate the native project
Run from the repository’s `mobile/` directory:

```bash
npm install
npm run stage:web
npx cap add ios
npx cap sync ios
npx cap open ios
```

If `ios/App` already exists as a generated Xcode project, do not run `cap add ios`
again. Use `npx cap sync ios` after web or plugin changes.

## Configure privacy and capabilities
1. Review `config/Info.plist.example` and merge only the keys that match actual
   features into the generated `ios/App/App/Info.plist`.
2. Review `config/PrivacyInfo.xcprivacy` and place the approved manifest at the
   app target’s resource location in Xcode.
3. Enable only capabilities actually used by the app (for example, Associated
   Domains for verified universal links). Do not enable broad background modes
   without a real requirement.
4. Add purpose strings only for permissions the app actually requests. This starter
   does not request camera, microphone, contacts, photos or location access.
5. In Xcode, select the app target, set the team, bundle identifier
   `in.medorbits.app`, version/build numbers and deployment target.

## Build and archive
- Open the generated `.xcworkspace` in Xcode.
- Select a real iPhone device or a simulator.
- Run Product > Build to validate.
- For distribution, use Product > Archive and follow App Store Connect validation.

## Security and release
- Keep API secrets, signing certificates, provisioning profiles and private keys out
  of Git and the app bundle.
- Use HTTPS. Keep admission decisions, identity checks, payment verification,
  document authorization and all sensitive business logic on the backend.
- Never cache private application data, uploaded documents, payment data or auth
  responses in public web assets.
- Review App Privacy details, privacy policy, age rating, export compliance and
  App Store review requirements before submission.
