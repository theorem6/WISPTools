const mongoose = require('mongoose');

// Middleware to ensure database connection
const ensureDB = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  req.db = mongoose.connection.db;
  next();
};

module.exports = { ensureDB };
