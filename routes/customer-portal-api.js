/**
 * Customer Portal API
 * Handles customer authentication and portal-specific endpoints
 * Integrates with work-orders API for tickets
 */

const express = require('express');
const { auth } = require('../config/firebase');
const { Customer } = require('../models/customer');
const { UserTenant } = require('../models/user');
const { WorkOrder } = require('../models/work-order');
const { requireAuth } = require('../middleware/admin-auth');

const router = express.Router();

/**
 * Middleware: Require customer authentication
 * Verifies customer is logged in and has portal access
 */
const requireCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Find customer by Firebase UID
    const customer = await Customer.findOne({ 
      'portalAccess.firebaseUid': uid,
      'portalAccess.enabled': true,
      'portalAccess.accountStatus': 'active'
    });
    
    if (!customer) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Customer account not found or inactive' 
      });
    }
    
    // Verify customer belongs to tenant
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    if (customer.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden', message: 'Tenant mismatch' });
    }
    
    // Attach customer to request
    req.customer = customer;
    req.customerId = customer.customerId;
    
    // Update last login
    customer.portalAccess.lastLoginAt = new Date();
    await customer.save();
    
    next();
  } catch (error) {
    console.error('Customer auth error:', error);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
};

/**
 * POST /api/customer-portal/auth/login
 * Customer login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password, idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }
    
    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Find customer by Firebase UID or identifier
    let customer = await Customer.findOne({ 
      'portalAccess.firebaseUid': uid 
    });
    
    if (!customer && identifier) {
      // Try to find by customer ID or phone
      customer = await Customer.findOne({
        $or: [
          { customerId: identifier },
          { primaryPhone: identifier },
          { email: identifier }
        ]
      });
      
      if (customer && !customer.portalAccess.firebaseUid) {
        // Link Firebase UID to customer
        customer.portalAccess.firebaseUid = uid;
        customer.portalAccess.accountCreatedAt = new Date();
        customer.portalAccess.accountStatus = 'active';
        await customer.save();
      }
    }
    
    if (!customer) {
      return res.status(404).json({ 
        error: 'Customer not found', 
        message: 'No customer account found. Please contact support.' 
      });
    }
    
    if (!customer.portalAccess.enabled) {
      return res.status(403).json({ 
        error: 'Portal access disabled', 
        message: 'Customer portal access is disabled for your account.' 
      });
    }
    
    if (customer.portalAccess.accountStatus !== 'active') {
      return res.status(403).json({ 
        error: 'Account inactive', 
        message: 'Your account is not active. Please contact support.' 
      });
    }
    
    // Update last login
    customer.portalAccess.lastLoginAt = new Date();
    await customer.save();
    
    // Return customer data (without sensitive info)
    const customerData = {
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      email: customer.email,
      primaryPhone: customer.primaryPhone,
      serviceStatus: customer.serviceStatus,
      servicePlan: customer.servicePlan,
      tenantId: customer.tenantId
    };
    
    res.json({
      success: true,
      customer: customerData
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

/**
 * POST /api/customer-portal/auth/signup
 * Customer sign-up (link customer to Firebase account)
 */
router.post('/auth/signup', async (req, res) => {
  try {
    const { customerId, phone, email, password, idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }
    
    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Find customer by ID, phone, or email
    const customer = await Customer.findOne({
      $or: [
        { customerId },
        { primaryPhone: phone },
        { email }
      ]
    });
    
    if (!customer) {
      return res.status(404).json({ 
        error: 'Customer not found', 
        message: 'No customer record found. Please contact support to create an account.' 
      });
    }
    
    if (customer.portalAccess.firebaseUid) {
      return res.status(400).json({ 
        error: 'Account exists', 
        message: 'An account already exists for this customer. Please log in instead.' 
      });
    }
    
    // Link Firebase UID to customer
    customer.portalAccess.firebaseUid = uid;
    customer.portalAccess.accountCreatedAt = new Date();
    customer.portalAccess.accountStatus = 'active';
    customer.portalAccess.enabled = true;
    await customer.save();
    
    // Create UserTenant record with role='customer'
    const userTenant = new UserTenant({
      userId: uid,
      tenantId: customer.tenantId,
      role: 'customer',
      status: 'active',
      addedAt: new Date()
    });
    await userTenant.save();
    
    // Return customer data
    const customerData = {
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      email: customer.email,
      primaryPhone: customer.primaryPhone,
      serviceStatus: customer.serviceStatus,
      servicePlan: customer.servicePlan,
      tenantId: customer.tenantId
    };
    
    res.json({
      success: true,
      message: 'Account created successfully',
      customer: customerData
    });
  } catch (error) {
    console.error('Customer signup error:', error);
    res.status(500).json({ error: 'Signup failed', message: error.message });
  }
});

/**
 * GET /api/customer-portal/auth/me
 * Get current customer (requires authentication)
 */
router.get('/auth/me', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    
    const customerData = {
      customerId: customer.customerId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      email: customer.email,
      primaryPhone: customer.primaryPhone,
      serviceStatus: customer.serviceStatus,
      servicePlan: customer.servicePlan,
      serviceAddress: customer.serviceAddress,
      tenantId: customer.tenantId
    };
    
    res.json(customerData);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer data' });
  }
});

/**
 * POST /api/customer-portal/auth/reset-password
 * Request password reset
 */
