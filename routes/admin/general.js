/**
 * General Admin Routes
 * General administrative endpoints
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Admin API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
