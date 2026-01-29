# Customer Portal Implementation Plan

**Date:** December 2024  
**Purpose:** Brandable customer-facing portal for complaints, reporting, and customer service

---

## ✅ Current Status (as of continuation)

- **Routes:** `/modules/customers/portal`, `/portal/login`, `/portal/signup`, `/portal/dashboard`, `/portal/tickets`, `/portal/tickets/new`, `/portal/tickets/[id]`, `/portal/service`, `/portal/faq`, `/portal/knowledge`, `/portal/live-chat` exist with placeholder or partial content.
- **Dashboard:** A **Customer Portal** card (active) links to `/modules/customers/portal` so staff can open the portal entry; landing redirects to login or dashboard based on customer auth.
- **Remaining:** Tenant branding (logo/colors) refinements; auth/tickets are wired. **Password reset:** Done – portal login "Forgot password?" opens inline form, calls `customerAuthService.requestPasswordReset(email)` → Firebase reset link to `/reset-password`.

---

## 📊 Executive Summary

**Overall Difficulty:** **Medium** (3-4 weeks development time)

**Goal:** Create a white-label customer portal where WISP customers can:
- Report issues/complaints
- View and track their tickets
- View service status
- Access support resources
- All branded with the WISP's logo, colors, and branding

---

## 🎯 Core Features

### **1. Customer Authentication**
- Customer login (email/phone + password)
- Customer account creation/linking
- Password reset
- Session management

### **2. Ticket/Complaint Management**
- Create new tickets/complaints
- View ticket history
- Track ticket status
- Add comments/updates
- Upload files/photos
- Receive notifications

### **3. Service Information**
- View service plan details
- Service status (active, suspended, etc.)
- Equipment information (CPE details)
- Installation history

### **4. Support Resources**
- FAQ/Knowledge Base
- Service status page
- Contact information
- Support hours

### **5. Branding System**
- WISP logo
- Custom colors
- Custom domain (optional)
- Custom messaging
- White-label experience

---

## 🏗️ Architecture Overview

### **URL Structure**

**Integrated with Customer Module:**
```
/modules/customers/portal/            # Customer portal landing/login
/modules/customers/portal/login        # Customer login
/modules/customers/portal/signup      # Customer account creation
/modules/customers/portal/dashboard   # Customer dashboard
/modules/customers/portal/tickets/    # Ticket list (from maintain module)
/modules/customers/portal/tickets/new # Create ticket (uses maintain module)
/modules/customers/portal/tickets/[id] # View ticket (from maintain module)
/modules/customers/portal/service      # Service information
/modules/customers/portal/support     # Support resources
```

**Alternative: Customer-Specific Portal**
```
/modules/customers/[customerId]/portal/  # Customer-specific portal view
```

**Integration Points:**
- Uses `workOrderService` from maintain module
- Shares ticket/work order data model
- Integrates with maintain module's ticket system
- Customer can only see their own tickets

### **Branding Subdomain (Optional)**
```
https://support.wisptools.io/          # Platform default
https://support.customerwisp.com/      # WISP custom domain
https://customerwisp.wisptools.io/    # Subdomain
```

---

## 🎨 Branding System Design

### **Tenant Branding Schema**

```javascript
// Add to tenant model
const tenantBrandingSchema = {
  // Logo & Visual Identity
  logo: {
    url: String,              // Logo image URL
    altText: String,          // Alt text for accessibility
    favicon: String           // Favicon URL
  },
  
  // Colors
  colors: {
    primary: String,          // Primary brand color (#3b82f6)
    secondary: String,        // Secondary color
    accent: String,           // Accent color
    background: String,       // Background color
    text: String,             // Primary text color
    textSecondary: String    // Secondary text color
  },
  
  // Typography
  typography: {
    fontFamily: String,       // Custom font (optional)
    headingFont: String,      // Heading font
    bodyFont: String          // Body font
  },
  
  // Company Information
  company: {
    name: String,             // Company name
    displayName: String,      // Display name (can be different)
    supportEmail: String,     // Support email
    supportPhone: String,     // Support phone
    supportHours: String,     // "Mon-Fri 8am-5pm EST"
    website: String,          // Company website
    address: String           // Physical address
  },
  
  // Portal Customization
  portal: {
    welcomeMessage: String,   // Custom welcome message
    footerText: String,       // Footer text
    customCSS: String,        // Additional CSS (optional)
    customDomain: String,     // Custom domain (optional)
    enableCustomDomain: Boolean
  },
  
  // Features
  features: {
    enableFAQ: Boolean,        // Show FAQ section
    enableServiceStatus: Boolean, // Show service status page
    enableLiveChat: Boolean,  // Enable live chat (future)
    enableKnowledgeBase: Boolean // Enable knowledge base
  }
};
```

