# Firebase Web IDE - ACS Module Deployment Guide

Since you're testing in Firebase Web IDE and don't have Firebase CLI installed locally, here's how to deploy the functions and test the ACS module:

## 🚀 Method 1: Deploy Functions via Firebase Web IDE

### Step 1: Deploy Functions in Web IDE
1. **Open Firebase Web IDE** (https://console.firebase.google.com)
2. **Go to your project** → **Functions** tab
3. **Click "Create function"** or use existing function
4. **Copy the function code** from `webide-setup-acs-database.js`
5. **Deploy the function**

### Step 2: Initialize Database
1. **Call the function** to initialize all sample data:
   ```javascript
   // In Firebase Web IDE Functions tab, call:
   initializeACSDatabase()
   ```

### Step 3: Test ACS Module
1. **Go to your hosted app** (Firebase Hosting URL)
2. **Navigate to ACS module** → **Admin** → **Presets**
3. **Click "Initialize Sample Data"** button
4. **Test delete operations** - they should now persist to database

## 🎯 Method 2: Use Individual Initialize Buttons

If Method 1 doesn't work, use the built-in initialize buttons:

### Step 1: Test Each Page
1. **ACS → Admin → Presets**
   - Click "Initialize Sample Data"
   - Try deleting a preset (should persist to database)

2. **ACS → Admin → Provisions** 
   - Click "Initialize Sample Data"
   - Try creating/deleting provisions

3. **ACS → Faults**
   - Click "Initialize Sample Data" 
   - Try resolving faults

4. **ACS → Devices**
   - Data should load from Firebase Functions
   - Try viewing device details

## 🔧 Method 3: Manual Database Setup

If functions aren't working, manually create Firestore collections:

### Step 1: Create Collections in Firestore
1. **Go to Firebase Console** → **Firestore Database**
2. **Create these collections:**
   - `presets`
   - `provisions` 
   - `faults`
   - `cpe_devices`

### Step 2: Add Sample Documents
Add sample documents to test the functionality. Here are the document structures:

#### Presets Collection
```json
{
  "default": {
    "name": "Default Provisioning",
    "description": "Basic configuration for all CPE devices",
    "weight": 0,
    "enabled": true,
    "configurations": [
      {
        "type": "value",
        "path": "InternetGatewayDevice.ManagementServer.URL",
        "value": "https://acs.example.com/cwmp"
      }
    ],
    "events": ["0 BOOTSTRAP", "1 BOOT", "2 PERIODIC"],
    "tags": ["default", "provisioning"]
  }
}
```

#### Provisions Collection
```json
{
  "default-provision": {
    "name": "Default Device Provisioning",
    "description": "Basic device configuration and parameter setup",
    "script": "declare(\"InternetGatewayDevice.ManagementServer.URL\", [], \"https://acs.example.com/cwmp\");",
    "enabled": true,
    "tags": ["default", "provisioning"]
  }
}
```

#### Faults Collection
```json
{
  "FAULT-001": {
    "deviceId": "CPE-003",
    "deviceName": "ZTE MF920U 4G LTE",
    "severity": "Critical",
    "code": "9001",
    "message": "Device connection timeout",
    "description": "Device failed to respond to TR-069 requests",
    "status": "Open",
    "timestamp": "2025-01-04T14:20:00Z"
  }
}
```

#### CPE Devices Collection
```json
{
  "nokia-lte-router-001": {
    "manufacturer": "Nokia",
    "model": "FastMile 4G Gateway",
    "status": "Online",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "New York, NY"
    },
    "lastContact": "2025-01-04T15:00:00Z",
    "parameters": {
      "SoftwareVersion": "1.2.3",
      "HardwareVersion": "HW-2.1"
    },
    "tags": ["nokia", "4g", "gateway"]
  }
}
```

## 🧪 Testing the Integration

### Test 1: Delete Operations
1. **Go to Presets page**
2. **Delete a preset**
3. **Refresh the page**
4. **Verify the preset is still gone** (database persistence)

### Test 2: Create Operations
1. **Click "Create Preset"**
2. **Fill in the form**
3. **Save the preset**
4. **Refresh the page**
5. **Verify the preset is still there** (database persistence)

### Test 3: Update Operations
1. **Edit an existing preset**
2. **Make changes and save**
3. **Refresh the page**
4. **Verify changes are persisted**

## 🔍 Troubleshooting

### If Functions Don't Deploy:
- Check Firebase project permissions
- Verify you're in the correct project
- Try creating a new function instead of modifying existing

### If Database Operations Don't Work:
- Check Firestore security rules
- Verify collections exist
- Check browser console for errors

### If Buttons Still Show 404:
- Verify Firebase Functions are deployed
- Check the project ID in the code matches your Firebase project
- Ensure functions are accessible via HTTPS

## 📊 Expected Console Messages

When working correctly, you should see:
```
Loading presets from Firebase Functions...
Loaded 5 presets from Firebase Functions
Successfully deleted preset default
```

When using fallback:
```
Firebase Functions not available, using sample data
Loaded 1 sample presets (fallback)
```

## 🎯 Success Criteria

✅ **Delete operations persist to database**
✅ **Create operations save to database** 
✅ **Update operations modify database**
✅ **Data survives page refreshes**
✅ **Console shows real database operations**

Your ACS module is now fully integrated with the database! 🎉
