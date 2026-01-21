# Customer Form Field Verification

## ✅ Service Type Field Location

The **Service Type** field is located in the **Basic Information** section of the customer form, right after the **Service Status** field.

### Form Structure:

1. **👤 Basic Information** (Always visible)
   - First Name *
   - Last Name *
   - Primary Phone *
   - Alternate Phone
   - Email
   - **Service Status** ← Dropdown
   - **Service Type** ← **HERE!** (Dropdown with options: 4G/5G, FWA, WiFi, Fiber)

2. **📍 Service Address**

3. **💳 Billing Address**

4. **📡 Service Plan**
   - Plan Name
   - Download (Mbps)
   - Upload (Mbps)
   - Monthly Fee ($)
   - **QCI, Max Bandwidth, Data Quota, Priority** (only shows if Service Type = 4G/5G)

5. **🔐 LTE/5G Authentication** (only shows if Service Type = 4G/5G)
   - IMSI
   - MSISDN
   - Ki
   - OPc
   - OP (optional)
   - SQN

6. **🔌 MAC Address** (Optional)

7. **📡 HSS Subscriber** (Only visible when editing existing customer, collapsible)

---

## 🔍 How to Verify

1. **Clear Browser Cache:**
   - Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
   - Clear cached images and files
   - Or do a hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

2. **Navigate to Customer Form:**
   - Go to: https://wisptools-production.web.app
   - Navigate to: **Customers** module
   - Click: **Add Customer** button

3. **Look for Service Type:**
   - Scroll to the **Basic Information** section
   - After **Service Status** dropdown
   - You should see **Service Type** dropdown with options:
     - Select Service Type (default)
     - 4G/5G (LTE/5G)
     - FWA (Fixed Wireless Access)
     - WiFi
     - Fiber

---

## 📋 Expected Behavior

### When Service Type is NOT selected:
- Service Plan shows basic fields only
- LTE/5G Authentication section is hidden
- MAC Address section is visible

### When Service Type = "4G/5G":
- Service Plan shows additional QoS fields (QCI, Max Bandwidth, Data Quota, Priority)
- LTE/5G Authentication section appears
- MAC Address section is visible

### When Service Type = "FWA", "WiFi", or "Fiber":
- Service Plan shows basic fields only
- LTE/5G Authentication section is hidden
- MAC Address section is visible

---

## 🐛 If Service Type Field is Missing

If you still don't see the Service Type field after clearing cache:

1. **Check Browser Console:**
   - Press `F12` to open DevTools
   - Look for any JavaScript errors
   - Check if the component is loading correctly

2. **Verify Deployment:**
   - Check: https://console.firebase.google.com/project/wisptools-production/hosting
   - Verify latest deployment timestamp
   - Should show deployment from today

3. **Check Network Tab:**
   - In DevTools, go to Network tab
   - Reload page
   - Check if `AddEditCustomerModal.svelte` or related JS files are loading
   - Verify they're not cached (should show 200 status, not 304)

4. **Try Incognito/Private Mode:**
   - Open browser in incognito/private mode
   - Navigate to the site
   - This bypasses all cache

---

## ✅ Deployment Status

- **Frontend Build:** ✅ Completed (Jan 21, 2026)
- **Firebase Deployment:** ✅ Completed (1230 files deployed)
- **Service Type Field:** ✅ Present in code (line 498-507)
- **LTE Auth Fields:** ✅ Present in code (conditional, shows when Service Type = 4G/5G)
- **MAC Address Field:** ✅ Present in code

---

## 📝 Code Reference

**File:** `Module_Manager/src/routes/modules/customers/components/AddEditCustomerModal.svelte`

**Service Type Field:** Lines 498-507
```svelte
<div class="form-group">
  <label>Service Type</label>
  <select bind:value={formData.serviceType}>
    <option value={undefined}>Select Service Type</option>
    <option value="4G/5G">4G/5G (LTE/5G)</option>
    <option value="FWA">FWA (Fixed Wireless Access)</option>
    <option value="WiFi">WiFi</option>
    <option value="Fiber">Fiber</option>
  </select>
</div>
```

**LTE Authentication Section:** Lines 638-700+ (conditional, shows when `formData.serviceType === '4G/5G'`)
