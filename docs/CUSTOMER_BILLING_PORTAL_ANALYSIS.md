# Customer Billing & Portal Implementation Analysis

**Date:** December 2024  
**Purpose:** Assess difficulty and approach for implementing customer billing system and customer-facing portal

---

## 📊 Executive Summary

**Overall Difficulty:** **Medium** (6-8 weeks development time)

The platform has a solid foundation with existing billing infrastructure, customer management, and authentication systems. The main work involves:
1. Extending billing system for customer payments (not just tenant subscriptions)
2. Creating customer authentication flow
3. Building customer-facing portal UI
4. Integrating payment processing for customers

---

## 🔍 Current Infrastructure Assessment

### ✅ **What Already Exists**

#### 1. **Billing Infrastructure** (70% Complete)
- **Location:** `backend-services/billing-api.js`, `billing-schema.js`
- **Status:** Working PayPal integration for tenant subscriptions
- **Components:**
  - Subscription management (create, cancel, webhooks)
  - Invoice generation and tracking
  - Payment method storage
  - Billing analytics
- **Gap:** Currently only handles tenant subscriptions, not customer service billing

#### 2. **Customer Management** (80% Complete)
- **Location:** `backend-services/models/customer.js`, `Module_Manager/src/lib/services/customerService.ts`
- **Status:** Full CRUD operations for customers
- **Components:**
  - Customer database with service plans
  - Service status tracking
  - Installation history
  - Complaint tracking
  - Billing address storage
- **Gap:** No customer billing records or payment history

#### 3. **Authentication System** (90% Complete)
- **Location:** `Module_Manager/src/lib/services/authService.ts`, Firebase Auth
- **Status:** Production-ready Firebase authentication
- **Components:**
  - Email/password authentication
  - Google OAuth
  - Token management
  - Multi-tenant user roles
- **Gap:** No customer role or customer authentication flow

#### 4. **Ticketing System** (85% Complete)
- **Location:** `Module_Manager/src/routes/modules/help-desk/`, `workOrderService.ts`
- **Status:** Full work order/ticket management
- **Components:**
  - Ticket creation and assignment
  - Status tracking
  - Customer association
  - Priority management
- **Gap:** No customer-facing ticket view or creation

---

## 🎯 Implementation Requirements

### **Phase 1: Customer Billing System** (3-4 weeks)

#### **1.1 Database Schema Extensions**

**Difficulty:** Low  
**Files to Modify:**
- `backend-services/models/customer.js` - Add billing fields
- Create new `customer-billing-schema.js`

**Required Schema Additions:**
```javascript
// Customer Billing Schema
const customerBillingSchema = {
  customerId: String,           // Link to customer
  tenantId: String,             // Multi-tenant isolation
  servicePlan: {
    planName: String,
    monthlyFee: Number,
    setupFee: Number,
    prorationEnabled: Boolean
  },
  billingCycle: {
    type: String,               // 'monthly', 'annual'
    dayOfMonth: Number,         // 1-31 (billing date)
    nextBillingDate: Date
  },
  paymentMethod: {
    type: String,               // 'credit_card', 'ach', 'paypal'
    stripeCustomerId: String,   // If using Stripe
    stripePaymentMethodId: String,
    last4: String,              // Last 4 digits
    brand: String,              // 'visa', 'mastercard', etc.
    expiryMonth: Number,
    expiryYear: Number
  },
  invoices: [{
    invoiceId: String,
    invoiceNumber: String,      // INV-2025-001
    amount: Number,
    status: String,             // 'pending', 'paid', 'overdue', 'cancelled'
    dueDate: Date,
    paidDate: Date,
    lineItems: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      total: Number
    }],
    payments: [{
      paymentId: String,
      amount: Number,
      method: String,
      transactionId: String,
      paidAt: Date
    }]
  }],
  paymentHistory: [{
    paymentId: String,
    invoiceId: String,
    amount: Number,
    method: String,
    status: String,
    transactionId: String,
    paidAt: Date
  }],
  balance: {
    current: Number,            // Current balance
    overdue: Number,            // Overdue amount
    lastPaymentDate: Date
  },
  autoPay: {
    enabled: Boolean,
    paymentMethodId: String
  }
}
```

**Estimated Time:** 2-3 days

#### **1.2 Payment Processing Integration**

**Difficulty:** Medium  
**Options:**

**Option A: Stripe (Recommended)**
- **Pros:**
  - Industry standard, well-documented
  - Excellent customer portal support
  - Handles subscriptions, one-time payments, ACH
  - Built-in fraud protection
  - Webhook support for payment events
- **Cons:**
  - Transaction fees (2.9% + $0.30 per transaction)
  - Requires PCI compliance (handled by Stripe)
