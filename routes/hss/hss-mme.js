/**
 * HSS MME Connections Routes
 * MME connection management endpoints
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC } = require('../../models/distributed-epc-schema');
const { ensureDB } = require('./hss-middleware');

// Apply middleware to all routes
router.use(ensureDB);

// MME Connections endpoint
// GET /api/hss/mme-connections - List MME connections (EPCs that act as MMEs)
router.get('/mme-connections', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Query RemoteEPC for active EPC connections (MMEs connect via EPCs)
    const epcs = await RemoteEPC.find({
      tenant_id: tenantId,
      status: { $in: ['online', 'registered'] }
    })
      .select('epc_id site_name status last_heartbeat last_seen network_config location')
      .lean();
    
    // Map EPCs to MME connection format
    const connections = epcs.map(epc => {
      // Extract IP from network_config or use location-based IP
      const mmeIp = epc.network_config?.mme_address || 
                    epc.location?.coordinates || 
                    'N/A';
      
      return {
        mme_id: epc.epc_id,
        epc_id: epc.epc_id,
        site_name: epc.site_name,
        ip_address: typeof mmeIp === 'object' ? 'auto-detected' : mmeIp,
        status: epc.status === 'online' ? 'active' : 'inactive',
        last_seen: epc.last_seen || epc.last_heartbeat || epc.updated_at,
        tenant_id: tenantId,
        location: epc.location
      };
    });

    res.json(connections);
  } catch (error) {
    console.error('Error fetching MME connections:', error);
    res.status(500).json({ error: 'Failed to fetch MME connections', message: error.message });
  }
});

module.exports = router;
