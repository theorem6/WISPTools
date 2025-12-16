# Monitoring Intervals - Best Practices & Implementation

## Current Configuration Analysis

### Current Intervals
- **EPC Check-in**: 5 minutes (300 seconds)
- **Ping Monitoring**: Every check-in (5 minutes)
- **Subnet Ping Sweep**: Hourly
- **SNMP Discovery**: Hourly

### Issues Identified

1. **Comment Mismatch**: Code comment says "Every minute before check-in" but actual interval is 5 minutes
2. **Frequency Too High**: 5 minutes may be excessive for stable systems
3. **No Adaptive Intervals**: Same frequency for all systems regardless of stability

---

## Industry Best Practices

### ICMP Ping Monitoring

**Recommended Intervals:**
- **Critical Systems**: 1-5 minutes
- **Production Systems**: 5-15 minutes
- **Stable Systems**: 15-30 minutes
- **Non-Critical**: 30-60 minutes

**Rationale:**
- Ping is lightweight but still generates network traffic
- Too frequent pings can cause false positives (network congestion)
- 5-15 minutes provides good balance between responsiveness and efficiency

### SNMP Polling

**Recommended Intervals:**
- **Critical Metrics** (CPU, Memory, Uptime): 5-15 minutes
- **Interface Statistics**: 5-15 minutes
- **Temperature**: 15-30 minutes
- **Full OID Walks**: Hourly or less frequent

**Rationale:**
- SNMP queries are more resource-intensive than ping
- Most metrics don't change rapidly
- 5-15 minutes captures trends without excessive load

### Service Check-ins

**Recommended Intervals:**
- **Critical Infrastructure**: 5 minutes
- **Production Systems**: 10-15 minutes
- **Stable Systems**: 15-30 minutes

**Rationale:**
- Check-ins include system metrics, service status, logs
- More data-intensive than simple ping
- 10-15 minutes is sufficient for most use cases

### Network Discovery Sweeps

**Recommended Intervals:**
- **Subnet Ping Sweeps**: Hourly (or less frequent)
- **SNMP Discovery**: Every 4-6 hours (or on-demand)
- **ARP Table Scans**: Hourly

**Rationale:**
- Discovery sweeps are resource-intensive
- Network topology doesn't change frequently
- Hourly is sufficient for most networks

---

## Recommended Configuration

### Standard Configuration (Most Systems)

```javascript
{
  checkin_interval: 600,        // 10 minutes (600 seconds)
  ping_interval: 600,           // 10 minutes
  snmp_poll_interval: 600,       // 10 minutes
  subnet_sweep_interval: 3600,   // 1 hour
  snmp_discovery_interval: 14400 // 4 hours
}
```

### Critical Systems Configuration

```javascript
{
  checkin_interval: 300,        // 5 minutes (300 seconds)
  ping_interval: 300,           // 5 minutes
  snmp_poll_interval: 300,       // 5 minutes
  subnet_sweep_interval: 3600,   // 1 hour
  snmp_discovery_interval: 7200  // 2 hours
}
```

### Stable Systems Configuration

```javascript
{
  checkin_interval: 900,        // 15 minutes (900 seconds)
  ping_interval: 900,           // 15 minutes
  snmp_poll_interval: 900,       // 15 minutes
  subnet_sweep_interval: 7200,   // 2 hours
  snmp_discovery_interval: 21600 // 6 hours
}
```

---

## Implementation Strategy

### Phase 1: Update Default Intervals

1. **Change default check-in interval** from 5 minutes to 10 minutes
2. **Update ping monitoring** to match check-in interval
3. **Keep subnet sweeps** at hourly (already optimal)
4. **Update SNMP discovery** to 4 hours (from hourly)

### Phase 2: Make Intervals Configurable

1. **Per-EPC Configuration**: Allow different intervals per EPC
2. **Per-Device Configuration**: Allow different ping intervals per device
3. **Adaptive Intervals**: Reduce frequency for stable systems

### Phase 3: Adaptive Monitoring

1. **Stability Detection**: Track consecutive successful check-ins
2. **Auto-Adjust**: Increase interval for stable systems
3. **Alert on Changes**: Reduce interval when issues detected

---

## Expected Impact

### Data Volume Reduction

**Current (5 minutes):**
- Check-ins/day: 288 per EPC
- Ping metrics/day: 288 per device
- Total documents/day: ~576 per EPC+device pair

**Recommended (10 minutes):**
- Check-ins/day: 144 per EPC (50% reduction)
- Ping metrics/day: 144 per device (50% reduction)
- Total documents/day: ~288 per EPC+device pair

**Stable Systems (15 minutes):**
- Check-ins/day: 96 per EPC (67% reduction)
- Ping metrics/day: 96 per device (67% reduction)
- Total documents/day: ~192 per EPC+device pair

### Storage Savings

- **10-minute interval**: ~50% reduction in data volume
- **15-minute interval**: ~67% reduction in data volume
- **Database growth**: Reduced from ~50-100 MB/month to ~25-50 MB/month

---

## Migration Plan

### Step 1: Update Defaults (Immediate)

1. Update `CHECKIN_INTERVAL` in `epc-checkin-agent.sh` to 600 seconds
2. Update comments to reflect actual intervals
3. Deploy and test

### Step 2: Backend Configuration (Next)

1. Add `checkin_interval` to EPC configuration
2. Allow backend to override default interval
3. Support per-EPC configuration

### Step 3: Frontend Configuration (Future)

1. Add UI for configuring monitoring intervals
2. Allow per-device ping intervals
3. Show current intervals in monitoring dashboard

---

## Monitoring Best Practices Summary

### ✅ Do's

- Use 10-15 minute intervals for most systems
- Use 5 minutes only for critical infrastructure
- Use hourly or less for discovery sweeps
- Make intervals configurable per system
- Monitor and adjust based on system stability

### ❌ Don'ts

- Don't use 1-minute intervals (too frequent, causes false positives)
- Don't use same interval for all systems
- Don't ignore system stability when setting intervals
- Don't forget to update comments when changing intervals

---

## References

- **ICMP Ping**: RFC 792, industry standard 5-15 minutes
- **SNMP Polling**: RFC 1157, typical 5-15 minutes
- **Network Monitoring**: ITU-T recommendations, 10-15 minutes for production
- **MongoDB Time-Series**: Best practices suggest 5-15 minute intervals

