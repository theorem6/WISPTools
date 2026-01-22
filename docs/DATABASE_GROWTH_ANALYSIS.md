# MongoDB Database Growth Analysis & Management Recommendations

## 🔍 Root Cause Analysis

### Database Growth Statistics (Before Cleanup)
- **Total Data Size**: 318.61 MB (uncompressed)
- **Storage Size**: 46.67 MB (compressed)
- **Total Documents**: 937,964
- **Collections**: 51

### Largest Collections (Before Cleanup)
1. **EPCLog**: 804,004 documents (35.34 MB storage, 262.69 MB data)
2. **PingMetrics**: 111,057 documents (6.66 MB storage, 35.99 MB data)
3. **EPCServiceStatus**: 16,370 documents (3.06 MB storage, 16.40 MB data)

---

## 📊 Data Collection Frequency Analysis

### 1. EPC Check-in Frequency
- **Interval**: Every 5 minutes (300 seconds)
- **Per Day**: 288 check-ins per EPC
- **Per Month**: ~8,640 check-ins per EPC

**What Gets Created Per Check-in:**
- 1x `EPCServiceStatus` document (system metrics, service status)
- Multiple `EPCLog` entries (from logs array sent by agent)
- 1x `PingMetrics` per monitored device (if ping cycle runs)

### 2. Ping Metrics Collection
- **Frequency**: Every check-in (every 5 minutes)
- **Per Device**: 288 ping metrics per day
- **Per Month**: ~8,640 ping metrics per device

**Example Calculation:**
- 10 monitored devices × 288 pings/day = 2,880 documents/day
- 2,880 × 30 days = 86,400 documents/month (just for ping!)

### 3. EPCLog Collection
- **Frequency**: Every check-in (every 5 minutes)
- **Volume**: Variable - depends on agent log verbosity
- **Issue**: Agent sends entire log buffer, which gets parsed into individual log entries

**Problem Identified:**
- Agent sends logs array with potentially many entries
- Each log entry creates a separate `EPCLog` document
- If agent sends 10 log entries per check-in:
  - 10 × 288 check-ins/day = 2,880 log entries/day
  - 2,880 × 30 days = 86,400 log entries/month per EPC

---

## 🚨 Why It Grew So Fast

### Primary Causes:

1. **Excessive Logging**
   - EPCLog had 804,004 documents
   - TTL was set to 30 days (too long for free tier)
   - Agent sends all logs from buffer on every check-in
   - Each log line becomes a separate document

2. **Too Long Retention Periods**
   - PingMetrics: 90 days TTL (way too long)
   - SNMPMetrics: 90 days TTL (way too long)
   - EPCLog: 30 days TTL (too long for free tier)
   - EPCServiceStatus: 7 days TTL (reasonable, but could be shorter)

3. **High Collection Frequency**
   - Check-ins every 5 minutes = 288/day
   - Ping metrics every 5 minutes = 288/day per device
   - No data aggregation or sampling

4. **No Data Aggregation**
   - Every ping creates a separate document
   - No hourly/daily rollups
   - Raw time-series data stored indefinitely

---

## 💡 Recommendations

### Immediate Actions (Already Implemented)

✅ **Reduced TTL Periods:**
- PingMetrics: 90 days → **7 days**
- SNMPMetrics: 90 days → **7 days**
- EPCServiceStatus: 7 days → **3 days**
- EPCLog: 30 days → **7 days** (recommended)

✅ **Created Cleanup Scripts:**
- `check-database-size.js` - Monitor database growth
- `cleanup-old-metrics.js` - Manual cleanup when needed

### Recommended Changes

#### 1. Reduce EPCLog Retention (CRITICAL)
**Current**: 30 days TTL  
**Recommended**: 7 days TTL

**Action**: Update `distributed-epc-schema.js`:
```javascript
EPCLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days
```

**Impact**: Will reduce EPCLog from ~800K documents to ~200K documents

#### 2. Reduce Log Verbosity
**Problem**: Agent sends entire log buffer on every check-in

**Recommendations**:
- Only send ERROR and WARNING level logs
- Limit log buffer size (last 50 lines max)
- Don't send INFO/DEBUG logs unless explicitly requested
- Aggregate multiple log lines into single document

**Implementation**: Modify `epc-checkin-agent.sh` to filter logs before sending

#### 3. Implement Data Aggregation (Future Enhancement)
**Current**: Every ping = 1 document  
**Recommended**: Aggregate into hourly summaries

**Benefits**:
- Reduce 288 documents/day to 24 documents/day (12x reduction)
- Still maintain granularity for recent data
- Keep raw data for last 24 hours, then aggregate

**Implementation**: Create aggregation job that runs daily:
- Keep raw data for last 24 hours
- Aggregate older data into hourly averages
- Store aggregated data in separate collection

