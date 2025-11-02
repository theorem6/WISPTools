# Monetization Action Plan
## Prioritized Fixes for WISP Management Platform

**Project:** LTE WISP Management Platform  
**Goal:** Make platform monetization-ready  
**Target Timeline:** 4 weeks for critical items

---

## PRIORITY 1: CRITICAL BLOCKERS 🔴
### Must fix before accepting any payments

---

## Task 1.1: Complete Billing System Authentication
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 days  
**Dependencies:** None  
**Blocker:** Cannot process payments securely

### Steps:

#### Step 1.1.1: Set up PayPal Credentials (1 hour)
**File:** `backend-services/billing-api.js`

**Actions:**
1. Create `.env` file in `backend-services/`:
```bash
PAYPAL_CLIENT_ID=your_live_client_id_here
PAYPAL_CLIENT_SECRET=your_live_client_secret_here
PAYPAL_ENVIRONMENT=live  # or 'sandbox' for testing
```

2. Update `billing-api.js` (lines 21-27):
```javascript
// REPLACE:
const environment = new paypal.core.LiveEnvironment(
  'ARcw63HPgW_YB1FdF3kH2...', // PLACEHOLDER
  'EK3CMbxefpxzA4We4tQMDO_FwLHw5cGIeXn0nhBppezAVsTnTPw0d1RN5ifRThxZb1qMmyrwN5GU1I7P' // PLACEHOLDER
);

// WITH:
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnv = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

if (!paypalClientId || !paypalClientSecret) {
  throw new Error('PayPal credentials not configured');
}

const environment = paypalEnv === 'live'
  ? new paypal.core.LiveEnvironment(paypalClientId, paypalClientSecret)
  : new paypal.core.SandboxEnvironment(paypalClientId, paypalClientSecret);
```

**Test:**
- Verify environment variables load correctly
- Check error handling for missing credentials

---

#### Step 1.1.2: Implement Firebase Token Verification (4-6 hours)
**File:** `backend-services/billing-api.js`

**Actions:**
1. Install Firebase Admin SDK (if not already):
```bash
cd backend-services
npm install firebase-admin
```

2. Create Firebase Admin initialization file: `backend-services/config/firebase-admin.js`
```javascript
const admin = require('firebase-admin');

// Initialize Firebase Admin (reuse from existing config if available)
if (!admin.apps.length) {
  const serviceAccount = require('../path/to/serviceAccountKey.json');
  // OR use environment variables:
  // const serviceAccount = {
  //   projectId: process.env.FIREBASE_PROJECT_ID,
  //   clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  //   privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  // };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
```

3. Replace authentication middleware (lines 32-49):
```javascript
const admin = require('../config/firebase-admin');

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user from Firestore to include tenant info
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    // Add user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      tenantId: userData.tenantId,
      role: userData.role,
      ...userData
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};
```

**Test:**
- Test with valid token
- Test with expired token
- Test with invalid token
- Test with no token

---

#### Step 1.1.3: Implement Admin Role Checking (2-3 hours)
**File:** `backend-services/billing-api.js`

**Actions:**
Replace admin middleware (lines 54-63):
```javascript
const requireAdmin = async (req, res, next) => {
  try {
    // User should be authenticated first (authenticateUser middleware)
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is platform admin, owner, or admin
    const allowedRoles = ['platform_admin', 'owner', 'admin'];
    
    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`Unauthorized admin access attempt by ${req.user.email} (role: ${req.user.role})`);
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'Only platform admins, owners, and admins can access this resource'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(403).json({ error: 'Admin access verification failed' });
  }
};
```

**Test:**
- Test with admin user
- Test with regular user
- Test with owner user
- Test without authentication

---

#### Step 1.1.4: Fix Email Placeholder (30 minutes)
**File:** `backend-services/billing-api.js` (line 120)

**Actions:**
Replace:
```javascript
email_address: req.user.email || 'user@example.com' // PLACEHOLDER
```

With:
```javascript
email_address: req.user?.email || (() => {
  throw new Error('User email is required for billing operations');
})()
```

