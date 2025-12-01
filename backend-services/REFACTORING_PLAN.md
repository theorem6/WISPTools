# Backend Services Refactoring Plan

## Goals
1. Extract large inline functions into separate service files
2. Break up monolithic route files into feature-based modules
3. Create reusable, protected service modules
4. Maintain 100% backward compatibility - break nothing

## Files to Refactor (by priority)

### Priority 1: Extract from server.js
- [ ] Extract EPC check-in logic → `routes/epc-checkin.js`
- [ ] Extract middleware → `middleware/error-handler.js`, `middleware/request-logger.js`
- [ ] Extract agent manifest endpoint → `routes/agent.js`
- [ ] Extract EPC delete endpoint → `routes/epc-management.js`

### Priority 2: Break up routes/plans.js (3249 lines)
- [ ] Extract PCI planning logic → `routes/plans/plans-pci.js`
- [ ] Extract marketing discovery logic → `routes/plans/plans-marketing.js`
- [ ] Extract promotions logic → `routes/plans/plans-promotions.js`
- [ ] Extract common utilities → `services/plan-service.js`

### Priority 3: Break up scripts/epc-snmp-discovery.js (2147 lines)
- [ ] Extract discovery core → `services/snmp-discovery-core.js`
- [ ] Extract MNDP discovery → `services/snmp-discovery-mndp.js`
- [ ] Extract OID walk logic → `services/snmp-discovery-oid-walk.js`
- [ ] Extract device identification → `services/snmp-discovery-device-id.js`

### Priority 4: Break up routes/epc-deployment.js (1657 lines)
- [ ] Extract ISO generation → `services/epc-deployment-iso.js`
- [ ] Extract cloud-init generation → `services/epc-deployment-cloudinit.js`
- [ ] Extract validation logic → `services/epc-deployment-validation.js`

### Priority 5: Break up utils/deployment-helpers.js (1296 lines)
- [ ] Split into feature-specific helpers

### Priority 6: Break up routes/hss-management.js (1234 lines)
- [ ] Extract HSS config management
- [ ] Extract EPC device management
- [ ] Extract site management

### Priority 7: Break up routes/snmp.js (1164 lines)
- [ ] Extract device discovery
- [ ] Extract metrics collection
- [ ] Extract polling logic

### Priority 8: Cleanup
- [ ] Remove temporary debug files
- [ ] Consolidate duplicate code
- [ ] Document new structure

