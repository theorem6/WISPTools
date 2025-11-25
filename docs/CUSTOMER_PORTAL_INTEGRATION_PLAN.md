# Customer Portal Integration Plan

**Date:** December 2024  
**Purpose:** Integrate customer-facing portal into customer module, tied to maintain module's ticketing system

---

## 🎯 Integration Overview

### **Key Requirements:**
1. ✅ Customer portal in `/modules/customers/portal/`
2. ✅ Uses maintain module's ticketing system (`workOrderService`)
3. ✅ Brandable by WISP (logo, colors, messaging)
4. ✅ Customers can only see their own tickets
5. ✅ Seamless integration with existing systems

---

## 🏗️ Architecture

### **Module Structure**

```
/modules/customers/
  ├── +page.svelte              # WISP view: Customer management
  ├── components/
  │   ├── AddEditCustomerModal.svelte
  │   └── CustomerPortalLink.svelte  # NEW: Link to customer portal
  └── portal/                    # NEW: Customer-facing portal
      ├── +layout.svelte         # Branded layout
      ├── +page.svelte           # Landing/login
      ├── login/
      ├── signup/
      ├── dashboard/
      └── tickets/               # Uses maintain module's tickets
          ├── +page.svelte       # List (filtered by customer)
          ├── new/
          └── [id]/
```

### **Data Flow**

```
Customer Portal → customerPortalService → workOrderService → maintain module API
                                                              ↓
                                                         MongoDB (work_orders)
```

**Key Point:** Customer portal is a filtered view of the maintain module's ticket system.

---

## 🔗 Integration Points

### **1. Ticket System Integration**

**Reuse Existing:**
- `workOrderService.ts` - Ticket CRUD operations
- `work-orders-api.js` - Backend API
- `work-order.js` model - Database schema

**Add Customer Filtering:**
```typescript
// customerPortalService.ts
export class CustomerPortalService {
  // Wraps workOrderService with customer filtering
  async getCustomerTickets(customerId: string): Promise<WorkOrder[]> {
    const allTickets = await workOrderService.getWorkOrders();
    // Filter to only this customer's tickets
    return allTickets.filter(ticket => 
      ticket.affectedCustomers?.some(c => c.customerId === customerId) ||
      ticket.customerReported === true && 
      ticket.customerContact?.email === currentCustomer.email
    );
  }
}
```

### **2. Maintain Module Connection**

**Backend API Enhancement:**
```javascript
// backend-services/routes/work-orders-api.js

// Add customer filtering middleware
const requireCustomerAuth = async (req, res, next) => {
  // Verify customer authentication
  // Extract customerId from token
  // Attach to request
  req.customerId = customerId;
  next();
};

// Customer portal endpoints (filtered)
router.get('/customer/:customerId', requireCustomerAuth, async (req, res) => {
  const { customerId } = req.params;
  // Verify customer owns this ID
  if (req.customerId !== customerId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Get tickets for this customer only
  const tickets = await WorkOrder.find({
    tenantId: req.tenantId,
    $or: [
      { 'affectedCustomers.customerId': customerId },
      { customerReported: true, 'customerContact.email': customer.email }
    ]
  });
  
  res.json(tickets);
});
```

### **3. Customer Module Integration**

**Add Portal Link in Customer Module:**
```svelte
<!-- Module_Manager/src/routes/modules/customers/+page.svelte -->
<!-- Add to customer row -->
<button on:click={() => openCustomerPortal(customer.customerId)}>
  Open Customer Portal
</button>

<!-- Or generate portal link -->
<a href="/modules/customers/portal?customer={customer.customerId}">
  Customer Portal Link
</a>
```

---

## 🎨 Branding Integration

### **Tenant Branding Schema**

**Add to:** `backend-services/models/tenant.js`

```javascript
// Add branding to tenant schema
branding: {
  // Logo & Visual
  logo: {
    url: String,
    altText: String,
    favicon: String
  },
  
  // Colors
  colors: {
    primary: { type: String, default: '#3b82f6' },
    secondary: String,
    accent: String,
    background: String,
    text: String
  },
  
  // Company Info
  company: {
    name: String,
    displayName: String,
    supportEmail: String,
    supportPhone: String,
    supportHours: String,
    website: String
  },
  
  // Portal Settings
  portal: {
    welcomeMessage: String,
    footerText: String,
    customCSS: String,
    enableCustomDomain: Boolean,
    customDomain: String
  }
}
```