**Test:**
- Verify email is extracted from authenticated user
- Test error handling when email is missing

---

#### Step 1.1.5: Add PayPal Webhook Handler (1 day)
**File:** Create `backend-services/routes/billing-webhooks.js`

**Actions:**
1. Create webhook handler for PayPal events:
```javascript
const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { Subscription } = require('../billing-schema');

// Verify PayPal webhook signature
async function verifyWebhook(req) {
  // Implement PayPal webhook verification
  // See: https://developer.paypal.com/docs/api-basics/notifications/webhooks/
  return true; // Simplified - implement proper verification
}

// Handle subscription created
router.post('/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const verified = await verifyWebhook(req);
    if (!verified) {
      return res.status(401).send('Unauthorized');
    }
    
    const event = JSON.parse(req.body);
    
    // Handle different event types
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        // Update subscription status
        await Subscription.updateOne(
          { paypalSubscriptionId: event.resource.id },
          { status: 'active' }
        );
        break;
        
      case 'PAYMENT.SALE.COMPLETED':
        // Record payment
        await Subscription.updateOne(
          { paypalSubscriptionId: event.resource.billing_agreement_id },
          { 
            lastPaymentDate: new Date(),
            status: 'active'
          }
        );
        break;
        
      case 'PAYMENT.SALE.DENIED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        // Handle payment failure
        await Subscription.updateOne(
          { paypalSubscriptionId: event.resource.billing_agreement_id },
          { 
            status: 'past_due',
            lastFailureDate: new Date()
          }
        );
        // TODO: Send notification email
        break;
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        // Handle cancellation
        await Subscription.updateOne(
          { paypalSubscriptionId: event.resource.id },
          { 
            status: 'cancelled',
            cancelledAt: new Date()
          }
        );
        break;
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal error');
  }
});

module.exports = router;
```

2. Add route to `server.js`:
```javascript
app.use('/api/billing/webhooks', require('./routes/billing-webhooks'));
```

**Test:**
- Use PayPal webhook simulator
- Test each event type
- Verify database updates

---

#### Step 1.1.6: Testing & Validation (4-6 hours)
**Actions:**
1. **Unit Tests:**
   - Test authentication with valid/invalid tokens
   - Test admin role checking
   - Test PayPal API calls (sandbox)

2. **Integration Tests:**
   - Test complete subscription flow
   - Test payment processing (sandbox)
   - Test webhook handling

3. **Security Tests:**
   - Test token expiration handling
   - Test unauthorized access attempts
   - Test webhook signature verification

**Checklist:**
- [ ] PayPal credentials loaded from environment
- [ ] Firebase token verification works
- [ ] Admin role checking enforced
- [ ] Email extracted from authenticated user
- [ ] Webhook handler processes events
- [ ] Error handling for all edge cases

---

## Task 1.2: Fix Mobile App Work Orders Integration
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 days  
**Dependencies:** None  
**Blocker:** Mobile app cannot display or accept work orders

### Steps:

#### Step 1.2.1: Create Work Orders Service (3-4 hours)
**File:** Create `wisp-field-app/src/services/workOrdersService.ts`