---

## 🔐 Customer Authentication

### **Customer Account Linking**

**Approach:** Link Firebase Auth user to Customer record

```javascript
// Customer Schema Addition
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

### **Customer Sign-Up Flow**

**Option 1: Self-Service Sign-Up**
1. Customer visits portal
2. Enters customer ID or phone number
3. System verifies customer exists
4. Customer creates password
5. System creates Firebase Auth account
6. Links Firebase UID to Customer record
7. Customer can log in

**Option 2: Invitation-Based**
1. WISP sends invitation email with link
2. Customer clicks link (contains access code)
3. Customer sets password
4. System creates account and links

**Option 3: Phone Verification**
1. Customer enters phone number
2. System sends SMS verification code
3. Customer verifies code
4. Customer sets password
5. Account created

**Recommended:** **Option 1 (Self-Service) + Option 2 (Invitation)** - Support both

---

## 📋 Ticket/Complaint System

### **Ticket Creation Flow**

```javascript
// Customer creates ticket
POST /api/customer-portal/tickets
{
  customerId: string,        // From authenticated session
  title: string,
  description: string,
  category: 'slow-speed' | 'no-connection' | 'intermittent' | 
           'equipment-failure' | 'billing-issue' | 'other',
  priority: 'low' | 'medium' | 'high',  // Customer can't set critical
  attachments: File[]        // Photos, documents
}

// System creates work order
// Links to customer
// Sends notification to WISP support team
```

### **Ticket Status Updates**

- Customer receives email notifications
- Portal shows real-time status
- Customer can add comments
- Support team can respond
- Status history visible

---

## 🎨 Portal UI Components

### **1. Landing/Login Page**

```
┌─────────────────────────────────────────┐
│  [WISP LOGO]                            │
│                                         │
│  Welcome to [WISP Name] Support        │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │  Customer Portal Login           │  │
│  │                                  │  │
│  │  Email/Phone: [_____________]   │  │
│  │  Password:    [_____________]   │  │
│  │                                  │  │
│  │  [Login]  [Forgot Password?]     │  │
│  │                                  │  │
│  │  New Customer? [Create Account]  │  │
│  └─────────────────────────────────┘  │
│                                         │
│  Need Help? support@wisp.com           │
└─────────────────────────────────────────┘
```

### **2. Customer Dashboard**

```
┌─────────────────────────────────────────┐
│  [WISP LOGO]  Welcome, John Smith       │
│              [Logout]                   │
├─────────────────────────────────────────┤
│                                         │
│  Service Status: ✅ Active              │
│  Plan: 50/10 Mbps                       │
│  Next Billing: Jan 15, 2025             │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ Open Tickets│  │ Quick Links │      │
│  │     3       │  │             │      │
│  └─────────────┘  │ • New Ticket│      │
│                   │ • Service   │      │
│  ┌─────────────┐  │ • Support   │      │
│  │ Recent      │  └─────────────┘      │
│  │ Activity    │                       │
│  │             │                       │
│  └─────────────┘                       │
└─────────────────────────────────────────┘
```

### **3. Create Ticket Page**

```
┌─────────────────────────────────────────┐
│  Create Support Ticket                  │
├─────────────────────────────────────────┤
│                                         │
│  Category:                              │
│  ○ Slow Speed                           │
│  ○ No Connection                        │
│  ○ Intermittent Service                 │
│  ○ Equipment Issue                      │
│  ○ Billing Question                     │
│  ○ Other                                │
│                                         │
│  Title: [Brief description...]         │
│                                         │
│  Description:                           │
│  [Detailed description of the issue...]│
│  [_____________________________]        │
│  [_____________________________]        │
│                                         │
│  Attach Photos/Files:                   │
│  [📎 Choose Files]                      │
│                                         │
│  Priority:                              │
│  ○ Low - General question               │
│  ● Medium - Service issue               │
│  ○ High - Urgent problem                │
│                                         │
│  [Cancel]  [Submit Ticket]              │
└─────────────────────────────────────────┘
```

### **4. Ticket List Page**

```
┌─────────────────────────────────────────┐
│  My Support Tickets                     │
├─────────────────────────────────────────┤
│                                         │
│  🔴 High - No Internet Connection       │
│     Ticket #TKT-2025-001                │
│     Created: Jan 10, 2025               │
│     Status: In Progress                 │
│     [View Details]                      │
│                                         │
│  🟡 Medium - Slow Speed                 │
│     Ticket #TKT-2025-002               │
│     Created: Jan 8, 2025               │
│     Status: Open                        │
│     [View Details]                      │
│                                         │
│  ✅ Resolved - Billing Question         │
│     Ticket #TKT-2024-099               │
│     Resolved: Jan 5, 2025              │
│     [View Details]                      │
│                                         │
│  [+ New Ticket]                         │
└─────────────────────────────────────────┘
```

### **5. Ticket Details Page**

```
┌─────────────────────────────────────────┐
│  Ticket #TKT-2025-001                    │
│  No Internet Connection                 │
├─────────────────────────────────────────┤
│                                         │
│  Status: 🔴 In Progress                 │
│  Priority: High                         │
│  Created: Jan 10, 2025 2:30 PM         │
│                                         │
│  Description:                           │
│  Internet went down around 2 PM.        │
│  Tried rebooting router, no change.     │
│                                         │
│  [Photo 1] [Photo 2]                    │
│                                         │
│  ───────────────────────────────────   │
│                                         │
│  💬 Conversation                        │
│                                         │
│  You (Jan 10, 2:30 PM):                │
│  Internet went down...                  │
│                                         │
│  Support Team (Jan 10, 2:45 PM):       │
│  Thank you for reporting. We're         │
│  investigating and will update you     │
│  shortly.                               │
│                                         │
│  Support Team (Jan 10, 3:15 PM):       │
│  Issue identified. Technician          │
│  scheduled for tomorrow 10am-12pm.      │
│                                         │
│  ───────────────────────────────────   │
│                                         │
│  Add Comment:                           │
│  [Type your message...]                 │
│  [📎 Attach] [Send]                     │
└─────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### **1. Branding System**

