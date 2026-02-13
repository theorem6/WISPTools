/**
 * Unified Tenant Management API
 * 
 * Complete CRUD operations for tenants using MongoDB
 * Only accessible by platform admin (admin@wisptools.io by default)
 */

const express = require('express');
const admin = require('firebase-admin');
const { Tenant } = require('../../models/tenant');
const { UserTenant } = require('../users/user-schema');
const { PlanProject } = require('../../models/plan');
const { PlanLayerFeature } = require('../../models/plan-layer-feature');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../../models/network');
const { InventoryItem } = require('../../models/inventory');
const { WorkOrder } = require('../../models/work-order');
const { Customer } = require('../../models/customer');
const InstallationDocumentation = require('../../models/installation-documentation');
const { verifyAuth, isPlatformAdminUser } = require('../users/role-auth-middleware');
const { PLATFORM_ADMIN_EMAILS } = require('../../utils/platformAdmin');

const router = express.Router();

// All routes require platform admin (checked by UID, not email)
router.use(verifyAuth);
router.use((req, res, next) => {
  if (!isPlatformAdminUser(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Platform admin access required'
    });
  }
  next();
});

/**
 * GET /admin/tenants
 * Get all tenants (with optional filtering)
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    
    const filter = {};
    if (status) {
      filter.status = status;
    }
    
    const tenants = await Tenant.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    
    // Get user counts for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const userCount = await UserTenant.countDocuments({ 
          tenantId: tenant._id.toString(),
          status: 'active'
        });
        
        return {
          ...tenant,
          id: tenant._id.toString(),
          userCount
        };
      })
    );
    
    res.json(tenantsWithStats);
  } catch (error) {
    console.error('Error getting tenants:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /admin/tenants/:tenantId
 * Get a specific tenant by ID
 */
