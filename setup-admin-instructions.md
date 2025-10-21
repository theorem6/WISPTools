# Setup Admin Access

You need to be set up as the owner/admin of your tenant to see User Management and Help Desk modules.

---

## 📋 Quick Fix - Using Firebase Console

### **Option 1: Direct Firestore Edit (Fastest - 2 minutes)**

1. **Open Firestore Console:**
   ```
   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore
   ```

2. **Get your User ID:**
   - Click `users` collection
   - Find your email
   - Copy the document ID (this is your `userId`)

3. **Get your Tenant ID:**
   - Click `tenants` collection
   - Find your tenant/organization
   - Copy the document ID (this is your `tenantId`)

4. **Create user_tenants document:**
   - Click `user_tenants` collection (create if doesn't exist)
   - Click "Add document"
   - **Document ID:** `{yourUserId}_{yourTenantId}` (example: `abc123_xyz789`)
   - **Add fields:**
     ```
     userId: {yourUserId}
     tenantId: {yourTenantId}
     role: "owner"
     status: "active"
     addedAt: {timestamp - click "Add field" → Type: timestamp → Value: now}
     ```
   - Click "Save"

5. **Refresh your browser**
   - Hard refresh (Ctrl+Shift+R)
   - User Management and Help Desk modules should appear!

---

## ✅ **Example:**

**If your userId is:** `abc123`  
**And tenantId is:** `xyz789`

**Create document:**
- **Collection:** `user_tenants`
- **Document ID:** `abc123_xyz789`
- **Fields:**
  ```
  userId: "abc123"
  tenantId: "xyz789"
  role: "owner"
  status: "active"
  addedAt: [current timestamp]
  ```

---

## 🔐 **What This Does:**

- Makes you the **owner** of the tenant
- Grants access to **all modules**
- Allows you to:
  - ✅ Invite other users
  - ✅ Manage user roles
  - ✅ Configure module access
  - ✅ Access User Management module
  - ✅ Access Help Desk module
  - ✅ Full administrative control

---

## 🧪 **Verify It Worked:**

After creating the user_tenants document:

1. **Refresh browser** (Ctrl+Shift+R)
2. **Check dashboard** - should see:
   - 👥 User Management
   - 🎧 Help Desk
3. **Click User Management** - should load successfully
4. **You should see yourself listed** as Owner

---

## 📞 **Alternative: Script Method**

If you prefer scripting:

1. **Download service account key:**
   - Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Save as `functions/service-account-key.json`

2. **Run setup script:**
   ```powershell
   cd scripts/database
   node setup-tenant-admin.js
   ```

---

## 🎯 **Quick Checklist:**

- [ ] Open Firestore Console
- [ ] Find your userId from `users` collection
- [ ] Find your tenantId from `tenants` collection
- [ ] Create `user_tenants/{userId}_{tenantId}` document
- [ ] Set role to "owner"
- [ ] Set status to "active"
- [ ] Refresh browser
- [ ] See User Management module ✅

**This takes 2 minutes and you'll have full access!** 🚀

