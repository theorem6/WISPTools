function initNetworkHelpers({ execAsync, os, pingScanner, log, MAX_PARALLEL_PINGS }) {
  function calculateBroadcast(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    const broadcast = ipParts.map((ipPart, i) => {
      return (ipPart | (~maskParts[i] & 0xFF)) & 0xFF;
    });
    
    return broadcast.join('.');
  }

  async function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const activeInterfaces = [];
    
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      
      for (const addr of addrs) {
        // Only IPv4, not loopback, not internal
        if (addr.family === 'IPv4' && !addr.internal) {
          const broadcastAddr = addr.netmask ? calculateBroadcast(addr.address, addr.netmask) : null;
          activeInterfaces.push({
            name: name,
            address: addr.address,
            netmask: addr.netmask,
            broadcast: broadcastAddr,
            mac: addr.mac
          });
          break; // Only need one IPv4 address per interface
        }
      }
    }
    
    return activeInterfaces;
  }

  async function getNetworkInfo() {
    try {
      const { stdout: ipOutput } = await execAsync("hostname -I | awk '{print $1}'");
      const ip = ipOutput.trim();
      
      const { stdout: routeOutput } = await execAsync(`ip route | grep "${ip}" | awk '{print $1}' | head -1`);
      const network = routeOutput.trim();
      
      // Extract CIDR from network (e.g., "192.168.1.0/24")
      if (network.includes('/')) {
        return network;
      }
      
      // Calculate CIDR from IP and netmask
      const { stdout: netmaskOutput } = await execAsync(`ip route | grep "${ip}" | awk '{print $1}' | head -1`);
      // Default to /24 if can't determine
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    } catch (error) {
      log(`WARNING: Failed to get network info: ${error.message}`);
      // Default subnet
      return '192.168.1.0/24';
    }
  }

  async function pingSweep(subnet) {
    log(`Step 1: Ping sweep - finding responding hosts on subnet: ${subnet}`);
    const startTime = Date.now();
    const respondingIPs = [];
    
    // Extract base IP from subnet (e.g., "192.168.1.0/24" -> "192.168.1")
    const [baseIP, cidr] = subnet.split('/');
    const baseParts = baseIP.split('.').slice(0, 3).join('.');
    
    if (pingScanner) {
      // Use ping-scanner package
      try {
        log(`Using ping-scanner package for ping sweep...`);
        const scanner = new pingScanner.Scanner({
          network: subnet,
          timeout: 1000,
          concurrency: MAX_PARALLEL_PINGS
        });
        
        const results = await scanner.scan();
        for (const [ip, isAlive] of results.entries()) {
          if (isAlive) {
            respondingIPs.push(ip);
          }
        }
      } catch (error) {
        log(`WARNING: ping-scanner failed, falling back to native ping: ${error.message}`);
        // Fall through to native ping
      }
    }
    
    // Fallback to native ping if ping-scanner not available or failed
    if (respondingIPs.length === 0) {
      log(`Using native ping commands (parallel processing)...`);
      
      const pingPromises = [];
      for (let i = 1; i <= 254; i++) {
        const testIP = `${baseParts}.${i}`;
        
        const pingPromise = execAsync(`ping -c 1 -W 1 ${testIP}`)
          .then(() => testIP)
          .catch(() => null);
        
        pingPromises.push(pingPromise);
        
        // Batch processing to limit concurrency
        if (pingPromises.length >= MAX_PARALLEL_PINGS) {
          const results = await Promise.all(pingPromises);
          respondingIPs.push(...results.filter(ip => ip !== null));
          pingPromises.length = 0;
        }
      }
      
      // Process remaining pings
      if (pingPromises.length > 0) {
        const results = await Promise.all(pingPromises);
        respondingIPs.push(...results.filter(ip => ip !== null));
      }
    }
    
    // Remove self IP
    const selfIP = (await execAsync("hostname -I | awk '{print $1}'")).stdout.trim();
    const filteredIPs = respondingIPs.filter(ip => ip !== selfIP);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Ping sweep complete: Found ${filteredIPs.length} responding hosts in ${elapsed}s`);
    
    return filteredIPs;
  }

  return {
    calculateBroadcast,
    getNetworkInterfaces,
    getNetworkInfo,
    pingSweep
  };
}

module.exports = initNetworkHelpers;
