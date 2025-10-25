/**
 * HSS Management Routes
 * Home Subscriber Server management endpoints
 */

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
let db;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI)
  .then(client => {
    db = client.db('hss_management');
    console.log('✅ HSS Management: Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ HSS Management: MongoDB connection failed:', err);
  });

// Middleware to ensure database connection
const ensureDB = (req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  req.db = db;
  next();
};

// Apply middleware to all routes
router.use(ensureDB);

// HSS Stats endpoint
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const stats = {
      total_subscribers: await req.db.collection('subscribers').countDocuments({ tenant_id: tenantId }),
      active_subscribers: await req.db.collection('subscribers').countDocuments({ 
        tenant_id: tenantId, 
        enabled: true 
      }),
      total_groups: await req.db.collection('groups').countDocuments({ tenant_id: tenantId }),
      total_bandwidth_plans: await req.db.collection('bandwidth_plans').countDocuments({ tenant_id: tenantId }),
      total_epcs: await req.db.collection('epcs').countDocuments({ tenant_id: tenantId }),
      recent_authentications: await req.db.collection('subscriber_sessions').countDocuments({
        tenant_id: tenantId,
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      })
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching HSS stats:', error);
    res.status(500).json({ error: 'Failed to fetch HSS stats' });
  }
});

// Subscribers endpoints
router.get('/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const subscribers = await req.db.collection('subscribers')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

router.post('/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const subscriber = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('subscribers').insertOne(subscriber);
    res.status(201).json({ id: result.insertedId, ...subscriber });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: 'Failed to create subscriber' });
  }
});

router.put('/subscribers/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    const result = await req.db.collection('subscribers').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

router.delete('/subscribers/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('subscribers').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

// Groups endpoints
router.get('/groups', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const groups = await req.db.collection('groups')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const group = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('groups').insertOne(group);
    res.status(201).json({ id: result.insertedId, ...group });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    const result = await req.db.collection('groups').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('groups').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Bandwidth Plans endpoints
router.get('/bandwidth-plans', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const plans = await req.db.collection('bandwidth_plans')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(plans);
  } catch (error) {
    console.error('Error fetching bandwidth plans:', error);
    res.status(500).json({ error: 'Failed to fetch bandwidth plans' });
  }
});

router.post('/bandwidth-plans', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const plan = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('bandwidth_plans').insertOne(plan);
    res.status(201).json({ id: result.insertedId, ...plan });
  } catch (error) {
    console.error('Error creating bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to create bandwidth plan' });
  }
});

router.put('/bandwidth-plans/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    const result = await req.db.collection('bandwidth_plans').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to update bandwidth plan' });
  }
});

router.delete('/bandwidth-plans/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('bandwidth_plans').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting bandwidth plan:', error);
    res.status(500).json({ error: 'Failed to delete bandwidth plan' });
  }
});

// EPCs endpoints
router.get('/epcs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const epcs = await req.db.collection('epcs')
      .find({ tenant_id: tenantId })
      .toArray();

    res.json(epcs);
  } catch (error) {
    console.error('Error fetching EPCs:', error);
    res.status(500).json({ error: 'Failed to fetch EPCs' });
  }
});

router.post('/epcs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const epc = {
      ...req.body,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await req.db.collection('epcs').insertOne(epc);
    res.status(201).json({ id: result.insertedId, ...epc });
  } catch (error) {
    console.error('Error creating EPC:', error);
    res.status(500).json({ error: 'Failed to create EPC' });
  }
});

router.put('/epcs/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    const result = await req.db.collection('epcs').updateOne(
      { _id: id, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    res.json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Error updating EPC:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

router.delete('/epcs/:id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { id } = req.params;
    const result = await req.db.collection('epcs').deleteOne({
      _id: id,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'EPC not found' });
    }

    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting EPC:', error);
    res.status(500).json({ error: 'Failed to delete EPC' });
  }
});

// MME Connections endpoint
router.get('/mme-connections', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // This would typically query Open5GS HSS for active MME connections
    // For now, return mock data
    const connections = [
      {
        mme_id: 'mme-001',
        ip_address: '192.168.1.100',
        status: 'active',
        last_seen: new Date(),
        tenant_id: tenantId
      }
    ];

    res.json(connections);
  } catch (error) {
    console.error('Error fetching MME connections:', error);
    res.status(500).json({ error: 'Failed to fetch MME connections' });
  }
});

// Bulk Import endpoint
router.post('/bulk-import', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const { type, data } = req.body; // type: 'subscribers', 'groups', 'plans', 'epcs'
    
    if (!type || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid bulk import data' });
    }

    const collection = type === 'subscribers' ? 'subscribers' :
                      type === 'groups' ? 'groups' :
                      type === 'plans' ? 'bandwidth_plans' :
                      type === 'epcs' ? 'epcs' : null;

    if (!collection) {
      return res.status(400).json({ error: 'Invalid import type' });
    }

    // Add tenant_id and timestamps to all items
    const itemsToInsert = data.map(item => ({
      ...item,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    }));

    const result = await req.db.collection(collection).insertMany(itemsToInsert);
    
    res.json({
      success: true,
      imported: result.insertedCount,
      type: type
    });
  } catch (error) {
    console.error('Error bulk importing:', error);
    res.status(500).json({ error: 'Failed to bulk import data' });
  }
});

module.exports = router;
