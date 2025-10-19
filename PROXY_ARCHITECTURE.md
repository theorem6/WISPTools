# Cloud Function Proxy Architecture

## 🔄 **Current Proxy Setup**

### **Single Unified Proxy: `hssProxy`**

Despite the name, `hssProxy` is a **universal backend proxy** that routes ALL API requests to the GCE VM backend.

**What it handles:**
- `/api/inventory/*` → Inventory Management
- `/api/network/*` → Coverage Map (sites, sectors, CPE, backhaul)
- `/dashboard/*` → HSS Dashboard stats
- `/subscribers/*` → HSS Subscriber management
- `/groups` → HSS Groups
- `/bandwidth-plans` → HSS Bandwidth plans
- `/api/monitoring/*` → Monitoring & Alerts
- `/api/epc/*` → Distributed EPC
- `/api/system/*` → System Management

**Target:** `http://136.112.111.167:3001` (GCE VM Backend)

---

## 📡 **Why One Proxy?**

**Advantages:**
- ✅ Single point of authentication
- ✅ Unified error handling
- ✅ One Cloud Function to maintain
- ✅ Consistent CORS handling
- ✅ Simplified frontend (one API URL)

**Note:** Despite being named `hssProxy`, it's really a **universal backend proxy**.

---

## 🏗️ **Better Naming (Future Refactor)**

### **Option A: Rename to Generic**
```typescript
// Rename hssProxy → backendProxy or apiProxy
export const backendProxy = onRequest(...)
```

**Frontend Update:**
```typescript
const API_URL = '.../backendProxy'  // Clear it handles all backend
```

### **Option B: Module-Specific Proxies**
```typescript
export const inventoryProxy = onRequest(...)  // → /api/inventory/*
export const coverageMapProxy = onRequest(...) // → /api/network/*
export const hssProxy = onRequest(...)         // → /subscribers, /groups, etc.
```

**Frontend Update:**
```typescript
// Inventory
const API_URL = '.../inventoryProxy'

// Coverage Map  
const API_URL = '.../coverageMapProxy'
```

---

## 🎯 **Current Deployment Instructions**

### **For ANY Backend API Update:**

**Despite the module you're updating, ALL changes go through `hssProxy`:**

```bash
# In Firebase Web IDE
cd lte-pci-mapper/functions
git pull origin main
firebase deploy --only functions:hssProxy
```

**This updates:**
- ✅ Inventory API routing
- ✅ Coverage Map API routing
- ✅ HSS API routing
- ✅ ALL backend API routing

---

## 📝 **Why This Confusion Happened**

1. Started with HSS module (hence "hssProxy")
2. Added more modules (inventory, coverage map, monitoring)
3. Reused same proxy for simplicity
4. Name didn't get updated to reflect broader purpose

---

## ✅ **Current Status**

**Working Configuration:**
- **Proxy Name**: `hssProxy` (legacy name, but works)
- **Purpose**: Universal backend proxy
- **Target**: Port 3001 on GCE VM
- **Handles**: ALL backend APIs

**To reduce confusion, remember:**
- `hssProxy` = "Backend Proxy" (handles everything)
- Not just for HSS, despite the name

---

## 🔄 **If You Want to Rename (Optional)**

### **Step 1: Create New Proxy**
```typescript
// functions/src/index.ts
export const backendProxy = hssProxy;  // Alias
```

### **Step 2: Update Frontend**
```typescript
// All services
const API_URL = '.../backendProxy'
```

### **Step 3: Deploy Both**
```bash
firebase deploy --only functions:hssProxy,functions:backendProxy
```

### **Step 4: Migrate Frontend**
Update all service files to use backendProxy

### **Step 5: Remove Old**
```bash
firebase functions:delete hssProxy
```

**For now, just remember: `hssProxy` = Universal Backend Proxy** 🎯

---

*Document Purpose: Clarify proxy architecture and reduce deployment confusion*

