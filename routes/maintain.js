// Maintain Module API
// Unified API for ticketing, maintenance, incidents, and customer management
//
const express = require('express');
const router = express.Router();
// Use schema files that match server structure
// On server: files are in /opt/hss-api/ (work-order-schema.js, customer-schema.js)
// On dev: files are in models/ directory
// Load models - server uses schema files at root, dev uses models/ directory
let WorkOrder, Customer;
try {
  // Server structure: /opt/hss-api/work-order-schema.js
  const workOrderSchema = require('../work-order-schema');
  const customerSchema = require('../customer-schema');
  WorkOrder = workOrderSchema.WorkOrder || workOrderSchema;
  Customer = customerSchema.Customer || customerSchema;
} catch (e) {
  // Dev structure fallback
  try {
    const workOrderModel = require('../models/work-order');
    const customerModel = require('../models/customer');
    WorkOrder = workOrderModel.WorkOrder;
    Customer = customerModel.Customer;
  } catch (e2) {
    console.error('Could not load models:', e2.message);
    // Don't throw - allow partial functionality
    WorkOrder = null;
    Customer = null;
  }
}

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

// ========== DASHBOARD STATS ==========
router.get('/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Get work order stats
    const openTickets = await WorkOrder.countDocuments({ 
      tenantId, 
      status: { $in: ['open', 'assigned', 'in-progress'] } 
    });
    
    const scheduledMaintenance = await WorkOrder.countDocuments({ 
      tenantId, 
      type: 'maintenance', 
      status: { $nin: ['closed', 'cancelled'] } 
    });
    
    const criticalTickets = await WorkOrder.countDocuments({ 
      tenantId, 
      priority: 'critical', 
      status: { $in: ['open', 'assigned', 'in-progress'] } 
    });
    
    // Get customer stats
    let totalCustomers = 0;
    let activeCustomers = 0;
    if (Customer) {
      totalCustomers = await Customer.countDocuments({ tenantId });
      activeCustomers = await Customer.countDocuments({ 
        tenantId, 
        serviceStatus: 'active' 
      });
    }
    
    // Calculate average response time
    const resolvedOrders = await WorkOrder.find({
      tenantId,
      status: { $in: ['resolved', 'closed'] },
      assignedAt: { $exists: true },
      createdAt: { $exists: true }
    }).lean();
    
    let avgResponseTime = 0;
    if (resolvedOrders.length > 0) {
      const totalResponseTime = resolvedOrders.reduce((sum, order) => {
        const responseTime = new Date(order.assignedAt).getTime() - new Date(order.createdAt).getTime();
        return sum + (responseTime / (1000 * 60 * 60)); // Convert to hours
      }, 0);
      avgResponseTime = Math.round((totalResponseTime / resolvedOrders.length) * 10) / 10;
    }
    
    res.json({
      tickets: {
        open: openTickets,
        critical: criticalTickets,
        scheduled: scheduledMaintenance
      },
      customers: {
        total: totalCustomers,
        active: activeCustomers
      },
      metrics: {
        avgResponseTime: `${avgResponseTime}h`,
        totalTickets: await WorkOrder.countDocuments({ tenantId }),
        resolvedTickets: await WorkOrder.countDocuments({ 
          tenantId, 
          status: { $in: ['resolved', 'closed'] } 
        })
      }
    });
  } catch (error) {
    console.error('Error fetching maintain dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', message: error.message });
  }
});

// ========== RECENT ACTIVITY ==========
router.get('/dashboard/activity', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get recent work orders
    const recentTickets = await WorkOrder.find({ tenantId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    
    // Get recent customers
    let recentCustomers = [];
    if (Customer) {
      recentCustomers = await Customer.find({ tenantId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
    }
    
    // Combine and sort by date
    const activity = [
      ...recentTickets.map(t => ({
        type: 'ticket',
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        timestamp: t.updatedAt || t.createdAt
      })),
      ...recentCustomers.map(c => ({
        type: 'customer',
        id: c._id,
        title: `${c.firstName} ${c.lastName}`,
        status: c.serviceStatus,
        timestamp: c.updatedAt || c.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, limit);
    
    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity', message: error.message });
  }
});

module.exports = router;