**Location:** `Module_Manager/src/routes/modules/customers/portal/+layout.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  let branding = {
    logo: '',
    colors: {},
    company: {}
  };
  
  onMount(async () => {
    // Load tenant branding
    // Apply to page
  });
  
  $: if ($currentTenant) {
    loadBranding();
  }
  
  async function loadBranding() {
    // Fetch tenant branding from API
    // Apply CSS variables
    // Set logo, colors, etc.
  }
</script>

<style>
  :global(:root) {
    --brand-primary: {branding.colors.primary || '#3b82f6'};
    --brand-secondary: {branding.colors.secondary || '#64748b'};
    --brand-logo: url('{branding.logo}');
  }
</style>
```

### **2. Customer Authentication Service**

**New File:** `Module_Manager/src/lib/services/customerAuthService.ts`

```typescript
export class CustomerAuthService {
  // Customer login (email/phone + password)
  async login(identifier: string, password: string): Promise<CustomerAuthResult>
  
  // Customer sign-up (customerId/phone + password)
  async signUp(customerId: string, phone: string, password: string): Promise<CustomerAuthResult>
  
  // Link existing customer to Firebase account (via access code)
  async linkCustomerAccount(accessCode: string, password: string): Promise<CustomerAuthResult>
  
  // Password reset
  async requestPasswordReset(identifier: string): Promise<void>
  
  // Get current customer (from Firebase UID)
  async getCurrentCustomer(): Promise<Customer | null>
  
  // Check if user is customer (vs WISP staff)
  async isCustomerUser(): Promise<boolean>
}
```

### **2.1 Customer Portal Service**

**New File:** `Module_Manager/src/lib/services/customerPortalService.ts`

