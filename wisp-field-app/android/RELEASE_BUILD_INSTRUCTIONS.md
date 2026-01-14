# WISPTools.io Release Build Instructions

## ✅ Completed Configuration

### 1. Multi-Architecture Support (32-bit & 64-bit)
- ✅ Configured to support all architectures:
  - `armeabi-v7a` (32-bit ARM)
  - `arm64-v8a` (64-bit ARM)
  - `x86` (32-bit Intel)
  - `x86_64` (64-bit Intel)
- ✅ Set in `gradle.properties`: `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
- ✅ Added ABI filters in `build.gradle` for both debug and release builds

### 2. Release Signing Configuration
- ✅ Release signing config added to `build.gradle`
- ✅ Falls back to debug keystore if release keystore not configured
- ✅ Keystore creation scripts provided:
  - `create-release-keystore.ps1` (PowerShell)
  - `create-release-keystore.sh` (Bash)

### 3. App Branding
- ✅ App name: "WISPTools.io" (updated in strings.xml and build.gradle)
- ✅ Theme colors: Matches web app (dark slate theme)
- ⚠️ **App Icon**: Needs to be replaced with branded icons (see below)

## 📱 App Icon Branding

### Current Status
The app currently uses default React Native icons. You need to replace them with WISPTools.io branded icons.

### Icon Locations
Replace icons in these directories:
```
android/app/src/main/res/
├── mipmap-mdpi/     (48x48 px)
├── mipmap-hdpi/     (72x72 px)
├── mipmap-xhdpi/    (96x96 px)
├── mipmap-xxhdpi/   (144x144 px)
└── mipmap-xxxhdpi/  (192x192 px)
```

### Files to Replace
In each mipmap directory, replace:
- `ic_launcher.png` (square icon)
- `ic_launcher_round.png` (round icon)

### Icon Design Guidelines
- **Primary Color**: Blue (#60a5fa) - matches web app
- **Background**: Dark slate (#0f172a or #1e293b)
- **Text/Logo**: "WISPTools.io" or "WISP" with antenna/tower icon
- **Style**: Modern, professional

### Quick Icon Generation
1. Create a 1024x1024px master icon design
2. Use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) to generate all sizes
3. Or use ImageMagick/Photoshop to resize manually

## 🔐 Creating Release Keystore

### Option 1: Use PowerShell Script
```powershell
cd android
.\create-release-keystore.ps1
```

### Option 2: Manual Creation
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore wisptools-release.keystore `
    -alias wisptools-key -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD `
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
```

### Configure gradle.properties
After creating the keystore, add to `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=wisptools-release.keystore
MYAPP_RELEASE_KEY_ALIAS=wisptools-key
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

**⚠️ SECURITY**: Keep the keystore file and passwords secure! Without this keystore, you cannot update the app on Google Play.

## 🏗️ Building Release APK

### Build Command
```powershell
cd android
$env:JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
$env:ANDROID_HOME = "C:\Users\david\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat assembleRelease
```

### Output Location
```
android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk
```

### Verify APK Architectures
```powershell
# Check included architectures
aapt dump badging android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk | Select-String "native-code"
```

Should show: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`

## 📋 Summary Checklist

- [x] Multi-architecture support configured (32-bit & 64-bit)
- [x] Release signing configuration added
- [x] App name updated to "WISPTools.io"
- [x] Theme colors match web app
- [ ] **App icons replaced with branded icons** ⚠️ REQUIRED
- [ ] Release keystore created (optional, uses debug keystore as fallback)
- [ ] Release APK built and tested

## 🚀 Next Steps

1. **Replace app icons** with WISPTools.io branded icons
2. (Optional) Create release keystore for production signing
3. Build release APK: `.\gradlew.bat assembleRelease`
4. Test APK on devices with different architectures
5. Upload to Google Play Console (if publishing)

# WISPTools.io Release Build Instructions

## ✅ Completed Configuration

### 1. Multi-Architecture Support (32-bit & 64-bit)
- ✅ Configured to support all architectures:
  - `armeabi-v7a` (32-bit ARM)
  - `arm64-v8a` (64-bit ARM)
  - `x86` (32-bit Intel)
  - `x86_64` (64-bit Intel)
- ✅ Set in `gradle.properties`: `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
- ✅ Added ABI filters in `build.gradle` for both debug and release builds

### 2. Release Signing Configuration
- ✅ Release signing config added to `build.gradle`
- ✅ Falls back to debug keystore if release keystore not configured
- ✅ Keystore creation scripts provided:
  - `create-release-keystore.ps1` (PowerShell)
  - `create-release-keystore.sh` (Bash)

### 3. App Branding
- ✅ App name: "WISPTools.io" (updated in strings.xml and build.gradle)
- ✅ Theme colors: Matches web app (dark slate theme)
- ⚠️ **App Icon**: Needs to be replaced with branded icons (see below)

## 📱 App Icon Branding

### Current Status
The app currently uses default React Native icons. You need to replace them with WISPTools.io branded icons.

### Icon Locations
Replace icons in these directories:
```
android/app/src/main/res/
├── mipmap-mdpi/     (48x48 px)
├── mipmap-hdpi/     (72x72 px)
├── mipmap-xhdpi/    (96x96 px)
├── mipmap-xxhdpi/   (144x144 px)
└── mipmap-xxxhdpi/  (192x192 px)
```

### Files to Replace
In each mipmap directory, replace:
- `ic_launcher.png` (square icon)
- `ic_launcher_round.png` (round icon)

### Icon Design Guidelines
- **Primary Color**: Blue (#60a5fa) - matches web app
- **Background**: Dark slate (#0f172a or #1e293b)
- **Text/Logo**: "WISPTools.io" or "WISP" with antenna/tower icon
- **Style**: Modern, professional

### Quick Icon Generation
1. Create a 1024x1024px master icon design
2. Use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) to generate all sizes
3. Or use ImageMagick/Photoshop to resize manually

## 🔐 Creating Release Keystore

### Option 1: Use PowerShell Script
```powershell
cd android
.\create-release-keystore.ps1
```

### Option 2: Manual Creation
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore wisptools-release.keystore `
    -alias wisptools-key -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD `
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
```

