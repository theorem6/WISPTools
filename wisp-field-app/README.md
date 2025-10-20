# 📱 WISP Field App - Mobile Equipment Scanner

React Native mobile app for field technicians to scan QR codes, document installations, and manage equipment on-site.

## ✨ Features

### 📷 QR Code Scanner
- Instant equipment lookup by scanning asset tags
- Automatic inventory item display
- Manual entry fallback if camera unavailable

### 📡 Tower Documentation
- View nearby tower sites based on GPS
- Access gate codes and safety notes
- Contact information for site managers
- FCC IDs and professional tower info
- Navigate to sites with Google Maps

### 🚚 Vehicle Inventory
- Track equipment in service vehicle
- Deploy equipment to tower sites
- Transfer items between locations
- Update equipment status on-the-go

### 🔧 Equipment Management
- View full equipment details after scanning
- Update status (deployed, maintenance, RMA)
- Add maintenance records
- Document installations with photos

### 🔐 Authentication
- Same Firebase auth as web platform
- Multi-tenant support
- Automatic tenant detection
- Secure API access with JWT tokens

---

## 🚀 Installation & Setup

### Prerequisites
```bash
# Install Node.js (18+)
# Install Android Studio
# Install React Native CLI
npm install -g react-native-cli
```

### 1. Install Dependencies
```bash
cd wisp-field-app
npm install
```

### 2. Setup Android

**Option A: Using Android Studio**
1. Open Android Studio
2. File → Open → Select `wisp-field-app/android`
3. Wait for Gradle sync
4. Click "Run" (green play button)

**Option B: Command Line**
```bash
# Make sure Android SDK is installed
# Set ANDROID_HOME environment variable

# Connect Android device via USB (enable USB debugging)
# OR start Android emulator

# Run the app
npm run android
```

### 3. Run on Device
```bash
# Start Metro bundler
npm start

# In another terminal, run on Android
npm run android

# For iOS (requires Mac)
npm run ios
```

---

## 📦 Building APK for Installation

### Debug Build (for testing)
```bash
cd android
./gradlew assembleDebug
```

**APK Location:**
`android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (for production)
```bash
cd android
./gradlew assembleRelease
```

**APK Location:**
`android/app/build/outputs/apk/release/app-release.apk`

### Install APK on Device
```bash
# Via adb
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or transfer APK to phone and install manually
```

---

## 🔧 Configuration

### Firebase Setup
The app uses the same Firebase project as the web app:
- **Project ID:** `lte-pci-mapper-65450042-bbf71`
- **Config:** Already included in `src/config/firebase.ts`
- **Android config:** `android/google-services.json`

### API Endpoints
The app connects to the same backend as the web platform:
```
Cloud Function (hssProxy) → GCE VM (port 3001) → MongoDB Atlas
```

All API calls go through:
`https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy`

---

## 📱 App Screens

### 1. Login Screen
- Email/password authentication
- Automatic tenant detection
- Same credentials as web app

### 2. Home Screen
- 📷 Scan QR Code
- 📡 Nearby Towers
- 🚚 Vehicle Inventory
- 📋 Work Orders (coming soon)

### 3. QR Scanner
- Real-time camera scanning
- Vibration feedback on successful scan
- Manual entry option
- Automatic equipment lookup

### 4. Asset Details
- Full equipment information
- Serial number, manufacturer, model
- Current location and status
- Quick actions (Deploy, Maintenance, RMA)
- ACS integration status

### 5. Nearby Towers
- List sorted by distance
- Gate codes displayed
- Contact information
- Navigation to site
- Equipment count per site

### 6. Tower Details
- Site information and location
- Gate codes and access instructions
- Contact information with click-to-call
- List of sectors (azimuth, band, technology)
- Equipment deployed at site

### 7. Vehicle Inventory
- Equipment currently in service vehicle
- Quick deploy to tower sites
- Status updates
- Transfer functionality

---

## 🔄 Syncing with Web Platform

The mobile app shares the same backend, so:

✅ **Equipment scanned in mobile app** appears in web inventory  
✅ **Items added in web** are scanned in mobile app  
✅ **Status updates sync** in real-time  
✅ **Same authentication** across platforms  
✅ **Multi-tenant data** stays isolated  

---

## 📊 Data Flow

```
Mobile App → Firebase Auth → Get Token
          ↓
     API Service adds:
     - Authorization: Bearer <token>
     - X-Tenant-ID: <tenant>
          ↓
     Cloud Function (hssProxy)
          ↓
     GCE Backend API (port 3001)
          ↓
     MongoDB Atlas (filtered by tenant)