### **Branding API**

**New File:** `backend-services/routes/branding-api.js`

```javascript
// Get tenant branding (public, for customer portal)
GET    /api/tenant/:tenantId/branding

// Update branding (admin only)
PUT    /api/tenant/:tenantId/branding
POST   /api/tenant/:tenantId/branding/logo
```

---

## 🔐 Customer Authentication Flow

### **Customer Account Linking**

```javascript
// Customer Schema Addition (backend-services/models/customer.js)
CustomerSchema.add({
  // Authentication
  firebaseUid: { 
    type: String, 
    unique: true, 
    sparse: true, 
    index: true 
  },
  accountCreatedAt: Date,
  lastLoginAt: Date,
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'locked'],
    default: 'pending'
  },
  
  // Portal Access
  portalAccess: {
    enabled: { type: Boolean, default: true },
    accessCode: String,        // For account linking
    accessCodeExpires: Date
  }
});
```

### **Authentication Service**

**New File:** `Module_Manager/src/lib/services/customerAuthService.ts`

```typescript
export class CustomerAuthService {
  // Login with customer ID/phone + password
  async login(identifier: string, password: string): Promise<CustomerAuthResult> {
    // 1. Find customer by ID or phone
    // 2. Verify Firebase Auth
    // 3. Return customer data
  }
  
  // Sign up - link customer to Firebase account
  async signUp(customerId: string, phone: string, password: string): Promise<CustomerAuthResult> {
    // 1. Verify customer exists
    // 2. Create Firebase Auth account
    // 3. Link Firebase UID to Customer record
    // 4. Create UserTenant record with role='customer'
  }
  
  // Get current customer from Firebase UID
  async getCurrentCustomer(): Promise<Customer | null> {
    const user = authService.getCurrentUser();
    if (!user) return null;
    
    // Find customer by firebaseUid
    return await customerService.getCustomerByFirebaseUid(user.uid);
  }
}
```

---

## 📋 Implementation Checklist

### **Week 1: Foundation & Branding**
- [ ] Add branding schema to tenant model
- [ ] Create branding API endpoints
- [ ] Build branded layout component (`customers/portal/+layout.svelte`)
- [ ] Implement dynamic CSS variables for branding
- [ ] Create branding management UI (for WISP admins)

### **Week 2: Customer Authentication**
- [ ] Add `firebaseUid` to customer schema
- [ ] Create `customerAuthService.ts`
- [ ] Build customer login page
- [ ] Build customer sign-up page
- [ ] Implement account linking
- [ ] Password reset flow

### **Week 3: Ticket Integration**
- [ ] Create `customerPortalService.ts` (wraps `workOrderService`)
- [ ] Build customer ticket list page (filtered view)
- [ ] Build create ticket page (uses maintain module)
- [ ] Build ticket details page (customer view)
- [ ] Add comment functionality
- [ ] File upload for tickets

### **Week 4: Service Info & Polish**
- [ ] Service information page
- [ ] Customer dashboard
- [ ] Support resources/FAQ
- [ ] Add portal link in customer module
- [ ] Mobile responsiveness
- [ ] Testing & bug fixes

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Customer Portal                                        │
│  /modules/customers/portal/                             │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Login/Signup │  │  Dashboard   │  │   Tickets    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│         customerAuthService│customerPortalService       │
└────────────────────────────┼────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│  Shared Services                                        │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ workOrderService │  │ customerService   │          │
│  └────────┬─────────┘  └────────┬─────────┘          │
└───────────┼──────────────────────┼─────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│  Backend APIs                                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │work-orders-  │  │customers-api  │  │branding-api  │ │
│  │api.js        │  │.js            │  │.js           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│  MongoDB                                                 │
│                                                          │
│  work_orders  │  customers  │  tenants (branding)       │
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 Branding Implementation