```typescript
import { workOrderService } from './workOrderService'; // Reuse existing service

export class CustomerPortalService {
  // Get customer's tickets (filters workOrderService results)
  async getCustomerTickets(customerId: string): Promise<WorkOrder[]>
  
  // Create ticket (uses workOrderService, auto-links to customer)
  async createCustomerTicket(customerId: string, ticketData: CreateTicketData): Promise<WorkOrder>
  
  // Get ticket (ensures customer owns it)
  async getCustomerTicket(customerId: string, ticketId: string): Promise<WorkOrder>
  
  // Add comment to ticket (customer can only comment, not change status)
  async addTicketComment(customerId: string, ticketId: string, comment: string): Promise<void>
  
  // Upload attachment
  async uploadTicketAttachment(customerId: string, ticketId: string, file: File): Promise<string>
}
```

### **3. Customer Portal API**

**Integration with Existing APIs:**

**Extend Work Order API** (`backend-services/routes/work-orders-api.js`):
```javascript
// Customer Portal Endpoints (filtered by customer)
GET    /api/work-orders/customer/:customerId     // List customer's tickets
POST   /api/work-orders/customer/:customerId     // Create ticket (customer)
GET    /api/work-orders/customer/:customerId/:id // Get ticket (customer view)
POST   /api/work-orders/customer/:customerId/:id/comments // Add comment
POST   /api/work-orders/customer/:customerId/:id/upload   // Upload attachment
```

**New Customer Portal API** (`backend-services/routes/customer-portal-api.js`):
```javascript
// Customer Authentication
POST   /api/customer-portal/auth/login
POST   /api/customer-portal/auth/signup
POST   /api/customer-portal/auth/link-account
POST   /api/customer-portal/auth/reset-password
GET    /api/customer-portal/auth/me

// Service Information
GET    /api/customer-portal/service              // Get customer service info
GET    /api/customer-portal/service/status       // Get service status

// Support Resources
GET    /api/customer-portal/support/faq          // Get FAQ
GET    /api/customer-portal/support/status       // Service status page
```

**Note:** Ticket endpoints use existing work-order API but with customer filtering middleware

### **4. Branding API**

**New Endpoints:**
```javascript
GET    /api/tenant/:tenantId/branding            // Get tenant branding
PUT    /api/tenant/:tenantId/branding            // Update branding (admin only)
POST   /api/tenant/:tenantId/branding/logo       // Upload logo
```

---

## 📁 File Structure

```
Module_Manager/src/routes/modules/
  customers/
    +page.svelte                        # Existing customer management (WISP view)
    portal/                              # NEW: Customer-facing portal
      +layout.svelte                    # Portal layout with branding
      +page.svelte                      # Landing/login page
      login/
        +page.svelte                    # Customer login
      signup/
        +page.svelte                    # Customer account creation
      dashboard/
        +page.svelte                    # Customer dashboard
      tickets/
        +page.svelte                    # Ticket list (from maintain module)
        new/
          +page.svelte                  # Create ticket (uses maintain module)
        [id]/
          +page.svelte                  # Ticket details (from maintain module)
      service/
        +page.svelte                    # Service information
      support/
        +page.svelte                    # Support resources
        faq/
          +page.svelte                  # FAQ page
      components/
        BrandedHeader.svelte            # Branded header component
        BrandedFooter.svelte            # Branded footer
        CustomerTicketCard.svelte      # Ticket card (customer view)
        ServiceStatusCard.svelte        # Service status card
        FileUpload.svelte                # File upload component
    components/
      AddEditCustomerModal.svelte       # Existing
      CustomerPortalLink.svelte         # NEW: Link to customer portal (WISP view)

  maintain/
    +page.svelte                        # Existing maintain module (WISP view)
    # Uses workOrderService - shared with customer portal

Module_Manager/src/lib/
  services/
    customerAuthService.ts              # NEW: Customer authentication
    customerPortalService.ts            # NEW: Portal API calls (wraps workOrderService)
    brandingService.ts                  # NEW: Branding management
    workOrderService.ts                 # EXISTING: Shared with maintain module
  components/
    customer-portal/
      BrandedLayout.svelte              # NEW: Reusable branded layout
      CustomerNav.svelte                # NEW: Customer navigation
      CustomerTicketList.svelte         # NEW: Customer ticket list view

backend-services/
  routes/
    customer-portal-api.js              # NEW: Customer portal API (extends work-order-api)
    branding-api.js                     # NEW: Branding API
    work-orders-api.js                  # EXISTING: Shared ticket API
  models/
    tenant-branding.js                  # NEW: Branding schema
    work-order.js                       # EXISTING: Shared ticket model
```

