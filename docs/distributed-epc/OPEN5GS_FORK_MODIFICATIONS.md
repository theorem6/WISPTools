# Open5GS Fork Modifications for Distributed EPC

## Overview

This document outlines the modifications needed to create `theorem6/open5gs-distributed` from the official Open5GS repository to support our distributed EPC architecture.

## Repository Information

- **Source**: https://github.com/open5gs/open5gs
- **Target**: https://github.com/theorem6/open5gs-distributed
- **Purpose**: Enhanced Open5GS with cloud HSS connectivity and metrics reporting

## Key Modifications

### 1. Cloud HSS Configuration Support

#### Files to Modify:
- `misc/db/open5gs-dbctl`
- `lib/diameter/s6a/s6a-message.c`
- `src/hss/hss-context.c`

#### Changes:
- Add support for remote HSS configuration
- Modify HSS connection logic to connect to cloud HSS at `136.112.111.167:3868`
- Add configuration options for cloud vs local HSS mode

### 2. Metrics Collection Integration

#### New Files to Add:
- `src/metrics/` (new directory)
- `src/metrics/metrics-collector.c`
- `src/metrics/metrics-sender.c`
- `src/metrics/metrics-api.h`

#### Changes:
- Add metrics collection for all Open5GS components
- Integrate with Node.js metrics agent
- Support configurable metrics intervals

### 3. Enhanced Configuration

#### Files to Modify:
- `misc/open5gs/` (configuration files)
- `src/` (component source files)

#### Changes:
- Add `cloud_hss_enabled` configuration option
- Add `cloud_hss_host` and `cloud_hss_port` settings
- Add `metrics_reporting_enabled` and `metrics_interval` settings
- Add `tenant_id` and `epc_id` configuration for multi-tenant support

### 4. API Extensions

#### New Files:
- `src/api/cloud-api.c`
- `src/api/cloud-api.h`

#### Changes:
- Add REST API endpoints for cloud communication
- Support for EPC registration and heartbeat
- Integration with our HSS Management API

## Configuration Examples

### hss.yaml (Cloud Mode)
```yaml
hss:
  s6a:
    - addr: 136.112.111.167
      port: 3868
      no_tls: false
      tls:
        server_cert: /etc/ssl/certs/hss.cert.pem
        server_key: /etc/ssl/private/hss.key.pem
        ca_cert: /etc/ssl/certs/cacert.pem

  cloud_mode:
    enabled: true
    tenant_id: "tenant-12345"
    epc_id: "epc-site-001"
    
  metrics:
    enabled: true
    interval: 60
    api_endpoint: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/metrics"
```

### mme.yaml (Distributed Mode)
```yaml
mme:
  s1ap:
    - addr: 0.0.0.0
      port: 36412
      
  s6a:
    - addr: 136.112.111.167
      port: 3868
      
  cloud_mode:
    enabled: true
    tenant_id: "tenant-12345"
    epc_id: "epc-site-001"
    
  metrics:
    enabled: true
    interval: 60
    api_endpoint: "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/metrics"
```

## Build Modifications

### CMakeLists.txt Changes
```cmake
# Add metrics collection
option(ENABLE_METRICS "Enable metrics collection" ON)
option(ENABLE_CLOUD_MODE "Enable cloud HSS mode" ON)

if(ENABLE_METRICS)
    add_subdirectory(src/metrics)
endif()

if(ENABLE_CLOUD_MODE)
    add_definitions(-DENABLE_CLOUD_MODE)
endif()
```

### Dependencies
- Add libcurl for HTTP API calls
- Add libjson-c for JSON metrics formatting
- Optional: libmongoc for direct MongoDB metrics storage

## Integration Points

### 1. Metrics Collection
- **Subscriber Events**: Attach/detach, location updates
- **Network Statistics**: eNB connections, cell status
- **System Resources**: CPU, memory, disk usage
- **Component Health**: Service status, uptime

### 2. Cloud Communication
- **Registration**: EPC site registration with cloud
- **Heartbeat**: Periodic status updates
- **Configuration Sync**: Pull configuration from cloud
- **Event Reporting**: Real-time event streaming

### 3. Multi-Tenant Support
- **Tenant Isolation**: Separate metrics by tenant
- **Configuration Scoping**: Tenant-specific settings
- **Resource Limits**: Per-tenant resource monitoring

## Deployment Script Integration

The fork will include our deployment script (`install-distributed-epc.sh`) with Open5GS modifications:

1. **Custom Build**: Compile Open5GS with distributed EPC features
2. **Configuration**: Auto-generate tenant/EPC-specific configs
3. **Service Setup**: Install and configure systemd services
4. **Metrics Agent**: Deploy Node.js metrics collection agent

## Testing Strategy

### 1. Unit Tests
- Metrics collection accuracy
- Cloud API communication
- Configuration validation

### 2. Integration Tests
- End-to-end metrics flow
- Multi-tenant isolation
- Cloud HSS connectivity

### 3. Performance Tests
- Metrics collection overhead
- Network bandwidth usage
- System resource impact

## Documentation Updates

### 1. README.md
- Add distributed EPC features
- Include cloud configuration examples
- Document new build options

### 2. Configuration Guide
- Cloud HSS setup instructions
- Metrics configuration options
- Multi-tenant deployment guide

### 3. API Documentation
- Cloud API endpoints
- Metrics data format
- Integration examples

## Migration Path

### From Standard Open5GS:
1. Backup existing configuration
2. Update to distributed fork
3. Enable cloud mode in configuration
4. Deploy metrics agent
5. Register EPC with cloud

### From Rapid5GS:
1. Compare configuration formats
2. Migrate subscriber data
3. Update deployment scripts
4. Test cloud connectivity

## Security Considerations

### 1. TLS/SSL
- Secure cloud HSS communication
- Certificate management
- API authentication

### 2. Network Security
- Firewall configuration
- VPN requirements
- Port restrictions

### 3. Data Privacy
- Tenant data isolation
- Metrics data encryption
- Audit logging

## Future Enhancements

### 1. Advanced Metrics
- Machine learning integration
- Predictive analytics
- Anomaly detection

### 2. Cloud Features
- Auto-scaling support
- Load balancing
- Geographic distribution

### 3. Management Features
- Web-based configuration
- Real-time monitoring
- Automated deployment

## Implementation Timeline

### Phase 1: Core Modifications (Week 1)
- [ ] Fork Open5GS repository
- [ ] Implement cloud HSS configuration
- [ ] Add basic metrics collection
- [ ] Create deployment scripts

### Phase 2: Integration (Week 2)
- [ ] Integrate metrics agent
- [ ] Test cloud connectivity
- [ ] Validate multi-tenant support
- [ ] Document configuration

### Phase 3: Testing & Deployment (Week 3)
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Security review
- [ ] Production deployment

This fork will provide a production-ready Open5GS distribution optimized for distributed EPC deployments with cloud HSS integration.
