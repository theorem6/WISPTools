// Script to check database content and fix issues
require('dotenv').config();
const mongoose = require('mongoose');
const { UnifiedSite } = require('./models/network');
const appConfig = require('./config/app');

async function checkData() {
  await mongoose.connect(appConfig.mongodb.uri, appConfig.mongodb.options);
  const sites = await UnifiedSite.find({}).lean();
  console.log('Total sites:', sites.length);
  sites.forEach(s => {
    console.log(`Site: ${s.name || 'N/A'}`);
    console.log(`  ID: ${s._id}`);
    console.log(`  Tenant: ${s.tenantId}`);
    console.log(`  CreatedBy: ${s.createdBy || 'N/A'}`);
    console.log('---');
  });
  await mongoose.connection.close();
}

checkData().catch(console.error);

