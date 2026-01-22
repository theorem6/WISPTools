function initNeighborDiscovery({ snmp, SNMP_TIMEOUT, LLDP_OIDS, CDP_OIDS, log }) {
  async function getNeighborsWithSystemSNMP(ip, community) {
    const result = {
      neighbors: [],
      cdp_enabled: false,
      lldp_enabled: false,
      cdp_failed: false,
      lldp_failed: false,
      cdp_error: null,
      lldp_error: null
    };
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const lldpOutput = await execAsync(`timeout 3 snmpwalk -v2c -c "${community}" "${ip}" ${LLDP_OIDS.lldpRemTable} 2>/dev/null`).catch((err) => {
        result.lldp_failed = true;
        result.lldp_error = err.message || 'LLDP query failed';
        return { stdout: '' };
      });
      
      if (lldpOutput.stdout && lldpOutput.stdout.trim()) {
        result.lldp_enabled = true;
        const lines = lldpOutput.stdout.split('\n');
        lines.forEach((line) => {
          const match = line.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)\s+=\s+(.+)/);
          if (match) {
            const neighborEntry = {
              device_id: match[5]?.replace(/STRING:\s*"?([^"]+)"?/, '$1').trim(),
              discovered_via: 'lldp',
              source_ip: ip
            };
            
            if (neighborEntry.device_id && neighborEntry.device_id !== '""') {
              result.neighbors.push(neighborEntry);
            }
          }
        });
      } else {
        result.lldp_failed = true;
        result.lldp_error = 'No LLDP data found';
      }
      
      if (result.neighbors.length === 0) {
        const cdpOutput = await execAsync(`timeout 3 snmpwalk -v2c -c "${community}" "${ip}" ${CDP_OIDS.cdpCacheDeviceId} 2>/dev/null`).catch((err) => {
          result.cdp_failed = true;
          result.cdp_error = err.message || 'CDP query failed';
          return { stdout: '' };
        });
        
        if (cdpOutput.stdout && cdpOutput.stdout.trim()) {
          result.cdp_enabled = true;
          const lines = cdpOutput.stdout.split('\n');
          lines.forEach((line) => {
            const match = line.match(/\.(\d+)\.(\d+)\.(\d+)\.(\d+)\s+=\s+(.+)/);
            if (match) {
              const deviceId = match[5]?.replace(/STRING:\s*"?([^"]+)"?/, '$1').trim();
              if (deviceId && deviceId !== '""') {
                const neighborEntry = {
                  device_id: deviceId,
                  discovered_via: 'cdp',
                  source_ip: ip
                };
                
                if (deviceId.toLowerCase().includes('mikrotik') || 
                    deviceId.toLowerCase().includes('routeros')) {
                  neighborEntry.device_type = 'mikrotik';
                }
                
                result.neighbors.push(neighborEntry);
              }
            }
          });
        } else {
          result.cdp_failed = true;
          result.cdp_error = 'No CDP data found';
        }
      }
    } catch (error) {
      result.cdp_failed = true;
      result.lldp_failed = true;
      result.cdp_error = error.message || 'Unknown error';
      result.lldp_error = error.message || 'Unknown error';
    }
    
    return result;
  }

  async function getMikrotikNeighbors(ip, community) {
    const result = {
      neighbors: [],
      cdp_enabled: false,
      lldp_enabled: false,
      cdp_failed: false,
      lldp_failed: false,
      cdp_error: null,
      lldp_error: null
    };
    
    try {
      if (snmp) {
        return new Promise((resolve) => {
          const session = snmp.createSession(ip, community, {
            port: 161,
            retries: 1,
            timeout: SNMP_TIMEOUT,
            transport: 'udp4'
          });
          
          session.subtree(LLDP_OIDS.lldpRemTable, (error, varbinds) => {
            if (error || !varbinds || varbinds.length === 0) {
              result.lldp_failed = true;
              result.lldp_error = error ? error.message : 'No LLDP data';
              session.close();
              getCDPNeighbors(session, ip, community).then(cdpResult => {
                resolve({
                  neighbors: cdpResult.neighbors || cdpResult || [],
                  ...result,
                  ...cdpResult
                });
              });
              return;
            }
            
            result.lldp_enabled = true;
            
            const neighborMap = {};
            varbinds.forEach((vb) => {
              const oid = vb.oid.toString();
              const value = vb.value?.toString() || '';
              
              const match = oid.match(/\.(\d+)\.(\d+)\.(\d+)$/);
              if (match) {
                const [, portNum, index] = match;
                const neighborKey = `${portNum}.${index}`;
                
                if (!neighborMap[neighborKey]) {
                  neighborMap[neighborKey] = {
                    local_port: parseInt(portNum),
                    index: parseInt(index),
                    discovered_via: 'lldp'
                  };
                }
                
                if (oid.includes('1.0.8802.1.1.2.1.4.1.1.5')) {
                  neighborMap[neighborKey].chassis_id = value;
                } else if (oid.includes('1.0.8802.1.1.2.1.4.1.1.9')) {
                  neighborMap[neighborKey].system_name = value;
                } else if (oid.includes('1.0.8802.1.1.2.1.4.1.1.10')) {
                  neighborMap[neighborKey].system_description = value;
                }
              }
            });
            
            session.close();
            resolve({
              neighbors: Object.values(neighborMap),
              ...result
            });
          });
        });
      } else {
        return await getNeighborsWithSystemSNMP(ip, community);
      }
    } catch (error) {
      log(`WARNING: Failed to discover neighbors for ${ip}: ${error.message}`);
      result.cdp_failed = true;
      result.lldp_failed = true;
      result.cdp_error = error.message;
      result.lldp_error = error.message;
      return result;
    }
  }

  async function getCDPNeighbors(session, ip, community) {
    try {
      const cdpOutput = await getNeighborsWithSystemSNMP(ip, community);
      return cdpOutput;
    } catch (error) {
      return {
        neighbors: [],
        cdp_failed: true,
        cdp_error: error.message || 'CDP query failed'
      };
    }
  }

  return {
    getMikrotikNeighbors,
    getNeighborsWithSystemSNMP
  };
}

module.exports = initNeighborDiscovery;
