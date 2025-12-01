/**
 * Deployment Script Template Generators
 * Modular template sections for EPC deployment script generation
 */

const { generateScriptHeader } = require('./script-header');
const { generateGRUBConfiguration } = require('./grub-config');
const { generateNetworkConfiguration, generateNetworkVariables } = require('./network-config');
const { generateDependencyInstallation } = require('./dependencies');

module.exports = {
  generateScriptHeader,
  generateGRUBConfiguration,
  generateNetworkConfiguration,
  generateNetworkVariables,
  generateDependencyInstallation
};

