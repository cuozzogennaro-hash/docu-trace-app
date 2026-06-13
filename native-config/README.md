# Native Firebase configuration

Capacitor's native projects (`ios/` and `android/`) are generated locally with
`npx cap add ios` / `npx cap add android` and are not part of the regular
Lovable workflow. The Firebase configuration files committed here are the
canonical source — they are copied into the right place inside the native
projects so push notifications work.

## Files

- `native-config/ios/GoogleService-Info.plist` → `ios/App/App/GoogleService-Info.plist`
- `native-config/android/google-services.json` → `android/app/google-services.json`

The same files are also already committed at their final paths
(`ios/App/App/...` and `android/app/...`) so a fresh clone is ready to build
after `npx cap add`.

## iOS

The GitHub Actions workflow (`.github/workflows/ios-release.yml`) automatically:
1. Copies `GoogleService-Info.plist` into `ios/App/App/` after `npx cap add ios`.
2. Registers it inside `App.xcodeproj` using the `xcodeproj` Ruby gem so it is
   bundled into the released IPA.

No manual Xcode step is required for the TestFlight build.

## Android

After running `npx cap add android` locally, apply the Google Services Gradle
plugin so `google-services.json` is processed at build time.

1. `android/build.gradle` — add to the top-level `buildscript.dependencies`:

   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```

2. `android/app/build.gradle` — add at the very bottom of the file:

   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

3. Make sure the application id matches Firebase:

   ```gradle
   defaultConfig {
       applicationId "com.docutrace.app"
   }
   ```

After these edits, run `npx cap sync android` and rebuild from Android Studio.