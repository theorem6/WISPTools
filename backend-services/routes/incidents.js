// Incidents API
// Manage auto-reported incidents from monitoring, app, or manual reports

const express = require('express');
const router = express.Router();
const { Incident } = require('../models/incident');
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

// ========== INCIDENTS ==========

// Get all incidents with filters
router.get('/', async (req, res) => {
  try {
    const { status, severity, incidentType, source, siteId, converted } = req.query;
    const query = { tenantId: req.tenantId };
    
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (incidentType) query.incidentType = incidentType;
    if (source) query.source = source;
    if (siteId) query['affectedSites.siteId'] = siteId;
    if (converted === 'true') {
      query.relatedTicketId = { $exists: true, $ne: null };
    } else if (converted === 'false') {
      query.relatedTicketId = { $exists: false };
    }
    
    const incidents = await Incident.find(query)
      .sort({ severity: -1, detectedAt: -1 })
      .lean();
    
    res.json(incidents);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents', message: error.message });
  }
});

// Get single incident
router.get('/:id', async (req, res) => {
  try {
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    }).lean();
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Include related ticket if exists
    if (incident.relatedTicketId) {
      const ticket = await WorkOrder.findOne({ _id: incident.relatedTicketId }).lean();
      if (ticket) {
        incident.relatedTicket = ticket;
      }
    }
    
    res.json(incident);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

// Create incident (typically auto-created, but allows manual creation)
router.post('/', async (req, res) => {
  try {
    const incidentCreationService = require('../services/incident-creation-service');
    const { source, sourceData, appUser, employee } = req.body;
    
    let incident;
    
    // Route to appropriate creation method based on source
    if (source === 'mobile-app') {
      incident = await incidentCreationService.createFromAppEvent(
        { ...sourceData, tenantId: req.tenantId },
        appUser
      );
    } else if (source === 'employee-report') {
      incident = await incidentCreationService.createFromEmployeeReport(
        { ...sourceData, tenantId: req.tenantId },
        employee
      );
    } else {
      // Direct creation (manual or system)
      const incident = new Incident({
        ...req.body,
        tenantId: req.tenantId
      });
      await incident.save();
      res.status(201).json(incident);
      return;
    }
    
    res.status(201).json(incident);
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident', details: error.message });
  }
});

// Update incident
router.put('/:id', async (req, res) => {
  try {
    const incident = await Incident.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ error: 'Failed to update incident', details: error.message });
  }
});

// Acknowledge incident
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    await incident.acknowledge(userId, userName);
    res.json(incident);
  } catch (error) {
    console.error('Error acknowledging incident:', error);
    res.status(500).json({ error: 'Failed to acknowledge incident' });
  }
});

// Convert incident to ticket
router.post('/:id/convert-to-ticket', async (req, res) => {
  try {
    const { priority, assignedTo, assignedToName, title, description } = req.body;
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Create work order from incident
    const ticketCount = await WorkOrder.countDocuments({ tenantId: req.tenantId });
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(4, '0')}`;
    
    // Map incident type to work order type
    const typeMap = {
      'cpe-offline': 'troubleshoot',
      'sector-down': 'repair',
      'backhaul-failure': 'repair',
      'network-outage': 'troubleshoot',
      'equipment-failure': 'repair',
      'power-outage': 'repair',
      'performance-degradation': 'troubleshoot',
      'configuration-error': 'repair',
      'security-breach': 'inspection',
      'fiber-cut': 'repair',
      'tower-issue': 'inspection',
      'environmental': 'inspection',
      'other': 'troubleshoot'
    };
    
    const workOrderType = typeMap[incident.incidentType] || 'troubleshoot';
    
    // Map incident category
    const ticketCategory = incident.source === 'customer-report' 
      ? 'customer-facing' 
      : 'infrastructure';
    
    // Determine priority from severity if not provided
    const workOrderPriority = priority || incident.severity || 'medium';
    
    const workOrder = new WorkOrder({
      tenantId: req.tenantId,
      ticketNumber,
      type: workOrderType,
      ticketCategory,
      issueCategory: incident.incidentType,
      priority: workOrderPriority,
      status: assignedTo ? 'assigned' : 'open',
      title: title || incident.title,
      description: description || incident.description || incident.initialObservations,
      assignedTo: assignedTo || undefined,
      assignedToName: assignedToName || undefined,
      assignedAt: assignedTo ? new Date() : undefined,
      affectedEquipment: incident.affectedEquipment || [],
      affectedSites: incident.affectedSites || [],
      affectedCustomers: incident.affectedCustomers || [],
      location: incident.location,
      customerReported: incident.source === 'customer-report',
      internalNotes: `Converted from incident ${incident.incidentNumber}\nSource: ${incident.source}\nDetected: ${incident.detectedAt}`,
      createdAt: new Date()
    });
    
    await workOrder.save();
    
    // Update incident
    await incident.convertToTicket(workOrder._id.toString(), ticketNumber, req.body.userId || 'system');
    
    res.json({
      incident,
      ticket: workOrder
    });
  } catch (error) {
    console.error('Error converting incident to ticket:', error);
    res.status(500).json({ error: 'Failed to convert incident to ticket', details: error.message });
  }
});

// Resolve incident
router.post('/:id/resolve', async (req, res) => {
  try {
    const { resolution, userId } = req.body;
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    await incident.resolve(resolution, userId);
    res.json(incident);
  } catch (error) {
    console.error('Error resolving incident:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// Close incident
router.post('/:id/close', async (req, res) => {
  try {
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    await incident.close();
    res.json(incident);
  } catch (error) {
    console.error('Error closing incident:', error);
    res.status(500).json({ error: 'Failed to close incident' });
  }
});

// Add investigation note
router.post('/:id/notes', async (req, res) => {
  try {
    const { note, userId, userName } = req.body;
    const incident = await Incident.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    incident.investigationNotes.push({
      note,
      addedBy: userId,
      addedByName: userName
    });
    
    await incident.save();
    res.json(incident);
  } catch (error) {
    console.error('Error adding investigation note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Get incident statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const active = await Incident.countDocuments({
      tenantId,
      status: { $in: ['new', 'investigating', 'acknowledged', 'mitigated'] }
    });
    
    const critical = await Incident.countDocuments({
      tenantId,
      severity: 'critical',
      status: { $in: ['new', 'investigating', 'acknowledged', 'mitigated'] }
    });
    
    const bySeverity = await Incident.aggregate([
      { $match: { tenantId, status: { $in: ['new', 'investigating', 'acknowledged', 'mitigated'] } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);
    
    const byType = await Incident.aggregate([
      { $match: { tenantId, status: { $in: ['new', 'investigating', 'acknowledged', 'mitigated'] } } },
      { $group: { _id: '$incidentType', count: { $sum: 1 } } }
    ]);
    
    res.json({
      active,
      critical,
      bySeverity,
      byType
    });
  } catch (error) {
    console.error('Error fetching incident stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
