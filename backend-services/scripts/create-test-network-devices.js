#!/usr/bin/env node

/**
 * Create Test Network Devices for david@tenant.com
 * This script creates real network devices in the database for testing the monitoring module
 */

const mongoose = require('mongoose');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');

// Tenant ID for david@tenant.com (from user messages)
const TENANT_ID = '690abdc14a6f067977986db3';
const CREATED_BY = 'david@tenant.com';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Network topology data - realistic WISP network
const networkData = {
  sites: [
    {
      name: 'Main Tower Site',
      type: 'tower',
      status: 'active',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: '123 Main Tower Rd, New York, NY 10001',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      height: 150,
      structureType: 'self-supporting',
      owner: 'Peterson Consulting'
    },
    {
      name: 'Secondary Tower',
      type: 'tower', 
      status: 'active',
      location: {
        latitude: 40.7589,
        longitude: -73.9851,
        address: '456 Secondary Tower Ave, New York, NY 10019',
        city: 'New York',
        state: 'NY',
        zipCode: '10019'
      },
      height: 120,
      structureType: 'monopole',
      owner: 'Peterson Consulting'
    },
    {
      name: 'NOC Facility',
      type: 'noc',
      status: 'active',
      location: {
        latitude: 40.7505,
        longitude: -73.9934,
        address: '789 NOC Center Dr, New York, NY 10018',
        city: 'New York',
        state: 'NY',
        zipCode: '10018'
      },
      owner: 'Peterson Consulting'
    },
    {
      name: 'Customer Site A',
      type: 'building',
      status: 'active',
      location: {
        latitude: 40.7282,
        longitude: -73.9942,
        address: '321 Customer St, New York, NY 10001',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      owner: 'Customer A Corp'
    },
    {
      name: 'Customer Site B',
      type: 'building',
      status: 'active',
      location: {
        latitude: 40.7614,
        longitude: -73.9776,
        address: '654 Business Ave, New York, NY 10019',
        city: 'New York',
        state: 'NY',
        zipCode: '10019'
      },
      owner: 'Customer B LLC'
    }
  ],
  
  equipment: [
    // Main Tower Equipment
    {
      name: 'Core Router MT-RB5009',
      type: 'router',
      status: 'active',
      manufacturer: 'Mikrotik',
      model: 'RB5009UG+S+IN',
      serialNumber: 'MT-RTR-001',
      partNumber: 'RB5009UG+S+IN',
      notes: JSON.stringify({
        management_ip: '192.168.1.1',
        snmp_community: 'public',
        snmp_version: 'v2c',
        mikrotik_api: {
          enabled: true,
          port: 8728,
          username: 'admin'
        }
      })
    },
    {
      name: 'Core Switch CRS328',
      type: 'switch',
      status: 'active',
      manufacturer: 'Mikrotik',
      model: 'CRS328-24P-4S+RM',
      serialNumber: 'MT-SW-001',
      partNumber: 'CRS328-24P-4S+RM',
      notes: JSON.stringify({
        management_ip: '192.168.1.10',
        snmp_community: 'public',
        snmp_version: 'v2c',
        port_count: 24
      })
    },
    {
      name: 'EPC Core Server',
      type: 'other',
      status: 'active',
      manufacturer: 'Dell',
      model: 'PowerEdge R640',
      serialNumber: 'EPC-001',
      partNumber: 'R640-EPC',
      notes: JSON.stringify({
        management_ip: '192.168.1.100',
        snmp_enabled: true,
        services: ['MME', 'SGW', 'PGW', 'HSS'],
        monitoring: {
          cpu_threshold: 80,
          memory_threshold: 85,
          disk_threshold: 90
        }
      })
    },
    // Secondary Tower Equipment
    {
      name: 'Backhaul Router RB4011',
      type: 'router',
      status: 'active',
      manufacturer: 'Mikrotik',
      model: 'RB4011iGS+RM',
      serialNumber: 'MT-RTR-002',
      partNumber: 'RB4011iGS+RM',
      notes: JSON.stringify({
        management_ip: '192.168.2.1',
        snmp_community: 'public',
        snmp_version: 'v2c',
        backhaul_to: 'Main Tower Site'
      })
    },
    // Customer Equipment
    {
      name: 'Customer A CPE',
      type: 'other',
      status: 'active',
      manufacturer: 'Mikrotik',
      model: 'LtAP mini LTE kit',
      serialNumber: 'MT-CPE-001',
      partNumber: 'RBLtAP-2HnD&R11e-LTE',
      notes: JSON.stringify({
        management_ip: '192.168.100.1',
        customer: 'Customer A Corp',
        plan: 'Business 100/20',
        snmp_enabled: true
      })
    },
    {
      name: 'Customer B CPE',
      type: 'other',
      status: 'active',
      manufacturer: 'Mikrotik',
      model: 'LtAP mini LTE kit',
      serialNumber: 'MT-CPE-002',
      partNumber: 'RBLtAP-2HnD&R11e-LTE',
      notes: JSON.stringify({
        management_ip: '192.168.100.2',
        customer: 'Customer B LLC',
        plan: 'Business 50/10',
        snmp_enabled: true
      })
    }
  ],

  sectors: [
    {
      name: 'Main Tower Sector 1',
      technology: 'LTE',
      band: 'Band 71',
      frequency: 600,
      azimuth: 0,
      beamwidth: 120,
      power: 40,
      status: 'active'
    },
    {
      name: 'Main Tower Sector 2', 
      technology: 'LTE',
      band: 'Band 71',
      frequency: 600,
      azimuth: 120,
      beamwidth: 120,
      power: 40,
      status: 'active'
    },
    {
      name: 'Main Tower Sector 3',
      technology: 'LTE',
      band: 'Band 71', 
      frequency: 600,
      azimuth: 240,
      beamwidth: 120,
      power: 40,
      status: 'active'
    },
    {
      name: 'Secondary Tower Sector 1',
      technology: 'LTE',
      band: 'Band 71',
      frequency: 600,
      azimuth: 180,
      beamwidth: 90,
      power: 30,
      status: 'active'
    }
  ],

  cpe: [
    {
      name: 'Customer A LTE CPE',
      technology: 'LTE',
      manufacturer: 'Mikrotik',
      model: 'LtAP mini LTE kit',
      serialNumber: 'CPE-001-A',
      macAddress: '4C:5E:0C:12:34:56',
      firmwareVersion: '7.11.2',
      subscriberName: 'Customer A Corp',
      subscriberEmail: 'admin@customera.com',
      subscriberPhone: '+1-555-0101',
      status: 'active',
      modules: {
        acs: {
          enabled: true,
          deviceId: 'CPE-001-A',
          lastSync: new Date()
        },
        hss: {
          enabled: true,
          subscriberId: 'SUB-001-A',
          lastSync: new Date()
        }
      }
    },
    {
      name: 'Customer B LTE CPE',
      technology: 'LTE',
      manufacturer: 'Mikrotik',
      model: 'LtAP mini LTE kit',
      serialNumber: 'CPE-002-B',
      macAddress: '4C:5E:0C:12:34:57',
      firmwareVersion: '7.11.2',
      subscriberName: 'Customer B LLC',
      subscriberEmail: 'it@customerb.com',
      subscriberPhone: '+1-555-0102',
      status: 'active',
      modules: {
        acs: {
          enabled: true,
          deviceId: 'CPE-002-B',
          lastSync: new Date()
        },
        hss: {
          enabled: true,
          subscriberId: 'SUB-002-B',
          lastSync: new Date()
        }
      }
    }
  ]
};

// Create all network devices
const createNetworkDevices = async () => {
  console.log('🚀 Creating network devices for tenant:', TENANT_ID);
  
  try {
    // Clear existing devices for this tenant
    console.log('🧹 Clearing existing devices...');
    await UnifiedSite.deleteMany({ tenantId: TENANT_ID });
    await UnifiedSector.deleteMany({ tenantId: TENANT_ID });
    await UnifiedCPE.deleteMany({ tenantId: TENANT_ID });
    await NetworkEquipment.deleteMany({ tenantId: TENANT_ID });
    await HardwareDeployment.deleteMany({ tenantId: TENANT_ID });
    
    // Create sites first
    console.log('📍 Creating sites...');
    const createdSites = [];
    for (const siteData of networkData.sites) {
      const site = new UnifiedSite({
        ...siteData,
        tenantId: TENANT_ID,
        createdBy: CREATED_BY,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await site.save();
      createdSites.push(site);
      console.log(`  ✅ Created site: ${site.name} (${site._id})`);
    }
    
    // Create network equipment and associate with sites
    console.log('🔧 Creating network equipment...');
    const createdEquipment = [];
    for (let i = 0; i < networkData.equipment.length; i++) {
      const equipData = networkData.equipment[i];
      
      // Assign equipment to appropriate sites
      let siteId = null;
      if (i < 3) {
        // First 3 equipment items go to Main Tower
        siteId = createdSites[0]._id;
      } else if (i === 3) {
        // Backhaul router goes to Secondary Tower
        siteId = createdSites[1]._id;
      } else if (i === 4) {
        // Customer A CPE goes to Customer Site A
        siteId = createdSites[3]._id;
      } else if (i === 5) {
        // Customer B CPE goes to Customer Site B
        siteId = createdSites[4]._id;
      }
      
      const equipment = new NetworkEquipment({
        ...equipData,
        tenantId: TENANT_ID,
        siteId: siteId,
        location: siteId ? createdSites.find(s => s._id.equals(siteId)).location : null,
        createdBy: CREATED_BY,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await equipment.save();
      createdEquipment.push(equipment);
      console.log(`  ✅ Created equipment: ${equipment.name} at ${createdSites.find(s => s._id.equals(siteId))?.name || 'Unknown Site'}`);
    }
    
    // Create sectors and associate with tower sites
    console.log('📡 Creating sectors...');
    const createdSectors = [];
    for (let i = 0; i < networkData.sectors.length; i++) {
      const sectorData = networkData.sectors[i];
      
      // First 3 sectors go to Main Tower, last sector goes to Secondary Tower
      const siteId = i < 3 ? createdSites[0]._id : createdSites[1]._id;
      const site = createdSites.find(s => s._id.equals(siteId));
      
      const sector = new UnifiedSector({
        ...sectorData,
        tenantId: TENANT_ID,
        siteId: siteId,
        location: site.location,
        createdBy: CREATED_BY,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await sector.save();
      createdSectors.push(sector);
      console.log(`  ✅ Created sector: ${sector.name} at ${site.name}`);
    }
    
    // Create CPE devices and associate with customer sites
    console.log('📱 Creating CPE devices...');
    const createdCPE = [];
    for (let i = 0; i < networkData.cpe.length; i++) {
      const cpeData = networkData.cpe[i];
      
      // CPE devices go to customer sites (sites 3 and 4)
      const siteId = createdSites[3 + i]._id;
      const site = createdSites.find(s => s._id.equals(siteId));
      
      const cpe = new UnifiedCPE({
        ...cpeData,
        tenantId: TENANT_ID,
        siteId: siteId,
        location: site.location,
        address: site.location.address,
        createdBy: CREATED_BY,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await cpe.save();
      createdCPE.push(cpe);
      console.log(`  ✅ Created CPE: ${cpe.name} at ${site.name}`);
    }
    
    // Create hardware deployments to link equipment to sites
    console.log('🔗 Creating hardware deployments...');
    for (const equipment of createdEquipment) {
      if (equipment.siteId) {
        const deployment = new HardwareDeployment({
          name: `${equipment.name} Deployment`,
          hardware_type: equipment.type === 'other' ? 'epc' : equipment.type,
          status: 'deployed',
          siteId: equipment.siteId,
          tenantId: TENANT_ID,
          config: equipment.notes ? JSON.parse(equipment.notes) : {},
          deployedAt: new Date(),
          createdBy: CREATED_BY,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await deployment.save();
        console.log(`  ✅ Created deployment: ${deployment.name}`);
      }
    }
    
    console.log('\n🎉 Network creation completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`  - Sites: ${createdSites.length}`);
    console.log(`  - Equipment: ${createdEquipment.length}`);
    console.log(`  - Sectors: ${createdSectors.length}`);
    console.log(`  - CPE: ${createdCPE.length}`);
    console.log(`  - Tenant ID: ${TENANT_ID}`);
    
    return {
      sites: createdSites,
      equipment: createdEquipment,
      sectors: createdSectors,
      cpe: createdCPE
    };
    
  } catch (error) {
    console.error('❌ Error creating network devices:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await createNetworkDevices();
    console.log('\n✅ All done! Network devices created successfully.');
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createNetworkDevices, networkData };