router.get('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    // Get user count
    const userCount = await UserTenant.countDocuments({ 
      tenantId: tenantId,
      status: 'active'
    });
    
    res.json({
      ...tenant,
      id: tenant._id.toString(),
      userCount
    });
  } catch (error) {
    console.error('Error getting tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /admin/tenants
 * Create a new tenant
 */
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      displayName, 
      contactEmail, 
      subdomain,
      ownerEmail 
    } = req.body;
    
    if (!name || !displayName || !contactEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, displayName, and contactEmail are required'
      });
    }
    
    // Generate subdomain if not provided
    let finalSubdomain = subdomain;
    if (!finalSubdomain) {
      finalSubdomain = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
    
    // Check if subdomain is already taken
    const existingTenant = await Tenant.findOne({ subdomain: finalSubdomain });
    if (existingTenant) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Subdomain already taken'
      });
    }
    
    // Generate tenant-specific CWMP URL
    // Format: https://wisptools.io/cwmp/{subdomain}
    const cwmpBaseUrl = process.env.CWMP_BASE_URL || process.env.PUBLIC_CWMP_BASE_URL || 'https://wisptools.io';
    const cwmpUrl = `${cwmpBaseUrl}/cwmp/${finalSubdomain}`;
    
    // Create tenant
    const tenant = new Tenant({
      name,
      displayName,
      subdomain: finalSubdomain,
      contactEmail,
      cwmpUrl,
      createdBy: req.user.uid,
      settings: {
        allowSelfRegistration: false,
        requireEmailVerification: true,
        maxUsers: 50,
        maxDevices: 20,
        features: {
          acs: true,
          hss: true,
          pci: true,
          helpDesk: true,
          userManagement: true,
          customerManagement: true
        }
      },
      limits: {
        maxUsers: 50,
        maxDevices: 20,
        maxNetworks: 10,
        maxTowerSites: 100
      }
    });
    
    await tenant.save();
    
    // Use contactEmail as owner if ownerEmail is not explicitly provided
    const finalOwnerEmail = ownerEmail || contactEmail;
    
    // Create owner association for the contact/owner email
    if (finalOwnerEmail) {
      try {
        const firebaseUser = await admin.auth().getUserByEmail(finalOwnerEmail);
        
        const userTenant = new UserTenant({
          userId: firebaseUser.uid,
          tenantId: tenant._id.toString(),
          role: 'owner',
          status: 'active',
          invitedBy: req.user.uid,
          invitedAt: new Date(),
          acceptedAt: new Date(),
          addedAt: new Date()
        });
        
        await userTenant.save();
        
        console.log(`✅ Created tenant "${displayName}" with owner ${finalOwnerEmail}`);
      } catch (error) {
        console.error(`⚠️ Created tenant but failed to assign owner ${finalOwnerEmail}:`, error.message);
        // Note: If the user doesn't exist in Firebase yet, they can log in later and will be auto-assigned
      }
    }
    
    // ALWAYS add platform administrators to every tenant
    for (const platformAdminEmail of PLATFORM_ADMIN_EMAILS) {
      try {
        const platformAdminUser = await admin.auth().getUserByEmail(platformAdminEmail);
        const platformAdminUserId = platformAdminUser.uid;
        
        const existingPlatformAdmin = await UserTenant.findOne({
          userId: platformAdminUserId,
          tenantId: tenant._id.toString()
        });
        
        if (!existingPlatformAdmin) {
          const platformAdminTenant = new UserTenant({
            userId: platformAdminUserId,
            tenantId: tenant._id.toString(),
            role: 'admin',
            status: 'active',
            invitedBy: req.user.uid,
            invitedAt: new Date(),
            acceptedAt: new Date(),
            addedAt: new Date()
          });
          
          await platformAdminTenant.save();
          console.log(`✅ Added platform admin ${platformAdminEmail} (${platformAdminUserId}) as admin to tenant "${displayName}"`);
        }
      } catch (error) {
        console.error(`⚠️ Failed to add platform admin ${platformAdminEmail} to tenant:`, error.message);
      }
    }
    
    res.status(201).json({
      success: true,
      tenant: {
        ...tenant.toObject(),
        id: tenant._id.toString()
      }
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * PUT /admin/tenants/:tenantId
 * Update a tenant
 */
router.put('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      name, 
      displayName, 
      contactEmail, 
      subdomain,
      status,
      settings,
      limits 
    } = req.body;
    
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    // Update fields
    if (name !== undefined) tenant.name = name;
    if (displayName !== undefined) tenant.displayName = displayName;
    if (contactEmail !== undefined) tenant.contactEmail = contactEmail;
    if (subdomain !== undefined) {
      // Check if new subdomain is available
      const existingTenant = await Tenant.findOne({ 
        subdomain: subdomain,
        _id: { $ne: tenantId }
      });
      if (existingTenant) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Subdomain already taken'
        });
      }
      tenant.subdomain = subdomain;
      tenant.cwmpUrl = `https://${subdomain}.lte-pci-mapper-65450042-bbf71.us-east4.hosted.app`;
    }
    if (status !== undefined) tenant.status = status;
    if (settings !== undefined) tenant.settings = { ...tenant.settings, ...settings };
    if (limits !== undefined) tenant.limits = { ...tenant.limits, ...limits };
    
    await tenant.save();
    
    res.json({
      success: true,
      tenant: {
        ...tenant.toObject(),
        id: tenant._id.toString()
      }
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * DELETE /admin/tenants/:tenantId
 * Delete a tenant (hard delete with cascade)
 */
router.delete('/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    console.log(`🗑️ Starting deletion of tenant: ${tenant.displayName} (${tenantId})`);
    
    // Delete all user-tenant associations
    const userAssociations = await UserTenant.find({ tenantId });
    console.log(`🗑️ Deleting ${userAssociations.length} user associations...`);
    
    await UserTenant.deleteMany({ tenantId });

    // Cascade delete tenant-scoped data across collections
    const [
      planResult,
      featureResult,
      siteResult,
      sectorResult,
      cpeResult,
      equipmentResult,
      deploymentResult,
      inventoryResult,
      workOrderResult,
      customerResult,
      installationResult
    ] = await Promise.all([
      PlanProject.deleteMany({ tenantId }),
      PlanLayerFeature.deleteMany({ tenantId }),
      UnifiedSite.deleteMany({ tenantId }),
      UnifiedSector.deleteMany({ tenantId }),
      UnifiedCPE.deleteMany({ tenantId }),
      NetworkEquipment.deleteMany({ tenantId }),
      HardwareDeployment.deleteMany({ tenantId }),
      InventoryItem.deleteMany({ tenantId }),
      WorkOrder.deleteMany({ tenantId }),
      Customer.deleteMany({ tenantId }),
      InstallationDocumentation.deleteMany({ tenantId })
    ]);
    
    // Delete the tenant
    await Tenant.findByIdAndDelete(tenantId);
    
    console.log(`✅ Tenant "${tenant.displayName}" deleted successfully`);
    
    res.json({
      success: true,
      message: `Tenant "${tenant.displayName}" deleted successfully`,
      deletedAssociations: userAssociations.length,
      cascade: {
        plans: planResult.deletedCount || 0,
        planFeatures: featureResult.deletedCount || 0,
        sites: siteResult.deletedCount || 0,
        sectors: sectorResult.deletedCount || 0,
        cpeDevices: cpeResult.deletedCount || 0,
        equipment: equipmentResult.deletedCount || 0,
        hardwareDeployments: deploymentResult.deletedCount || 0,
        inventoryItems: inventoryResult.deletedCount || 0,
        workOrders: workOrderResult.deletedCount || 0,
        customers: customerResult.deletedCount || 0,
        installationDocs: installationResult.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * POST /admin/tenants/:tenantId/assign-owner
 * Assign or change the owner of a tenant
 */
router.post('/:tenantId/assign-owner', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email is required'
      });
    }
    
    // Verify tenant exists
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    console.log(`[Admin] Assigning owner ${email} to tenant ${tenant.displayName}`);
    
    // Get Firebase user by email
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({
        error: 'User Not Found',
        message: `No Firebase user found with email: ${email}`
      });
    }
    
    const userId = firebaseUser.uid;
    
    // Check if user already has a record for this tenant
    let userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (userTenant) {
      // Update existing record to owner
      const oldRole = userTenant.role;
      userTenant.role = 'owner';
      userTenant.status = 'active';
      await userTenant.save();
      
      console.log(`✅ Updated ${email} from ${oldRole} to owner in tenant ${tenant.displayName}`);
      
      return res.json({
        success: true,
        message: `Updated ${email} from ${oldRole} to owner`,
        userId,
        previousRole: oldRole,
        newRole: 'owner'
      });
    } else {
      // Create new owner record
      userTenant = new UserTenant({
        userId,
        tenantId,
        role: 'owner',
        status: 'active',
        invitedBy: req.user.uid,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        addedAt: new Date()
      });
      
      await userTenant.save();
      
      console.log(`✅ Created owner record for ${email} in tenant ${tenant.displayName}`);
      
      return res.json({
        success: true,
        message: `Assigned ${email} as owner`,
        userId,
        newRole: 'owner'
      });
    }
  } catch (error) {
    console.error('Error assigning owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /admin/tenants/:tenantId/users
 * Get all users in a tenant
 */
router.get('/:tenantId/users', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const userTenants = await UserTenant.find({ tenantId }).lean();
    
    // Get Firebase user details
    const users = [];
    for (const ut of userTenants) {
      try {
        const firebaseUser = await admin.auth().getUser(ut.userId);
        users.push({
          uid: ut.userId,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          role: ut.role,
          status: ut.status,
          addedAt: ut.addedAt
        });
      } catch (error) {
        console.error(`Failed to get user ${ut.userId}:`, error);
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error getting tenant users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