**Actions:**
1. Create service file:
```typescript
import apiService from './apiService';

export interface WorkOrder {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: 'open' | 'assigned' | 'in-progress' | 'waiting-parts' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'installation' | 'repair' | 'maintenance' | 'upgrade' | 'removal' | 'troubleshoot' | 'inspection';
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  affectedCustomers?: Array<{
    customerName: string;
    customerId?: string;
  }>;
}

class WorkOrdersService {
  private baseUrl = '/api/work-orders';

  async getMyTickets(userId: string): Promise<WorkOrder[]> {
    try {
      const response = await apiService.get(`${this.baseUrl}?assignedTo=${userId}`);
      return response.data || [];
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
      throw new Error(error.message || 'Failed to load work orders');
    }
  }

  async getTicket(ticketId: string): Promise<WorkOrder> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${ticketId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching ticket:', error);
      throw new Error(error.message || 'Failed to load ticket');
    }
  }

  async acceptTicket(ticketId: string, userId: string): Promise<void> {
    try {
      await apiService.post(`${this.baseUrl}/${ticketId}/accept`, {
        assignedTo: userId,
        status: 'assigned'
      });
    } catch (error: any) {
      console.error('Error accepting ticket:', error);
      throw new Error(error.message || 'Failed to accept ticket');
    }
  }

  async updateStatus(ticketId: string, status: WorkOrder['status'], notes?: string): Promise<void> {
    try {
      await apiService.put(`${this.baseUrl}/${ticketId}`, {
        status,
        notes: notes || ''
      });
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
      throw new Error(error.message || 'Failed to update ticket');
    }
  }

  async startWork(ticketId: string, userId: string): Promise<void> {
    await this.updateStatus(ticketId, 'in-progress');
  }

  async completeWork(ticketId: string, notes?: string): Promise<void> {
    await this.updateStatus(ticketId, 'resolved', notes);
  }
}

export default new WorkOrdersService();
```

**Test:**
- Verify service exports correctly
- Check TypeScript compilation

---

#### Step 1.2.2: Update WorkOrdersScreen (3-4 hours)
**File:** `wisp-field-app/src/screens/WorkOrdersScreen.tsx`

**Actions:**
1. Import service:
```typescript
import workOrdersService from '../services/workOrdersService';
```

2. Replace `loadTickets` function (lines 43-62):
```typescript
const loadTickets = async () => {
  setIsLoading(true);
  
  try {
    if (!userId) {
      console.warn('No userId available');
      setTickets([]);
      return;
    }
    
    const tickets = await workOrdersService.getMyTickets(userId);
    setTickets(tickets);
  } catch (error: any) {
    console.error('Failed to load tickets:', error);
    Alert.alert('Error', error.message || 'Failed to load tickets');
    setTickets([]); // Set empty array on error
  } finally {
    setIsLoading(false);
    setRefreshing(false);
  }
};
```

3. Replace `handleAcceptTicket` function (lines 89-109):
```typescript
const handleAcceptTicket = async (ticket: any) => {
  Alert.alert(
    'Accept Ticket',
    `Accept ${ticket.ticketNumber}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            setIsLoading(true);
            await workOrdersService.acceptTicket(ticket.id, userId);
            Alert.alert('Success', 'Ticket accepted');
            await loadTickets(); // Reload tickets
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to accept ticket');
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]
  );
};
```

4. Add pull-to-refresh handler:
```typescript
const onRefresh = React.useCallback(async () => {
  setRefreshing(true);
  await loadTickets();
}, [userId]);
```

**Test:**
- Test loading tickets
- Test accepting tickets
- Test error handling
- Test pull-to-refresh

---

#### Step 1.2.3: Update API Service Configuration (1-2 hours)
**File:** Verify `wisp-field-app/src/services/apiService.ts` exists and is configured

**Actions:**
1. Verify API service includes:
```typescript
// Should have base URL configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001' // Development
  : 'https://136.112.111.167:3001'; // Production

// Should include authentication headers
headers: {
  'Authorization': `Bearer ${authToken}`,
  'X-Tenant-ID': tenantId,
  'Content-Type': 'application/json'
}
```

2. Add error handling for network failures

**Test:**
- Test API calls with correct headers
- Test offline handling

---

#### Step 1.2.4: Add Work Order Detail Screen (4-6 hours)
**File:** Create `wisp-field-app/src/screens/WorkOrderDetailScreen.tsx` (optional but recommended)

**Actions:**
1. Create detail screen with:
   - Full ticket information
   - Status update buttons
   - Notes/updates section
   - Navigation to location
   - Customer information

2. Add navigation route:
```typescript
<Stack.Screen 
  name="WorkOrderDetail" 
  component={WorkOrderDetailScreen}
