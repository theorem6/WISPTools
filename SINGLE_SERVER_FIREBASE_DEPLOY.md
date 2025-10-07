# 🔥 Single-Server Firebase Deployment Guide

## ✅ YES - Everything Runs on Firebase!

Your entire platform (Module Manager + PCI + GenieACS) runs on **Firebase infrastructure only**. No separate VPS needed!

---

## 🏗️ Architecture (All Firebase)

```
┌─────────────────────────────────────────────────────────┐
│  Firebase Platform (Google Cloud)                       │
│  ├── 🌐 Hosting: Module Manager Web App                │
│  ├── 🔥 Functions: Backend Services (Node.js 20)       │
│  │   ├── GenieACS CWMP (TR-069)                        │
│  │   ├── GenieACS NBI (REST API)                       │
│  │   ├── GenieACS File Server                          │
│  │   └── CPE Device Sync                               │
│  ├── 🗄️ Firestore: User data, networks, cells         │
│  ├── 🔐 Auth: User authentication                      │
│  └── 📦 Storage: File uploads                          │
└────────────┬────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────┐
│  MongoDB Atlas (Cloud Database - Free Tier)             │
│  └── 📊 GenieACS Data: devices, tasks, presets         │
└─────────────────────────────────────────────────────────┘
```

**Your MongoDB:** `mongodb+srv://genieacs-user:***@cluster0.1radgkw.mongodb.net/genieacs`

---

## 🚀 Simple Deployment (Everything at Once)

### **Prerequisites:**
- ✅ Firebase CLI installed: `npm install -g firebase-tools`
- ✅ Logged in to Firebase: `firebase login`
- ✅ MongoDB Atlas already set up ✅ (You have this!)

### **One-Command Deploy:**

```bash
# From root directory
cd Module_Manager
npm run build
cd ..
firebase deploy
```

**That's it!** This deploys:
- ✅ Module Manager web app (Hosting)
- ✅ GenieACS services (Functions)
- ✅ Database rules (Firestore)
- ✅ Storage rules

---

## 📋 What Gets Deployed

### **1. Web Application (Firebase Hosting)**
```
https://lte-pci-mapper-65450042-bbf71.web.app
```
- Module Manager dashboard
- PCI Resolution module
- Future modules

### **2. Backend Services (Firebase Functions)**
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/
```

**Available endpoints:**
- `/syncCPEDevices` - Sync devices from MongoDB to Firestore
- `/getCPEDevices` - Get all CPE devices
- `/getCPEDevice` - Get single device
- `/genieacsNBI` - GenieACS Northbound Interface API
- `/genieacsFS` - GenieACS File Server
- `/scheduledCPESync` - Auto-sync (every 5 minutes)

### **3. Database (Firestore + MongoDB Atlas)**
- **Firestore**: User data, networks, PCI analysis
- **MongoDB Atlas**: GenieACS device data (you already have this)

---

## 🔧 Environment Configuration

Your MongoDB connection is already embedded in the code:
```
mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs
```

**Optionally**, you can override it:
```bash
firebase functions:config:set mongodb.connection_url="your-custom-connection-string"
```

But it's **not required** - the default works!

---

## 🎯 Testing After Deployment

### **Test Web App:**
```bash
# Open in browser
https://lte-pci-mapper-65450042-bbf71.web.app
```

### **Test GenieACS Functions:**
```bash
# Test device sync
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices

# Test get devices
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

---

## 💰 Cost Breakdown

### **Free Tier (Default):**
- ✅ Firebase Hosting: 10GB storage, 360MB/day transfer
- ✅ Firebase Functions: 2M invocations/month, 400K GB-seconds
- ✅ Firestore: 50K reads, 20K writes, 1GB storage/day
- ✅ MongoDB Atlas: M0 cluster (512MB RAM, 10GB storage)

**Total: $0/month** for development and small production use!

### **Paid Tier (if needed):**
- Firebase Blaze Plan: Pay-as-you-go (typically $5-20/month for small apps)
- MongoDB Atlas: M10 ($57/month) or M2 ($9/month) for production

---

## 🔥 Deployment Commands

### **Full Deploy:**
```bash
cd Module_Manager
npm run build
cd ..
firebase deploy
```

### **Deploy Only Web App:**
```bash
cd Module_Manager
npm run build
cd ..
firebase deploy --only hosting
```

### **Deploy Only Functions:**
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### **Deploy Only Database Rules:**
```bash
firebase deploy --only firestore:rules,storage:rules
```

---

## ✅ Summary

**YES, everything runs on Firebase!**

- ✅ **No VPS needed**
- ✅ **No server IP addresses**
- ✅ **Firebase gives you the URL**
- ✅ **MongoDB Atlas is cloud-hosted**
- ✅ **GenieACS services run as Firebase Functions**
- ✅ **All managed, auto-scaling, highly available**

---

## 🚀 Ready to Deploy?

Just run:
```bash
cd Module_Manager
npm run build
cd ..
firebase deploy
```

**Your entire platform will be live on Firebase!** 🎉

