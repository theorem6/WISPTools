/**
 * HSS Database Initialization Script
 * 
 * Creates MongoDB collections and indexes for HSS module
 * Run this once before deploying the HSS API
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'hss';

async function initializeHSSDatabase() {
  console.log('🚀 HSS Database Initialization\n');
  console.log('Connecting to MongoDB...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(DATABASE_NAME);
    
    // ========================================================================
    // Create Collections
    // ========================================================================
    
    console.log('📋 Creating collections...');
    
    const collections = [
      'active_subscribers',
      'inactive_subscribers',
      'subscriber_cpe_mappings',
      'subscriber_sessions',
      'authentication_vectors',
      'subscriber_audit_log'
    ];
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`  ✓ Created collection: ${collectionName}`);
      } catch (error) {
        if (error.code === 48) {
          console.log(`  ⚠ Collection already exists: ${collectionName}`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('');
    
    // ========================================================================
    // Create Indexes
    // ========================================================================
    
    console.log('🔍 Creating indexes...\n');
    
    // active_subscribers indexes
    console.log('Indexing active_subscribers...');
    const activeSubscribers = db.collection('active_subscribers');
    await activeSubscribers.createIndex({ imsi: 1 }, { unique: true });
    await activeSubscribers.createIndex({ tenantId: 1 });
    await activeSubscribers.createIndex({ status: 1 });
    await activeSubscribers.createIndex({ 'acs.cpe_serial_number': 1 });
    await activeSubscribers.createIndex({ 'acs.acs_device_id': 1 });
    await activeSubscribers.createIndex({ 'metadata.created_at': -1 });
    console.log('  ✓ Created 6 indexes on active_subscribers\n');
    
    // inactive_subscribers indexes
    console.log('Indexing inactive_subscribers...');
    const inactiveSubscribers = db.collection('inactive_subscribers');
    await inactiveSubscribers.createIndex({ imsi: 1 });
    await inactiveSubscribers.createIndex({ tenantId: 1 });
    await inactiveSubscribers.createIndex({ 'deactivation.deactivated_at': -1 });
    await inactiveSubscribers.createIndex({ 'deactivation.reason': 1 });
    console.log('  ✓ Created 4 indexes on inactive_subscribers\n');
    
    // subscriber_cpe_mappings indexes
    console.log('Indexing subscriber_cpe_mappings...');
    const cpeMappings = db.collection('subscriber_cpe_mappings');
    await cpeMappings.createIndex({ imsi: 1 }, { unique: true });
    await cpeMappings.createIndex({ 'cpe.serial_number': 1 });
    await cpeMappings.createIndex({ 'cpe.acs_device_id': 1 });
    await cpeMappings.createIndex({ tenantId: 1 });
    await cpeMappings.createIndex({ updated_at: -1 });
    console.log('  ✓ Created 5 indexes on subscriber_cpe_mappings\n');
    
    // subscriber_sessions indexes
    console.log('Indexing subscriber_sessions...');
    const sessions = db.collection('subscriber_sessions');
    await sessions.createIndex({ imsi: 1 });
    await sessions.createIndex({ session_id: 1 }, { unique: true });
    await sessions.createIndex({ tenantId: 1 });
    await sessions.createIndex({ status: 1 });
    await sessions.createIndex({ started_at: -1 });
    console.log('  ✓ Created 5 indexes on subscriber_sessions\n');
    
    // authentication_vectors indexes
    console.log('Indexing authentication_vectors...');
    const authVectors = db.collection('authentication_vectors');
    await authVectors.createIndex({ imsi: 1 });
    await authVectors.createIndex({ created_at: -1 });
    console.log('  ✓ Created 2 indexes on authentication_vectors\n');
    
    // subscriber_audit_log indexes
    console.log('Indexing subscriber_audit_log...');
    const auditLog = db.collection('subscriber_audit_log');
    await auditLog.createIndex({ imsi: 1 });
    await auditLog.createIndex({ tenantId: 1 });
    await auditLog.createIndex({ performed_at: -1 });
    await auditLog.createIndex({ action: 1 });
    await auditLog.createIndex({ performed_by: 1 });
    console.log('  ✓ Created 5 indexes on subscriber_audit_log\n');
    
    // ========================================================================
    // Insert Sample Data (Optional)
    // ========================================================================
    
    console.log('📝 Do you want to insert sample test data? (y/n)');
    // For automated scripts, skip sample data
    const insertSampleData = false; // Change to true if needed
    
    if (insertSampleData) {
      console.log('\nInserting sample subscribers...');
      
      const sampleSubscribers = [
        {
          imsi: '001010123456789',
          tenantId: 'tenant_test',
          // Note: In production, Ki and OPc would be encrypted
          ki: 'ENCRYPTED_VALUE_PLACEHOLDER_1',
          opc: 'ENCRYPTED_VALUE_PLACEHOLDER_1',
          sqn: 0,
          status: 'active',
          msisdn: '+1234567890',
          profile: {
            apn: 'internet',
            apn_config: [{
              apn: 'internet',
              qos_profile: 'gold'
            }],
            subscription_type: 'postpaid',
            data_plan: {
              max_bandwidth_dl: 100000000,
              max_bandwidth_ul: 50000000,
              monthly_quota: 0,
              used_this_month: 0
            }
          },
          acs: {
            cpe_serial_number: null,
            acs_device_id: null,
            last_acs_inform: null,
            device_status: 'not_connected'
          },
          metadata: {
            created_at: new Date(),
            updated_at: new Date(),
            created_by: 'system',
            notes: 'Sample test subscriber',
            tags: ['test']
          }
        }
      ];
      
      await activeSubscribers.insertMany(sampleSubscribers);
      console.log(`  ✓ Inserted ${sampleSubscribers.length} sample subscribers\n`);
    }
    
    // ========================================================================
    // Database Statistics
    // ========================================================================
    
    console.log('📊 Database Statistics:\n');
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      console.log(`  ${collectionName}:`);
      console.log(`    Documents: ${count}`);
      console.log(`    Indexes: ${indexes.length}`);
    }
    
    console.log('');
    
    // ========================================================================
    // Success Message
    // ========================================================================
    
    console.log('✅ HSS Database Initialization Complete!\n');
    console.log('Next Steps:');
    console.log('1. Generate encryption key:');
    console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.log('');
    console.log('2. Set environment variables:');
    console.log('   export HSS_ENCRYPTION_KEY=<your-64-char-hex-key>');
    console.log('   export MONGODB_URI=' + MONGODB_URI);
    console.log('');
    console.log('3. Deploy Firebase Functions:');
    console.log('   firebase deploy --only functions:hssApi');
    console.log('');
    console.log('4. Test the API:');
    console.log('   curl https://your-api.com/hssApi/health');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run initialization
initializeHSSDatabase().catch(console.error);

