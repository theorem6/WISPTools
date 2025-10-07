# 🚀 Quick Deploy Guide - MongoDB npm Driver

## ⚡ 3 Steps to Deploy

### Step 1: Set MongoDB Password (2 minutes)

Run the password setup script:

**Linux/Mac/Firebase Web IDE:**
```bash
chmod +x set-mongodb-password.sh
./set-mongodb-password.sh
```

**Windows PowerShell:**
```powershell
.\set-mongodb-password.ps1
```

**Or manually edit these files and replace `<db_password>`:**
- `apphosting.yaml`
- `apphosting.staging.yaml`
- `apphosting.development.yaml`

Your password: (from MongoDB Atlas → Database Access → genieacs-user)

### Step 2: Install Dependencies (1 minute)

```bash
cd functions
npm install
cd ..
```

This installs MongoDB Driver v6.20.0 from npm.

### Step 3: Deploy! (2 minutes)

```bash
firebase deploy
```

## ✅ Test Your Deployment

### Test MongoDB Connection:
```bash
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices
```

### Test Get Devices:
```bash
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

## 📚 Need More Details?

See **`MONGODB_NPM_DEPLOYMENT.md`** for:
- Complete MongoDB Atlas setup
- Troubleshooting guide
- Performance optimization
- Security best practices

## 🔗 Your MongoDB Connection

```
Cluster: cluster0.1radgkw.mongodb.net
Username: genieacs-user
Driver: MongoDB Node.js v6.20
Connection: mongodb+srv://
```

---

**Total time: ~5 minutes** ⏱️

Using official [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/) from npm!

