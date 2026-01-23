#!/usr/bin/env node

/**
 * Script to delete ACS/TR-069 devices via the backend API
 * This calls the DELETE /api/tr069/devices endpoint
 */

const TENANT_ID = '690abdc14a6f067977986db3'; // Peterson Consulting
// Use production backend URL - update this if your backend is on a different server
const BACKEND_URL = process.env.BACKEND_URL || process.env.HSS_API_URL || 'https://136.112.111.167:3001';

async function deleteACSDevices() {
  try {
    console.log(`\n🔍 Deleting ACS/TR-069 devices for tenant: ${TENANT_ID} (Peterson Consulting)\n`);
    console.log(`📡 Calling backend API: ${BACKEND_URL}/api/tr069/devices\n`);
    
    const response = await fetch(`${BACKEND_URL}/api/tr069/devices`, {
      method: 'DELETE',
      headers: {
        'X-Tenant-ID': TENANT_ID,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Success!');
      console.log(`   Deleted: ${result.deleted} devices`);
      console.log(`   Total: ${result.total} devices`);
      if (result.errors && result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.forEach(err => {
          console.log(`     - Device ${err.deviceId}: ${err.error}`);
        });
      }
      console.log(`\n   Message: ${result.message}\n`);
    } else {
      console.error('❌ Failed to delete devices');
      console.error('   Error:', result.error || result.message);
      if (result.details) {
        console.error('   Details:', result.details);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error calling API:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. The backend server is running');
    console.error('   2. BACKEND_URL is set correctly (default: http://localhost:3001)');
    console.error('   3. You have network access to the backend\n');
    process.exit(1);
  }
}

deleteACSDevices();