/>
```

**Test:**
- Test navigation from list to detail
- Test status updates
- Test notes addition

---

#### Step 1.2.5: Testing (4-6 hours)
**Actions:**
1. **Test on Android device:**
   - Install APK
   - Login as field technician
   - Load work orders
   - Accept ticket
   - Update status

2. **Test error scenarios:**
   - No internet connection
   - Invalid token
   - Server error
   - Empty ticket list

3. **Test offline handling:**
   - Queue actions when offline
   - Sync when online

**Checklist:**
- [ ] Service created and exported
- [ ] WorkOrdersScreen loads tickets from API
- [ ] Accept ticket functionality works
- [ ] Status updates work
- [ ] Error handling implemented
- [ ] Pull-to-refresh works
- [ ] Tested on physical device

---

## Task 1.3: Secure All Admin Endpoints
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1-2 days  
**Dependencies:** Firebase Admin SDK setup (from Task 1.1)

### Steps:

#### Step 1.3.1: Audit All Admin Routes (2 hours)
**Actions:**
1. Search for admin routes:
```bash
grep -r "requireAdmin\|require.*admin\|/admin" backend-services/
```

2. List all admin-protected endpoints:
   - `/admin/*` routes
   - `/api/billing/*` routes (some endpoints)
   - User management routes
   - Tenant management routes

---

#### Step 1.3.2: Create Reusable Admin Middleware (2-3 hours)
**File:** Create `backend-services/middleware/admin-auth.js`

**Actions:**
```javascript
const admin = require('../config/firebase-admin');

/**
 * Middleware to require authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      ...userDoc.data()
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to require admin role
 */