---

## 🎨 Branding Implementation

### **Dynamic CSS Variables**

```javascript
// Apply branding on portal load
function applyBranding(branding) {
  const root = document.documentElement;
  
  // Colors
  root.style.setProperty('--brand-primary', branding.colors.primary);
  root.style.setProperty('--brand-secondary', branding.colors.secondary);
  root.style.setProperty('--brand-accent', branding.colors.accent);
  root.style.setProperty('--brand-background', branding.colors.background);
  root.style.setProperty('--brand-text', branding.colors.text);
  
  // Typography
  if (branding.typography.fontFamily) {
    root.style.setProperty('--brand-font-family', branding.typography.fontFamily);
  }
}
```

### **Logo Display**

```svelte
{#if branding.logo}
  <img 
    src={branding.logo} 
    alt={branding.company.name || 'Logo'}
    class="brand-logo"
  />
{:else}
  <div class="brand-logo-text">
    {branding.company.name || 'WISP Support'}
  </div>
{/if}
```

---

## 🔐 Security Considerations

### **1. Customer Data Isolation**
- Customers can only see their own tickets
- Strict tenant isolation
- No access to other customers' data
- API validates customer ownership

### **2. Authentication Security**
- Strong password requirements
- Rate limiting on login attempts
- Session timeout
- Email verification
- Optional 2FA (future)

### **3. File Upload Security**
- File type validation
- File size limits
- Virus scanning (optional)
- Secure storage (Firebase Storage)

---

## 📋 Implementation Checklist

### **Week 1: Foundation**
- [ ] Create customer portal route structure
- [ ] Implement branding system (database schema)
- [ ] Create branding API endpoints
- [ ] Build branded layout component
- [ ] Implement dynamic CSS variables

### **Week 2: Authentication**
- [ ] Create customer authentication service
- [ ] Build login page
- [ ] Build sign-up page
- [ ] Implement account linking
- [ ] Password reset flow
- [ ] Customer session management

### **Week 3: Ticket System**
- [ ] Create ticket list page
- [ ] Create ticket details page
- [ ] Build create ticket form
- [ ] Implement file upload
- [ ] Add comment functionality
- [ ] Email notifications

### **Week 4: Service Info & Polish**
- [ ] Service information page
- [ ] Support resources page
- [ ] FAQ system
- [ ] Dashboard page
- [ ] Mobile responsiveness
- [ ] Testing & bug fixes

---

## 🎯 Customer Experience Features

### **1. Real-Time Updates**
- WebSocket or polling for ticket status
- Live status updates
- Notification badges

### **2. Mobile Responsive**
- Works on all devices
- Touch-friendly interface
- Mobile-optimized forms

### **3. Accessibility**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode

### **4. Multi-Language (Future)**
- i18n support
- Language selector
- Translated content

---

## 📊 Difficulty Assessment

| Component | Difficulty | Time Estimate | Risk Level |
|-----------|-----------|---------------|------------|
| Branding System | Low-Medium | 3-4 days | Low |
| Customer Auth | Medium | 4-5 days | Medium |
| Portal Layout | Low | 2-3 days | Low |
| Ticket System | Medium | 5-7 days | Low |
| File Upload | Low-Medium | 2-3 days | Low |
| Service Info | Low | 2-3 days | Low |
| Dashboard | Low-Medium | 3-4 days | Low |
| Testing & Polish | Low | 3-4 days | Low |
| **TOTAL** | **Medium** | **3-4 weeks** | **Low-Medium** |

---

## ✅ Success Metrics

### **Customer Satisfaction**
- Ticket creation time < 2 minutes
- Response time visibility
- Clear status updates
- Easy navigation

### **WISP Benefits**
- Reduced support calls
- Better ticket organization
- Customer self-service
- Professional brand image

---

## 🚀 Next Steps

1. **Create branding schema** in tenant model
2. **Build portal route structure**
3. **Implement customer authentication**
4. **Create ticket system for customers**
5. **Add branding customization UI** (for WISP admins)
6. **Test end-to-end flow**

**Estimated Timeline:** 3-4 weeks for MVP