```

---

## 🛠️ Development

### Run in Development Mode
```bash
# Terminal 1 - Start Metro bundler
npm start

# Terminal 2 - Run on Android
npm run android

# Or run on iOS (Mac only)
npm run ios
```

### Debug Console
```bash
# View React Native logs
npx react-native log-android
npx react-native log-ios

# View device logs
adb logcat
```

### Hot Reload
- **Fast Refresh:** Enabled by default
- Press `R` twice or shake device to reload
- `Cmd+D` (iOS) or `Cmd+M` (Android) for dev menu

---

## 📷 Camera Permissions

The app requires camera permission for QR scanning:

**Android:** Automatically prompts on first use  
**iOS:** Add description in `Info.plist`

Users can also use manual entry if camera isn't available.

---

## 🌐 Network Requirements

**Internet Required:**
- Firebase authentication
- API calls to backend
- Real-time inventory sync

**Future: Offline Mode**
- SQLite cache for offline access
- Sync queue when back online
- Cached tower data

---

## 🎯 Use Cases

### Field Technician
1. **Morning:** Open app → See vehicle inventory
2. **Drive to site:** View nearby towers → Get gate code
3. **At tower:** Scan equipment → Update status to "deployed"
4. **Installation:** Add maintenance notes and photos
5. **End of day:** Equipment status synced to web platform

### Warehouse Manager
1. **Receiving:** Scan incoming equipment → Add to inventory
2. **Outbound:** Scan item → Mark "in-transit" to vehicle
3. **Stock check:** Quick scan to verify equipment

### Network Operator
1. **Emergency repair:** Find nearest spare equipment
2. **On-site:** Access tower gate codes and contacts
3. **Quick deployment:** Scan equipment → Deploy to site
4. **RMA tracking:** Mark failed equipment for return

---

## 🔒 Security

- ✅ Firebase Authentication (same as web)
- ✅ JWT tokens for API access
- ✅ HTTPS only connections
- ✅ Tenant-level data isolation
- ✅ No sensitive data cached locally
- ✅ Automatic session timeout

---

## 📲 Distribution

### Internal Testing (Recommended)
```bash
# Build debug APK
npm run build:android

# Send app-debug.apk to testers
# They can install directly (enable "Unknown Sources")
```

### Google Play Store (Production)
1. Create signed release build
2. Upload to Play Console
3. Internal testing → Beta → Production
4. Submit for review

### TestFlight (iOS)
1. Build for iOS
2. Upload to App Store Connect
3. Add internal testers
4. Distribute

---

## 🆘 Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
cd android
./gradlew clean
cd ..
npm start -- --reset-cache
```

### Camera Not Working
- Check camera permissions in Settings
- Use "Manual Entry" button as fallback
- Verify camera hardware is functional

### Network Errors
- Check internet connection
- Verify Firebase project configuration
- Check GCE VM backend is running (port 3001)
- Test API with curl or Postman

---

## 📝 Notes

This is a **cross-platform React Native app** that works on:
- ✅ Android (5.0+)
- ✅ iOS (12.0+)

**Same codebase** for both platforms!

---

## 🎉 Ready to Use!

The app connects to your existing backend infrastructure. No changes needed to backend APIs - just install and run!

**Support:** For issues, check the main project README or contact your system administrator.

