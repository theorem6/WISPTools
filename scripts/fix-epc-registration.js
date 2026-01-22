#!/usr/bin/env node
/**
 * Fix EPC Device Registration
 * 
 * This script checks if a device_code exists in the database and can:
 * 1. Check registration status
 * 2. Fix device_code if it's missing or incorrect
 * 3. Link device_code to an existing EPC
 * 
 * Usage:
 *   node fix-epc-registration.js <device_code> [epc_id]
 * 
 * Examples:
 *   node fix-epc-registration.js YALNTFQC
 *   node fix-epc-registration.js YALNTFQC EPC-CB4C5042
 */

const mongoose = require('mongoose');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const appConfig = require('../config/app-config');

const DEVICE_CODE = process.argv[2];
const EPC_ID = process.argv[3];

if (!DEVICE_CODE) {
    console.error('❌ Error: Device code is required');
    console.error('');
    console.error('Usage: node fix-epc-registration.js <device_code> [epc_id]');
    console.error('');
    console.error('Examples:');
    console.error('  node fix-epc-registration.js YALNTFQC');
    console.error('  node fix-epc-registration.js YALNTFQC EPC-CB4C5042');
    process.exit(1);
}

async function fixRegistration() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(appConfig.mongodb.uri);
        console.log('✅ Connected to MongoDB\n');
        
        const deviceCodeUpper = DEVICE_CODE.toUpperCase();
        console.log(`📋 Looking for device with code: ${deviceCodeUpper}`);
        
        // Step 1: Check if device exists with this device_code
        let epc = await RemoteEPC.findOne({ device_code: deviceCodeUpper });
        
        if (epc) {
            console.log('✅ Device found in database!');
            console.log(`   EPC ID: ${epc.epc_id}`);
            console.log(`   Site Name: ${epc.site_name || 'N/A'}`);
            console.log(`   Status: ${epc.status}`);
            console.log(`   Tenant ID: ${epc.tenant_id}`);
            console.log(`   IP Address: ${epc.ip_address || 'N/A'}`);
            console.log(`   Last Seen: ${epc.last_seen || 'Never'}`);
            console.log('');
            console.log('✅ Device is properly registered!');
            process.exit(0);
        }
        
        console.log('⚠️  Device code not found in database');
        console.log('');
        
        // Step 2: If EPC_ID provided, try to link device_code to that EPC
        if (EPC_ID) {
            console.log(`🔗 Attempting to link device_code to EPC: ${EPC_ID}`);
            
            const existingEPC = await RemoteEPC.findOne({ epc_id: EPC_ID });
            
            if (!existingEPC) {
                console.error(`❌ Error: EPC with ID ${EPC_ID} not found`);
                process.exit(1);
            }
            
            console.log(`✅ Found EPC: ${EPC_ID}`);
            console.log(`   Current device_code: ${existingEPC.device_code || 'NONE'}`);
            console.log(`   Site Name: ${existingEPC.site_name || 'N/A'}`);
            console.log('');
            
            if (existingEPC.device_code && existingEPC.device_code.toUpperCase() !== deviceCodeUpper) {
                console.log(`⚠️  Warning: EPC already has a different device_code: ${existingEPC.device_code}`);
                console.log(`   This will overwrite it with: ${deviceCodeUpper}`);
                console.log('');
            }
            
            // Update device_code
            await RemoteEPC.updateOne(
                { epc_id: EPC_ID },
                { $set: { device_code: deviceCodeUpper } }
            );
            
            console.log(`✅ Successfully linked device_code ${deviceCodeUpper} to EPC ${EPC_ID}`);
            console.log('');
            
            // Verify
            const updated = await RemoteEPC.findOne({ epc_id: EPC_ID });
            console.log('✅ Verification:');
            console.log(`   EPC ID: ${updated.epc_id}`);
            console.log(`   Device Code: ${updated.device_code}`);
            console.log(`   Site Name: ${updated.site_name || 'N/A'}`);
            
            process.exit(0);
        }
        
        // Step 3: Search for EPCs without device_code or with similar device_code
        console.log('🔍 Searching for EPCs that might match...');
        console.log('');
        
        // Search by partial match
        const partialMatch = await RemoteEPC.findOne({
            $or: [
                { device_code: { $regex: deviceCodeUpper.substring(0, 4), $options: 'i' } },
                { epc_id: { $regex: deviceCodeUpper, $options: 'i' } },
                { site_name: { $regex: deviceCodeUpper, $options: 'i' } }
            ]
        });
        
        if (partialMatch) {
            console.log('💡 Found a potential match:');
            console.log(`   EPC ID: ${partialMatch.epc_id}`);
            console.log(`   Device Code: ${partialMatch.device_code || 'NONE'}`);
            console.log(`   Site Name: ${partialMatch.site_name || 'N/A'}`);
            console.log('');
            console.log(`To link this device_code, run:`);
            console.log(`  node fix-epc-registration.js ${deviceCodeUpper} ${partialMatch.epc_id}`);
            console.log('');
        }
        
        // List all EPCs without device_code
        const epcsWithoutCode = await RemoteEPC.find({
            $or: [
                { device_code: { $exists: false } },
                { device_code: null },
                { device_code: '' }
            ]
        }).select('epc_id site_name status').limit(10);
        
        if (epcsWithoutCode.length > 0) {
            console.log('📋 EPCs without device_code that could be linked:');
            epcsWithoutCode.forEach(epc => {
                console.log(`   • ${epc.epc_id} - ${epc.site_name || 'N/A'} (${epc.status})`);
            });
            console.log('');
            console.log(`To link device_code to one of these, run:`);
            console.log(`  node fix-epc-registration.js ${deviceCodeUpper} <epc_id>`);
            console.log('');
        }
        
        // List all EPCs
        const allEPCs = await RemoteEPC.find().select('epc_id site_name device_code status').limit(20);
        if (allEPCs.length > 0) {
            console.log('📋 All EPCs in database:');
            allEPCs.forEach(epc => {
                const code = epc.device_code ? `[${epc.device_code}]` : '[NO CODE]';
                console.log(`   • ${epc.epc_id} ${code} - ${epc.site_name || 'N/A'} (${epc.status})`);
            });
            console.log('');
        }
        
        console.log('❌ Device code not found in database.');
        console.log('');
        console.log('To register this device:');
        console.log('  1. Go to https://wisptools-production.web.app');
        console.log('  2. Navigate to: HSS Management → Remote EPCs');
        console.log('  3. Add a new EPC or find existing one');
        console.log('  4. Enter Device Code:', deviceCodeUpper);
        console.log('');
        console.log('Or to link to an existing EPC, run:');
        console.log(`  node fix-epc-registration.js ${deviceCodeUpper} <epc_id>`);
        console.log('');
        
        process.exit(1);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

fixRegistration();

