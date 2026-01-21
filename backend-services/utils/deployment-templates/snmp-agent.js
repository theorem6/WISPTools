/**
 * Generate SNMP agent installation section
 * NOTE: This module contains a large embedded JavaScript file (epc-snmp-agent.js)
 * The embedded file is extracted from the original deployment-helpers.js to preserve exact formatting
 * @param {Object} config - Configuration object
 * @param {string} config.deploymentType - Deployment type
 */
const fs = require('fs');
const path = require('path');

function generateSNMPAgentInstallation(config) {
  const { deploymentType } = config;
  
  // Read the SNMP section from the original deployment-helpers.js file
  // This preserves the exact formatting and escaping of the embedded JavaScript
  const originalFile = path.join(__dirname, '../deployment-helpers.js');
  const originalContent = fs.readFileSync(originalFile, 'utf8');
  const lines = originalContent.split('\n');
  
  // Extract SNMP section (lines 458-1381, 0-indexed: 457-1380)
  const snmpStartLine = 457; // Line 458 in 1-indexed
  const snmpEndLine = 1380;  // Line 1381 in 1-indexed
  const snmpSection = lines.slice(snmpStartLine, snmpEndLine + 1).join('\n');
  
  // Replace the deploymentType placeholder if it exists
  return snmpSection.replace(/\$\{deploymentType\}/g, deploymentType);
}

module.exports = { generateSNMPAgentInstallation };
