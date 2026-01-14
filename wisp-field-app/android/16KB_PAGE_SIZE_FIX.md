# 16KB Page Size Support Fix

## Current Status

React Native 0.73.11 does **not** have built-in 16KB page size support. This was added in React Native 0.74+.

## The Problem

React Native native libraries (libreactnativejni.so, libhermes.so, etc.) are pre-built and come from npm. They are compiled with 4KB page size alignment by default, which causes errors on Android 15+ devices with 16KB page sizes.

## Solutions

### Option 1: Upgrade React Native (Recommended)

Upgrade to React Native 0.74+ which includes 16KB page size support:

```bash
cd wisp-field-app
npm install react-native@0.74.0
npm install
cd android
./gradlew clean
./gradlew assembleDebug
```

**Note:** This is a major version upgrade and may require code changes.

### Option 2: Use extractNativeLibs="false" (Current Approach)

We've configured:
- `android:extractNativeLibs="false"` in AndroidManifest.xml
- Proper APK packaging configuration
- APK alignment with zipalign

This keeps libraries compressed in the APK, which helps with alignment, but **does not fix the underlying library alignment issue**.

### Option 3: Wait for React Native 0.73.x Patch

Facebook may backport 16KB support to 0.73.x. Monitor:
- https://github.com/facebook/react-native/issues
- React Native releases

### Option 4: Manual Library Realignment (Advanced)

Use NDK tools to realign libraries after build:
1. Extract APK
2. Use `llvm-objcopy` to realign each .so file
3. Repackage APK
4. Re-sign

This is complex and may break libraries.

## Current Configuration

✅ `android:extractNativeLibs="false"` in AndroidManifest.xml
✅ Proper packaging configuration in build.gradle
✅ APK alignment with zipalign
❌ React Native libraries still have 4KB alignment (pre-built)

## Recommendation

**Upgrade to React Native 0.74+** for proper 16KB page size support. This is the only reliable solution for React Native apps.

## Testing

After upgrading, test on a device with 16KB page size (Android 15+):
- The app should launch without alignment errors
- All native libraries should load correctly
- No "16KB page size" errors in logcat

# 16KB Page Size Support Fix

## Current Status

React Native 0.73.11 does **not** have built-in 16KB page size support. This was added in React Native 0.74+.

## The Problem

React Native native libraries (libreactnativejni.so, libhermes.so, etc.) are pre-built and come from npm. They are compiled with 4KB page size alignment by default, which causes errors on Android 15+ devices with 16KB page sizes.

## Solutions

### Option 1: Upgrade React Native (Recommended)

Upgrade to React Native 0.74+ which includes 16KB page size support:

```bash
cd wisp-field-app
npm install react-native@0.74.0
npm install
cd android
./gradlew clean
./gradlew assembleDebug
```

**Note:** This is a major version upgrade and may require code changes.

### Option 2: Use extractNativeLibs="false" (Current Approach)

We've configured:
- `android:extractNativeLibs="false"` in AndroidManifest.xml
- Proper APK packaging configuration
- APK alignment with zipalign

This keeps libraries compressed in the APK, which helps with alignment, but **does not fix the underlying library alignment issue**.

### Option 3: Wait for React Native 0.73.x Patch

Facebook may backport 16KB support to 0.73.x. Monitor:
- https://github.com/facebook/react-native/issues
- React Native releases

### Option 4: Manual Library Realignment (Advanced)

Use NDK tools to realign libraries after build:
1. Extract APK
2. Use `llvm-objcopy` to realign each .so file
3. Repackage APK
4. Re-sign

This is complex and may break libraries.

## Current Configuration

✅ `android:extractNativeLibs="false"` in AndroidManifest.xml
✅ Proper packaging configuration in build.gradle
✅ APK alignment with zipalign
❌ React Native libraries still have 4KB alignment (pre-built)

## Recommendation

**Upgrade to React Native 0.74+** for proper 16KB page size support. This is the only reliable solution for React Native apps.

## Testing

After upgrading, test on a device with 16KB page size (Android 15+):
- The app should launch without alignment errors
- All native libraries should load correctly
- No "16KB page size" errors in logcat

# 16KB Page Size Support Fix

## Current Status

React Native 0.73.11 does **not** have built-in 16KB page size support. This was added in React Native 0.74+.

## The Problem

React Native native libraries (libreactnativejni.so, libhermes.so, etc.) are pre-built and come from npm. They are compiled with 4KB page size alignment by default, which causes errors on Android 15+ devices with 16KB page sizes.

## Solutions

### Option 1: Upgrade React Native (Recommended)

Upgrade to React Native 0.74+ which includes 16KB page size support:

```bash
cd wisp-field-app
npm install react-native@0.74.0
npm install
cd android
./gradlew clean
./gradlew assembleDebug
```

**Note:** This is a major version upgrade and may require code changes.

### Option 2: Use extractNativeLibs="false" (Current Approach)

We've configured:
- `android:extractNativeLibs="false"` in AndroidManifest.xml
- Proper APK packaging configuration
- APK alignment with zipalign

This keeps libraries compressed in the APK, which helps with alignment, but **does not fix the underlying library alignment issue**.

### Option 3: Wait for React Native 0.73.x Patch

Facebook may backport 16KB support to 0.73.x. Monitor:
- https://github.com/facebook/react-native/issues
- React Native releases

### Option 4: Manual Library Realignment (Advanced)

Use NDK tools to realign libraries after build:
1. Extract APK
2. Use `llvm-objcopy` to realign each .so file
3. Repackage APK
4. Re-sign

This is complex and may break libraries.

## Current Configuration

✅ `android:extractNativeLibs="false"` in AndroidManifest.xml
✅ Proper packaging configuration in build.gradle
✅ APK alignment with zipalign
❌ React Native libraries still have 4KB alignment (pre-built)

## Recommendation

**Upgrade to React Native 0.74+** for proper 16KB page size support. This is the only reliable solution for React Native apps.

## Testing

After upgrading, test on a device with 16KB page size (Android 15+):
- The app should launch without alignment errors
- All native libraries should load correctly
- No "16KB page size" errors in logcat







