# Building the WISP Field App APK

Due to a known incompatibility between Gradle 8.5 and React Native Firebase, the APK must be built using Android Studio.

## Build Environment Status ✅

Everything is set up and ready:
- ✅ Node.js 20.18.0 installed
- ✅ Java 17 installed  
- ✅ npm dependencies installed
- ✅ Gradle wrapper configured
- ✅ Android SDK configured
- ✅ google-services.json in place

## Build Method 1: Android Studio (Recommended)

1. **Open Android Studio**

2. **Open the Project:**
   - Click **File → Open**
   - Navigate to: `C:\Users\david\Downloads\PCI_mapper\wisp-field-app\android`
   - Click **OK**

3. **Wait for Gradle Sync:**
   - Android Studio will automatically sync Gradle (1-2 minutes)
   - If prompted about Gradle version, click "Use Gradle wrapper"

4. **Build the APK:**
   - Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Wait for build to complete (3-5 minutes first time)

5. **Find your APK:**
   ```
   C:\Users\david\Downloads\PCI_mapper\wisp-field-app\android\app\build\outputs\apk\debug\app-debug.apk
   ```

## Build Method 2: Command Line (Alternative)

If Android Studio's Gradle works:

```powershell
cd C:\Users\david\Downloads\PCI_mapper\wisp-field-app\android

# Set environment
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Build
.\gradlew.bat assembleDebug
```

## Installing on Android Device

### Method A: USB Cable
```powershell
# Connect phone via USB (USB Debugging enabled)
adb install app\build\outputs\apk\debug\app-debug.apk
```

### Method B: Transfer File
1. Copy `app-debug.apk` to your phone
2. Open it on the phone
3. Allow "Install from Unknown Sources" if prompted
4. Tap "Install"

## Troubleshooting

### "Gradle sync failed"
- Click **File → Invalidate Caches → Invalidate and Restart**

### "SDK not found"
- In Android Studio: **File → Settings → Appearance & Behavior → System Settings → Android SDK**
- Ensure Android 14.0 (API 34) is installed

### "Build failed"
- Try: **Build → Clean Project**
- Then: **Build → Rebuild Project**

## App Details

- **Package Name:** `com.wispfieldapp`
- **Min SDK:** Android 6.0 (API 23)
- **Target SDK:** Android 14 (API 34)
- **Permissions:** Camera, Location, Storage

## First Launch

1. **Login Credentials:**
   - Email: Same as web platform
   - Password: Same as web platform

2. **Grant Permissions:**
   - Camera (for QR scanning)
   - Location (for nearby towers)
   - Storage (for photos)

3. **Features:**
   - 📷 Scan QR Codes on equipment
   - 📡 View nearby towers with GPS
   - 🚚 Manage vehicle inventory
   - 📋 Handle work orders
   - 🔧 Record deployments

---

**Note:** The Gradle validation error you encountered is a known issue tracked here: https://github.com/invertase/react-native-firebase/issues/7621

Android Studio handles this gracefully with its internal build system.

