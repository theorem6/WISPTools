# MongoDB Atlas Deployment with npm Driver

This guide explains how to deploy your application with MongoDB Atlas using the official [MongoDB Node.js Driver v6.x](https://www.mongodb.com/docs/drivers/node/current/).

## 🎯 Overview

Your application now uses the **official MongoDB Node.js npm package** (v6.20) to connect to MongoDB Atlas. This provides:

- ✅ Latest MongoDB features and performance
- ✅ Built-in connection pooling for Firebase Functions
- ✅ Automatic reconnection handling
- ✅ Type-safe operations with TypeScript
- ✅ Optimized for serverless environments

## 📦 What's Configured

### MongoDB Driver Package
```json
{
  "dependencies": {
    "mongodb": "^6.20.0"
  }
}
```

### Connection Handler
- **File**: `functions/src/mongoConnection.ts`
- **Features**:
  - Singleton pattern (reuses connections)
  - Connection pooling (2-10 connections)
  - Compression enabled (zlib)
  - Timeout handling
  - Health checks

### Your MongoDB Atlas Cluster
```
Cluster: cluster0.1radgkw.mongodb.net
Username: genieacs-user
Connection String: mongodb+srv://genieacs-user:<db_password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

## 🚀 Step-by-Step Deployment

### Step 1: Get Your MongoDB Password

You need to replace `<db_password>` in the connection string with your actual password.

**Where to find it:**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your project
3. Go to **Database Access** in the left sidebar
4. Find user `genieacs-user`
5. **If you don't remember the password**, click **Edit** → **Edit Password** → Set a new password

**Important**: Save this password securely!

### Step 2: Update Connection String in Configuration Files

You have **3 options** for setting your MongoDB password:

#### Option 1: Update apphosting.yaml files (Recommended for deployment)

Edit these files and replace `<db_password>` with your actual password:

**`apphosting.yaml`** (Production):
```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:YOUR_ACTUAL_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  availability:
    - RUNTIME
```

**`apphosting.staging.yaml`** (Staging):
```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:YOUR_ACTUAL_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  availability:
    - RUNTIME
```

**`apphosting.development.yaml`** (Development):
```yaml
- variable: MONGODB_URI
  value: "mongodb+srv://genieacs-user:YOUR_ACTUAL_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  availability:
    - RUNTIME
```

#### Option 2: Use Firebase Secrets (More secure)

```bash
# Set as Firebase secret
echo "mongodb+srv://genieacs-user:YOUR_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" | firebase functions:secrets:set MONGODB_URI

# Then update apphosting.yaml to use secret:
- variable: MONGODB_URI
  secret: MONGODB_URI
  availability:
    - RUNTIME
```

#### Option 3: Set as Environment Variable (Local testing)

```bash
# Linux/Mac
export MONGODB_URI="mongodb+srv://genieacs-user:YOUR_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Windows PowerShell
$env:MONGODB_URI="mongodb+srv://genieacs-user:YOUR_PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
```

### Step 3: Verify MongoDB Atlas Network Access

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your cluster
3. Go to **Network Access** in the left sidebar
4. Ensure you have an IP whitelist entry:
   - **For development**: Add `0.0.0.0/0` (allow from anywhere)
   - **For production**: Add specific Firebase/Google Cloud IP ranges

### Step 4: Install Dependencies

```bash
cd functions
npm install
```

This will install MongoDB driver v6.20.0 from npm.

### Step 5: Build Functions

```bash
cd functions
npm run build
```

### Step 6: Deploy to Firebase

```bash
# From project root
firebase deploy

# Or deploy only functions
firebase deploy --only functions
```

## 🧪 Testing Your MongoDB Connection

### Test 1: Check MongoDB Connection

Create a test function to verify connectivity:

```bash
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices
```

Expected response:
```json
{
  "success": true,
  "synced": 0,
  "errors": 0,
  "total": 0,
  "timestamp": "2025-..."
}
```

### Test 2: Add Sample Data

Use MongoDB Atlas UI or MongoDB Compass:

1. Connect to your cluster
2. Select database: `genieacs`
3. Create collection: `devices`
4. Insert a sample device:

```json
{
  "_id": "test-device-1",
  "_deviceId": {
    "Manufacturer": "Nokia",
    "OUI": "001E58",
    "ProductClass": "LTE Router",
    "SerialNumber": "TEST123456"
  },
  "_lastInform": { "$date": "2025-01-07T00:00:00Z" },
  "_registered": { "$date": "2025-01-07T00:00:00Z" },
  "Device.GPS.Latitude": "40.7128",
  "Device.GPS.Longitude": "-74.0060",
  "Device.DeviceInfo.Manufacturer": "Nokia",
  "Device.DeviceInfo.SerialNumber": "TEST123456"
}
```

### Test 3: Sync Devices

```bash
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices
```

Expected response:
```json
{
  "success": true,
  "synced": 1,
  "errors": 0,
  "total": 1,
  "timestamp": "2025-..."
}
```

### Test 4: Get Devices

```bash
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

Expected response:
```json
{
  "success": true,
  "devices": [...],
  "count": 1
}
```

## 📊 MongoDB Atlas Setup (If Starting Fresh)

If you haven't set up MongoDB Atlas yet:

### 1. Create MongoDB Atlas Account
1. Go to https://cloud.mongodb.com
2. Sign up for free account
3. Create organization and project

### 2. Create Cluster
1. Click **"Build a Database"**
2. Choose **M0 Free tier**
3. Select **Cloud Provider**: AWS
4. Select **Region**: us-east-1 (or closest to Firebase region)
5. Cluster Name: `Cluster0`
6. Click **"Create"**

### 3. Create Database User
1. Go to **Database Access**
2. Click **"Add New Database User"**
3. Username: `genieacs-user`
4. Password: Generate strong password (save it!)
5. Database User Privileges: **"Read and write to any database"**
6. Click **"Add User"**

### 4. Configure Network Access
1. Go to **Network Access**
2. Click **"Add IP Address"**
3. For development: Click **"Allow Access from Anywhere"** (0.0.0.0/0)
4. For production: Add specific IP ranges later
5. Click **"Confirm"**

### 5. Get Connection String
1. Go to **Database** → **Connect**
2. Choose **"Connect your application"**
3. Driver: **Node.js**
4. Version: **6.0 or later**
5. Copy connection string
6. Replace `<password>` with your actual password

## 🔧 Troubleshooting

### Error: "MongoServerError: bad auth"

**Cause**: Incorrect password or username

**Solution**:
1. Verify username is `genieacs-user`
2. Reset password in MongoDB Atlas → Database Access
3. Update connection string with new password

### Error: "MongoTimeoutError: Server selection timed out"

**Cause**: Network access not configured or wrong IP address

**Solution**:
1. Go to MongoDB Atlas → Network Access
2. Add `0.0.0.0/0` to allow all IPs (for testing)
3. Wait 1-2 minutes for changes to propagate

### Error: "MongoParseError: Invalid connection string"

**Cause**: Connection string format is incorrect

**Solution**:
1. Verify connection string format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/?params
   ```
2. Ensure no spaces in the string
3. Password special characters should be URL-encoded

### Error: "Function deployment failed"

**Cause**: Dependencies not installed or build failed

**Solution**:
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
cd ..
firebase deploy --only functions
```

## 📈 Performance Optimization

### Connection Pooling

The MongoDB connection handler uses connection pooling:

```typescript
{
  maxPoolSize: 10,  // Maximum connections
  minPoolSize: 2,   // Minimum connections
  compressors: ['zlib']  // Compression
}
```

This is optimized for Firebase Functions where connections are reused between invocations.

### Indexes

Create indexes for better query performance:

```javascript
// In MongoDB Atlas or Compass
db.devices.createIndex({ "_lastInform": -1 });
db.devices.createIndex({ "_deviceId.SerialNumber": 1 });
db.devices.createIndex({ "Device.GPS.Latitude": 1, "Device.GPS.Longitude": 1 });
```

### Caching

The application caches devices in Firestore:
- MongoDB → Source of truth (GenieACS data)
- Firestore → Cached copy (fast reads for PCI Mapper)
- Sync: Every 5 minutes (scheduled function)

## 💰 Cost Considerations

### MongoDB Atlas Free Tier (M0)
- ✅ 512MB storage
- ✅ Shared RAM
- ✅ No credit card required
- ✅ Perfect for development/testing

### Upgrade Options
- **M2** ($9/month): 2GB storage, 2GB RAM
- **M5** ($25/month): 5GB storage, 2GB RAM
- **M10** ($57/month): 10GB storage, 2GB RAM (production recommended)

### Firebase Functions
- **Free tier**: 2M invocations/month
- **Paid**: $0.40/million invocations after free tier

## 📚 Additional Resources

- [MongoDB Node.js Driver Documentation](https://www.mongodb.com/docs/drivers/node/current/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Connection String Format](https://www.mongodb.com/docs/manual/reference/connection-string/)

## ✅ Deployment Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user `genieacs-user` created with password
- [ ] Network access configured (0.0.0.0/0 for dev)
- [ ] Connection string updated in `apphosting.yaml` files
- [ ] Password replaced (no `<db_password>` placeholder)
- [ ] Dependencies installed (`npm install` in functions/)
- [ ] Functions built (`npm run build` in functions/)
- [ ] Deployed to Firebase (`firebase deploy`)
- [ ] Tested connection (sync and get devices)
- [ ] Sample data added to MongoDB
- [ ] Verified devices sync to Firestore

---

**🎉 You're now using MongoDB Atlas with the official npm driver!**

Your application has:
- ✅ Modern MongoDB driver (v6.20)
- ✅ Optimized connection handling
- ✅ Automatic retry and reconnection
- ✅ Type-safe database operations
- ✅ Production-ready configuration

