# Open5GS Performance Tuning Integration

## Summary

Open5GS performance tuning has been integrated into all remote EPC deployment scripts. This tuning eliminates UDP socket buffer overflows and enables high-throughput (180+ Mbps) LTE core operation.

## What Was Added

### 1. Socket Buffer Tuning (`/etc/sysctl.d/99-open5gs.conf`)

**Purpose**: Eliminate UDP socket buffer overflows for GTP-U traffic (port 2152)

**Settings Applied**:
- Receive buffer max: **64 MB** (up from default 212 KB)
- Transmit buffer max: **128 MB** (up from default 212 KB)
- UDP buffer minimums configured
- Network backlog queue increased to handle bursts
- TCP tuning for better connection handling

### 2. Service Priority Configuration

**File**: `/etc/systemd/system/open5gs-sgwud.service.d/priority.conf`

**Settings**:
- `Nice=-10` - Higher CPU priority
- `CPUSchedulingPolicy=fifo` - Real-time FIFO scheduling
- `CPUSchedulingPriority=50` - High priority level

**Purpose**: Ensure SGWU/UPF gets CPU time promptly, especially under load

### 3. GTP Tunnel Interface Tuning

**Service**: `open5gs-tuning.service`

**Function**: Sets `ogstun` interface transmit queue length to 10,000

**Purpose**: Handle traffic bursts on the GTP tunnel interface

## Files Modified

1. **`backend-services/utils/deployment-helpers.js`**
   - Main deployment script generator
   - Adds tuning configuration after FreeDiameter setup
   - Enables and starts tuning service

2. **`backend-services/scripts/configure-distributed-epc.sh`**
   - Standalone configuration script for remote EPCs
   - Applies tuning during EPC configuration

3. **`backend-services/scripts/apply-open5gs-performance-tuning.sh`** (NEW)
   - Standalone script to apply tuning to existing EPCs
   - Can be run without full redeployment

## Integration Points

The tuning is automatically applied in:

1. **New EPC Deployments**: All new deployments via the main deployment script generator
2. **Distributed EPC Configuration**: When running `configure-distributed-epc.sh`
3. **Existing EPCs**: Use the standalone tuning script

## Applying Tuning to Existing EPCs

For EPCs already deployed, you can apply the tuning without a full redeployment:

### Option 1: Standalone Script (Recommended)

```bash
# On the remote EPC server
sudo bash -c "curl -fsSL https://hss.wisptools.io/downloads/scripts/apply-open5gs-performance-tuning.sh -o /tmp/apply-tuning.sh && bash /tmp/apply-tuning.sh"
```

### Option 2: Manual Application

The tuning script is available at:
- Local: `backend-services/scripts/apply-open5gs-performance-tuning.sh`
- Server: `https://hss.wisptools.io/downloads/scripts/apply-open5gs-performance-tuning.sh` (after deployment)

## Expected Results

After applying tuning:

| Metric | Before | After |
|--------|--------|-------|
| Socket Buffer Max | 212 KB | **64 MB / 128 MB** |
| UDP Error Rate | 500-1000/sec | **0/sec** |
| Sustained Throughput | Degraded | **180+ Mbps** |
| Socket Queue Depth | Frequently backed up | **Consistently 0** |

## Verification Commands

### Check Current Buffer Settings
```bash
sysctl net.core.rmem_max net.core.wmem_max
```

### Check UDP Error Rate (Should be stable after tuning)
```bash
cat /proc/net/snmp | grep -A1 '^Udp:'
```

### Check Socket Queue Depth
```bash
ss -ulnp | grep 2152
```

### Check Service Priority
```bash
systemctl cat open5gs-sgwud.service | grep -A3 "priority.conf"
```

### Check GTP Tunnel Queue Length
```bash
ip link show ogstun | grep qlen
```

## Configuration Files Created

1. `/etc/sysctl.d/99-open5gs.conf` - Socket buffer tuning (persistent)
2. `/etc/systemd/system/open5gs-sgwud.service.d/priority.conf` - Service priority
3. `/etc/systemd/system/open5gs-tuning.service` - GTP tunnel tuning service

All configurations persist across reboots.

## Notes

- The tuning is based on production testing that eliminated 13.4M+ accumulated UDP errors
- Settings are conservative enough to not consume excessive memory
- Intel X710 NICs work well with this tuning (tested hardware)
- Tuning survives reboots via systemd services and sysctl.d configuration

## Testing

After deployment or applying tuning:

1. Monitor UDP error rate - should remain stable (no new errors)
2. Monitor throughput - should handle high loads without degradation
3. Check socket queue depth - should remain at 0 under normal load
4. Verify service priority is applied - check systemd override

## Deployment Status

- ✅ Integrated into main deployment script generator
- ✅ Integrated into distributed EPC configuration script
- ✅ Standalone tuning script created
- ✅ All changes committed and pushed to GitHub

## Next Steps

1. **For New Deployments**: Tuning will be applied automatically
2. **For Existing EPCs**: Run the standalone tuning script or redeploy
3. **Monitor**: Watch for UDP errors and verify throughput improvements


