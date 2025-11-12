/**
 * Cleanup Firestore Test Data Script
 * Removes all test data from Firestore collections that should be in MongoDB
 * This is for non-production environments only
 */

const admin = require('firebase-admin');
const appConfig = require('../config/app');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = require(appConfig.firebase.serviceAccountKey || process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: appConfig.firebase.projectId || process.env.FIREBASE_PROJECT_ID
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const firestore = admin.firestore();

async function cleanupFirestoreTestData() {
  try {
    console.log('Connecting to Firestore...');
    console.log('✓ Connected to Firestore');

    let totalDeleted = {
      towerSites: 0,
      sectors: 0,
      cpeDevices: 0,
      networkEquipment: 0,
      cbrsDevices: 0,
      networkSites: 0
    };

    // Get all tenants
    const tenantsSnapshot = await firestore.collection('tenants').get();
    const tenantIds = tenantsSnapshot.docs.map(doc => doc.id);
    
    console.log(`\nFound ${tenantIds.length} tenant(s) in Firestore`);

    // Clean up each tenant's Firestore collections
    for (const tenantId of tenantIds) {
      console.log(`\n--- Cleaning up tenant: ${tenantId} ---`);

      // 1. Delete towerSites subcollection
      const towerSitesRef = firestore.collection('tenants').doc(tenantId).collection('towerSites');
      const towerSitesSnapshot = await towerSitesRef.get();
      const towerSitesBatch = firestore.batch();
      let towerSitesCount = 0;
      towerSitesSnapshot.docs.forEach(doc => {
        towerSitesBatch.delete(doc.ref);
        towerSitesCount++;
      });
      if (towerSitesCount > 0) {
        await towerSitesBatch.commit();
        totalDeleted.towerSites += towerSitesCount;
        console.log(`  ✓ Deleted ${towerSitesCount} tower sites`);
      }

      // 2. Delete sectors subcollection
      const sectorsRef = firestore.collection('tenants').doc(tenantId).collection('sectors');
      const sectorsSnapshot = await sectorsRef.get();
      const sectorsBatch = firestore.batch();
      let sectorsCount = 0;
      sectorsSnapshot.docs.forEach(doc => {
        sectorsBatch.delete(doc.ref);
        sectorsCount++;
      });
      if (sectorsCount > 0) {
        await sectorsBatch.commit();
        totalDeleted.sectors += sectorsCount;
        console.log(`  ✓ Deleted ${sectorsCount} sectors`);
      }

      // 3. Delete cpeDevices subcollection
      const cpeDevicesRef = firestore.collection('tenants').doc(tenantId).collection('cpeDevices');
      const cpeDevicesSnapshot = await cpeDevicesRef.get();
      const cpeDevicesBatch = firestore.batch();
      let cpeDevicesCount = 0;
      cpeDevicesSnapshot.docs.forEach(doc => {
        cpeDevicesBatch.delete(doc.ref);
        cpeDevicesCount++;
      });
      if (cpeDevicesCount > 0) {
        await cpeDevicesBatch.commit();
        totalDeleted.cpeDevices += cpeDevicesCount;
        console.log(`  ✓ Deleted ${cpeDevicesCount} CPE devices`);
      }

      // 4. Delete networkEquipment subcollection
      const networkEquipmentRef = firestore.collection('tenants').doc(tenantId).collection('networkEquipment');
      const networkEquipmentSnapshot = await networkEquipmentRef.get();
      const networkEquipmentBatch = firestore.batch();
      let networkEquipmentCount = 0;
      networkEquipmentSnapshot.docs.forEach(doc => {
        networkEquipmentBatch.delete(doc.ref);
        networkEquipmentCount++;
      });
      if (networkEquipmentCount > 0) {
        await networkEquipmentBatch.commit();
        totalDeleted.networkEquipment += networkEquipmentCount;
        console.log(`  ✓ Deleted ${networkEquipmentCount} network equipment`);
      }
    }

    // 5. Delete top-level collections (not tenant-specific)
    // CBRS devices
    const cbrsDevicesRef = firestore.collection('cbrs_devices');
    const cbrsDevicesSnapshot = await cbrsDevicesRef.get();
    const cbrsDevicesBatch = firestore.batch();
    let cbrsDevicesCount = 0;
    cbrsDevicesSnapshot.docs.forEach(doc => {
      cbrsDevicesBatch.delete(doc.ref);
      cbrsDevicesCount++;
    });
    if (cbrsDevicesCount > 0) {
      await cbrsDevicesBatch.commit();
      totalDeleted.cbrsDevices += cbrsDevicesCount;
      console.log(`  ✓ Deleted ${cbrsDevicesCount} CBRS devices`);
    }

    // Network sites (HSS module)
    const networkSitesRef = firestore.collection('networkSites');
    const networkSitesSnapshot = await networkSitesRef.get();
    const networkSitesBatch = firestore.batch();
    let networkSitesCount = 0;
    networkSitesSnapshot.docs.forEach(doc => {
      networkSitesBatch.delete(doc.ref);
      networkSitesCount++;
    });
    if (networkSitesCount > 0) {
      await networkSitesBatch.commit();
      totalDeleted.networkSites += networkSitesCount;
      console.log(`  ✓ Deleted ${networkSitesCount} network sites`);
    }

    // Summary
    console.log('\n=== FIRESTORE CLEANUP SUMMARY ===');
    console.log(`Tower sites deleted: ${totalDeleted.towerSites}`);
    console.log(`Sectors deleted: ${totalDeleted.sectors}`);
    console.log(`CPE devices deleted: ${totalDeleted.cpeDevices}`);
    console.log(`Network equipment deleted: ${totalDeleted.networkEquipment}`);
    console.log(`CBRS devices deleted: ${totalDeleted.cbrsDevices}`);
    console.log(`Network sites deleted: ${totalDeleted.networkSites}`);
    console.log(`\nTotal objects deleted: ${Object.values(totalDeleted).reduce((a, b) => a + b, 0)}`);

    console.log('\n✓ Firestore cleanup completed successfully!');

  } catch (error) {
    console.error('✗ Firestore cleanup failed:', error);
    throw error;
  }
}

// Run cleanup
if (require.main === module) {
  cleanupFirestoreTestData()
    .then(() => {
      console.log('\n✓ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupFirestoreTestData };

