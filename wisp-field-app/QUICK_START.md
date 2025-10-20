# 🚀 Quick Start - WISP Field App

## For Windows Users (Local Android Testing)

### 1. Install Prerequisites (One-Time Setup)

#### Install Node.js
```powershell
# Download and install from: https://nodejs.org/
# Version 18 or higher required
node --version  # Should show v18.x.x or higher
```

#### Install Android Studio
```
1. Download from: https://developer.android.com/studio
2. Run installer
3. During setup, install:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device
```

#### Setup Environment Variables
```powershell
# Add to System Environment Variables:
ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
Path += %ANDROID_HOME%\platform-tools
Path += %ANDROID_HOME%\tools
```

### 2. Install App Dependencies
```powershell
cd C:\Users\david\Downloads\PCI_mapper\wisp-field-app
npm install
```

### 3. Run on Android

#### Option A: Using Android Emulator (Easiest)
```powershell
# Open Android Studio → AVD Manager → Create Virtual Device
# Start the emulator

# In PowerShell:
cd wisp-field-app
npm run android
```

#### Option B: Using Physical Device
```powershell
# On your Android phone:
# 1. Settings → About Phone → Tap "Build Number" 7 times
# 2. Settings → Developer Options → Enable "USB Debugging"
# 3. Connect phone via USB
# 4. Accept debugging prompt on phone

# Verify device is connected:
adb devices

# Run the app:
npm run android
```

### 4. Build APK for Installation
```powershell
cd android
.\gradlew.bat assembleDebug

# APK created at:
# android\app\build\outputs\apk\debug\app-debug.apk

# Transfer to phone and install
```

---

## 📱 First Time Login

1. **Email:** Same as web app (david@tenant.com)
2. **Password:** Same as web app
3. **Tenant:** Automatically detected (Peterson Consulting)

---

## 🎯 Testing the App

### Test Scenario 1: QR Scanning
1. Open app → Login
2. Tap "📷 Scan QR Code"
3. Allow camera permission
4. Point at QR code (or tap "⌨️ Manual Entry")
5. Enter test serial number or asset tag
6. See equipment details!

### Test Scenario 2: Nearby Towers
1. Tap "📡 Nearby Towers"
2. Allow location permission
3. See list of towers sorted by distance
4. Tap a tower → View details, gate codes, contacts
5. Tap "🗺️ Open in Maps" → Navigate to tower

### Test Scenario 3: Vehicle Inventory
1. Tap "🚚 Vehicle Inventory"
2. See equipment currently in vehicle
3. Tap equipment → Deploy to site

---

## 🔧 Troubleshooting

### "Metro bundler not running"
```powershell
# In one PowerShell window:
npm start

# In another PowerShell window:
npm run android
```

### "Unable to resolve module"
```powershell
npm start -- --reset-cache
npm run android
```

### "App won't install on phone"
```powershell
# Enable "Install from Unknown Sources" in phone settings
# Or use:
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### "Camera permission denied"
```
Settings → Apps → WISP Field App → Permissions → Camera → Allow
```

---

## 📦 What's Included

✅ **Login/Auth** - Same as web app  
✅ **QR Scanner** - Camera-based scanning  
✅ **Asset Details** - Full equipment info  
✅ **Nearby Towers** - GPS-based tower list  
✅ **Vehicle Inventory** - Equipment tracking  
✅ **Tower Details** - Gate codes, contacts, sectors  

---

## 🎉 You're Ready!

The app is **fully functional** and connects to your existing backend. No backend changes needed!

**Questions?** Check the main README.md or contact support.

