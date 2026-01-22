/**
 * Deployment Script Template Generators
 * Modular template sections for EPC deployment script generation
 */

const { generateScriptHeader } = require('./script-header');
const { generateGRUBConfiguration } = require('./grub-config');
const { generateNetworkConfiguration, generateNetworkVariables } = require('./network-config');
const { generateDependencyInstallation } = require('./dependencies');
const { generateOpen5GSInstallation } = require('./open5gs');
const { generateSNMPAgentInstallation } = require('./snmp-agent');
const { generateServicesStartup } = require('./services');
const { generateScriptFooter } = require('./script-footer');

module.exports = {
  generateScriptHeader,
  generateGRUBConfiguration,
  generateNetworkConfiguration,
  generateNetworkVariables,
  generateDependencyInstallation,
  generateOpen5GSInstallation,
  generateSNMPAgentInstallation,
  generateServicesStartup,
  generateScriptFooter
};

