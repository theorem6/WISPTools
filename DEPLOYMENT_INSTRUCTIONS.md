# 🚀 Firebase GenieACS Integration - Deployment Instructions

## Prerequisites

### 1. Install Node.js and Firebase CLI
```bash
# Install Node.js from https://nodejs.org/
# Then install Firebase CLI
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Project
```bash
firebase use --add
# Select your Firebase project
```

## MongoDB Atlas Configuration

Your MongoDB Atlas is already configured:
- **Connection URL**: `mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0`
- **Database**: `genieacs`

## Deployment Steps

### Step 1: Configure Firebase Functions
```bash
# Set MongoDB connection URL
firebase functions:config:set mongodb.connection_url="mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0"
```

### Step 2: Install Dependencies
```bash
cd functions
npm install
cd ..
```

### Step 3: Deploy Firebase Functions
```bash
firebase deploy --only functions
```

### Step 4: Deploy Firestore Configuration
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Step 5: Deploy Firebase Hosting (Optional)
```bash
firebase deploy --only hosting
```

## Alternative: Use Deployment Scripts

### Windows (PowerShell)
```powershell
.\deploy-firebase.ps1
```

### Linux/macOS (Bash)
```bash
chmod +x deploy-firebase.sh
./deploy-firebase.sh
```

## Initialize MongoDB with Sample Data

### Option 1: Run the initialization script
```bash
node init-mongodb-data.js
```

### Option 2: Manual MongoDB setup
1. Connect to your MongoDB Atlas cluster
2. Create database `genieacs`
3. Import the sample data from the initialization script

## Test the Integration

### Run the test script
```bash
node test-integration.js
```

### Manual testing
```bash
# Test sync function
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices

# Test CWMP endpoint
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/genieacsCWMP
```

## Firebase Functions Endpoints

After deployment, you'll have these endpoints:

### 1. Sync CPE Devices
- **URL**: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices`
- **Method**: GET
- **Purpose**: Sync CPE devices from MongoDB to Firestore

### 2. GenieACS CWMP
- **URL**: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/genieacsCWMP`
- **Method**: POST
- **Purpose**: Handle TR-069 CWMP requests from CPEs

### 3. Get CPE Performance Metrics
- **URL**: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/getCpePerformanceMetrics`
- **Method**: POST (Callable Function)
- **Purpose**: Get real-time performance data for a specific CPE

## Firestore Collections

### `cpe_devices`
- Stores CPE device information synced from GenieACS
- Includes GPS coordinates, status, and basic parameters

### `cpe_performance`
- Stores historical performance metrics
- Timestamped data for analytics and graphing

## Environment Variables

### Firebase Functions Config
```bash
firebase functions:config:get
```

### Required Configuration
- `mongodb.connection_url`: MongoDB Atlas connection string

## Troubleshooting

### Common Issues

#### 1. Firebase CLI not found
```bash
npm install -g firebase-tools
```

#### 2. Authentication failed
```bash
firebase login
```

#### 3. Functions deployment failed
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

#### 4. MongoDB connection failed
- Check your MongoDB Atlas IP whitelist
- Verify the connection string
- Ensure the database user has proper permissions

### Logs and Monitoring

#### Firebase Functions Logs
```bash
firebase functions:log
```

#### Firebase Console
- [Firebase Console](https://console.firebase.google.com)
- [MongoDB Atlas](https://cloud.mongodb.com)

## Next Steps

1. **Test the integration** using the test script
2. **Initialize MongoDB** with sample data
3. **Deploy to production** using the deployment scripts
4. **Integrate with PCI Mapper** UI components
5. **Monitor performance** and scale as needed

## Support

If you encounter issues:
1. Check the Firebase Functions logs
2. Verify MongoDB Atlas connectivity
3. Test individual components
4. Review the deployment guide

## Security Notes

- MongoDB Atlas is secured with authentication
- Firebase Functions use Firebase Admin SDK
- Firestore rules restrict access to authenticated users
- All external communications use HTTPS

---

**Ready to deploy? Run the deployment script and follow the prompts!**
