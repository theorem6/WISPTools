# 🔥 Firebase Web IDE - GenieACS Integration Setup

## Yes, This Works in Firebase Web IDE! 

The Firebase GenieACS integration is **fully compatible** with Firebase Web IDE. Here's how to set it up:

---

## 🚀 Quick Setup in Firebase Web IDE

### Step 1: Start Development Server

In the Firebase Web IDE terminal:

```bash
# Navigate to your project root
cd .

# Install dependencies (if needed)
npm install

# Start the development server
npm run dev -- --host
```

### Step 2: Configure Environment Variables

In Firebase Web IDE, create a `.env.local` file:

```bash
# Create environment file
touch .env.local
```

Add your configuration:

```env
# MongoDB Atlas Connection
PUBLIC_MONGODB_URL=mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0

# Firebase Project (replace with your actual project ID)
PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id

# GenieACS Configuration
PUBLIC_GENIEACS_NBI_URL=https://us-central1-your-firebase-project-id.cloudfunctions.net
PUBLIC_GENIEACS_USERNAME=admin
PUBLIC_GENIEACS_PASSWORD=password
```

---

## 🧪 Testing in Firebase Web IDE

### Option 1: Use the Test Script

```bash
# Run the integration test
node test-integration.js
```

### Option 2: Initialize MongoDB Data

```bash
# Initialize sample CPE devices in MongoDB
node init-mongodb-data.js
```

### Option 3: Test Individual Components

```bash
# Test MongoDB connection
node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0');
client.connect().then(() => {
  console.log('✅ MongoDB Atlas connected successfully!');
  client.close();
}).catch(err => console.error('❌ Connection failed:', err.message));
"
```

---

## 🔧 Firebase Functions in Web IDE

### Deploy Functions from Web IDE

```bash
# Install Firebase CLI (if not available)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Set MongoDB configuration
firebase functions:config:set mongodb.connection_url="mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0"

# Deploy functions
cd functions
npm install
firebase deploy --only functions
cd ..
```

### Deploy Firestore Rules

```bash
# Deploy Firestore configuration
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 📱 Testing the Integration

### 1. Test Firebase Functions

```bash
# Test sync function (replace YOUR_PROJECT_ID)
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices

# Test CWMP endpoint
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/genieacsCWMP
```

### 2. Check Firestore Data

In Firebase Console:
1. Go to **Firestore Database**
2. Look for `cpe_devices` collection
3. Verify CPE devices are synced from MongoDB

### 3. Test in Browser

In your Firebase Web IDE preview:
1. Open the PCI Mapper
2. Look for CPE devices on the map
3. Click on CPE devices to see performance data

---

## 🔍 Firebase Web IDE Specific Features

### Preview Integration

The Firebase Web IDE preview will show:
- ✅ **PCI Mapper** with CPE devices
- ✅ **Real-time CPE status** (Online/Offline)
- ✅ **GPS coordinates** from CPEs
- ✅ **Performance metrics** when clicking CPEs

### Live Reload

- Changes to your code will **auto-reload** in the preview
- MongoDB data changes will sync automatically
- Firebase Functions deploy instantly

### Terminal Access

You have full terminal access for:
- MongoDB operations
- Firebase CLI commands
- Git operations
- Testing scripts

---

## 🚨 Important Notes for Web IDE

### 1. Environment Variables
- Use `PUBLIC_` prefix for client-side variables
- Server-side variables go in Firebase Functions config
- Restart dev server after changing `.env.local`

### 2. CORS Configuration
- Firebase Functions automatically handle CORS
- No additional CORS setup needed in Web IDE

### 3. HTTPS Requirements
- Firebase Web IDE uses HTTPS
- MongoDB Atlas connections work fine
- All API calls are secure

### 4. Port Configuration
- Use `--host` flag for dev server
- Firebase Web IDE handles port mapping
- Preview works automatically

---

## 🎯 Complete Test Workflow

### 1. Start Everything
```bash
# Terminal 1: Start dev server
npm run dev -- --host

# Terminal 2: Deploy functions
firebase deploy --only functions

# Terminal 3: Initialize data
node init-mongodb-data.js
```

### 2. Test Integration
```bash
# Test the complete flow
node test-integration.js
```

### 3. Verify in Browser
1. Open Firebase Web IDE preview
2. Navigate to PCI Mapper
3. Look for CPE devices on map
4. Click devices to see performance data

---

## 🔧 Troubleshooting in Web IDE

### MongoDB Connection Issues
```bash
# Test connection
node -e "const { MongoClient } = require('mongodb'); const client = new MongoClient('your-connection-string'); client.connect().then(() => console.log('✅ Connected')).catch(err => console.error('❌ Failed:', err.message));"
```

### Firebase Functions Not Deploying
```bash
# Check Firebase login
firebase login --reauth

# Check project
firebase use --list

# Deploy with verbose output
firebase deploy --only functions --debug
```

### Preview Not Loading
- Make sure you're using `--host` flag
- Check Firebase Web IDE preview panel
- Look for error messages in browser console

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ **MongoDB Atlas** connects successfully
2. ✅ **Firebase Functions** deploy without errors
3. ✅ **CPE devices** appear in Firestore
4. ✅ **PCI Mapper** shows CPE locations on map
5. ✅ **Clicking CPEs** displays performance data
6. ✅ **Real-time updates** work in preview

---

## 🚀 Ready to Test!

The Firebase Web IDE is **perfect** for testing the GenieACS integration because:

- ✅ **Full Firebase ecosystem** available
- ✅ **Live preview** with auto-reload
- ✅ **Terminal access** for all commands
- ✅ **Firestore integration** works seamlessly
- ✅ **Functions deployment** is straightforward
- ✅ **MongoDB Atlas** connectivity is reliable

**Start testing now!** 🔥