const requireAdmin = (options = {}) => {
  const allowedRoles = options.allowedRoles || ['platform_admin', 'owner', 'admin'];
  
  return async (req, res, next) => {
    try {
      // Must be authenticated first
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!allowedRoles.includes(req.user.role)) {
        console.warn(`Unauthorized access attempt by ${req.user.email} (role: ${req.user.role})`);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: req.user.role
        });
      }
      
      next();
    } catch (error) {
      console.error('Admin check error:', error);
      res.status(403).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Middleware to require owner or platform admin
 */
const requireOwner = requireAdmin({ allowedRoles: ['platform_admin', 'owner'] });

module.exports = {
  requireAuth,
  requireAdmin,
  requireOwner
};
```

---

#### Step 1.3.3: Apply Middleware to All Admin Routes (3-4 hours)
**Files:** Multiple route files

**Actions:**
1. Update `backend-services/routes/admin/general.js`:
```javascript
const { requireAuth, requireAdmin } = require('../../middleware/admin-auth');

router.get('/dashboard', requireAuth, requireAdmin(), async (req, res) => {
  // ... existing code
});
```

2. Update `backend-services/routes/admin/tenants.js`:
```javascript
const { requireAuth, requireAdmin } = require('../../middleware/admin-auth');

router.use(requireAuth); // All routes require auth
router.use(requireAdmin()); // All routes require admin
```

3. Update `backend-services/routes/users/index.js`:
```javascript
const { requireAuth, requireAdmin } = require('../../middleware/admin-auth');

// Apply to admin-only routes
router.put('/:userId/role', requireAuth, requireAdmin(), async (req, res) => {
  // ... existing code
});
```

**Test:**
- Test each admin endpoint with regular user (should fail)
- Test with admin user (should succeed)
- Test with expired token (should fail)

---

#### Step 1.3.4: Add Audit Logging (2-3 hours)
**File:** Create `backend-services/middleware/audit-logger.js`

**Actions:**
```javascript
const admin = require('../config/firebase-admin');

const auditLog = async (req, action, resourceType, resourceId, status, details = {}) => {
  try {
    await admin.firestore().collection('audit_logs').add({
      user_id: req.user?.uid,
      user_email: req.user?.email,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      status, // 'success' or 'failure'
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      details,
      module: 'admin'
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't fail request if audit logging fails
  }
};

module.exports = { auditLog };
```

Apply to admin routes:
```javascript
const { auditLog } = require('../../middleware/audit-logger');

router.delete('/:tenantId', requireAuth, requireAdmin(), async (req, res) => {
  try {
    // ... delete logic
    await auditLog(req, 'delete', 'tenant', req.params.tenantId, 'success');
    res.json({ success: true });
  } catch (error) {
    await auditLog(req, 'delete', 'tenant', req.params.tenantId, 'failure', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});
```

**Test:**
- Verify audit logs are created
- Check logs are queryable
- Test failure scenarios are logged

---

**Checklist:**
- [ ] All admin routes identified
- [ ] Reusable middleware created
- [ ] All admin routes protected
- [ ] Audit logging implemented
- [ ] Tested with different user roles
- [ ] Tested unauthorized access attempts

---

## PRIORITY 2: HIGH IMPORTANCE 🟡
### Important for revenue and production quality

---

## Task 2.1: Improve Cost Estimation System
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 days  
**Dependencies:** None

### Steps:

#### Step 2.1.1: Create Equipment Price Database (1 day)
**File:** Create `backend-services/models/equipment-pricing.js`

**Actions:**
1. Create schema for equipment pricing:
```javascript
const mongoose = require('mongoose');

const EquipmentPricingSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  category: { type: String, required: true },
  equipmentType: { type: String, required: true },
  manufacturer: String,
  model: String,
  basePrice: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  source: { type: String, enum: ['manual', 'inventory', 'vendor'], default: 'manual' },
  lastUpdated: { type: Date, default: Date.now },
  vendorUrl: String,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('EquipmentPricing', EquipmentPricingSchema);
```

2. Create pricing API: `backend-services/routes/equipment-pricing.js`
```javascript
const router = require('express').Router();
const EquipmentPricing = require('../models/equipment-pricing');

// Get price for equipment
router.get('/price', async (req, res) => {
  try {
    const { category, equipmentType, manufacturer, model } = req.query;
    
    // First try exact match
    let pricing = await EquipmentPricing.findOne({
      tenantId: req.tenantId,
      category,
      equipmentType,
      manufacturer,
      model
    });
    
    // Fallback to category + type match
    if (!pricing) {
      pricing = await EquipmentPricing.findOne({
        tenantId: req.tenantId,
        category,
        equipmentType
      });
    }
    
    // Fallback to inventory average
    if (!pricing) {
      const InventoryItem = require('../models/inventory');
      const inventoryItems = await InventoryItem.find({
        tenantId: req.tenantId,
        category,
        status: { $in: ['available', 'deployed'] }
      }).select('purchasePrice');
      
      const prices = inventoryItems
        .map(item => item.purchasePrice)
        .filter(price => price && price > 0);
      
      if (prices.length > 0) {
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        pricing = { basePrice: averagePrice, source: 'inventory_average' };
      }
    }
    
    res.json({
      price: pricing?.basePrice || null,
      source: pricing?.source || 'not_found',
      confidence: pricing ? 'high' : 'low'
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

#### Step 2.1.2: Update Plans API to Use Price Database (2-3 hours)
**File:** `backend-services/routes/plans.js`

**Actions:**
1. Replace hardcoded costEstimates (lines 766-782):
```javascript
async function estimateCost(tenantId, requirement) {
  try {
    const pricingResponse = await fetch(
      `http://localhost:3001/api/equipment-pricing/price?` +
      `category=${encodeURIComponent(requirement.category)}&` +
      `equipmentType=${encodeURIComponent(requirement.equipmentType)}&` +
      `manufacturer=${encodeURIComponent(requirement.manufacturer || '')}&` +
      `model=${encodeURIComponent(requirement.model || '')}`,
      {
        headers: { 'x-tenant-id': tenantId }
      }
    );
    
    const pricing = await pricingResponse.json();
    
    if (pricing.price) {
      return {
        estimatedCost: pricing.price * requirement.quantity,
        confidence: pricing.confidence,
        source: pricing.source
      };
    }
    
    // Final fallback (should rarely be used)
    return {
      estimatedCost: 1000 * requirement.quantity,
      confidence: 'low',
      source: 'fallback'
    };
  } catch (error) {
    console.error('Error estimating cost:', error);
    return {
      estimatedCost: 1000 * requirement.quantity,
      confidence: 'low',
      source: 'error_fallback'
    };
  }
}
```

**Test:**
- Test with existing inventory prices
- Test with manual pricing entries
- Test fallback behavior

---

#### Step 2.1.3: Create Admin UI for Price Management (1-2 days)
**File:** Create `Module_Manager/src/routes/modules/equipment-pricing/+page.svelte`

**Actions:**
1. Create pricing management interface
2. Allow manual price entry
3. Show price source and confidence
4. Import prices from inventory

**Test:**
- Test price entry
- Test price updates
- Test price lookup

---

## Task 2.2: Complete EPC Auto-Installation
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 days  
**Dependencies:** None

### Steps:

#### Step 2.2.1: Complete ISO Generation Script (1 day)
**File:** `backend-services/routes/epc-deployment.js` (line 551)

**Actions:**
1. Review existing script: `backend-services/scripts/make-autoinstall-iso.sh`
2. Complete placeholder implementation:
```javascript
// Generate auto-install ISO
router.post('/:epcId/generate-iso', async (req, res) => {
  try {
    const { epcId } = req.params;
    const epc = await DistributedEPC.findById(epcId);
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Generate ISO with configuration
    const isoPath = await generateAutoInstallISO({
      epcId: epc.epc_id,
      hostname: epc.hostname,
      ipAddress: epc.network_config.ip_address,
      mmeAddress: epc.network_config.mme_address,
      hssAddress: epc.network_config.hss_address,
      // ... other config
    });
    
    // Return download link
    res.json({
      isoUrl: `/api/epc/${epcId}/download-iso`,
      isoPath,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
  } catch (error) {
    console.error('ISO generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function generateAutoInstallISO(config) {
  // Implement ISO generation using existing script
  const { exec } = require('child_process');
  const path = require('path');
  
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scripts/make-autoinstall-iso.sh');
    exec(`bash ${scriptPath} ${config.epcId}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}
```

**Test:**
- Test ISO generation
- Test ISO download
- Verify ISO boots correctly

---

## Task 2.3: Mobile Tower Selection
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 1-2 days  
**Dependencies:** None

### Steps:

#### Step 2.3.1: Create Tower Selection Component (4-6 hours)
**File:** Create `wisp-field-app/src/components/TowerSelector.tsx`

**Actions:**
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import apiService from '../services/apiService';

interface Tower {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface TowerSelectorProps {
  onSelect: (tower: Tower) => void;
  selectedTowerId?: string;
}

export default function TowerSelector({ onSelect, selectedTowerId }: TowerSelectorProps) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTowers();
  }, []);

  const loadTowers = async () => {
    try {
      const response = await apiService.get('/api/network/sites?type=tower');
      setTowers(response.data || []);
    } catch (error) {
      console.error('Error loading towers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={towers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.towerItem,
              selectedTowerId === item.id && styles.selected
            ]}
            onPress={() => onSelect(item)}
          >
            <Text style={styles.towerName}>{item.name}</Text>
            {item.location.address && (
              <Text style={styles.towerAddress}>{item.location.address}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

---

#### Step 2.3.2: Update AssetDetailsScreen (2-3 hours)
**File:** `wisp-field-app/src/screens/AssetDetailsScreen.tsx`

**Actions:**
1. Replace placeholder (line 35-36):
```typescript
import TowerSelector from '../components/TowerSelector';

// Add state
const [showTowerSelector, setShowTowerSelector] = useState(false);

// Replace Alert with:
<TouchableOpacity onPress={() => setShowTowerSelector(true)}>
  <Text>Select Tower</Text>
</TouchableOpacity>

{showTowerSelector && (
  <Modal>
    <TowerSelector
      onSelect={(tower) => {
        // Update asset location
        updateAssetLocation(asset.id, tower.location);
        setShowTowerSelector(false);
      }}
      selectedTowerId={asset.location?.towerId}
    />
  </Modal>
)}
```

**Test:**
- Test tower selection
- Test location update
- Test navigation back

---

## PRIORITY 3: MEDIUM IMPORTANCE 🟢
### Improvements and cleanup

---

## Task 3.1: Code Cleanup & Remove Orphaned Code
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 2-3 days

### Steps:

#### Step 3.1.1: Audit Orphaned Directories (1 day)
**Actions:**
1. Review each directory:
   - `hss-module/` - Check if used
   - `distributed-epc/` - Check if used
   - `genieacs-fork/` - Document purpose or remove
   - `ltepci/` - Check if used
   - `nokia/` - Document or remove

2. For each directory:
   - Search for imports/references
   - Check git history
   - Document purpose if keeping
   - Remove if unused

---

#### Step 3.1.2: Remove Duplicate Monitor Module (1 hour)
**File:** `Module_Manager/src/routes/modules/monitor/+page.svelte`

**Actions:**
1. Remove the module entirely, OR
2. Redirect to monitoring module:
```javascript
import { goto } from '$app/navigation';
goto('/modules/monitoring');
```

3. Update dashboard to use monitoring instead of monitor

---

#### Step 3.1.3: Fix Mock Data Returns (1 day)
**Files:** Multiple

**Actions:**
1. `backend-services/routes/hss-management.js` (line 757):
   - Replace mock data with real HSS queries
   - Add error handling

2. `backend-services/monitoring-service.js` (line 698):
   - Implement CBRS spectrum calculation
   - Or remove if not needed

---

## IMPLEMENTATION TIMELINE

### Week 1: Critical Fixes
**Days 1-2:** Task 1.1 - Billing System Authentication
- PayPal credentials setup
- Firebase token verification
- Admin role checking
- Webhook handler

**Days 3-4:** Task 1.2 - Mobile App Work Orders
- Service creation
- Screen updates
- Testing

**Day 5:** Task 1.3 - Secure Admin Endpoints
- Middleware creation
- Route protection
- Audit logging

### Week 2: High Priority
**Days 1-2:** Task 2.1 - Cost Estimation
- Price database
- API updates
- Admin UI (if time)

**Days 3-4:** Task 2.2 - EPC Auto-Installation
- ISO generation completion
- Testing

**Day 5:** Task 2.3 - Mobile Tower Selection
- Component creation
- Screen updates

### Week 3: Testing & Polish
**Days 1-3:** End-to-end testing
- Payment flow testing
- Mobile app testing
- Security testing

**Days 4-5:** Code cleanup
- Remove orphaned code
- Fix mock data
- Documentation

### Week 4: Production Hardening
**Days 1-3:** Production deployment
- Environment setup
- Monitoring configuration
- Backup procedures

**Days 4-5:** Final testing & launch preparation

---

## SUCCESS CRITERIA

### Critical (Must Have)
- [ ] Payments can be processed securely
- [ ] Mobile app displays work orders
- [ ] Admin endpoints are secured
- [ ] All authentication is verified

### Important (Should Have)
- [ ] Cost estimation is accurate
- [ ] EPC auto-installation works
- [ ] Mobile tower selection works

### Nice to Have
- [ ] Code cleanup completed
- [ ] Documentation updated
- [ ] Performance optimized

---

## RISK MITIGATION

### High Risk Items
1. **PayPal Integration**
   - Risk: Payment failures
   - Mitigation: Test thoroughly in sandbox first

2. **Mobile App API Integration**
   - Risk: Breaking existing functionality
   - Mitigation: Feature flags, gradual rollout

3. **Admin Security**
   - Risk: Unauthorized access
   - Mitigation: Comprehensive testing, audit logging

### Contingency Plans
- If billing takes longer: Extend timeline by 1 week
- If mobile app breaks: Rollback to previous version
- If security issues found: Security audit before launch

---

**Plan Created:** December 2024  
**Next Update:** After Week 1 completion
