# iOS release checklist

- [ ] Generate the native project on macOS with `npx cap add ios`.
- [ ] Run `npx cap sync ios` after staging web assets and installing plugins.
- [ ] Confirm bundle ID is `in.medorbits.app`.
- [ ] Set Apple Developer Team and valid signing settings in Xcode.
- [ ] Verify app icon, launch screen, display name and version/build.
- [ ] Merge only necessary Info.plist keys; permission prompts must match actual use.
- [ ] Review and validate `PrivacyInfo.xcprivacy` against APIs and all included SDKs.
- [ ] Test login/logout, navigation, deep links (if configured), network loss/recovery,
      uploads/downloads and payment handoff on physical devices.
- [ ] Confirm sensitive API responses and private documents are not cached offline.
- [ ] Test VoiceOver, Dynamic Type, safe areas and supported iPhone/iPad sizes.
- [ ] Verify production API uses HTTPS and no secrets are embedded in the app.
- [ ] Complete App Store privacy disclosures and review metadata.
- [ ] Archive and validate in Xcode; upload using Organizer or Transporter.
