# Deployment Script Template Modules

This directory contains modular template generators for EPC deployment scripts.

## Module Structure

- `script-header.js` - Script header, initialization, and color functions
- `grub-config.js` - GRUB configuration for headless operation
- `network-config.js` - Network configuration and auto-detection
- `dependencies.js` - Package and dependency installation
- `index.js` - Main export file

## Usage

```javascript
const templates = require('./deployment-templates');

const header = templates.generateScriptHeader({
  siteName: 'My Site',
  epc_id: 'EPC-12345',
  deploymentType: 'both',
  installEPC: true,
  installSNMP: true,
  gce_ip: '136.112.111.167',
  hss_port: '3001'
});

const grub = templates.generateGRUBConfiguration();
const network = templates.generateNetworkConfiguration();
// ... etc
```

## Benefits

- **Modularity**: Each section can be maintained independently
- **Testability**: Individual template generators can be tested
- **Reusability**: Templates can be reused or combined differently
- **Maintainability**: Easier to locate and fix issues in specific sections

