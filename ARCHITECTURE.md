# WISP Multitool - System Architecture

**Unified Data Architecture**  
**Date:** October 21, 2025

---

## 🎯 **Clear Separation of Concerns**

### **Firebase Auth - Authentication Only**
Used EXCLUSIVELY for user authentication and identity:
- ✅ User login (Google SSO, Microsoft SSO)
- ✅ Token generation and verification
- ✅ User identity (email, displayName, photoURL, phoneNumber)
- ✅ Session management
- ❌ NO business data stored here

### **MongoDB Atlas - All Business Data**
Used for ALL application data:
- ✅ User-tenant relationships (`user_tenants` collection)
- ✅ User roles and permissions
- ✅ Customers (`customers` collection)
- ✅ Work orders (`work_orders` collection)
- ✅ Inventory (`inventory` collection)
- ✅ Network data (`towerSites`, `sectors`, etc.)
- ✅ HSS subscribers (`subscribers` collection)
- ✅ Service history, complaints, billing
- ✅ ALL queryable, reportable business data

---

## 🔐 **Authentication Flow**

```
1. User logs in via Firebase Auth (Google/Microsoft)
   ↓
2. Firebase Auth returns UID and token
   ↓
3. Frontend stores token, sends with every API request
   ↓
4. Backend verifies token with Firebase Admin SDK
   ↓
5. Backend looks up user's role in MongoDB (UserTenant collection)
   ↓
6. Backend authorizes request based on role
   ↓
7. Backend returns data from MongoDB
```

---

## 🗄️ **Database Structure**

### **Firebase Auth (Identity Only)**
```
Users (managed by Firebase):
  - UID (unique identifier)
  - email
  - displayName
  - photoURL  
  - phoneNumber
  - emailVerified
  - metadata (created, lastSignIn)
```

### **MongoDB Atlas (All Business Data)**

#### **user_tenants Collection**
```javascript
{
  _id: ObjectId(),
  userId: "firebase-uid-abc123",     // Links to Firebase Auth
  tenantId: "tenant-xyz789",
  role: "owner" | "admin" | "engineer" | "installer" | "helpdesk" | "viewer",
  status: "active" | "suspended" | "pending_invitation",
  moduleAccess: { /* custom permissions */ },
  invitedBy: "firebase-uid-...",
  invitedAt: Date,
  acceptedAt: Date,
  addedAt: Date,
  lastAccessAt: Date
}
```

#### **customers Collection**
```javascript
{
  _id: ObjectId(),
  tenantId: String,
  customerId: "CUST-2025-0001",
  firstName: String,
  lastName: String,
  primaryPhone: String,
  email: String,
  serviceAddress: {
    street, city, state, zipCode,
    latitude, longitude,    // For map display
    gateCode, directions
  },
  serviceStatus: "active" | "pending" | "suspended",
  installation: {
    status: "completed" | "scheduled" | "in-progress",
    installedBy: "firebase-uid-...",
    completedDate: Date,
    cpeSerialNumber: String
  },
  networkInfo: {
    imsi: String,           // Links to HSS
    cpeSerialNumber: String // Links to ACS
  },
  serviceHistory: [{
    date, type, description, technician, workOrderId
  }],
  complaints: [{
    date, category, description, priority, status, workOrderId
  }]
}
```

#### **work_orders Collection**
```javascript
{
  _id: ObjectId(),
  tenantId: String,
  ticketNumber: "TKT-2025-0001",
  type: "installation" | "repair" | "troubleshoot",
  priority: "critical" | "high" | "medium" | "low",
  status: "open" | "assigned" | "in-progress" | "resolved",
  assignedTo: "firebase-uid-...",    // Links to Firebase Auth
  title: String,
  description: String,
  affectedCustomers: [{
    customerId: "CUST-2025-0001"     // Links to customers collection
  }],
  affectedSites: [{
    siteId: String                    // Links to coverage map
  }],
  createdAt: Date,
  createdBy: "firebase-uid-..."
}
```

---

## 🔄 **Data Relationships**

### **Users → Tenants**
```
Firebase Auth User (UID: abc123)
  ↓
MongoDB user_tenants:
  - { userId: "abc123", tenantId: "tenant1", role: "owner" }
  - { userId: "abc123", tenantId: "tenant2", role: "admin" }
```

### **Customers → Network Equipment**
```
MongoDB Customer
  ↓
  networkInfo.imsi → HSS Subscriber (MongoDB)
  networkInfo.cpeSerialNumber → ACS Device (MongoDB)
  serviceAddress.lat/lng → Coverage Map pin
```

### **Work Orders → Everything**
```
MongoDB Work Order
  ↓
  assignedTo → Firebase Auth User
  affectedCustomers → MongoDB Customers
  affectedSites → MongoDB Tower Sites
  affectedEquipment → MongoDB Inventory
```

---

## 📋 **What Goes Where**

| Data Type | Storage | Reason |
|-----------|---------|--------|
| **User Identity** | Firebase Auth | SSO integration, secure auth |
| **User Roles** | MongoDB | Business logic, queryable |
| **Customers** | MongoDB | Business data, reporting |
| **Work Orders** | MongoDB | Business data, reporting |
| **Inventory** | MongoDB | Business data, tracking |
| **HSS Subscribers** | MongoDB | Business data, billing |
| **Network Equipment** | MongoDB | Business data, operations |
| **Service History** | MongoDB | Business data, analytics |
| **Complaints** | MongoDB | Business data, tracking |
| **Billing** | MongoDB | Business data, reporting |

---

## 🔧 **Backend API Pattern**

Every API endpoint follows this pattern:

```javascript
router.get('/endpoint', async (req, res) => {
  try {
    // 1. Verify Firebase Auth token (via middleware)
    const userId = req.user.uid;           // From Firebase token
    const tenantId = req.tenantId;         // From header
    
    // 2. Check role/permissions in MongoDB
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    const hasPermission = checkPermission(userTenant.role, 'someAction');
    
    // 3. Query business data from MongoDB
    const data = await SomeModel.find({ tenantId });
    
    // 4. Return data
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## ✅ **Benefits of This Architecture**

1. **Single Sign-On** - Firebase Auth supports Google, Microsoft, Apple, etc.
2. **Unified Data** - All business data in MongoDB Atlas for easy queries
3. **Scalability** - MongoDB handles millions of records efficiently
4. **Reporting** - Can run complex aggregations across all data
5. **Consistency** - All modules use same database
6. **Security** - Firebase tokens verified, MongoDB enforces tenant isolation

---

## 🚀 **Implementation Status**

### **✅ Correctly Implemented:**
- Inventory API (MongoDB)
- Work Orders API (MongoDB)
- Customer API (MongoDB)
- Network API (MongoDB)
- HSS API (MongoDB)

### **🔄 Being Updated:**
- User Management API (MongoDB for data, Firebase for auth)
- Role Auth Middleware (MongoDB for roles, Firebase for tokens)

---

## 📦 **Required NPM Packages on Backend**

```bash
npm install firebase-admin    # For Firebase token verification
npm install mongoose          # For MongoDB Atlas
npm install express cors
```

---

## 🌐 **Connection Strings**

**.env file on backend:**
```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/wisp-multitool
FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71
PORT=3001
```

---

**This architecture gives you the best of both worlds:**
- 🔐 **Firebase Auth** - Easy SSO login
- 🗄️ **MongoDB Atlas** - Powerful business data storage

All code will be updated to follow this pattern consistently! 🎯

