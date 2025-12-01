# Code Optimization and Refactoring Plan

## Completed Refactoring

### ✅ Route Files Modularized
- `routes/plans.js` (3249 lines) → Modular structure
- `routes/epc-deployment.js` (1657 lines) → Modular structure  
- `routes/hss-management.js` (1234 lines) → Modular structure
- `routes/snmp.js` (1164 lines) → Already modular
- `server.js` → Extracted middleware and services

## Remaining Optimization Opportunities

### 📋 1. SNMP Discovery Script (`scripts/epc-snmp-discovery.js` - 2147 lines)

**Current Status:** Monolithic standalone script for remote EPC devices

**Recommended Approach:** Create modular structure while maintaining single-file deployment capability

**Proposed Modules:**
- `scripts/snmp-discovery/oui-lookup.js` - OUI lookup utilities (lines 37-244)
- `scripts/snmp-discovery/config.js` - Configuration constants (lines 246-340)
- `scripts/snmp-discovery/utils.js` - Utility functions (logging, device code, network info)
- `scripts/snmp-discovery/ping-sweep.js` - Network ping sweep (lines ~477-550)
- `scripts/snmp-discovery/oid-walk.js` - SNMP OID walk operations (lines ~550-752)
- `scripts/snmp-discovery/device-identification.js` - Device type identification (lines ~752-833)
- `scripts/snmp-discovery/mikrotik.js` - Mikrotik-specific functions (lines ~1292-1408)
- `scripts/snmp-discovery/mndp.js` - MNDP discovery (lines ~1470-1721)
- `scripts/snmp-discovery/cdp-lldp.js` - CDP/LLDP discovery (lines ~1721-1838)
- `scripts/snmp-discovery/network-scanner.js` - Main network scanning orchestration (lines ~1838+)

**Deployment Strategy:**
- Option A: Bundle all modules into single file using a build process before deployment
- Option B: Deploy as modular structure and ensure all files are copied to remote EPC
- Option C: Keep as single file but add clear section markers and comments for maintainability

**Complexity:** High - Requires careful deployment coordination

**Priority:** Medium - Current single-file structure works, but modular would improve maintainability

### 📋 2. Deployment Helpers (`utils/deployment-helpers.js` - 1296 lines)

**Current Status:** Single large function generating bash script template

**Proposed Optimization:**
- Extract script section generators into separate functions:
  - `generateScriptHeader()` - Header and initialization
  - `generateGRUBConfiguration()` - GRUB setup section
  - `generateDependencyInstallation()` - Package installation
  - `generateOpen5GSInstallation()` - Open5GS setup
  - `generateSNMPAgentSetup()` - SNMP agent configuration
  - `generateServiceConfiguration()` - Systemd services
  - `generateScriptFooter()` - Finalization

**New Structure:**
```
utils/
  deployment-helpers/
    index.js - Main entry point
    script-sections/
      header.js
      grub-config.js
      dependencies.js
      open5gs.js
      snmp-agent.js
      services.js
      footer.js
    templates/
      base-template.js
```

**Complexity:** Medium - Template string extraction is straightforward

**Priority:** Medium - Current structure works but could be more maintainable

### 📋 3. Large Helper Files Review

**Files to Review:**
- `utils/deployment-helpers.js` (1296 lines) - See above
- `scripts/epc-snmp-discovery.js` (2147 lines) - See above

## Implementation Notes

### SNMP Discovery Script Considerations

1. **Remote Deployment:** The script runs on remote EPC devices where file structure may be limited
2. **Dependencies:** Uses optional npm packages (`ping-scanner`, `net-snmp`) with fallbacks
3. **Standalone Requirement:** Must be able to run without external module dependencies in some scenarios

### Deployment Helpers Considerations

1. **Template Strings:** Large bash script templates embedded as JavaScript template literals
2. **Backward Compatibility:** Must maintain existing function signatures
3. **Testing:** Changes must be carefully tested to ensure generated scripts work correctly

## Recommendations

1. **Immediate:** Document current structure clearly with section markers
2. **Short-term:** Extract deployment helper script sections into sub-functions (low risk)
3. **Long-term:** Consider bundling approach for SNMP discovery modules (requires build process)

## Next Steps

1. Create section markers in `epc-snmp-discovery.js` for easier navigation
2. Extract deployment helper script sections into separate template functions
3. Create comprehensive documentation for both systems
4. Consider build/bundling process for remote script deployment

