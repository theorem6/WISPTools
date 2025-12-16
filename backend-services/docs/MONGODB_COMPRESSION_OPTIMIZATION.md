# MongoDB Compression & Storage Optimization

## Current Compression Status

### MongoDB Atlas Free Tier
- **Storage Engine**: WiredTiger (default)
- **Default Compression**: Snappy (automatic)
- **Compression Ratio**: ~2-3x (varies by data type)
- **User Control**: ❌ Not configurable on free tier

**Important**: MongoDB Atlas free tier already uses Snappy compression automatically. You cannot change compression settings on the free tier - compression is managed by Atlas.

### Current Storage Stats
- **Data Size**: 318.61 MB (uncompressed)
- **Storage Size**: 46.67 MB (compressed)
- **Compression Ratio**: ~6.8x (excellent!)

This shows that MongoDB is already compressing data effectively. The issue is the **volume** of data, not the compression.

---

## Application-Level Optimization

Since we can't change MongoDB compression settings, we need to optimize **what we store**:

### 1. Optimize EPCLog Storage

**Current Issue**: Storing full log messages with redundant data

**Optimization**:
- Truncate long log messages (max 500 chars)
- Remove redundant fields from `details`
- Store only essential metadata

**Implementation**: See `optimize-epc-logs.js` script

### 2. Optimize SNMPMetrics Storage

**Current Issue**: `raw_oids` field stores large Mixed objects

**Optimization**:
- Only store `raw_oids` if explicitly needed for debugging
- Remove `raw_oids` from production metrics (keep only processed values)
- Use smaller data types where possible (Number vs String)

**Implementation**: See schema updates below

### 3. Optimize PingMetrics Storage

**Current Issue**: Storing redundant fields

**Optimization**:
- Remove `error` field if `success: true` (saves space)
- Use smaller data types
- Remove `last_success` and `last_failure` if not needed for queries

**Implementation**: See schema updates below

### 4. String Field Optimization

**Best Practices**:
- Use `trim()` on all string inputs
- Limit string lengths where appropriate
- Use enums instead of free-form strings
- Store references (IDs) instead of full objects

---

## Schema Optimizations

### EPCLog Schema Optimization

```javascript
// BEFORE: Full log message with all details
{
  message: "Very long log message with lots of details...",
  details: { ip_address: "...", device_code: "...", timestamp: "..." }
}

// AFTER: Truncated message, minimal details
{
  message: "Truncated message...", // Max 500 chars
  details: { /* only essential fields */ }
}
```

### SNMPMetrics Schema Optimization

```javascript
// BEFORE: Large raw_oids object
{
  raw_oids: {
    "1.3.6.1.2.1.1.1.0": "Very long system description...",
    "1.3.6.1.2.1.1.3.0": 1234567890,
    // ... many more OIDs
  }
}

// AFTER: Only store if needed for debugging
{
  // raw_oids removed or only stored for last 24 hours
  // Processed values stored in structured fields
}
```

### PingMetrics Schema Optimization

```javascript
// BEFORE: All fields always present
{
  success: true,
  error: null, // Unnecessary if success
  last_success: Date,
  last_failure: Date,
  consecutive_failures: 0
}

// AFTER: Only store relevant fields
{
  success: true,
  // error only if success: false
  // last_success/last_failure only if needed for queries
}
```

---

## Data Cleanup & Optimization Scripts

### 1. Optimize Existing EPCLog Documents

**Script**: `backend-services/scripts/optimize-epc-logs.js`

**Actions**:
- Truncate messages > 500 chars
- Remove redundant fields from `details`
- Remove old debug/info logs (keep only error/warning)

### 2. Remove Unused raw_oids from SNMPMetrics

**Script**: `backend-services/scripts/optimize-snmp-metrics.js`

**Actions**:
- Remove `raw_oids` field from documents older than 24 hours
- Keep only processed metric values

### 3. Optimize PingMetrics

**Script**: `backend-services/scripts/optimize-ping-metrics.js`

**Actions**:
- Remove `error` field when `success: true`
- Remove `last_success`/`last_failure` if not indexed/queried

---

## Compression Alternatives (If Upgrading)

If you upgrade from free tier, you can configure compression:

### Available Compression Algorithms

1. **Snappy** (default)
   - Fast compression/decompression
   - Good compression ratio (~2-3x)
   - Low CPU overhead
   - ✅ Best for most use cases

2. **zlib**
   - Higher compression ratio (~3-4x)
   - More CPU intensive
   - Better for archival data

3. **zstd** (MongoDB 4.2+)
   - Best compression ratio (~4-5x)
   - Good performance
   - ✅ Best for storage-constrained environments

### How to Configure (If Upgrading)

```javascript
// Create collection with zstd compression
db.createCollection("epclogs", {
  storageEngine: {
    wiredTiger: {
      configString: "blockCompressor=zstd"
    }
  }
});

// Or set at database level (requires restart)
// In mongod.conf:
storage:
  wiredTiger:
    collectionConfig:
      blockCompressor: zstd
```

**Note**: This requires MongoDB Atlas paid tier or self-hosted MongoDB.

---

## Recommended Actions

### Immediate (Free Tier)

1. ✅ **Optimize EPCLog storage** (truncate messages, filter logs)
2. ✅ **Remove raw_oids from old SNMPMetrics** (keep only processed values)
3. ✅ **Clean up redundant fields** in PingMetrics
4. ✅ **Run optimization scripts** weekly

### Future (If Upgrading)

1. ⚠️ **Upgrade to paid tier** to enable zstd compression
2. ⚠️ **Recreate collections** with zstd compression
3. ⚠️ **Migrate data** to compressed collections

---

## Expected Impact

### Current (Snappy Compression)
- **Compression Ratio**: ~6.8x (already excellent!)
- **Storage**: 46.67 MB for 318.61 MB data

### After Application Optimization
- **EPCLog Reduction**: 50-70% (truncation + filtering)
- **SNMPMetrics Reduction**: 20-30% (remove raw_oids)
- **PingMetrics Reduction**: 10-15% (remove redundant fields)
- **Total Storage**: ~30-35 MB (down from 46.67 MB)

### If Upgrading to zstd
- **Additional Compression**: 20-30% more
- **Total Storage**: ~25-30 MB

---

## Monitoring Compression

### Check Collection Compression

```javascript
// In MongoDB shell or Compass
db.epclogs.stats()

// Look for:
// - size: Uncompressed data size
// - storageSize: Compressed storage size
// - compressionRatio: size / storageSize
```

### Monitor Growth

```bash
# Run weekly
node backend-services/scripts/check-database-size.js
```

---

## Summary

**Current Status**:
- ✅ MongoDB Atlas already uses Snappy compression (automatic)
- ✅ Compression ratio is excellent (~6.8x)
- ⚠️ Cannot change compression on free tier

**Best Approach**:
1. **Optimize data storage** at application level (most effective)
2. **Reduce data volume** (TTL, filtering, truncation)
3. **Consider upgrade** only if still hitting limits after optimization

**Key Insight**: The problem is **data volume**, not compression. Focus on storing less data rather than compressing more.