#### 4. Reduce Check-in Frequency (Optional)
**Current**: Every 5 minutes  
**Recommended**: Every 10-15 minutes for stable systems

**Trade-offs**:
- Less real-time monitoring
- 50-66% reduction in data volume
- Still sufficient for most use cases

**Implementation**: Make check-in interval configurable per EPC

#### 5. Implement Log Level Filtering
**Current**: All logs stored  
**Recommended**: Only store ERROR and WARNING by default

**Implementation**: Add log level filter in `epc-checkin-service.js`:
```javascript
// Only store ERROR and WARNING logs
if (logEntry.level === 'error' || logEntry.level === 'warning') {
  await new EPCLog({...}).save();
}
```

#### 6. Batch Log Storage
**Current**: Each log line = 1 document  
**Recommended**: Batch multiple log lines into single document

**Implementation**: Store logs as array in single document:
```javascript
await new EPCLog({
  epc_id: epc.epc_id,
  tenant_id: epc.tenant_id,
  log_type: 'checkin',
  logs: logLines, // Array of log entries
  count: logLines.length
}).save();
```

---

## 📈 Projected Growth Rates

### Current Configuration (After TTL Changes)
- **PingMetrics**: ~2,880 documents/day (10 devices) → 20,160/week → auto-delete after 7 days
- **EPCServiceStatus**: ~288 documents/day → 2,016/week → auto-delete after 3 days
- **EPCLog**: Variable (depends on verbosity) → auto-delete after 7 days

### With Recommended Changes
- **PingMetrics**: Same (already optimized)
- **EPCServiceStatus**: Same (already optimized)
- **EPCLog**: 50-80% reduction (filtering + batching)

---

## 🔧 Implementation Priority

### High Priority (Do Now)
1. ✅ Reduce TTL periods (DONE)
2. ⚠️ Reduce EPCLog TTL to 7 days (NEEDED)
3. ⚠️ Filter logs to only ERROR/WARNING (NEEDED)

### Medium Priority (Next Sprint)
4. Implement log batching
5. Add log level configuration per EPC
6. Create daily aggregation job

### Low Priority (Future)
7. Make check-in interval configurable
8. Implement hourly data aggregation
9. Add database size monitoring alerts

---

## 📊 Monitoring & Maintenance

### Weekly Tasks
1. Run `check-database-size.js` to monitor growth
2. Review collection sizes and document counts
3. Check TTL index effectiveness

### Monthly Tasks
1. Run `cleanup-old-metrics.js` if needed
2. Review and adjust retention periods
3. Analyze growth trends

### Alerts to Set Up
- Database size > 400 MB (80% of free tier)
- Collection growth rate > 10% per week
- TTL indexes not deleting data (check index stats)

---

## 🎯 Target Metrics

### After All Recommendations
- **Total Database Size**: < 200 MB (well under 512 MB limit)
- **EPCLog Documents**: < 50,000 (down from 800,000+)
- **PingMetrics Documents**: < 20,000 (7 days retention)
- **EPCServiceStatus Documents**: < 1,000 (3 days retention)

### Growth Rate
- **Expected Growth**: ~5-10 MB/month (manageable)
- **With Aggregation**: ~2-5 MB/month (optimal)

---

## 📝 Code Changes Needed

### 1. Update EPCLog TTL
**File**: `backend-services/models/distributed-epc-schema.js`
```javascript
EPCLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days
```

### 2. Filter Logs by Level
**File**: `backend-services/services/epc-checkin-service.js`
```javascript
async function storeLogs(epc, logs, ipAddress, deviceCode) {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return;
  }

  try {
    // Filter to only ERROR and WARNING logs
    const filteredLogs = logs.filter(log => 
      log.level === 'error' || log.level === 'warning'
    );
    
    if (filteredLogs.length === 0) {
      return; // No important logs to store
    }
    
    // ... rest of existing code
  }
}
```

### 3. Limit Log Buffer Size
**File**: `backend-services/scripts/epc-checkin-agent.sh`
- Limit logs array to last 50 entries
- Only include ERROR and WARNING level logs

---

## ✅ Summary

The database grew quickly due to:
1. **Excessive logging** (804K EPCLog documents)
2. **Too long retention** (90 days for metrics)
3. **High frequency** (every 5 minutes)
4. **No aggregation** (raw time-series data)

**Solutions implemented:**
- ✅ Reduced TTL periods
- ✅ Created cleanup scripts
- ⚠️ Need to reduce EPCLog TTL and filter logs

**Next steps:**
1. Update EPCLog TTL to 7 days
2. Filter logs to only ERROR/WARNING
3. Monitor growth weekly
4. Consider aggregation for future optimization

