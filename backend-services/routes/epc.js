/**
 * EPC Routes
 * Distributed EPC management endpoints
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'EPC management service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
