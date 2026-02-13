const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// MongoDB Connection - required for Tenant model
const MONGODB_URI = process.env.MONGODB_URI || '';

console.log('🔗 Connecting to MongoDB Atlas for Tenant lookup...');
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '10mb' }));

// mount only EPC deployment routes
app.use('/api/deploy', require('./routes/epc-deployment'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'min-epc-server', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`min-epc-server listening on ${PORT}`);
});


