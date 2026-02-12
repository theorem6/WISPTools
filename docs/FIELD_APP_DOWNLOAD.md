---
title: Field App APK – Build and Download URL
description: How to build the Android APK and configure the dashboard download link.
---

# Field App APK – Build and Download URL

## Download link in the app

The dashboard uses **`API_CONFIG.MOBILE_APP_DOWNLOAD_URL`** in `Module_Manager/src/lib/config/api.ts`. Default: `/downloads/wisp-field-app.apk`.

- **Current setup:** APK is in `Module_Manager/static/downloads/wisp-field-app.apk`. SvelteKit copies `static/` to the build output, so the deployed app serves it at `/downloads/wisp-field-app.apk`. No config change needed unless you host the APK elsewhere.
- **Relative path** (e.g. `/downloads/wisp-field-app.apk`): Resolved against the app origin (e.g. `https://wisptools.io/downloads/wisp-field-app.apk`). You must serve the APK at that path (Firebase Hosting static files or your CDN).
- **Absolute URL**: Set in `api.ts` or via env to point to Firebase Storage, GCE, or another host.

## Building the APK

1. See **`wisp-field-app/android/RELEASE_BUILD_INSTRUCTIONS.md`** for full steps (keystore, signing, multi-arch).
2. From repo root: `cd wisp-field-app/android && ./gradlew assembleRelease` (or use the scripts in that folder).
3. Output: `android/app/build/outputs/apk/release/app-release.apk`. Rename/copy to `wisp-field-app.apk` if desired.

## Serving the APK

- **Firebase Hosting:** Put the APK in `Module_Manager/public/downloads/` (or project `public/downloads/`) so it is deployed as `/downloads/wisp-field-app.apk`. Ensure `MOBILE_APP_DOWNLOAD_URL` is `/downloads/wisp-field-app.apk`.
- **Firebase Storage:** Upload the APK, make the object publicly readable, and set `MOBILE_APP_DOWNLOAD_URL` to the file URL.
- **GCE / nginx:** Serve from `/var/www/html/downloads/wisp-field-app.apk` and set the config to your domain + path.

After building and uploading, the dashboard “Download Field App” link (📱) will point to the configured URL.

---

## Branded app icon

To replace the default app icon with your WISP's branding:

1. **Assets:** Create or export your icon as PNG (recommended: 1024×1024 for Android adaptive icon, plus legacy 48–192 dp densities if not using adaptive). Use a tool (e.g. Android Studio Image Asset Studio, or icon.kitchen) to generate `mipmap-*` and `drawable` resources.
2. **Android:** In `wisp-field-app/android/app/src/main/res/`, replace the contents of `mipmap-hdpi`, `mipmap-mdpi`, `mipmap-xhdpi`, `mipmap-xxhdpi`, `mipmap-xxxhdpi` with your icon. For adaptive icons (Android 8+), update `res/mipmap-*/ic_launcher.xml` (foreground/background) and the referenced drawables.
3. **Rebuild:** Run `./gradlew assembleRelease` (or your release task). The new icon will appear after reinstalling the APK.
4. **Documentation:** If your team uses a brand guide, add the icon specs and paths to a short `ICON_BRANDING.md` in `wisp-field-app/` so future builds stay consistent.
