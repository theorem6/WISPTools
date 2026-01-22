/**
 * Middleware Configuration
 * Centralized middleware setup and configuration
 */

const cors = require('cors');
const express = require('express');

/**
 * CORS Configuration
 * Configure Cross-Origin Resource Sharing
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and Firebase hosting domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app',
      'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
};

/**
 * Setup Express middleware
 * @param {Express} app - Express application instance
 */
function setupMiddleware(app) {
  // CORS middleware
  app.use(cors(corsOptions));
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Request logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
    next();
  });
  
  // Security headers middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

/**
 * Error handling middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed'
    });
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerError') {
    return res.status(503).json({
      error: 'Database Unavailable',
      message: 'Database connection failed. Please try again later.',
      code: 'DATABASE_ERROR'
    });
  }

  // Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    return res.status(401).json({
      error: 'Authentication Error',
      message: err.message || 'Authentication failed',
      code: err.code
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message || 'Invalid data provided',
      code: 'VALIDATION_ERROR'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'Authentication token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 handler middleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

module.exports = {
  setupMiddleware,
  errorHandler,
  notFoundHandler,
  corsOptions
};
