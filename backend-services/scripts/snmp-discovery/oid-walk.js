function initOidWalk({ snmp, SNMP_TIMEOUT, IF_MIB_OIDS, IP_MIB_OIDS, ouiLookup, log }) {
  async function performOIDWalk(ip, community) {
    const walkData = {
      interfaces: [],
      arp_table: [],
      routes: [],
      ip_addresses: []
    };
    
    if (!snmp) {
      return walkData; // Skip OID walk if net-snmp not available
    }
    
    try {
      const session = snmp.createSession(ip, community, {
        port: 161,
        retries: 1,
        timeout: SNMP_TIMEOUT * 2,
        transport: 'udp4'
      });
      
      // Walk interface table
      try {
        await new Promise((resolve) => {
          const interfaces = new Map();
          session.subtree(IF_MIB_OIDS.ifTable, (error, varbinds) => {
            if (error || !varbinds) {
              resolve();
              return;
            }
            
            varbinds.forEach((vb) => {
              const oid = vb.oid.toString();
              const value = vb.value;
              const ifIndex = parseInt(oid.split('.').pop());
              
              if (!interfaces.has(ifIndex)) {
                interfaces.set(ifIndex, { index: ifIndex });
              }
              
              const iface = interfaces.get(ifIndex);
              
              if (oid.includes(IF_MIB_OIDS.ifDescr.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.description = value?.toString() || '';
              } else if (oid.includes(IF_MIB_OIDS.ifType.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifSpeed.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.speed = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifPhysAddress.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.mac_address = value?.toString() || '';
              } else if (oid.includes(IF_MIB_OIDS.ifAdminStatus.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.admin_status = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifOperStatus.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.oper_status = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifInOctets.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.in_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifOutOctets.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.out_octets = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifInErrors.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.in_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IF_MIB_OIDS.ifOutErrors.replace('1.3.6.1.2.1.2.2.1.', ''))) {
                iface.out_errors = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              }
            });
            
            walkData.interfaces = Array.from(interfaces.values());
            resolve();
          });
        });
      } catch (error) {
        log(`WARNING: Failed to walk interface table for ${ip}: ${error.message}`);
      }
      
      // Walk ARP table
      try {
        await new Promise((resolve) => {
          const arpEntries = new Map();
          session.subtree(IP_MIB_OIDS.ipNetToMediaTable, (error, varbinds) => {
            if (error || !varbinds) {
              resolve();
              return;
            }
            
            varbinds.forEach((vb) => {
              const oid = vb.oid.toString();
              const value = vb.value;
              
              const oidParts = oid.split('.');
              const ipIndex = oidParts.slice(-4).join('.');
              
              if (!arpEntries.has(ipIndex)) {
                arpEntries.set(ipIndex, { ip_address: ipIndex });
              }
              
              const entry = arpEntries.get(ipIndex);
              
              if (oid.includes(IP_MIB_OIDS.ipNetToMediaPhysAddress.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.mac_address = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipNetToMediaIfIndex.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.interface_index = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IP_MIB_OIDS.ipNetToMediaType.replace('1.3.6.1.2.1.4.22.1.', ''))) {
                entry.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              }
            });
            
            walkData.arp_table = Array.from(arpEntries.values());
            resolve();
          });
        });
      } catch (error) {
        log(`WARNING: Failed to walk ARP table for ${ip}: ${error.message}`);
      }
      
      // Walk routing table
      try {
        await new Promise((resolve) => {
          const routes = new Map();
          session.subtree(IP_MIB_OIDS.ipRouteTable, (error, varbinds) => {
            if (error || !varbinds) {
              resolve();
              return;
            }
            
            varbinds.forEach((vb) => {
              const oid = vb.oid.toString();
              const value = vb.value;
              
              const oidParts = oid.split('.');
              const destIndex = oidParts.slice(-4).join('.');
              
              if (!routes.has(destIndex)) {
                routes.set(destIndex, { destination: destIndex });
              }
              
              const route = routes.get(destIndex);
              
              if (oid.includes(IP_MIB_OIDS.ipRouteNextHop.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.next_hop = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipRouteMask.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.mask = value?.toString() || '';
              } else if (oid.includes(IP_MIB_OIDS.ipRouteType.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.type = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              } else if (oid.includes(IP_MIB_OIDS.ipRouteProto.replace('1.3.6.1.2.1.4.21.1.', ''))) {
                route.protocol = typeof value === 'number' ? value : parseInt(value?.toString() || '0');
              }
            });
            
            walkData.routes = Array.from(routes.values());
            resolve();
          });
        });
      } catch (error) {
        log(`WARNING: Failed to walk routing table for ${ip}: ${error.message}`);
      }
      
      // Walk IP address table
      try {
        await new Promise((resolve) => {
          const ipAddrs = new Map();
          session.subtree(IP_MIB_OIDS.ipAdEntAddr, (error, varbinds) => {
            if (error || !varbinds) {
              resolve();
              return;
            }
            
            varbinds.forEach((vb) => {
              const ipAddr = vb.value?.toString() || '';
              if (ipAddr && !ipAddr.includes('127.') && !ipAddr.includes('::1')) {
                ipAddrs.set(ipAddr, { ip_address: ipAddr });
              }
            });
            
            walkData.ip_addresses = Array.from(ipAddrs.values());
            resolve();
          });
        });
      } catch (error) {
        log(`WARNING: Failed to walk IP address table for ${ip}: ${error.message}`);
      }
      
      session.close();
    } catch (error) {
      log(`WARNING: OID walk failed for ${ip}: ${error.message}`);
    }
    
    return walkData;
  }

  function identifyDeviceType(deviceInfo, walkData) {
    const sysObjectID = deviceInfo.sysObjectID || '';
    const sysDescr = (deviceInfo.sysDescr || '').toLowerCase();
    
    if (sysObjectID.includes('1.3.6.1.4.1.14988') || sysDescr.includes('mikrotik') || sysDescr.includes('routeros')) {
      return 'mikrotik';
    }
    
    if (ouiLookup && walkData && walkData.arp_table && Array.isArray(walkData.arp_table)) {
      const mikrotikFromARP = ouiLookup.detectMikrotikFromArpTable(walkData.arp_table);
      if (mikrotikFromARP && mikrotikFromARP.length > 0) {
        log(`  Detected Mikrotik device via OUI lookup from ARP table (${mikrotikFromARP.length} MAC address(es))`);
        return 'mikrotik';
      }
    }
    
    if (ouiLookup && walkData && walkData.interfaces && Array.isArray(walkData.interfaces)) {
      for (const iface of walkData.interfaces) {
        if (iface.mac_address || iface.phys_address) {
          const mac = iface.mac_address || iface.phys_address;
          if (ouiLookup.isMikrotikOUI(mac)) {
            log(`  Detected Mikrotik device via OUI lookup from interface MAC: ${mac}`);
            return 'mikrotik';
          }
        }
      }
    }
    
    if (sysObjectID.includes('1.3.6.1.4.1.9')) {
      if (walkData.interfaces && walkData.interfaces.length > 8) {
        const hasManyEth = walkData.interfaces.filter(i => i.type === 6).length > 4;
        if (hasManyEth) return 'switch';
      }
      return 'cisco_router';
    }
    
    if (sysObjectID.includes('1.3.6.1.4.1.2011')) {
      return 'huawei';
    }
    
    if (sysObjectID.includes('1.3.6.1.4.1.41112') || sysDescr.includes('ubiquiti')) {
      return 'ubiquiti';
    }
    
    if (walkData.interfaces && walkData.interfaces.length > 0) {
      const interfaceCount = walkData.interfaces.length;
      const ethernetCount = walkData.interfaces.filter(i => i.type === 6).length;
      const hasVLAN = walkData.interfaces.some(i => i.type === 53 || i.description?.toLowerCase().includes('vlan'));
      
      if (ethernetCount > 4 && hasVLAN && walkData.arp_table && walkData.arp_table.length > 0) {
        return 'switch';
      }
      
      if (interfaceCount <= 8 && walkData.routes && walkData.routes.length > 1) {
        return 'router';
      }
      
      const wirelessCount = walkData.interfaces.filter(i => i.type === 71 || i.type === 6 && i.description?.toLowerCase().includes('wifi')).length;
      if (wirelessCount > 0) {
        return 'access_point';
      }
    }
    
    return deviceInfo.device_type || 'generic';
  }

  return { performOIDWalk, identifyDeviceType };
}

module.exports = initOidWalk;
