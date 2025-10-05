# GenieACS Integration Plan for PCI Mapper

## Overview
This document outlines the integration strategy for incorporating GenieACS (TR-069 Auto Configuration Server) into the PCI Mapper project to enable CPE (Customer Premises Equipment) location mapping and performance monitoring.

## Current System Analysis

### PCI Mapper Architecture
- **Data Model**: Network > Cell Site (Tower) > Sector > EARFCN/Channel
- **Mapping**: ArcGIS-based visualization with GPS coordinates
- **Technology**: SvelteKit frontend, Firebase backend, TypeScript

### GenieACS Architecture
- **genieacs-cwmp**: TR-069 protocol communication (port 7547)
- **genieacs-nbi**: REST API for external integration (port 7557)
- **genieacs-fs**: File server for firmware/configs (port 7567)
- **genieacs-ui**: Web interface (port 3000)
- **Database**: MongoDB for device data storage

## Integration Strategy

### Phase 1: Core Integration Setup
1. **Fork GenieACS**: Clone and integrate GenieACS components
2. **Database Integration**: Connect GenieACS MongoDB with existing Firebase
3. **API Bridge**: Create service layer to bridge GenieACS NBI with PCI Mapper
4. **CPE Data Model**: Extend current models to support TR-069 device data

### Phase 2: GPS Location Mapping
1. **TR-069 Parameter Mapping**: Configure CPEs to report GPS coordinates
2. **Location Service**: Create service to collect and process GPS data
3. **Map Integration**: Extend ArcGIS mapper to display CPE locations
4. **Real-time Updates**: Implement live location updates from CPEs

### Phase 3: Performance Monitoring
1. **Parameter Collection**: Configure TR-069 parameters for performance metrics
2. **Data Visualization**: Create graphs for CPE performance data
3. **Interactive UI**: Implement click-to-view metrics on map
4. **Historical Data**: Store and display time-series performance data

## Technical Implementation

### 1. GenieACS Integration Structure
```
src/lib/genieacs/
├── services/
│   ├── acsService.ts          # Main ACS communication service
│   ├── deviceService.ts       # Device management service
│   ├── parameterService.ts    # TR-069 parameter handling
│   └── locationService.ts     # GPS location processing
├── models/
│   ├── cpeDevice.ts          # CPE device data model
│   ├── tr069Parameters.ts    # TR-069 parameter definitions
│   └── performanceMetrics.ts # Performance data model
├── api/
│   ├── nbiClient.ts          # GenieACS NBI client
│   └── cwmpClient.ts         # CWMP protocol client
└── utils/
    ├── parameterMapper.ts    # Parameter mapping utilities
    └── dataTransformer.ts    # Data transformation utilities
```

### 2. Enhanced Data Models

#### CPE Device Model
```typescript
interface CPEDevice {
  id: string;                    // Unique device identifier
  deviceId: {                    // TR-069 device identification
    manufacturer: string;
    oui: string;
    productClass: string;
    serialNumber: string;
  };
  location: {
    latitude: number;            // GPS coordinates
    longitude: number;
    accuracy?: number;           // GPS accuracy in meters
    lastUpdate: Date;
  };
  networkInfo: {
    ipAddress: string;
    macAddress: string;
    connectionType: string;      // WiFi, Ethernet, Cellular
  };
  performanceMetrics: {
    signalStrength: number;      // RSSI/dBm
    bandwidth: number;           // Throughput in Mbps
    latency: number;             // Round-trip time in ms
    packetLoss: number;          // Percentage
    uptime: number;              // Device uptime in seconds
  };
  lastContact: Date;
  status: 'online' | 'offline' | 'unknown';
  parameters: TR069Parameter[];  // TR-069 parameter values
}
```

#### TR-069 Parameter Model
```typescript
interface TR069Parameter {
  name: string;                  // Parameter path (e.g., "InternetGatewayDevice.DeviceInfo.SoftwareVersion")
  value: string | number | boolean;
  type: 'string' | 'int' | 'unsignedInt' | 'boolean' | 'dateTime';
  timestamp: Date;
  writable: boolean;
  category: 'location' | 'performance' | 'configuration' | 'status';
}
```

### 3. Key TR-069 Parameters for CPE Mapping

#### GPS/Location Parameters
- `Device.GPS.Latitude` - GPS latitude
- `Device.GPS.Longitude` - GPS longitude
- `Device.GPS.Accuracy` - GPS accuracy
- `Device.GPS.LastUpdate` - Last GPS update timestamp

#### Performance Parameters
- `Device.WiFi.Radio.1.SignalStrength` - WiFi signal strength
- `Device.Ethernet.Interface.1.Stats.BytesReceived` - Traffic statistics
- `Device.DeviceInfo.Uptime` - Device uptime
- `Device.ManagementServer.ConnectionRequestURL` - ACS connection info

#### Network Parameters
- `Device.IP.Interface.1.IPAddress` - IP address
- `Device.Ethernet.Interface.1.MACAddress` - MAC address
- `Device.WiFi.Radio.1.Channel` - WiFi channel
- `Device.WiFi.Radio.1.Frequency` - WiFi frequency

### 4. Integration Services

