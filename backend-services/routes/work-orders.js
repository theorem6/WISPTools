// Work Order & Ticketing API
// Manage field operations, installations, and trouble tickets

const express = require('express');
const router = express.Router();
const { WorkOrder } = require('../models/work-order');

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

// ========== WORK ORDERS / TICKETS ==========

// Get all work orders with filters
router.get('/', async (req, res) => {
  try {
    const { status, priority, assignedTo, type, siteId } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (type) query.type = type;
    if (siteId) query['affectedSites.siteId'] = siteId;
    
    const workOrders = await WorkOrder.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .lean();
    
    res.json(workOrders);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders', message: error.message });
  }
});

// Get single work order
router.get('/:id', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    }).lean();
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// Create work order
router.post('/', async (req, res) => {
  try {
    // Generate ticket number if not provided
    let ticketNumber = req.body.ticketNumber;
    if (!ticketNumber) {
      const count = await WorkOrder.countDocuments({ tenantId: req.tenantId });
      ticketNumber = `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    }
    
    const workOrder = new WorkOrder({
      ...req.body,
      tenantId: req.tenantId,
      ticketNumber
    });
    
    await workOrder.save();
    res.status(201).json(workOrder);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: 'Failed to create work order', details: error.message });
  }
});

// Update work order
router.put('/:id', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

// Delete work order
router.delete('/:id', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete work order' });
  }
});

// ========== ACTIONS ==========

// Assign work order to technician
router.post('/:id/assign', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    await workOrder.assignTo(userId, userName);
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign work order' });
  }
});

// Start work
router.post('/:id/start', async (req, res) => {
  try {
    const { userId } = req.body;
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    await workOrder.startWork(userId);
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start work' });
  }
});

// Add work log entry
router.post('/:id/log', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    await workOrder.addWorkLog(req.body);
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add work log' });
  }
});

// Complete work order
router.post('/:id/complete', async (req, res) => {
  try {
    const { resolution, rootCause, preventiveMeasures } = req.body;
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    workOrder.resolution = resolution;
    workOrder.rootCause = rootCause;
    workOrder.preventiveMeasures = preventiveMeasures;
    
    await workOrder.complete(resolution);
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete work order' });
  }
});

// Close work order
router.post('/:id/close', async (req, res) => {
  try {
    const workOrder = await WorkOrder.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }
    
    await workOrder.close();
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to close work order' });
  }
});

// ========== QUERIES ==========

// Get my assigned tickets
router.get('/assigned/:userId', async (req, res) => {
  try {
    const tickets = await WorkOrder.getAssignedTickets(req.tenantId, req.params.userId);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assigned tickets' });
  }
});

// Get tickets by site
router.get('/site/:siteId', async (req, res) => {
  try {
    const tickets = await WorkOrder.getBySite(req.tenantId, req.params.siteId);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch site tickets' });
  }
});

// Get SLA breached tickets
router.get('/alerts/sla-breach', async (req, res) => {
  try {
    const tickets = await WorkOrder.getSLABreached(req.tenantId);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SLA breached tickets' });
  }
});

// ========== STATISTICS ==========

router.get('/stats/dashboard', async (req, res) => {
  try {
    const stats = await WorkOrder.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          totalOpen: [
            { $match: { status: { $in: ['open', 'assigned', 'in-progress'] } } },
            { $count: 'total' }
          ],
          avgResolutionTime: [
            { $match: { completedAt: { $exists: true } } },
            {
              $project: {
                resolutionTime: {
                  $divide: [
                    { $subtract: ['$completedAt', '$createdAt'] },
                    3600000 // Convert to hours
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                avgHours: { $avg: '$resolutionTime' }
              }
            }
          ]
        }
      }
    ]);
    
    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================================================
// BULK IMPORT
// ============================================================================

/**
 * POST /api/work-orders/bulk-import
 * Bulk import work orders from CSV/JSON
 */
router.post('/bulk-import', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    const { workOrders } = req.body;
    
    if (!Array.isArray(workOrders) || workOrders.length === 0) {
      return res.status(400).json({ error: 'workOrders array is required and must not be empty' });
    }
    
    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };
    
    // Process work orders one by one
    for (let i = 0; i < workOrders.length; i++) {
      try {
        const woData = workOrders[i];
        
        // Generate ticket number if not provided
        let ticketNumber = woData.ticketNumber;
        if (!ticketNumber) {
          const count = await WorkOrder.countDocuments({ tenantId });
          ticketNumber = `TKT-${new Date().getFullYear()}-${String(count + results.imported + 1).padStart(4, '0')}`;
        }
        
        // Parse dates if strings
        if (woData.scheduledDate && typeof woData.scheduledDate === 'string') {
          woData.scheduledDate = new Date(woData.scheduledDate);
        }
        if (woData.dueDate && typeof woData.dueDate === 'string') {
          woData.dueDate = new Date(woData.dueDate);
        }
        
        // Ensure required fields
        if (!woData.title) {
          throw new Error('title is required');
        }
        
        if (!woData.type) {
          throw new Error('type is required');
        }
        
        const workOrder = new WorkOrder({
          ...woData,
          tenantId,
          ticketNumber
        });
        
        await workOrder.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: err.message || 'Failed to import'
        });
      }
    }
    
    res.json({
      message: 'Bulk import completed',
      ...results
    });
  } catch (error) {
    console.error('Error bulk importing work orders:', error);
    res.status(500).json({ error: 'Failed to bulk import work orders', message: error.message });
  }
});

module.exports = router;

