/**
 * Manual Tenant Creation Script
 * Creates a tenant and assigns david@tenant.com as owner
 */

const mongoose = require('mongoose');
const { Tenant } = require('./backend-services/tenant-schema');
const { UserTenant } = require('./backend-services/user-schema');

const MONGODB_URI = 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

async function createTenant() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Create the tenant
    const tenant = new Tenant({
      name: 'Davids Tenant',
      displayName: 'Davids Tenant',
      subdomain: 'davids-tenant',
      contactEmail: 'david@tenant.com',
      cwmpUrl: 'https://davids-tenant.lte-pci-mapper-65450042-bbf71.us-east4.hosted.app',
      createdBy: 'system',
      status: 'active',
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
    console.log('✅ Tenant created:', tenant._id.toString());
    console.log('   Name:', tenant.displayName);
    console.log('   Subdomain:', tenant.subdomain);
    
    // Create user-tenant association for david@tenant.com
    const userTenant = new UserTenant({
      userId: 'e6VVuSMxyzZIbm8q1E2eOI7eh6V2',
      tenantId: tenant._id.toString(),
      role: 'owner',
      status: 'active',
      invitedBy: 'system',
      invitedAt: new Date(),
      acceptedAt: new Date(),
      addedAt: new Date()
    });
    
    await userTenant.save();
    console.log('✅ User-tenant association created');
    console.log('   User: david@tenant.com');
    console.log('   Role: owner');
    
    // Verify
    const userTenants = await UserTenant.find({ userId: 'e6VVuSMxyzZIbm8q1E2eOI7eh6V2' });
    console.log('✅ Verified:', userTenants.length, 'tenant(s) for david@tenant.com');
    
    await mongoose.disconnect();
    console.log('');
    console.log('✅ SUCCESS! You can now log in as david@tenant.com');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTenant();

