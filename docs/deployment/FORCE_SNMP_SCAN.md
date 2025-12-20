# Force SNMP Scan on Remote EPC

## Method 1: Run Script Directly (Recommended)

SSH to your remote EPC device and run:

```bash
sudo /opt/wisptools/epc-snmp-discovery.sh
```

This will:
- Scan the local network for SNMP devices
- Report discovered devices to the server immediately
- Show output in the terminal

## Method 2: Clear Last Discovery Timestamp

To force the next automatic discovery (runs during check-in):

```bash
# Clear the last discovery timestamp file
sudo rm -f /tmp/last-snmp-discovery

# Or manually set it to 0
echo "0" | sudo tee /tmp/last-snmp-discovery
```

The next check-in (within 60 seconds) will trigger a discovery.

## Method 3: Watch Discovery in Real-Time

To see the discovery happening:

```bash
# Watch the discovery log
sudo tail -f /var/log/wisptools-snmp-discovery.log

# Or watch check-in log (where discovery output goes)
sudo tail -f /var/log/wisptools-checkin.log | grep -i "snmp"
```

## Method 4: Test Discovery on Specific Subnet

You can also test discovery on a specific subnet by modifying the script temporarily or running it with a subnet parameter (if supported).

## Verify Results

After running discovery, check the SNMP tab in the Monitoring module to see discovered devices.

## Expected Output

You should see logs like:
```
[SNMP-DISCOVERY] Starting SNMP discovery on subnet: 192.168.1.0/24
[SNMP-DISCOVERY] Found SNMP device: 192.168.1.1 (community: public)
[SNMP-DISCOVERY] Discovery complete. Found X SNMP devices
[SNMP-DISCOVERY] Successfully reported discovery: X devices processed
```