- **Implementation:**
  - Install: `npm install stripe`
  - Create Stripe account and get API keys
  - Implement Stripe Customer creation
  - Implement payment method storage
  - Implement invoice creation and payment
  - Set up webhooks for payment events

**Option B: PayPal (Extend Existing)**
- **Pros:**
  - Already integrated for tenant billing
  - Lower fees for some transaction types
  - Familiar to many customers
- **Cons:**
  - Less flexible than Stripe
  - Customer must have PayPal account
  - More complex for recurring billing

**Option C: Hybrid (Stripe + PayPal)**
- **Pros:**
  - Maximum payment method options
  - Best customer experience
- **Cons:**
  - More complex implementation
  - Two payment processors to manage

**Recommended:** **Stripe** for customer billing (keep PayPal for tenant subscriptions)

**Estimated Time:** 5-7 days

#### **1.3 Billing API Endpoints**

**Difficulty:** Medium  
**New Endpoints Needed:**

```javascript
// Customer Billing API Routes
POST   /api/customers/:customerId/billing/setup-payment-method
GET    /api/customers/:customerId/billing/payment-methods
PUT    /api/customers/:customerId/billing/payment-method/:methodId
DELETE /api/customers/:customerId/billing/payment-method/:methodId

GET    /api/customers/:customerId/billing/invoices
GET    /api/customers/:customerId/billing/invoices/:invoiceId
POST   /api/customers/:customerId/billing/invoices/:invoiceId/pay
GET    /api/customers/:customerId/billing/invoices/:invoiceId/pdf

GET    /api/customers/:customerId/billing/payment-history
GET    /api/customers/:customerId/billing/balance

POST   /api/customers/:customerId/billing/auto-pay/enable
POST   /api/customers/:customerId/billing/auto-pay/disable

// Automated Billing (Cron Jobs)
POST   /api/billing/generate-monthly-invoices  // Run monthly
POST   /api/billing/process-auto-payments      // Run daily
POST   /api/billing/send-payment-reminders      // Run daily
```

**Estimated Time:** 5-7 days

#### **1.4 Automated Billing Workflows**

**Difficulty:** Medium-High  
**Required Features:**

1. **Monthly Invoice Generation**
   - Cron job to run on billing date
   - Calculate prorated charges for plan changes
   - Generate invoice PDFs
   - Send invoice emails

2. **Auto-Pay Processing**
   - Daily job to process scheduled payments
   - Retry failed payments
   - Update invoice status
   - Send payment confirmations

3. **Payment Reminders**
   - Send reminders 7 days before due date
   - Send overdue notices
   - Escalate to suspension workflow

4. **Service Suspension/Reconnection**
   - Auto-suspend for overdue accounts
   - Auto-reconnect after payment
   - Integration with HSS for service control

**Estimated Time:** 7-10 days

---

### **Phase 2: Customer Authentication** (1-2 weeks)

#### **2.1 Customer User Role**

**Difficulty:** Low  
**Files to Modify:**
- `backend-services/models/user.js` - Add 'customer' role
- `Module_Manager/src/lib/models/userRole.ts` - Add customer role type
- `backend-services/config/user-hierarchy.js` - Add customer permissions

**Required Changes:**
```javascript
// Add to user roles enum
roles: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 
        'helpdesk', 'sales', 'viewer', 'customer']  // NEW

// Customer permissions (very limited)
customerPermissions: {
  viewOwnAccount: true,
  viewOwnInvoices: true,
  viewOwnTickets: true,
  createTicket: true,
  makePayment: true,
  updateOwnProfile: true,
  // NO access to:
  // - Other customers
  // - Network management
  // - System settings
  // - Admin functions
}
```

**Estimated Time:** 2-3 days

#### **2.2 Customer Account Linking**

**Difficulty:** Medium  
**Challenge:** Link Firebase Auth user to Customer record

**Approach:**
1. When customer signs up, create Firebase Auth account
2. Store Firebase UID in Customer record: `customer.firebaseUid = user.uid`
3. Create UserTenant record with role='customer'
4. Customer logs in → System finds Customer record by Firebase UID
5. Customer portal shows only their data

**Database Schema Addition:**
```javascript
// In customer.js
CustomerSchema.add({
  firebaseUid: { type: String, unique: true, sparse: true, index: true },
  accountCreatedAt: Date,
  lastLoginAt: Date
});
```

**Estimated Time:** 3-4 days

#### **2.3 Customer Sign-Up Flow**

**Difficulty:** Medium  
**New Routes Needed:**
- `Module_Manager/src/routes/customer-signup/+page.svelte`
- `Module_Manager/src/routes/customer-login/+page.svelte`

**Flow:**
1. Customer enters email, password, customer ID or phone
2. System verifies customer exists in database
3. Create Firebase Auth account
4. Link Firebase UID to Customer record
5. Send verification email
6. Redirect to customer portal