router.post('/auth/reset-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    
    // Find customer
    const customer = await Customer.findOne({
      $or: [
        { customerId: identifier },
        { primaryPhone: identifier },
        { email: identifier }
      ]
    });
    
    if (!customer) {
      // Don't reveal if customer exists (security)
      return res.json({ 
        success: true, 
        message: 'If an account exists, a password reset email has been sent.' 
      });
    }
    
    if (!customer.portalAccess.firebaseUid) {
      return res.status(400).json({ 
        error: 'No account', 
        message: 'No portal account exists. Please sign up first.' 
      });
    }
    
    // Send password reset email via Firebase
    // This is handled by Firebase Auth on the frontend
    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to process password reset' });
  }
});

/**
 * GET /api/customer-portal/tickets
 * Get customer's tickets (filtered from work orders)
 */
router.get('/tickets', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    const tenantId = customer.tenantId;
    
    // Get all tickets for this customer
    const tickets = await WorkOrder.find({
      tenantId,
      $or: [
        { 'affectedCustomers.customerId': customer.customerId },
        { 
          customerReported: true, 
          'customerContact.email': customer.email 
        },
        {
          customerReported: true,
          'customerContact.phone': customer.primaryPhone
        }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();
    
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching customer tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * POST /api/customer-portal/tickets
 * Create ticket (customer)
 */
router.post('/tickets', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    const { title, description, category, priority, attachments } = req.body;
    
    // Map category to issueCategory
    const categoryMap = {
      'slow-speed': 'poor-performance',
      'no-connection': 'cpe-offline',
      'intermittent': 'cpe-offline',
      'equipment-failure': 'equipment-failure',
      'billing-issue': 'other',
      'other': 'other'
    };
    
    const issueCategory = categoryMap[category] || 'other';
    
    // Generate ticket number
    const ticketCount = await WorkOrder.countDocuments({ tenantId: customer.tenantId });
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(3, '0')}`;
    
    // Create work order
    const workOrder = new WorkOrder({
      tenantId: customer.tenantId,
      ticketNumber,
      type: 'troubleshoot',
      ticketCategory: 'customer-facing',
      issueCategory,
      priority: priority || 'medium',
      status: 'open',
      title,
      description,
      customerReported: true,
      customerContact: {
        name: customer.fullName,
        phone: customer.primaryPhone,
        email: customer.email
      },
      affectedCustomers: [{
        customerId: customer.customerId,
        customerName: customer.fullName,
        phoneNumber: customer.primaryPhone,
        serviceAddress: customer.serviceAddress?.street 
          ? `${customer.serviceAddress.street}, ${customer.serviceAddress.city}` 
          : undefined
      }],
      location: {
        type: 'customer',
        address: customer.serviceAddress?.street 
          ? `${customer.serviceAddress.street}, ${customer.serviceAddress.city}, ${customer.serviceAddress.state} ${customer.serviceAddress.zipCode}`
          : undefined,
        gpsCoordinates: customer.serviceAddress?.latitude && customer.serviceAddress?.longitude
          ? {
              latitude: customer.serviceAddress.latitude,
              longitude: customer.serviceAddress.longitude
            }
          : undefined
      },
      createdAt: new Date()
    });
    
    await workOrder.save();
    
    res.json({
      success: true,
      message: 'Ticket created successfully',
      ticket: workOrder
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket', message: error.message });
  }
});

/**
 * GET /api/customer-portal/tickets/:id
 * Get ticket details (customer can only see their own)
 */
router.get('/tickets/:id', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    const { id } = req.params;
    
    const ticket = await WorkOrder.findOne({
      _id: id,
      tenantId: customer.tenantId,
      $or: [
        { 'affectedCustomers.customerId': customer.customerId },
        { 
          customerReported: true, 
          'customerContact.email': customer.email 
        }
      ]
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

/**
 * POST /api/customer-portal/tickets/:id/comments
 * Add comment to ticket (customer)
 */
router.post('/tickets/:id/comments', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    const { id } = req.params;
    const { comment } = req.body;
    
    const ticket = await WorkOrder.findOne({
      _id: id,
      tenantId: customer.tenantId,
      $or: [
        { 'affectedCustomers.customerId': customer.customerId },
        { 
          customerReported: true, 
          'customerContact.email': customer.email 
        }
      ]
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Add comment to work performed
    if (!ticket.workPerformed) {
      ticket.workPerformed = [];
    }
    
    ticket.workPerformed.push({
      timestamp: new Date(),
      action: `Customer Comment: ${comment}`,
      performedBy: customer.customerId,
      performedByName: customer.fullName,
      notes: comment
    });
    
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Comment added',
      ticket
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/customer-portal/service
 * Get customer service information
 */
router.get('/service', requireCustomerAuth, async (req, res) => {
  try {
    const customer = req.customer;
    
    const serviceInfo = {
      serviceStatus: customer.serviceStatus,
      servicePlan: customer.servicePlan,
      serviceAddress: customer.serviceAddress,
      installation: customer.installation,
      networkInfo: customer.networkInfo,
      equipment: customer.installation?.equipment || []
    };
    
    res.json(serviceInfo);
  } catch (error) {
    console.error('Error fetching service info:', error);
    res.status(500).json({ error: 'Failed to fetch service information' });
  }
});

module.exports = router;