### **Dynamic Branding Application**

```svelte
<!-- Module_Manager/src/routes/modules/customers/portal/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService } from '$lib/services/brandingService';
  
  let branding = {
    logo: '',
    colors: { primary: '#3b82f6' },
    company: { name: '' }
  };
  
  onMount(async () => {
    if ($currentTenant) {
      await loadBranding();
      applyBranding();
    }
  });
  
  async function loadBranding() {
    branding = await brandingService.getTenantBranding($currentTenant.id);
  }
  
  function applyBranding() {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.colors.primary);
    root.style.setProperty('--brand-logo', `url('${branding.logo}')`);
    // ... more CSS variables
  }
</script>

<style>
  :global(:root) {
    --brand-primary: var(--brand-primary, #3b82f6);
    --brand-secondary: var(--brand-secondary, #64748b);
  }
  
  .portal-header {
    background: var(--brand-primary);
  }
</style>
```

---

## 🔐 Security & Access Control

### **Customer Data Isolation**

```javascript
// Backend middleware
const requireCustomerAuth = async (req, res, next) => {
  // 1. Verify Firebase token
  const decodedToken = await auth.verifyIdToken(req.headers.authorization);
  const uid = decodedToken.uid;
  
  // 2. Get customer from Firebase UID
  const customer = await Customer.findOne({ firebaseUid: uid });
  if (!customer) {
    return res.status(403).json({ error: 'Not a customer account' });
  }
  
  // 3. Verify customer belongs to tenant
  if (customer.tenantId !== req.tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // 4. Attach customer to request
  req.customer = customer;
  req.customerId = customer.customerId;
  next();
};

// Ticket endpoints with customer filtering
router.get('/tickets', requireCustomerAuth, async (req, res) => {
  // Only return tickets for this customer
  const tickets = await WorkOrder.find({
    tenantId: req.tenantId,
    $or: [
      { 'affectedCustomers.customerId': req.customerId },
      { customerReported: true, 'customerContact.email': req.customer.email }
    ]
  });
  
  res.json(tickets);
});
```

---

## 📊 Integration Benefits

### **1. Code Reuse**
- ✅ Reuse `workOrderService` - no duplicate ticket logic
- ✅ Reuse `work-orders-api.js` - extend existing API
- ✅ Reuse ticket data model - consistent structure

### **2. Data Consistency**
- ✅ Single source of truth (maintain module)
- ✅ Customer portal is filtered view
- ✅ No data sync needed

### **3. Maintenance**
- ✅ Update ticket system once, both views benefit
- ✅ Shared bug fixes
- ✅ Consistent behavior

### **4. User Experience**
- ✅ WISP staff see full ticket system (maintain module)
- ✅ Customers see filtered view (customer portal)
- ✅ Same data, different views

---

## 🎯 Customer Portal Features

### **1. Ticket Management**
- View own tickets (filtered from maintain module)
- Create new tickets (creates work order in maintain module)
- Add comments to tickets
- Upload photos/files
- Track ticket status

### **2. Service Information**
- View service plan
- Service status
- Equipment details (CPE info)
- Installation history

### **3. Support Resources**
- FAQ
- Service status page
- Contact information
- Support hours

### **4. Branding**
- WISP logo
- Custom colors
- Custom messaging
- White-label experience

---

## 📋 Implementation Priority

### **Phase 1: MVP (2 weeks)**
1. Branding system (logo, colors)
2. Customer authentication
3. Ticket list (filtered view)
4. Create ticket
5. View ticket details

### **Phase 2: Enhanced (1 week)**
1. Service information page
2. Customer dashboard
3. File uploads
4. Email notifications

### **Phase 3: Polish (1 week)**
1. FAQ/Support resources
2. Mobile optimization
3. Advanced branding options
4. Custom domain support

---

## ✅ Success Criteria

1. ✅ Customers can log in and see only their tickets
2. ✅ Customers can create tickets that appear in maintain module
3. ✅ Portal is fully branded with WISP logo/colors
4. ✅ Seamless integration with maintain module
5. ✅ Good customer experience (easy to use)

**Total Timeline:** 3-4 weeks for complete implementation