### Configure gradle.properties
After creating the keystore, add to `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=wisptools-release.keystore
MYAPP_RELEASE_KEY_ALIAS=wisptools-key
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

**⚠️ SECURITY**: Keep the keystore file and passwords secure! Without this keystore, you cannot update the app on Google Play.

## 🏗️ Building Release APK

### Build Command
```powershell
cd android
$env:JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
$env:ANDROID_HOME = "C:\Users\david\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat assembleRelease
```

### Output Location
```
android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk
```

### Verify APK Architectures
```powershell
# Check included architectures
aapt dump badging android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk | Select-String "native-code"
```

Should show: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`

## 📋 Summary Checklist

- [x] Multi-architecture support configured (32-bit & 64-bit)
- [x] Release signing configuration added
- [x] App name updated to "WISPTools.io"
- [x] Theme colors match web app
- [ ] **App icons replaced with branded icons** ⚠️ REQUIRED
- [ ] Release keystore created (optional, uses debug keystore as fallback)
- [ ] Release APK built and tested

## 🚀 Next Steps

1. **Replace app icons** with WISPTools.io branded icons
2. (Optional) Create release keystore for production signing
3. Build release APK: `.\gradlew.bat assembleRelease`
4. Test APK on devices with different architectures
5. Upload to Google Play Console (if publishing)

# WISPTools.io Release Build Instructions

## ✅ Completed Configuration

### 1. Multi-Architecture Support (32-bit & 64-bit)
- ✅ Configured to support all architectures:
  - `armeabi-v7a` (32-bit ARM)
  - `arm64-v8a` (64-bit ARM)
  - `x86` (32-bit Intel)
  - `x86_64` (64-bit Intel)
- ✅ Set in `gradle.properties`: `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
- ✅ Added ABI filters in `build.gradle` for both debug and release builds

### 2. Release Signing Configuration
- ✅ Release signing config added to `build.gradle`
- ✅ Falls back to debug keystore if release keystore not configured
- ✅ Keystore creation scripts provided:
  - `create-release-keystore.ps1` (PowerShell)
  - `create-release-keystore.sh` (Bash)

### 3. App Branding
- ✅ App name: "WISPTools.io" (updated in strings.xml and build.gradle)
- ✅ Theme colors: Matches web app (dark slate theme)
- ⚠️ **App Icon**: Needs to be replaced with branded icons (see below)

## 📱 App Icon Branding

### Current Status
The app currently uses default React Native icons. You need to replace them with WISPTools.io branded icons.

### Icon Locations
Replace icons in these directories:
```
android/app/src/main/res/
├── mipmap-mdpi/     (48x48 px)
├── mipmap-hdpi/     (72x72 px)
├── mipmap-xhdpi/    (96x96 px)
├── mipmap-xxhdpi/   (144x144 px)
└── mipmap-xxxhdpi/  (192x192 px)
```

### Files to Replace
In each mipmap directory, replace:
- `ic_launcher.png` (square icon)
- `ic_launcher_round.png` (round icon)

### Icon Design Guidelines
- **Primary Color**: Blue (#60a5fa) - matches web app
- **Background**: Dark slate (#0f172a or #1e293b)
- **Text/Logo**: "WISPTools.io" or "WISP" with antenna/tower icon
- **Style**: Modern, professional

### Quick Icon Generation
1. Create a 1024x1024px master icon design
2. Use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) to generate all sizes
3. Or use ImageMagick/Photoshop to resize manually

## 🔐 Creating Release Keystore

### Option 1: Use PowerShell Script
```powershell
cd android
.\create-release-keystore.ps1
```

### Option 2: Manual Creation
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore wisptools-release.keystore `
    -alias wisptools-key -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD `
    -dname "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
```

### Configure gradle.properties
After creating the keystore, add to `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=wisptools-release.keystore
MYAPP_RELEASE_KEY_ALIAS=wisptools-key
MYAPP_RELEASE_STORE_PASSWORD=your_store_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
```

**⚠️ SECURITY**: Keep the keystore file and passwords secure! Without this keystore, you cannot update the app on Google Play.

## 🏗️ Building Release APK

### Build Command
```powershell
cd android
$env:JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
$env:ANDROID_HOME = "C:\Users\david\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat assembleRelease
```

### Output Location
```
android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk
```

### Verify APK Architectures
```powershell
# Check included architectures
aapt dump badging android/app/build/outputs/apk/release/WISPTools-io-v1.0.0-release.apk | Select-String "native-code"
```

Should show: `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`

## 📋 Summary Checklist

- [x] Multi-architecture support configured (32-bit & 64-bit)
- [x] Release signing configuration added
- [x] App name updated to "WISPTools.io"
- [x] Theme colors match web app
- [ ] **App icons replaced with branded icons** ⚠️ REQUIRED
- [ ] Release keystore created (optional, uses debug keystore as fallback)
- [ ] Release APK built and tested

## 🚀 Next Steps

1. **Replace app icons** with WISPTools.io branded icons
2. (Optional) Create release keystore for production signing
3. Build release APK: `.\gradlew.bat assembleRelease`
4. Test APK on devices with different architectures
5. Upload to Google Play Console (if publishing)