**Alternative:** Customer receives invitation email with signup link

**Estimated Time:** 4-5 days

---

### **Phase 3: Customer Portal** (2-3 weeks)

#### **3.1 Portal Structure**

**Difficulty:** Medium  
**New Routes:**
```
/customer-portal/
  ├── dashboard          # Overview: balance, recent activity
  ├── billing/
  │   ├── invoices      # List of invoices
  │   ├── payments      # Payment history
  │   └── payment-methods # Manage payment methods
  ├── tickets/
  │   ├── list          # Customer's tickets
  │   ├── create        # Create new ticket
  │   └── [id]          # View ticket details
  ├── account/
  │   ├── profile       # Edit profile
  │   ├── service       # View service details
  │   └── usage         # Data usage (if tracked)
  └── support           # Help & FAQ
```

**Estimated Time:** 2-3 days (structure)

#### **3.2 Billing Portal Pages**

**Difficulty:** Medium  
**Components Needed:**

1. **Invoice List** (`/customer-portal/billing/invoices`)
   - Table of invoices with status
   - Filter by date, status
   - Download PDF
   - Pay invoice button

2. **Payment Page** (`/customer-portal/billing/pay`)
   - Invoice details
   - Payment method selection
   - Secure payment form (Stripe Elements)
   - Payment confirmation

3. **Payment Methods** (`/customer-portal/billing/payment-methods`)
   - List saved payment methods
   - Add new card/ACH
   - Set default payment method
   - Delete payment methods

4. **Payment History** (`/customer-portal/billing/payments`)
   - Transaction history
   - Receipt downloads
   - Refund information

**Estimated Time:** 7-10 days

#### **3.3 Ticket Portal Pages**

**Difficulty:** Low-Medium  
**Components Needed:**

1. **Ticket List** (`/customer-portal/tickets`)
   - Customer's tickets only
   - Status, priority, date
   - Create new ticket button

2. **Create Ticket** (`/customer-portal/tickets/create`)
   - Category selection
   - Description
   - Attach files (optional)
   - Submit

3. **Ticket Details** (`/customer-portal/tickets/[id]`)
   - View ticket details
   - View responses
   - Add comments (customer can respond)
   - Upload files

**Note:** Reuse existing `workOrderService` but filter by customer

**Estimated Time:** 5-7 days

#### **3.4 Account Management Pages**

**Difficulty:** Low  
**Components Needed:**

1. **Profile** (`/customer-portal/account/profile`)
   - Edit name, email, phone
   - Change password
   - Notification preferences

2. **Service Details** (`/customer-portal/account/service`)
   - Service plan information
   - Service status
   - Installation date
   - Equipment information (CPE serial, etc.)

3. **Usage** (`/customer-portal/account/usage`)
   - Data usage graphs (if tracked)
   - Speed test results
   - Connection quality metrics

**Estimated Time:** 4-5 days

---

## 🔗 Integration Points

### **1. HSS Integration for Service Control**

**Difficulty:** Medium  
**Purpose:** Suspend/reconnect service based on payment status

**Implementation:**
- When invoice becomes overdue → Call HSS API to suspend subscriber
- When payment received → Call HSS API to reactivate subscriber
- Update customer service status in database

**Files to Modify:**
- `backend-services/routes/hss-api.js` - Add suspend/reactivate endpoints
- `backend-services/billing-api.js` - Add service control hooks

**Estimated Time:** 2-3 days

### **2. Email Notifications**

**Difficulty:** Low  
**Purpose:** Send billing emails to customers

**Required Emails:**
- Invoice generated
- Payment reminder (7 days before due)
- Payment received confirmation
- Payment failed notification
- Service suspended notification
- Service reactivated notification

**Implementation:**
- Use existing email service (if exists) or integrate SendGrid/Mailgun
- Create email templates
- Add email sending to billing workflows

**Estimated Time:** 3-4 days

### **3. PDF Invoice Generation**

**Difficulty:** Medium  
**Purpose:** Generate professional invoice PDFs

**Options:**
- **Puppeteer** - Render HTML to PDF (recommended)
- **PDFKit** - Programmatic PDF generation
- **jsPDF** - Client-side PDF generation

**Implementation:**
- Create invoice template (HTML)
- Generate PDF on invoice creation
- Store PDF in cloud storage (Firebase Storage or S3)
- Provide download link

**Estimated Time:** 3-4 days

---

## 📋 Implementation Checklist

### **Week 1-2: Foundation**
- [ ] Extend customer schema with billing fields
- [ ] Set up Stripe account and API keys
- [ ] Create customer billing API endpoints
- [ ] Implement payment method storage
- [ ] Test Stripe integration

### **Week 3-4: Billing Automation**
- [ ] Implement invoice generation
- [ ] Set up automated billing cron jobs
- [ ] Implement auto-pay processing
- [ ] Create payment reminder system
- [ ] Integrate service suspension/reconnection

