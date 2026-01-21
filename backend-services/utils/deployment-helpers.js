// Full Deployment Script Helper Functions
// Isolated utilities for EPC deployment script generation - DO NOT MODIFY unless fixing deployment issues
// 
// NOTE: Octal escape sequences (\1, \2, etc.) must be double-escaped (\\1, \\2)
//       in JavaScript template strings to avoid syntax errors

const templates = require('./deployment-templates');

/**
 * Generate full EPC deployment script with Open5GS installation
 * This installs all EPC components and dependencies automatically
 * 
 * @param {Object} epc - Full EPC configuration object from database
 * @param {string} epc.epc_id - Unique EPC identifier
 * @param {string} epc.deployment_type - 'epc', 'snmp', or 'both'
 * @param {Object} epc.hss_config - HSS configuration (mcc, mnc, tac, etc.)
 * @param {Object} epc.snmp_config - SNMP configuration
 */
function generateFullDeploymentScript(epc) {
  // Handle both old (3 args) and new (1 object arg) call signatures
  let epc_id, gce_ip, hss_port, deploymentType, hssConfig, snmpConfig, siteName;
  
  if (typeof epc === 'object' && epc !== null) {
    // New signature: single EPC object
    epc_id = epc.epc_id;
    gce_ip = '136.112.111.167'; // GCE public IP
    hss_port = '3001';
    deploymentType = epc.deployment_type || 'both';
    hssConfig = epc.hss_config || {};
    snmpConfig = epc.snmp_config || {};
    siteName = epc.site_name || 'WISPTools EPC';
  } else {
    // Legacy signature: (epc_id, gce_ip, hss_port)
    epc_id = arguments[0];
    gce_ip = arguments[1] || '136.112.111.167';
    hss_port = arguments[2] || '3001';
    deploymentType = 'both';
    hssConfig = {};
    snmpConfig = {};
    siteName = 'WISPTools EPC';
  }
  
  // Determine what to install
  const installEPC = deploymentType === 'epc' || deploymentType === 'both';
  const installSNMP = deploymentType === 'snmp' || deploymentType === 'both';
  
  // Network config from HSS config or defaults
  const mcc = hssConfig.mcc || '001';
  const mnc = hssConfig.mnc || '01';
  const tac = hssConfig.tac || '1';
  const apn = hssConfig.apnName || 'internet';
  const dnsPrimary = hssConfig.dnsPrimary || '8.8.8.8';
  const dnsSecondary = hssConfig.dnsSecondary || '8.8.4.4';
  
  // Build script using modular templates
  const config = {
    siteName,
    epc_id,
    deploymentType,
    installEPC,
    installSNMP,
    gce_ip,
    hss_port,
    mcc,
    mnc,
    tac,
    apn,
    dnsPrimary,
    dnsSecondary
  };
  
  return templates.generateScriptHeader(config) +
         templates.generateNetworkConfiguration() +
         templates.generateGRUBConfiguration() +
         templates.generateNetworkVariables(config) +
         templates.generateDependencyInstallation() +
         templates.generateOpen5GSInstallation(config) +
         templates.generateSNMPAgentInstallation(config) +
         templates.generateServicesStartup() +
         templates.generateScriptFooter(config);
}

module.exports = {
  generateFullDeploymentScript
};
