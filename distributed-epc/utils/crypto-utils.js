// Cryptographic Utilities for EPC Security
const crypto = require('crypto');

/**
 * Generate a unique EPC ID
 * @returns {string} - epc_xxxxxxxxxxxxxxxx
 */
function generateEpcId() {
  return `epc_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate an authentication code
 * @returns {string} - 32-character hex string
 */
function generateAuthCode() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate an API key
 * @returns {string} - 64-character hex string
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secret key for HMAC signing
 * @returns {string} - 64-character hex string
 */
function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify HMAC signature
 * @param {string} payload - The payload to verify
 * @param {string} signature - The signature to check
 * @param {string} secretKey - The secret key
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, secretKey) {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}

/**
 * Create HMAC signature
 * @param {string} payload - The payload to sign
 * @param {string} secretKey - The secret key
 * @returns {string} - The signature
 */
function createSignature(payload, secretKey) {
  return crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
}

module.exports = {
  generateEpcId,
  generateAuthCode,
  generateApiKey,
  generateSecretKey,
  verifySignature,
  createSignature
};

