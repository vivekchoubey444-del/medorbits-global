# Native project generation

The `android/` and `ios/` directories in this repository are documentation
directories, not generated native IDE projects.

Generate projects locally:
```bash
npm install
npm run stage:web
npm run cap:add:android
npm run cap:add:ios
npm run cap:sync
```

Do not overwrite a previously customized native project without a backup.
Commit generated native projects only after reviewing platform configuration,
signing exclusions, permissions, privacy manifests and plugin changes.
iOS generation/build requires macOS and Xcode.
