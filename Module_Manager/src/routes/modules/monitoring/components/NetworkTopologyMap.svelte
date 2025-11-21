<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
  export let snmpData = [];
  export let showControls = true;
  export let height = '700px';
  
  let topologyContainer;
  let network = null;
  let nodes = null;
  let edges = null;
  let selectedNode = null;
  let selectedEdge = null;
  let showNodeDetails = false;
  let showEdgeDetails = false;
  
  // Topology configuration
  let topologyConfig = {
    layout: 'hierarchical', // 'hierarchical', 'force', 'circular', 'random'
    physics: true,
    clustering: false,
    showLabels: true,
    showMetrics: true,
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  };
  
  // Node type configurations
  const nodeTypeConfig = {
    epc: {
      color: { background: '#10b981', border: '#059669' },
      shape: 'diamond',
      size: 30,
      font: { color: 'white', size: 12 },
      icon: '📡'
    },
    mikrotik_router: {
      color: { background: '#3b82f6', border: '#2563eb' },
      shape: 'box',
      size: 25,
      font: { color: 'white', size: 12 },
      icon: '🌐'
    },
    mikrotik_ap: {
      color: { background: '#8b5cf6', border: '#7c3aed' },
      shape: 'triangle',
      size: 20,
      font: { color: 'white', size: 10 },
      icon: '📶'
    },
    mikrotik_switch: {
      color: { background: '#f59e0b', border: '#d97706' },
      shape: 'box',
      size: 20,
      font: { color: 'white', size: 10 },
      icon: '🔀'
    },
    mikrotik_cpe: {
      color: { background: '#ef4444', border: '#dc2626' },
      shape: 'dot',
      size: 15,
      font: { color: 'white', size: 8 },
      icon: '📱'
    },
    internet: {
      color: { background: '#6366f1', border: '#4f46e5' },
      shape: 'star',
      size: 35,
      font: { color: 'white', size: 14 },
      icon: '🌍'
    },
    unknown: {
      color: { background: '#6b7280', border: '#4b5563' },
      shape: 'dot',
      size: 15,
      font: { color: 'white', size: 10 },
      icon: '❓'
    }
  };
  
  // Edge type configurations
  const edgeTypeConfig = {
    ethernet: {
      color: '#10b981',
      width: 3,
      dashes: false,
      label: 'Ethernet'
    },
    wireless: {
      color: '#8b5cf6',
      width: 2,
      dashes: [5, 5],
      label: 'Wireless'
    },
    fiber: {
      color: '#f59e0b',
      width: 4,
      dashes: false,
      label: 'Fiber'
    },
    vpn: {
      color: '#ef4444',
      width: 2,
      dashes: [10, 5],
      label: 'VPN'
    },
    internet: {
      color: '#6366f1',
      width: 3,
      dashes: [15, 5],
      label: 'Internet'
    },
    unknown: {
      color: '#6b7280',
      width: 1,
      dashes: [2, 2],
      label: 'Unknown'
    }
  };
  
  let refreshTimer = null;
  
  onMount(async () => {
    await initializeTopology();
    if (devices.length > 0) {
      updateTopology();
    }
    
    if (topologyConfig.autoRefresh) {
      startAutoRefresh();
    }
  });
  
  // Watch for device/SNMP data changes
  $: if (network && (devices || snmpData)) {
    updateTopology();
  }
  
  async function initializeTopology() {
    try {
      // Initialize vis.js network
      const vis = await import('vis-network/standalone');
      
      // Create empty datasets
      nodes = new vis.DataSet([]);
      edges = new vis.DataSet([]);
      
      const data = { nodes, edges };
      const options = getNetworkOptions();
      
      network = new vis.Network(topologyContainer, data, options);
      
      // Add event listeners
      network.on('selectNode', handleNodeSelect);
      network.on('selectEdge', handleEdgeSelect);
      network.on('deselectNode', handleNodeDeselect);
      network.on('deselectEdge', handleEdgeDeselect);
      network.on('doubleClick', handleDoubleClick);
      
      console.log('[Network Topology] Topology initialized');
    } catch (error) {
      console.error('[Network Topology] Failed to initialize:', error);
    }
  }
  
  function getNetworkOptions() {
    return {
      layout: {
        hierarchical: topologyConfig.layout === 'hierarchical' ? {
          enabled: true,
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 200,
          levelSeparation: 150
        } : false
      },
      physics: {
        enabled: topologyConfig.physics,
        stabilization: { iterations: 100 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09
        }
      },
      nodes: {
        borderWidth: 2,
        shadow: true,
        font: {
          size: 12,
          color: 'white'
        }
      },
      edges: {
        width: 2,
        shadow: true,
        smooth: {
          type: 'continuous'
        },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 }
        }
      },
      interaction: {
        hover: true,
        selectConnectedEdges: false
      },
      groups: nodeTypeConfig
    };
  }
  
  function updateTopology() {
    if (!network || !nodes || !edges) return;
    
    // Clear existing data
    nodes.clear();
    edges.clear();
    
    // Process devices and create nodes
    const processedNodes = processDevicesIntoNodes();
    const processedEdges = processConnectionsIntoEdges(processedNodes);
    
    // Add nodes and edges to the network
    nodes.add(processedNodes);
    edges.add(processedEdges);
    
    // Fit network to show all nodes
    setTimeout(() => {
      network.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    }, 100);
  }
  
  function processDevicesIntoNodes() {
    const processedNodes = [];
    
    // Add internet node
    processedNodes.push({
      id: 'internet',
      label: topologyConfig.showLabels ? '🌍 Internet' : '',
      group: 'internet',
      level: 0,
      deviceType: 'internet',
      metrics: {}
    });
    
    // Process actual devices
    devices.forEach(device => {
      const deviceType = getDeviceType(device);
      const config = nodeTypeConfig[deviceType] || nodeTypeConfig.unknown;
      
      // Get SNMP data for this device
      const deviceSNMP = snmpData.find(s => s.deviceId === device.id) || {};
      
      // Determine hierarchy level
      let level = getDeviceLevel(device, deviceType);
      
      // Create label
      let label = '';
      if (topologyConfig.showLabels) {
        label = `${config.icon} ${device.name || device.id}`;
        if (topologyConfig.showMetrics && device.metrics) {
          if (device.metrics.cpuUsage) {
            label += `\nCPU: ${device.metrics.cpuUsage.toFixed(1)}%`;
          }
          if (device.metrics.activeUsers) {
            label += `\nUsers: ${device.metrics.activeUsers}`;
          }
        }
      }
      
      processedNodes.push({
        id: device.id,
        label: label,
        group: deviceType,
        level: level,
        deviceType: deviceType,
        device: device,
        snmpData: deviceSNMP,
        metrics: device.metrics || {},
        title: createNodeTooltip(device, deviceSNMP)
      });
    });
    
    return processedNodes;
  }
  
  function processConnectionsIntoEdges(nodes) {
    const processedEdges = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Create connections based on network topology analysis
    const connections = analyzeNetworkTopology(nodes);
    
    connections.forEach(connection => {
      const fromNode = nodeMap.get(connection.from);
      const toNode = nodeMap.get(connection.to);
      
      if (fromNode && toNode) {
        const edgeType = determineConnectionType(fromNode, toNode, connection);
        const config = edgeTypeConfig[edgeType] || edgeTypeConfig.unknown;
        
        let label = '';
        if (topologyConfig.showLabels && connection.bandwidth) {
          label = `${connection.bandwidth}`;
        }
        
        processedEdges.push({
          id: `${connection.from}-${connection.to}`,
          from: connection.from,
          to: connection.to,
          color: config.color,
          width: config.width,
          dashes: config.dashes,
          label: label,
          connectionType: edgeType,
          bandwidth: connection.bandwidth,
          latency: connection.latency,
          packetLoss: connection.packetLoss,
          title: createEdgeTooltip(connection, edgeType)
        });
      }
    });
    
    return processedEdges;
  }
  
  function analyzeNetworkTopology(nodes) {
    const connections = [];
    
    // Connect EPCs to internet through routers
    const epcs = nodes.filter(n => n.deviceType === 'epc');
    const routers = nodes.filter(n => n.deviceType === 'mikrotik_router');
    const aps = nodes.filter(n => n.deviceType === 'mikrotik_ap');
    const switches = nodes.filter(n => n.deviceType === 'mikrotik_switch');
    const cpes = nodes.filter(n => n.deviceType === 'mikrotik_cpe');
    
    // Connect routers to internet
    routers.forEach(router => {
      connections.push({
        from: 'internet',
        to: router.id,
        type: 'internet',
        bandwidth: '1 Gbps',
        latency: '10ms',
        packetLoss: '0%'
      });
    });
    
    // Connect EPCs to routers (typically fiber or ethernet)
    epcs.forEach(epc => {
      const nearestRouter = findNearestDevice(epc, routers);
      if (nearestRouter) {
        connections.push({
          from: nearestRouter.id,
          to: epc.id,
          type: 'fiber',
          bandwidth: '10 Gbps',
          latency: '1ms',
          packetLoss: '0%'
        });
      }
    });
    
    // Connect switches to routers
    switches.forEach(switchDevice => {
      const nearestRouter = findNearestDevice(switchDevice, routers);
      if (nearestRouter) {
        connections.push({
          from: nearestRouter.id,
          to: switchDevice.id,
          type: 'ethernet',
          bandwidth: '1 Gbps',
          latency: '1ms',
          packetLoss: '0%'
        });
      }
    });
    
    // Connect APs to routers or switches
    aps.forEach(ap => {
      const nearestInfra = findNearestDevice(ap, [...routers, ...switches]);
      if (nearestInfra) {
        const connectionType = ap.device?.location && nearestInfra.device?.location && 
                              calculateDistance(ap.device.location.coordinates, nearestInfra.device.location.coordinates) > 5 
                              ? 'wireless' : 'ethernet';
        
        connections.push({
          from: nearestInfra.id,
          to: ap.id,
          type: connectionType,
          bandwidth: connectionType === 'wireless' ? '100 Mbps' : '1 Gbps',
          latency: connectionType === 'wireless' ? '5ms' : '1ms',
          packetLoss: connectionType === 'wireless' ? '0.1%' : '0%'
        });
      }
    });
    
    // Connect CPEs to APs (wireless connections)
    cpes.forEach(cpe => {
      const nearestAP = findNearestDevice(cpe, aps);
      if (nearestAP) {
        // Get signal strength from SNMP data if available
        const signalStrength = cpe.snmpData?.signalStrength || -70;
        const bandwidth = signalStrength > -60 ? '50 Mbps' : signalStrength > -70 ? '25 Mbps' : '10 Mbps';
        
        connections.push({
          from: nearestAP.id,
          to: cpe.id,
          type: 'wireless',
          bandwidth: bandwidth,
          latency: '10ms',
          packetLoss: signalStrength > -70 ? '0.1%' : '0.5%',
          signalStrength: signalStrength
        });
      }
    });
    
    return connections;
  }
  
  function findNearestDevice(device, candidates) {
    if (!device.device?.location?.coordinates || candidates.length === 0) {
      return candidates[0] || null;
    }
    
    let nearest = null;
    let minDistance = Infinity;
    
    candidates.forEach(candidate => {
      if (candidate.device?.location?.coordinates) {
        const distance = calculateDistance(
          device.device.location.coordinates,
          candidate.device.location.coordinates
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = candidate;
        }
      }
    });
    
    return nearest || candidates[0];
  }
  
  function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  function getDeviceType(device) {
    if (device.type === 'epc') return 'epc';
    if (device.type === 'mikrotik') {
      return `mikrotik_${device.deviceType || 'router'}`;
    }
    return 'unknown';
  }
  
  function getDeviceLevel(device, deviceType) {
    // Assign hierarchy levels for hierarchical layout
    switch (deviceType) {
      case 'internet': return 0;
      case 'mikrotik_router': return 1;
      case 'epc': return 2;
      case 'mikrotik_switch': return 2;
      case 'mikrotik_ap': return 3;
      case 'mikrotik_cpe': return 4;
      default: return 5;
    }
  }
  
  function determineConnectionType(fromNode, toNode, connection) {
    if (connection.type) return connection.type;
    
    // Determine connection type based on device types and distance
    if (fromNode.deviceType === 'internet') return 'internet';
    if (toNode.deviceType === 'epc' || fromNode.deviceType === 'epc') return 'fiber';
    if (toNode.deviceType === 'mikrotik_cpe' || fromNode.deviceType === 'mikrotik_cpe') return 'wireless';
    if (toNode.deviceType === 'mikrotik_ap' || fromNode.deviceType === 'mikrotik_ap') {
      // Check distance to determine if wireless backhaul
      if (fromNode.device?.location && toNode.device?.location) {
        const distance = calculateDistance(
          fromNode.device.location.coordinates,
          toNode.device.location.coordinates
        );
        return distance > 5 ? 'wireless' : 'ethernet';
      }
      return 'ethernet';
    }
    
    return 'ethernet';
  }
  
  function createNodeTooltip(device, snmpData) {
    let tooltip = `<strong>${device.name || device.id}</strong><br>`;
    tooltip += `Type: ${getDeviceType(device)}<br>`;
    tooltip += `Status: ${device.status}<br>`;
    
    if (device.ipAddress) {
      tooltip += `IP: ${device.ipAddress}<br>`;
    }
    
    if (device.metrics) {
      tooltip += '<br><strong>Metrics:</strong><br>';
      if (device.metrics.cpuUsage) tooltip += `CPU: ${device.metrics.cpuUsage.toFixed(1)}%<br>`;
      if (device.metrics.memoryUsage) tooltip += `Memory: ${device.metrics.memoryUsage.toFixed(1)}%<br>`;
      if (device.metrics.activeUsers) tooltip += `Users: ${device.metrics.activeUsers}<br>`;
    }
    
    if (snmpData && Object.keys(snmpData).length > 0) {
      tooltip += '<br><strong>SNMP Data:</strong><br>';
      if (snmpData.uptime) tooltip += `Uptime: ${snmpData.uptime}<br>`;
      if (snmpData.temperature) tooltip += `Temp: ${snmpData.temperature}°C<br>`;
    }
    
    return tooltip;
  }
  
  function createEdgeTooltip(connection, edgeType) {
    let tooltip = `<strong>${edgeTypeConfig[edgeType]?.label || 'Connection'}</strong><br>`;
    if (connection.bandwidth) tooltip += `Bandwidth: ${connection.bandwidth}<br>`;
    if (connection.latency) tooltip += `Latency: ${connection.latency}<br>`;
    if (connection.packetLoss) tooltip += `Packet Loss: ${connection.packetLoss}<br>`;
    if (connection.signalStrength) tooltip += `Signal: ${connection.signalStrength} dBm<br>`;
    return tooltip;
  }
  
  function handleNodeSelect(event) {
    const nodeId = event.nodes[0];
    if (nodeId) {
      const node = nodes.get(nodeId);
      selectedNode = node;
      showNodeDetails = true;
      dispatch('nodeSelected', node);
    }
  }
  
  function handleEdgeSelect(event) {
    const edgeId = event.edges[0];
    if (edgeId) {
      const edge = edges.get(edgeId);
      selectedEdge = edge;
      showEdgeDetails = true;
      dispatch('edgeSelected', edge);
    }
  }
  
  function handleNodeDeselect() {
    selectedNode = null;
    showNodeDetails = false;
  }
  
  function handleEdgeDeselect() {
    selectedEdge = null;
    showEdgeDetails = false;
  }
  
  function handleDoubleClick(event) {
    if (event.nodes.length > 0) {
      const nodeId = event.nodes[0];
      const node = nodes.get(nodeId);
      if (node && node.device) {
        dispatch('deviceDoubleClick', node.device);
      }
    }
  }
  
  function changeLayout(layout) {
    topologyConfig.layout = layout;
    const options = getNetworkOptions();
    network.setOptions(options);
    
    // Re-fit the network
    setTimeout(() => {
      network.fit();
    }, 100);
  }
  
  function togglePhysics() {
    topologyConfig.physics = !topologyConfig.physics;
    network.setOptions({ physics: { enabled: topologyConfig.physics } });
  }
  
  function toggleLabels() {
    topologyConfig.showLabels = !topologyConfig.showLabels;
    updateTopology();
  }
  
  function toggleMetrics() {
    topologyConfig.showMetrics = !topologyConfig.showMetrics;
    updateTopology();
  }
  
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    
    refreshTimer = setInterval(() => {
      dispatch('refreshData');
    }, topologyConfig.refreshInterval);
  }
  
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }
  
  function exportTopology() {
    if (network) {
      const canvas = network.getCanvas();
      const dataURL = canvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.download = `network-topology-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataURL;
      link.click();
    }
  }
</script>

<div class="topology-container" style="height: {height}">
  <!-- Topology Controls -->
  {#if showControls}
    <div class="topology-controls">
      <div class="control-panel">
        <div class="control-section">
          <h4>Layout</h4>
          <div class="control-group">
            <select bind:value={topologyConfig.layout} on:change={() => changeLayout(topologyConfig.layout)}>
              <option value="hierarchical">Hierarchical</option>
              <option value="force">Force-directed</option>
              <option value="circular">Circular</option>
              <option value="random">Random</option>
            </select>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Display</h4>
          <div class="control-group">
            <label>
              <input type="checkbox" bind:checked={topologyConfig.physics} on:change={togglePhysics} />
              Physics Simulation
            </label>
            <label>
              <input type="checkbox" bind:checked={topologyConfig.showLabels} on:change={toggleLabels} />
              Show Labels
            </label>
            <label>
              <input type="checkbox" bind:checked={topologyConfig.showMetrics} on:change={toggleMetrics} />
              Show Metrics
            </label>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Auto-Refresh</h4>
          <div class="control-group">
            <label>
              <input type="checkbox" bind:checked={topologyConfig.autoRefresh} 
                     on:change={() => topologyConfig.autoRefresh ? startAutoRefresh() : stopAutoRefresh()} />
              Enable Auto-Refresh
            </label>
            {#if topologyConfig.autoRefresh}
              <select bind:value={topologyConfig.refreshInterval} on:change={startAutoRefresh}>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
              </select>
            {/if}
          </div>
        </div>
        
        <div class="control-section">
          <h4>Actions</h4>
          <div class="control-group">
            <button class="btn btn-sm" on:click={() => network?.fit()}>
              🎯 Fit to Screen
            </button>
            <button class="btn btn-sm" on:click={exportTopology}>
              💾 Export Image
            </button>
            <button class="btn btn-sm" on:click={() => dispatch('refreshData')}>
              🔄 Refresh Data
            </button>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Legend</h4>
          <div class="legend">
            {#each Object.entries(nodeTypeConfig) as [type, config]}
              <div class="legend-item">
                <div class="legend-node" style="background-color: {config.color.background}; border-color: {config.color.border}">
                  {config.icon}
                </div>
                <span class="legend-label">{type.replace('mikrotik_', '').replace('_', ' ')}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Topology Visualization -->
  <div class="topology-canvas" bind:this={topologyContainer}></div>
  
  <!-- Node Details Panel -->
  {#if showNodeDetails && selectedNode}
    <div class="details-panel node-details">
      <div class="panel-header">
        <h3>{selectedNode.device?.name || selectedNode.id}</h3>
        <button class="close-btn" on:click={() => showNodeDetails = false}>✕</button>
      </div>
      
      <div class="panel-content">
        <div class="device-info">
          <div class="info-row">
            <label>Type:</label>
            <span>{selectedNode.deviceType.replace('mikrotik_', '').replace('_', ' ')}</span>
          </div>
          <div class="info-row">
            <label>Status:</label>
            <span class="status-badge {selectedNode.device?.status}">{selectedNode.device?.status || 'unknown'}</span>
          </div>
          {#if selectedNode.device?.ipAddress}
            <div class="info-row">
              <label>IP Address:</label>
              <span>{selectedNode.device.ipAddress}</span>
            </div>
          {/if}
          {#if selectedNode.device?.location?.address}
            <div class="info-row">
              <label>Location:</label>
              <span>{selectedNode.device.location.address}</span>
            </div>
          {/if}
        </div>
        
        {#if selectedNode.metrics && Object.keys(selectedNode.metrics).length > 0}
          <div class="metrics-section">
            <h4>Current Metrics</h4>
            {#if selectedNode.metrics.cpuUsage}
              <div class="metric-row">
                <label>CPU Usage:</label>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: {selectedNode.metrics.cpuUsage}%"></div>
                  <span>{selectedNode.metrics.cpuUsage.toFixed(1)}%</span>
                </div>
              </div>
            {/if}
            {#if selectedNode.metrics.memoryUsage}
              <div class="metric-row">
                <label>Memory Usage:</label>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: {selectedNode.metrics.memoryUsage}%"></div>
                  <span>{selectedNode.metrics.memoryUsage.toFixed(1)}%</span>
                </div>
              </div>
            {/if}
            {#if selectedNode.metrics.activeUsers}
              <div class="metric-row">
                <label>Active Users:</label>
                <span>{selectedNode.metrics.activeUsers}</span>
              </div>
            {/if}
          </div>
        {/if}
        
        {#if selectedNode.snmpData && Object.keys(selectedNode.snmpData).length > 0}
          <div class="snmp-section">
            <h4>SNMP Data</h4>
            {#each Object.entries(selectedNode.snmpData) as [key, value]}
              <div class="info-row">
                <label>{key}:</label>
                <span>{value}</span>
              </div>
            {/each}
          </div>
        {/if}
        
        <div class="panel-actions">
          <button class="btn btn-primary" on:click={() => dispatch('viewDeviceDetails', selectedNode.device)}>
            View Full Details
          </button>
          {#if selectedNode.deviceType.startsWith('mikrotik')}
            <button class="btn btn-secondary" on:click={() => dispatch('configureDevice', selectedNode.device)}>
              Configure Device
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Edge Details Panel -->
  {#if showEdgeDetails && selectedEdge}
    <div class="details-panel edge-details">
      <div class="panel-header">
        <h3>Connection Details</h3>
        <button class="close-btn" on:click={() => showEdgeDetails = false}>✕</button>
      </div>
      
      <div class="panel-content">
        <div class="connection-info">
          <div class="info-row">
            <label>Type:</label>
            <span>{edgeTypeConfig[selectedEdge.connectionType]?.label || 'Unknown'}</span>
          </div>
          {#if selectedEdge.bandwidth}
            <div class="info-row">
              <label>Bandwidth:</label>
              <span>{selectedEdge.bandwidth}</span>
            </div>
          {/if}
          {#if selectedEdge.latency}
            <div class="info-row">
              <label>Latency:</label>
              <span>{selectedEdge.latency}</span>
            </div>
          {/if}
          {#if selectedEdge.packetLoss}
            <div class="info-row">
              <label>Packet Loss:</label>
              <span>{selectedEdge.packetLoss}</span>
            </div>
          {/if}
          {#if selectedEdge.signalStrength}
            <div class="info-row">
              <label>Signal Strength:</label>
              <span>{selectedEdge.signalStrength} dBm</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .topology-container {
    position: relative;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color, #e5e7eb);
    background: var(--card-bg, white);
  }
  
  .topology-canvas {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary, #f9fafb);
  }
  
  .topology-controls {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    background: var(--card-bg, white);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 280px;
    max-height: calc(100% - 2rem);
    overflow-y: auto;
  }
  
  .control-panel {
    padding: 1rem;
  }
  
  .control-section {
    margin-bottom: 1.5rem;
  }
  
  .control-section:last-child {
    margin-bottom: 0;
  }
  
  .control-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }
  
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .control-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    cursor: pointer;
  }
  
  .control-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 4px;
    background: var(--card-bg, white);
    color: var(--text-primary, #111827);
    font-size: 0.875rem;
  }
  
  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .legend-node {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }
  
  .legend-label {
    color: var(--text-primary, #111827);
    text-transform: capitalize;
  }
  
  .details-panel {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 300px;
    background: var(--card-bg, white);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-height: calc(100% - 2rem);
    overflow-y: auto;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #111827);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.25rem;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
  }
  
  .panel-content {
    padding: 1rem;
  }
  
  .device-info, .connection-info {
    margin-bottom: 1rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }
  
  .info-row label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }
  
  .status-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .status-badge.online {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
  }
  
  .status-badge.offline {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  .status-badge.unknown {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
  }
  
  .metrics-section, .snmp-section {
    margin-bottom: 1rem;
  }
  
  .metrics-section h4, .snmp-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }
  
  .metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .metric-row label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }
  
  .metric-bar {
    position: relative;
    width: 100px;
    height: 16px;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .metric-fill {
    height: 100%;
    background: var(--primary, #3b82f6);
    transition: width 0.3s ease;
  }
  
  .metric-bar span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }
  
  .panel-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }
  
  .btn-primary:hover {
    background: #2563eb;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary, #6b7280);
    color: white;
  }
  
  .btn-secondary:hover {
    background: #4b5563;
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
</style>