#### GenieACS Service
```typescript
class GenieACSService {
  // Initialize connection to GenieACS NBI
  async initialize(): Promise<void>
  
  // Get all CPE devices
  async getDevices(): Promise<CPEDevice[]>
  
  // Get device parameters
  async getDeviceParameters(deviceId: string): Promise<TR069Parameter[]>
  
  // Set device parameters
  async setDeviceParameters(deviceId: string, parameters: TR069Parameter[]): Promise<void>
  
  // Get device location
  async getDeviceLocation(deviceId: string): Promise<Location>
  
  // Get performance metrics
  async getPerformanceMetrics(deviceId: string): Promise<PerformanceMetrics>
}
```

#### Location Service
```typescript
class LocationService {
  // Process GPS data from TR-069 parameters
  processGPSData(parameters: TR069Parameter[]): Location
  
  // Validate GPS coordinates
  validateGPS(latitude: number, longitude: number): boolean
  
  // Calculate distance between points
  calculateDistance(point1: Location, point2: Location): number
  
  // Update device location in database
  updateDeviceLocation(deviceId: string, location: Location): Promise<void>
}
```

### 5. Map Integration Enhancements

#### Extended ArcGIS Mapper
```typescript
class EnhancedPCIArcGISMapper extends PCIArcGISMapper {
  private cpeLayer: any;           // CPE locations layer
  private performanceLayer: any;   // Performance indicators layer
  
  // Add CPE devices to map
  async renderCPEDevices(cpeDevices: CPEDevice[]): Promise<void>
  
  // Handle CPE click events
  onCPEClick(callback: (deviceId: string) => void): void
  
  // Display performance metrics popup
  showPerformanceMetrics(deviceId: string, metrics: PerformanceMetrics): void
  
  // Update CPE locations in real-time
  updateCPELocations(updates: CPEUpdate[]): void
}
```

### 6. Performance Visualization Components

#### CPE Performance Modal
```svelte
<!-- CPEPerformanceModal.svelte -->
<script lang="ts">
  import { CPEDevice, PerformanceMetrics } from '$lib/genieacs/models';
  
  export let cpeDevice: CPEDevice;
  export let isOpen: boolean;
  
  let metrics: PerformanceMetrics;
  let chartData: ChartData;
  
  // Load performance data
  async function loadPerformanceData() {
    // Implementation
  }
</script>

<div class="modal" class:open={isOpen}>
  <div class="modal-content">
    <h2>{cpeDevice.deviceId.serialNumber}</h2>
    
    <!-- GPS Location -->
    <div class="location-info">
      <p>Latitude: {cpeDevice.location.latitude}</p>
      <p>Longitude: {cpeDevice.location.longitude}</p>
    </div>
    
    <!-- Performance Charts -->
    <div class="charts">
      <!-- Signal Strength Chart -->
      <canvas bind:this={signalChart}></canvas>
      
      <!-- Bandwidth Chart -->
      <canvas bind:this={bandwidthChart}></canvas>
      
      <!-- Latency Chart -->
      <canvas bind:this={latencyChart}></canvas>
    </div>
  </div>
</div>
```

## Deployment Architecture

### Development Environment
1. **GenieACS Services**: Run locally on default ports
2. **MongoDB**: Local MongoDB instance for GenieACS
3. **PCI Mapper**: Existing SvelteKit development setup
4. **CPE Simulator**: Use genieacs-sim for testing

### Production Environment
1. **GenieACS**: Deploy on dedicated server/VPS
2. **Database**: MongoDB cluster for scalability
3. **PCI Mapper**: Deploy to Firebase Hosting
4. **API Integration**: RESTful communication between services

## Security Considerations

### TR-069 Security
- **Authentication**: Implement proper CPE authentication
- **Encryption**: Use HTTPS for all communications
- **Access Control**: Role-based access to CPE data
- **Data Privacy**: Protect GPS and performance data

### API Security
- **API Keys**: Secure API communication between services
- **Rate Limiting**: Implement rate limiting for API calls
- **Input Validation**: Validate all TR-069 parameter data
- **Audit Logging**: Log all CPE interactions

## Testing Strategy

### Unit Tests
- TR-069 parameter parsing
- GPS data validation
- Performance metric calculations
- Data transformation utilities

### Integration Tests
- GenieACS NBI communication
- Database operations
- Map rendering with CPE data
- Real-time updates

### End-to-End Tests
- Complete CPE discovery workflow
- GPS location mapping
- Performance monitoring
- User interaction flows

## Timeline

### Week 1-2: Foundation
- Set up GenieACS fork integration
- Create basic data models
- Implement core services

### Week 3-4: GPS Integration
- Configure TR-069 GPS parameters
- Implement location service
- Extend map with CPE locations

### Week 5-6: Performance Monitoring
- Add performance parameter collection
- Create visualization components
- Implement real-time updates

### Week 7-8: Testing & Polish
- Comprehensive testing
- Performance optimization
- UI/UX improvements
- Documentation

## Success Metrics

### Technical Metrics
- CPE discovery rate: >95%
- GPS accuracy: <10 meters
- Real-time update latency: <5 seconds
- API response time: <200ms

### User Experience Metrics
- Map load time: <3 seconds
- CPE click response: <1 second
- Chart rendering: <2 seconds
- Overall system reliability: >99%

## Conclusion

This integration plan provides a comprehensive approach to incorporating GenieACS TR-069 capabilities into the PCI Mapper project. The phased approach ensures systematic implementation while maintaining system stability and performance.

The key benefits of this integration include:
- Real-time CPE location tracking
- Performance monitoring and visualization
- Automated device management
- Enhanced network planning capabilities
- Scalable architecture for large deployments

By following this plan, the PCI Mapper will evolve into a comprehensive network management platform that combines traditional cell site planning with modern CPE management capabilities.
