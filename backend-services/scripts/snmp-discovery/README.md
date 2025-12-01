# SNMP Discovery Script Modules

This directory contains modular components for the SNMP network discovery system.

## Module Structure

- `oui-lookup.js` - OUI (Organizationally Unique Identifier) lookup utilities
- `config.js` - Configuration constants and settings
- `utils.js` - Utility functions (logging, device code, network info)
- `ping-sweep.js` - Network ping sweep functionality
- `oid-walk.js` - SNMP OID walk operations
- `device-identification.js` - Device type identification logic
- `mikrotik.js` - Mikrotik-specific discovery functions
- `mndp.js` - MNDP (Mikrotik Neighbor Discovery Protocol) implementation
- `cdp-lldp.js` - CDP/LLDP neighbor discovery
- `network-scanner.js` - Main network scanning orchestration

## Usage

The main script `../epc-snmp-discovery.js` imports and uses these modules.
These modules are designed to work together and can be deployed as a single bundle.

## Deployment

These modules are deployed to remote EPC devices as part of the discovery agent.
Ensure all modules are deployed together and maintain the directory structure.

