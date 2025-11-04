/**
 * User Tenant Creation API
 * Allows regular users to create their FIRST tenant only
 * Users can only have one tenant - it's theirs permanently
 * Only system admin can delete tenants
 */

const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');
const { verifyAuth } = require('./users/role-auth-middleware');
const { Tenant } = require('../models/tenant');
const { UserTenant } = require('./users/user-schema');

/**
 * POST /api/tenants
 * Create a new tenant (for regular users - their first tenant only)
 */
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    
    // Check if user already has a tenant
    const existingTenants = await UserTenant.find({ 
      userId,
      status: 'active'
    });
    
    if (existingTenants.length > 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You already have a tenant. Each user can only create one tenant.'
      });
    }
    
    const { 
      name, 
      displayName, 
      contactEmail, 
      subdomain 
    } = req.body;
    
    if (!name || !displayName || !contactEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, displayName, and contactEmail are required'
      });
    }
    
    // Use user's email if contactEmail not provided
    const finalContactEmail = contactEmail || userEmail;
    
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
    
    // Generate CWMP URL
    const cwmpUrl = `https://${finalSubdomain}.lte-pci-mapper-65450042-bbf71.us-east4.hosted.app`;
    
    // Create tenant
    const tenant = new Tenant({
      name,
      displayName,
      subdomain: finalSubdomain,
      contactEmail: finalContactEmail,
      cwmpUrl,
      createdBy: userId,
      settings: {
        allowSelfRegistration: false,
        requireEmailVerification: true,
        maxUsers: 50,
        maxDevices: 1000,
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
        maxDevices: 1000,
        maxNetworks: 10,
        maxTowerSites: 100
      }
    });
    
    await tenant.save();
    
    // Create owner association for the user
    const userTenant = new UserTenant({
      userId,
      tenantId: tenant._id.toString(),
      role: 'owner',
      status: 'active',
      invitedBy: userId,
      invitedAt: new Date(),
      acceptedAt: new Date(),
      addedAt: new Date()
    });
    
    await userTenant.save();
    
    // ALWAYS add david@david.com as platform admin for every tenant
    try {
      const platformAdminEmail = 'david@david.com';
      const platformAdminUid = '1tf7J4Df4jMuZlEfrRQZ3Kmj1Gy1'; // Known UID for david@david.com
      
      let platformAdminUserId;
      try {
        // Try to get user by email first
        const platformAdminUser = await admin.auth().getUserByEmail(platformAdminEmail);
        platformAdminUserId = platformAdminUser.uid;
      } catch (emailError) {
        // If email lookup fails, use the known UID
        console.warn(`Could not find user by email ${platformAdminEmail}, using known UID:`, emailError.message);
        platformAdminUserId = platformAdminUid;
      }
      
      // Check if platform admin already has a record for this tenant
      const existingPlatformAdmin = await UserTenant.findOne({
        userId: platformAdminUserId,
        tenantId: tenant._id.toString()
      });
      
      if (!existingPlatformAdmin) {
        const platformAdminTenant = new UserTenant({
          userId: platformAdminUserId,
          tenantId: tenant._id.toString(),
          role: 'admin', // Platform admin gets admin role in all tenants
          status: 'active',
          invitedBy: userId,
          invitedAt: new Date(),
          acceptedAt: new Date(),
          addedAt: new Date()
        });
        
        await platformAdminTenant.save();
        console.log(`✅ Added platform admin ${platformAdminEmail} (${platformAdminUserId}) as admin to tenant "${displayName}"`);
      }
    } catch (error) {
      console.error(`⚠️ Failed to add platform admin to tenant:`, error.message);
      console.error(`⚠️ Error stack:`, error.stack);
      // Don't fail tenant creation if platform admin addition fails
    }
    
    console.log(`✅ User ${userEmail} created their tenant "${displayName}" (${tenant._id})`);
    
    res.status(201).json({
      success: true,
      tenant: {
        ...tenant.toObject(),
        id: tenant._id.toString()
      }
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map((err) => err.message);
      return res.status(400).json({
        error: 'Validation Error',
        message: validationErrors.join(', ')
      });
    }
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000 || error.code === 11001) {
      return res.status(400).json({
        error: 'Duplicate Entry',
        message: 'A tenant with this subdomain already exists'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;

