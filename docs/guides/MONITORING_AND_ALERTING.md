---
title: Monitoring and Alerting System
description: Tenant-based monitoring, alerts, and network topology.
---

# Monitoring and Alerting System

Complete guide to the tenant-based monitoring and alerting system.

---

## 📊 **Overview**

The platform includes a comprehensive monitoring and alerting system that:

- ✅ **Multi-tenant isolation** - Each tenant sees only their own metrics and alerts
- ✅ **Real-time monitoring** - 60-second refresh interval
- ✅ **Cross-module coverage** - Monitors HSS, GenieACS, CBRS, API, and system health
- ✅ **Customizable alerts** - Define rules with thresholds and notifications
- ✅ **Audit logging** - Track all administrative actions
- ✅ **Service health checks** - Automatic health monitoring for all services

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    MONITORING FRONTEND                       │
│                  /modules/monitoring                         │
│  • Overview Dashboard                                        │
│  • Active Alerts                                             │
│  • Alert Rules Management                                    │
│  • Audit Log Viewer                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MONITORING API (/monitoring/*)                  │
│  • Metrics collection (60s interval)                         │
│  • Alert rule evaluation                                     │
│  • Service health checks                                     │
│  • Audit logging                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA SOURCES                               │
├─────────────────────────────────────────────────────────────┤
│  • MongoDB (subscribers, devices, grants)                    │
│  • Open5GS Prometheus (port 9090)                            │
│  • Service health endpoints                                  │
│  • System metrics (CPU, memory, disk)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 **MongoDB Collections**

### **1. `metrics`**

Stores time-series metric data:

```javascript
{
  metric_id: "uuid",
  tenant_id: "tenant_001",
  source: "hss",  // hss|genieacs|cbrs|api|system
  metric_name: "active_subscribers",
  metric_type: "gauge",  // counter|gauge|histogram|summary
  value: 150,
  unit: "count",
  labels: { region: "us-east" },
  timestamp: ISODate("2025-10-16T05:30:00Z"),
  expires_at: ISODate("2025-11-15T05:30:00Z")  // TTL: 30 days
}
```

### **2. `alert_rules`**

Defines alert conditions:

```javascript
{
  rule_id: "uuid",
  tenant_id: "tenant_001",
  name: "High Authentication Failure Rate",
  description: "Alert when auth failures exceed 10%",
  enabled: true,
  source: "hss",
  metric_name: "auth_failure_rate",
  operator: "gt",  // gt|gte|lt|lte|eq|ne
  threshold: 10,
  duration_seconds: 300,  // Condition must persist for 5 minutes
  severity: "warning",  // info|warning|error|critical
  notifications: {
    email: ["admin@example.com"],
    webhook: "https://hooks.slack.com/...",
    slack: "..."
  },
  cooldown_minutes: 15,
  created_at: ISODate("2025-10-16T00:00:00Z"),
  updated_at: ISODate("2025-10-16T00:00:00Z")
}
```

### **3. `alerts`**

Active and historical alerts:

```javascript
{
  alert_id: "uuid",
  tenant_id: "tenant_001",
  rule_id: "rule_uuid",
  rule_name: "High Authentication Failure Rate",
  source: "hss",
  severity: "warning",
  message: "auth_failure_rate is 15% (greater than threshold of 10%)",
  metric_name: "auth_failure_rate",
  current_value: 15,
  threshold: 10,
  operator: "gt",
  status: "firing",  // firing|acknowledged|resolved|muted
  first_triggered: ISODate("2025-10-16T05:30:00Z"),
  last_triggered: ISODate("2025-10-16T05:35:00Z"),
  acknowledged_at: null,
  resolved_at: null,
  acknowledged_by: null,
  resolved_by: null,
  notes: "",
  notifications_sent: [
    {
      channel: "email",
      sent_at: ISODate("2025-10-16T05:30:05Z"),
      success: true
    }
  ]
}
```

### **4. `service_health`**

Service health check results:

```javascript
{
  health_id: "uuid",
  tenant_id: "tenant_001",
  service_name: "hss-daemon",
  status: "healthy",  // healthy|degraded|down|unknown
  uptime_seconds: 86400,
  cpu_percent: 15.5,
  memory_mb: 128,
  response_time_ms: 45,
  error_rate: 0,
  version: "2.7.6",
  last_restart: ISODate("2025-10-15T00:00:00Z"),
  error_message: null,
  checked_at: ISODate("2025-10-16T05:30:00Z"),
  last_healthy: ISODate("2025-10-16T05:30:00Z"),
  last_unhealthy: null
}
```

### **5. `audit_logs`**

Audit trail of all actions:

```javascript
{
  log_id: "uuid",
  tenant_id: "tenant_001",
  action: "create",  // create|update|delete|enable|disable
  resource_type: "subscriber",
  resource_id: "sub_001",
  user_id: "user_123",
  user_email: "admin@example.com",
  user_role: "owner",
  changes: {
    before: null,
    after: { imsi: "001010000000001", ... }
  },
  status: "success",  // success|failure|partial
  error_message: null,
  ip_address: "203.0.113.1",
  user_agent: "Mozilla/5.0...",
  module: "hss",  // hss|genieacs|cbrs|pci|tenant
  timestamp: ISODate("2025-10-16T05:30:00Z"),
  expires_at: ISODate("2026-01-14T05:30:00Z")  // TTL: 90 days
}
```

---

## 📈 **Monitored Metrics**

### **HSS Module:**

| Metric | Type | Description | Unit |
|--------|------|-------------|------|
| `active_subscribers` | Gauge | Enabled subscribers | count |
| `total_subscribers` | Gauge | All subscribers | count |
| `recent_authentications` | Counter | Authentications (last 5 min) | count |
| `auth_failure_rate` | Gauge | Failed authentications | % |
| `mme_connections` | Gauge | Connected MMEs | count |
| `service_health` | Gauge | HSS daemon status | 0/1 |

### **GenieACS Module:**

| Metric | Type | Description | Unit |
|--------|------|-------------|------|
| `total_devices` | Gauge | All CPE devices | count |
| `online_devices` | Gauge | Currently online | count |
| `offline_devices` | Gauge | Currently offline | count |
| `faulty_devices` | Gauge | Devices with faults | count |
| `fault_rate` | Gauge | Percentage with faults | % |
| `service_health` | Gauge | GenieACS status | 0/1 |

### **CBRS Module:**

| Metric | Type | Description | Unit |
|--------|------|-------------|------|
| `total_cbsds` | Gauge | Total CBSDs | count |
| `active_grants` | Gauge | Granted spectrum | count |
| `heartbeat_failure_rate` | Gauge | Failed heartbeats | % |
| `available_spectrum_mhz` | Gauge | Available spectrum | MHz |
| `sas_connected` | Gauge | SAS connection status | 0/1 |

### **API Metrics:**

| Metric | Type | Description | Unit |
|--------|------|-------------|------|
| `error_rate` | Gauge | API error percentage | % |
| `avg_response_time_ms` | Gauge | Average latency | ms |
| `requests_per_minute` | Counter | Request rate | req/min |

### **System Metrics:**

| Metric | Type | Description | Unit |
|--------|------|-------------|------|
| `cpu_percent` | Gauge | CPU usage | % |
| `memory_percent` | Gauge | Memory usage | % |
| `disk_percent` | Gauge | Disk usage | % |
| `mongodb_connected` | Gauge | DB connection status | 0/1 |

---

## 🚨 **Default Alert Rules**

### **Critical Alerts:**

1. **HSS Service Down**
   - Metric: `service_health == 0`
   - Duration: 60s
   - Action: Immediate investigation

2. **MongoDB Connection Lost**
   - Metric: `mongodb_connected == 0`
   - Duration: 60s
   - Action: Check database connectivity

3. **SAS Connection Lost**
   - Metric: `sas_connected == 0`
   - Duration: 300s
   - Action: Check CBRS SAS API

4. **Low Disk Space**
   - Metric: `disk_percent > 90`
   - Duration: 0s
   - Action: Free up disk space

### **Error Alerts:**

5. **MME Disconnected**
   - Metric: `mme_connections == 0`
   - Duration: 120s
   - Action: Check MME configuration

6. **High Grant Heartbeat Failures**
   - Metric: `heartbeat_failure_rate > 20`
   - Duration: 600s
   - Action: Check CBRS configuration

### **Warning Alerts:**

7. **High Authentication Failure Rate**
   - Metric: `auth_failure_rate > 10`
   - Duration: 300s
   - Action: Check subscriber credentials

8. **Subscriber Limit Reached**
   - Metric: `active_subscribers >= 900`
   - Duration: 0s
   - Action: Plan capacity upgrade

9. **High CPE Fault Rate**
   - Metric: `fault_rate > 5`
   - Duration: 600s
   - Action: Investigate common faults

10. **CPE Offline Spike**
    - Metric: `offline_devices > 10`
    - Duration: 300s
    - Action: Check network connectivity

11. **High CPU Usage**
    - Metric: `cpu_percent > 80`
    - Duration: 300s
    - Action: Check for runaway processes

12. **High Memory Usage**
    - Metric: `memory_percent > 85`
    - Duration: 300s
    - Action: Check for memory leaks

13. **Slow API Response**
    - Metric: `avg_response_time_ms > 1000`
    - Duration: 300s
    - Action: Investigate performance

14. **High API Error Rate**
    - Metric: `error_rate > 5`
    - Duration: 300s
    - Action: Check application logs

---

## 🔧 **API Endpoints**

### **Metrics:**

```bash
# Get metrics
GET /monitoring/metrics?source=hss&metric_name=active_subscribers&time_range=24h

# Get aggregated metrics (for charts)
GET /monitoring/metrics/aggregated?source=hss&metric_name=active_subscribers&time_range=7d&interval=1h
```

### **Alert Rules:**

```bash
# Get all alert rules
GET /monitoring/alert-rules

# Create alert rule
POST /monitoring/alert-rules
{
  "name": "Custom Alert",
  "source": "hss",
  "metric_name": "active_subscribers",
  "operator": "gt",
  "threshold": 500,
  "severity": "warning",
  "duration_seconds": 60,
  "notifications": {
    "email": ["admin@example.com"]
  }
}

# Update alert rule
PUT /monitoring/alert-rules/:rule_id

# Delete alert rule
DELETE /monitoring/alert-rules/:rule_id
```

### **Alerts:**

```bash
# Get active alerts
GET /monitoring/alerts?status=firing&severity=critical

# Acknowledge alert
POST /monitoring/alerts/:alert_id/acknowledge
{
  "notes": "Working on it"
}

# Resolve alert
POST /monitoring/alerts/:alert_id/resolve
{
  "notes": "Issue fixed"
}
```

### **Service Health:**

```bash
# Get service health
GET /monitoring/health/services

# Force health check
POST /monitoring/health/check
{
  "service": "hss-daemon"
}
```

### **Audit Logs:**

```bash
# Get audit logs
GET /monitoring/audit-logs?module=hss&limit=100

# Filter by user
GET /monitoring/audit-logs?user_id=user_123

# Filter by action
GET /monitoring/audit-logs?action=delete&resource_type=subscriber
```

### **Dashboard:**

```bash
# Get complete dashboard data
GET /monitoring/dashboard

# Returns:
{
  "metrics": {
    "hss": { ... },
    "genieacs": { ... },
    "cbrs": { ... }
  },
  "service_health": [...],
  "active_alerts": [...],
  "recent_activity": [...],
  "summary": {
    "total_alerts": 5,
    "critical_alerts": 1,
    "services_down": 0
  }
}
```

---

## 🎯 **Usage Guide**

### **Initialize Default Alert Rules**

When setting up a new tenant:

1. Go to `/modules/monitoring`
2. Click "Alert Rules" tab
3. Click "➕ Initialize Default Rules"
4. Review and customize rules as needed

Or via API:

```bash
curl -X POST http://136.112.111.167:3000/monitoring/initialize-alerts \
  -H "x-tenant-id: tenant_001"
```

### **Create Custom Alert Rule**

```bash
curl -X POST http://136.112.111.167:3000/monitoring/alert-rules \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d '{
    "name": "Subscriber Capacity Warning",
    "source": "hss",
    "metric_name": "active_subscribers",
    "operator": "gte",
    "threshold": 800,
    "severity": "warning",
    "duration_seconds": 0,
    "notifications": {
      "email": ["ops@example.com"]
    },
    "cooldown_minutes": 60
  }'
```

### **Handle Active Alerts**

1. **View Alerts:** `/modules/monitoring` → "Active Alerts" tab
2. **Acknowledge:** Click "✓ Acknowledge" on alert
3. **Investigate:** Check logs and metrics
4. **Resolve:** Click "✅ Resolve" when fixed
5. **Monitor:** Verify alert doesn't re-trigger

### **Audit Trail Review**

1. Go to `/modules/monitoring` → "Audit Log" tab
2. View all tenant actions
3. Filter by module, user, action, or resource
4. Export for compliance reporting

---

## 🔍 **Monitoring Workflows**

### **Daily Operations:**

1. **Morning Check:**
   - View monitoring dashboard
   - Check for critical/error alerts
   - Review service health
   - Acknowledge any non-critical alerts

2. **Issue Investigation:**
   - Check alert details and metrics
   - Review audit logs for related actions
   - Check service health for affected components
   - Resolve issue and document in alert notes

3. **Performance Review:**
   - Review metric trends over 7 days
   - Identify capacity planning needs
   - Optimize based on patterns

### **Alert Response:**

#### **Critical Alerts (Immediate):**
- HSS Service Down → Restart service, check logs
- MongoDB Connection Lost → Check database status
- SAS Connection Lost → Verify API keys and connectivity
- Low Disk Space → Clean up logs, expand disk

#### **Error Alerts (< 30 minutes):**
- MME Disconnected → Check MME FreeDiameter config
- High Grant Heartbeat Failures → Review CBRS grant status

#### **Warning Alerts (< 2 hours):**
- High Auth Failure Rate → Review subscriber credentials
- High CPU/Memory → Investigate processes
- Slow API Response → Check database queries

---

## 🛠️ **Integration Examples**

### **Custom Metric Collection**

Add to your code:

```javascript
const monitoringService = require('./monitoring-service');

// Record custom metric
await monitoringService.recordMetric(
  tenantId,
  'hss',
  'bulk_import_duration',
  importTimeMs,
  { subscribers: count },
  'ms'
);
```

### **Audit Logging**

Add to API endpoints:

```javascript
const monitoringService = require('./monitoring-service');

// Log action
await monitoringService.logAction(
  tenantId,
  userId,
  'delete',
  'subscriber',
  subscriberId,
  { before: oldData },
  'success',
  null,
  'hss',
  req
);
```

### **Webhook Notifications**

Configure webhook URL in alert rule:

```javascript
{
  "notifications": {
    "webhook": "https://your-webhook-endpoint.com/alerts"
  }
}
```

Webhook payload:

```json
{
  "alert_id": "uuid",
  "rule_name": "High Auth Failure Rate",
  "severity": "warning",
  "message": "auth_failure_rate is 15%...",
  "current_value": 15,
  "threshold": 10,
  "timestamp": "2025-10-16T05:30:00Z"
}
```

---

## 📊 **Prometheus Integration**

### **Open5GS HSS Metrics**

Available at: `http://136.112.111.167:9090/metrics`

Key metrics:
- `open5gs_hss_diameter_peers` - Connected MMEs
- `open5gs_hss_sessions_total` - Active sessions
- `open5gs_hss_auth_requests_total` - Authentication requests
- `open5gs_hss_auth_failures_total` - Failed authentications

### **Scraping Configuration**

To integrate with external Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'open5gs-hss'
    static_configs:
      - targets: ['136.112.111.167:9090']
```

---

## 🔔 **Notification Channels**

### **Email (TODO: Configure)**

```javascript
// Add to alert rule
{
  "notifications": {
    "email": ["ops@example.com", "admin@example.com"]
  }
}
```

Requires: SendGrid, AWS SES, or similar email service configured.

### **Slack (TODO: Configure)**

```javascript
// Add to alert rule
{
  "notifications": {
    "slack": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
```

### **Webhook (Ready)**

Any HTTP endpoint can receive alert notifications.

---

## 🧪 **Testing**

### **Test Metric Collection:**

```bash
# Trigger a metric collection manually
curl -X POST http://136.112.111.167:3000/monitoring/health/check \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d '{"service": "hss-api"}'

# View collected metrics
curl http://136.112.111.167:3000/monitoring/metrics?source=system&time_range=1h \
  -H "x-tenant-id: tenant_001"
```

### **Test Alert Rules:**

```bash
# Create a test alert that will trigger
curl -X POST http://136.112.111.167:3000/monitoring/alert-rules \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d '{
    "name": "Test Alert",
    "source": "hss",
    "metric_name": "active_subscribers",
    "operator": "gte",
    "threshold": 0,
    "severity": "info",
    "duration_seconds": 0
  }'

# Wait 60 seconds for monitoring loop to evaluate

# Check if alert triggered
curl http://136.112.111.167:3000/monitoring/alerts \
  -H "x-tenant-id: tenant_001"
```

---

## 🔧 **Configuration**

### **Monitoring Interval**

Default: 60 seconds

To change, edit `monitoring-service.js`:

```javascript
setInterval(async () => {
  // Collection logic
}, 60000);  // Change to 30000 for 30 seconds
```

### **Metric Retention**

Default: 30 days (auto-deleted via TTL index)

To change, edit `monitoring-schema.js`:

```javascript
expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days
```

### **Audit Log Retention**

Default: 90 days

To change, edit `monitoring-schema.js`:

```javascript
expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)  // 90 days
```

---

## 🚨 **Troubleshooting**

### **Metrics Not Collecting:**

```bash
# Check monitoring service is running
ssh root@136.112.111.167 "journalctl -u hss-api.service -f | grep monitoring"

# Should see: "Starting monitoring service..."
#            "Monitoring service started"

# Check for errors
ssh root@136.112.111.167 "journalctl -u hss-api.service -n 100 | grep -i error"
```

### **Alerts Not Triggering:**

```bash
# Check alert rules exist
curl http://136.112.111.167:3000/monitoring/alert-rules \
  -H "x-tenant-id: YOUR_TENANT_ID"

# Check if rule is enabled
# enabled: true

# Check if metrics are being collected
curl "http://136.112.111.167:3000/monitoring/metrics?source=hss&time_range=1h" \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

### **Dashboard Not Loading:**

```bash
# Check backend API
curl http://136.112.111.167:3000/monitoring/dashboard \
  -H "x-tenant-id: YOUR_TENANT_ID"

# Check service status
ssh root@136.112.111.167 "systemctl status hss-api.service"
```

---

## 📞 **Production Recommendations**

### **Before Going Live:**

1. ✅ Initialize default alert rules
2. ✅ Configure email notifications
3. ✅ Test alert triggering and resolution
4. ✅ Set up external monitoring (Uptime Robot, Pingdom)
5. ✅ Configure log aggregation (Google Cloud Logging)
6. ✅ Set up on-call rotation
7. ✅ Document escalation procedures

### **Ongoing:**

1. Review alert rules monthly
2. Adjust thresholds based on patterns
3. Export audit logs for compliance
4. Monitor monitoring system itself
5. Keep documentation updated

---

**Last Updated:** October 16, 2025  
**Version:** 1.0

