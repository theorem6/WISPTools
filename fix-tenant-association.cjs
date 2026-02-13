const mongoose = require('mongoose');
const { Tenant } = require('./tenant-schema');
const { UserTenant } = require('./user-schema');

const MONGODB_URI = process.env.MONGODB_URI || '';

mongoose.connect(MONGODB_URI).then(async () => {
  const tenant = await Tenant.findOne({ subdomain: 'davids-tenant' });
  if (!tenant) {
    console.log('❌ Tenant not found');
    await mongoose.disconnect();
    return;
  }
  
  console.log('✅ Tenant found:', tenant._id.toString());
  
  const userTenants = await UserTenant.find({ userId: 'e6VVuSMxyzZIbm8q1E2eOI7eh6V2' });
  console.log('Found', userTenants.length, 'associations');
  
  if (userTenants.length === 0) {
    console.log('Creating association...');
    await new UserTenant({
      userId: 'e6VVuSMxyzZIbm8q1E2eOI7eh6V2',
      tenantId: tenant._id.toString(),
      role: 'owner',
      status: 'active',
      invitedBy: 'system',
      invitedAt: new Date(),
      acceptedAt: new Date(),
      addedAt: new Date()
    }).save();
    console.log('✅ Created!');
  } else {
    console.log('✅ Association already exists');
  }
  
  await mongoose.disconnect();
});