### **Week 5: Customer Authentication**
- [ ] Add customer role to user system
- [ ] Implement customer account linking
- [ ] Create customer sign-up flow
- [ ] Create customer login page
- [ ] Test authentication flow

### **Week 6-7: Customer Portal**
- [ ] Create portal layout and navigation
- [ ] Build billing pages (invoices, payments, payment methods)
- [ ] Build ticket pages (list, create, view)
- [ ] Build account pages (profile, service, usage)
- [ ] Implement PDF invoice generation

### **Week 8: Integration & Testing**
- [ ] Integrate HSS service control
- [ ] Set up email notifications
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization

---

## 💰 Cost Considerations

### **Payment Processing Fees**
- **Stripe:** 2.9% + $0.30 per transaction
- **PayPal:** 2.9% + $0.30 per transaction
- **ACH (Stripe):** $0.25 per transaction (lower fees)

### **Infrastructure Costs**
- **PDF Storage:** Firebase Storage or S3 (~$0.023/GB)
- **Email Service:** SendGrid (free tier: 100 emails/day) or Mailgun
- **Cron Jobs:** Firebase Functions or Cloud Scheduler

### **Development Costs**
- **Estimated Time:** 6-8 weeks
- **Complexity:** Medium
- **Risk:** Low-Medium (well-established patterns)

---

## 🚨 Risks & Challenges

### **1. PCI Compliance**
- **Risk:** Storing credit card data requires PCI DSS compliance
- **Mitigation:** Use Stripe Elements (hosted payment form) - never touch card data
- **Status:** Low risk with Stripe

### **2. Payment Failures**
- **Risk:** Failed payments, chargebacks, disputes
- **Mitigation:** 
  - Implement retry logic
  - Send clear payment failure notifications
  - Provide easy payment retry in portal
  - Track payment failure reasons

### **3. Customer Account Security**
- **Risk:** Unauthorized access to customer accounts
- **Mitigation:**
  - Strong password requirements
  - Two-factor authentication (optional)
  - Rate limiting on login attempts
  - Email verification
  - Secure session management

### **4. Data Privacy**
- **Risk:** Customer data exposure
- **Mitigation:**
  - Strict tenant isolation
  - Customer can only see their own data
  - Audit logging
  - GDPR compliance considerations

---

## 🎯 Recommended Approach

### **Phase 1: MVP (Minimum Viable Product)**
**Timeline:** 4 weeks

**Features:**
1. Customer authentication (sign-up, login)
2. Basic customer portal (dashboard, billing, tickets)
3. Invoice viewing and payment
4. Payment method management
5. Ticket creation and viewing

**Skip for MVP:**
- Auto-pay
- Automated invoice generation
- Service suspension automation
- Usage tracking
- Advanced reporting

### **Phase 2: Automation**
**Timeline:** 2-3 weeks

**Features:**
1. Automated monthly invoice generation
2. Auto-pay processing
3. Payment reminders
4. Service suspension/reconnection

### **Phase 3: Enhanced Features**
**Timeline:** 1-2 weeks

**Features:**
1. Usage tracking and display
2. Service plan upgrades/downgrades
3. Payment history analytics
4. Email notifications
5. PDF invoice generation

---

## 📊 Difficulty Assessment Summary

| Component | Difficulty | Time Estimate | Risk Level |
|-----------|-----------|---------------|------------|
| Database Schema | Low | 2-3 days | Low |
| Stripe Integration | Medium | 5-7 days | Low |
| Billing API | Medium | 5-7 days | Medium |
| Automated Billing | Medium-High | 7-10 days | Medium |
| Customer Auth | Medium | 4-5 days | Low |
| Customer Portal UI | Medium | 10-12 days | Low |
| HSS Integration | Medium | 2-3 days | Medium |
| Email System | Low | 3-4 days | Low |
| PDF Generation | Medium | 3-4 days | Low |
| **TOTAL** | **Medium** | **6-8 weeks** | **Low-Medium** |

---

## ✅ Conclusion

**Feasibility:** **HIGH** ✅

The platform has excellent foundations:
- Existing billing infrastructure (70% reusable)
- Customer management system (80% complete)
- Authentication system (90% complete)
- Ticketing system (85% complete)

**Main Work Required:**
1. Extend billing for customers (not just tenants)
2. Add customer authentication role
3. Build customer portal UI
4. Integrate payment processing (Stripe recommended)

**Recommended Next Steps:**
1. Set up Stripe account and test integration
2. Extend customer schema with billing fields
3. Build MVP customer portal (4 weeks)
4. Add automation features (2-3 weeks)
5. Enhance with advanced features (1-2 weeks)

**Total Estimated Timeline:** 6-8 weeks for full implementation

