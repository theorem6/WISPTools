/**
 * Customer Management API
 * CRUD operations for customer records, service history, and complaints
 */

const express = require('express');
const router = express.Router();
const { Customer } = require('./customer-schema');

// ============================================================================
// CUSTOMER CRUD ENDPOINTS
// ============================================================================

/**
 * GET /api/customers
 * List all customers for tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }
    
    const { status, search, limit = 100 } = req.query;
    
    let query = { tenantId, isActive: true };
    
    // Filter by status
    if (status) {
      query.serviceStatus = status;
    }
    
    let customers;
    
    // Search by name, phone, or email
    if (search) {
      customers = await Customer.find({
        ...query,
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { primaryPhone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      })
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    } else {
      customers = await Customer.find(query)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });
    }
    
    res.json(customers);
  } catch (error) {
    console.error('Error listing customers:', error);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

/**
 * POST /api/customers
 * Create new customer
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }
    
    // Generate customer ID
    const count = await Customer.countDocuments({ tenantId });
    const customerId = `CUST-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    
    const customer = new Customer({
      ...req.body,
      tenantId,
      customerId
    });
    
    await customer.save();
    
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * GET /api/customers/:id
 * Get customer details
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    
    const customer = await Customer.findOne({ 
      tenantId, 
      $or: [
        { _id: id },
        { customerId: id }
      ]
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    
    const customer = await Customer.findOneAndUpdate(
      { 
        tenantId, 
        $or: [{ _id: id }, { customerId: id }]
      },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * DELETE /api/customers/:id
 * Soft delete customer
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    
    const customer = await Customer.findOneAndUpdate(
      { 
        tenantId, 
        $or: [{ _id: id }, { customerId: id }]
      },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted', customer });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ============================================================================
// SERVICE HISTORY
// ============================================================================

/**
 * POST /api/customers/:id/service-history
 * Add service history entry
 */
router.post('/:id/service-history', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    
    const customer = await Customer.findOneAndUpdate(
      { 
        tenantId, 
        $or: [{ _id: id }, { customerId: id }]
      },
      { 
        $push: { 
          serviceHistory: {
            ...req.body,
            date: new Date()
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error adding service history:', error);
    res.status(500).json({ error: 'Failed to add service history' });
  }
});

// ============================================================================
// COMPLAINTS
// ============================================================================

/**
 * POST /api/customers/:id/complaints
 * Add complaint
 */
router.post('/:id/complaints', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    
    const customer = await Customer.findOneAndUpdate(
      { 
        tenantId, 
        $or: [{ _id: id }, { customerId: id }]
      },
      { 
        $push: { 
          complaints: {
            ...req.body,
            date: new Date(),
            status: 'open'
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error adding complaint:', error);
    res.status(500).json({ error: 'Failed to add complaint' });
  }
});

/**
 * PUT /api/customers/:id/complaints/:complaintId
 * Update complaint status
 */
router.put('/:id/complaints/:complaintId', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { id, complaintId } = req.params;
    
    const customer = await Customer.findOneAndUpdate(
      { 
        tenantId, 
        $or: [{ _id: id }, { customerId: id }],
        'complaints._id': complaintId
      },
      { 
        $set: { 
          'complaints.$': {
            ...req.body,
            _id: complaintId
          }
        },
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer or complaint not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// ============================================================================
// SEARCH & LOOKUP
// ============================================================================

/**
 * GET /api/customers/search/phone/:phone
 * Lookup customer by phone number
 */
router.get('/search/phone/:phone', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { phone } = req.params;
    
    const customers = await Customer.find({
      tenantId,
      isActive: true,
      $or: [
        { primaryPhone: { $regex: phone, $options: 'i' } },
        { alternatePhone: { $regex: phone, $options: 'i' } }
      ]
    }).limit(10);
    
    res.json(customers);
  } catch (error) {
    console.error('Error searching by phone:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

/**
 * GET /api/customers/search/email/:email
 * Lookup customer by email
 */
router.get('/search/email/:email', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { email } = req.params;
    
    const customers = await Customer.find({
      tenantId,
      isActive: true,
      email: { $regex: email, $options: 'i' }
    }).limit(10);
    
    res.json(customers);
  } catch (error) {
    console.error('Error searching by email:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

/**
 * GET /api/customers/search/imsi/:imsi
 * Lookup customer by IMSI
 */
router.get('/search/imsi/:imsi', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { imsi } = req.params;
    
    const customers = await Customer.find({
      tenantId,
      isActive: true,
      'networkInfo.imsi': { $regex: imsi, $options: 'i' }
    }).limit(10);
    
    res.json(customers);
  } catch (error) {
    console.error('Error searching by IMSI:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * GET /api/customers/stats
 * Get customer statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    const total = await Customer.countDocuments({ tenantId, isActive: true });
    const active = await Customer.countDocuments({ tenantId, isActive: true, serviceStatus: 'active' });
    const pending = await Customer.countDocuments({ tenantId, isActive: true, serviceStatus: 'pending' });
    const suspended = await Customer.countDocuments({ tenantId, isActive: true, serviceStatus: 'suspended' });
    
    // Open complaints
    const openComplaints = await Customer.aggregate([
      { $match: { tenantId, isActive: true } },
      { $unwind: '$complaints' },
      { $match: { 'complaints.status': { $in: ['open', 'in-progress'] } } },
      { $count: 'total' }
    ]);
    
    res.json({
      total,
      active,
      pending,
      suspended,
      openComplaints: openComplaints[0]?.total || 0
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;

