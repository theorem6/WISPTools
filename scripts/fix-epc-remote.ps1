# PowerShell script to fix EPC scripts remotely
# Usage: .\fix-epc-remote.ps1

$EPC_IP = "10.0.25.134"
$EPC_USER = "wisp"
$EPC_PASS = "wisp123"

Write-Host "=== Connecting to EPC: ${EPC_USER}@${EPC_IP} ===" -ForegroundColor Cyan

# Read the fix script content
$fixScript = @"
#!/bin/bash
set +e

echo "=== Fixing All EPC Scripts ==="

# Update epc-checkin-agent.sh
echo "Updating epc-checkin-agent.sh..."
curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /tmp/epc-checkin-agent.sh.tmp
ACTUAL_HASH=\$(sha256sum /tmp/epc-checkin-agent.sh.tmp | awk '{print \$1}')
if [ "\$ACTUAL_HASH" = "2a7bb5c69d26aae3f793da0766f6219fbec0f3c952ad8efbfb28ef9eb7463181" ]; then
    sudo mv /tmp/epc-checkin-agent.sh.tmp /opt/wisptools/epc-checkin-agent.sh
    sudo chmod 755 /opt/wisptools/epc-checkin-agent.sh
    echo "✅ epc-checkin-agent.sh updated"
else
    echo "❌ Hash mismatch: Expected: 2a7bb5c69d26aae3..., Actual: \$ACTUAL_HASH"
    rm -f /tmp/epc-checkin-agent.sh.tmp
fi

# Update epc-snmp-discovery.js
echo "Updating epc-snmp-discovery.js..."
curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.js -o /tmp/epc-snmp-discovery.js.tmp
ACTUAL_HASH=\$(sha256sum /tmp/epc-snmp-discovery.js.tmp | awk '{print \$1}')
if [ "\$ACTUAL_HASH" = "b11d13244a256939a9880ba821e06fa3ee04394be6d1a9e22e183339c4d9cc81" ]; then
    sudo mv /tmp/epc-snmp-discovery.js.tmp /opt/wisptools/epc-snmp-discovery.js
    sudo chmod 644 /opt/wisptools/epc-snmp-discovery.js
    echo "✅ epc-snmp-discovery.js updated"
else
    echo "❌ Hash mismatch: Expected: b11d13244a256939..., Actual: \$ACTUAL_HASH"
    rm -f /tmp/epc-snmp-discovery.js.tmp
fi

# Update epc-snmp-discovery.sh
echo "Updating epc-snmp-discovery.sh..."
curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh -o /tmp/epc-snmp-discovery.sh.tmp
ACTUAL_HASH=\$(sha256sum /tmp/epc-snmp-discovery.sh.tmp | awk '{print \$1}')
if [ "\$ACTUAL_HASH" = "ba437a014fcedf5a31c414156a090f05145841f6ff50476dce7fbcb77de0fc47" ]; then
    sudo mv /tmp/epc-snmp-discovery.sh.tmp /opt/wisptools/epc-snmp-discovery.sh
    sudo chmod 755 /opt/wisptools/epc-snmp-discovery.sh
    echo "✅ epc-snmp-discovery.sh updated"
else
    echo "❌ Hash mismatch: Expected: ba437a014fcedf5a..., Actual: \$ACTUAL_HASH"
    rm -f /tmp/epc-snmp-discovery.sh.tmp
fi

# Update install-epc-dependencies.sh
echo "Updating install-epc-dependencies.sh..."
curl -fsSL https://hss.wisptools.io/downloads/scripts/install-epc-dependencies.sh -o /tmp/install-epc-dependencies.sh.tmp
ACTUAL_HASH=\$(sha256sum /tmp/install-epc-dependencies.sh.tmp | awk '{print \$1}')
if [ "\$ACTUAL_HASH" = "92855d81de5a334ce07f6a50bd41c9a1dbb3ea8bf1b217cd422dcd2e06b41a80" ]; then
    sudo mv /tmp/install-epc-dependencies.sh.tmp /opt/wisptools/install-epc-dependencies.sh
    sudo chmod 755 /opt/wisptools/install-epc-dependencies.sh
    echo "✅ install-epc-dependencies.sh updated"
else
    echo "❌ Hash mismatch: Expected: 92855d81de5a334c..., Actual: \$ACTUAL_HASH"
    rm -f /tmp/install-epc-dependencies.sh.tmp
fi

# Verify all
echo ""
echo "=== Verification ==="
for script in epc-checkin-agent.sh epc-snmp-discovery.js epc-snmp-discovery.sh install-epc-dependencies.sh; do
    if [ -f "/opt/wisptools/\$script" ]; then
        hash=\$(sha256sum "/opt/wisptools/\$script" | awk '{print \$1}')
        echo "✅ \$script: \$hash"
    else
        echo "❌ \$script: NOT FOUND"
    fi
done

echo ""
echo "=== Done! ==="
"@

# Save script to temp file
$tempScript = Join-Path $env:TEMP "fix-epc-remote.sh"
$fixScript | Out-File -FilePath $tempScript -Encoding ASCII

Write-Host "`n=== Executing fix script on EPC ===" -ForegroundColor Yellow

# Use sshpass if available, otherwise use expect-like approach or manual password
try {
    # Try using ssh with password from environment or stdin
    # Note: This requires sshpass on Windows or configuring SSH keys
    
    # Alternative: Use plink if available
    if (Get-Command plink -ErrorAction SilentlyContinue) {
        Write-Host "Using plink..." -ForegroundColor Green
        $fixScript | plink -ssh -pw $EPC_PASS "${EPC_USER}@${EPC_IP}" "bash"
    } else {
        # Try native SSH (may require key-based auth or manual password entry)
        Write-Host "Using native SSH..." -ForegroundColor Green
        Write-Host "Note: You may need to enter password manually if SSH keys are not configured." -ForegroundColor Yellow
        
        # Copy script and execute
        $fixScript | ssh "${EPC_USER}@${EPC_IP}" "cat > /tmp/fix-epc.sh && bash /tmp/fix-epc.sh && rm /tmp/fix-epc.sh"
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "`n=== Manual Instructions ===" -ForegroundColor Yellow
    Write-Host "1. SSH to the EPC: ssh ${EPC_USER}@${EPC_IP}" -ForegroundColor White
    Write-Host "2. Password: $EPC_PASS" -ForegroundColor White
    Write-Host "3. Copy and paste the contents of: backend-services/PASTE_TO_EPC.txt" -ForegroundColor White
}

# Clean up
Remove-Item $tempScript -ErrorAction SilentlyContinue

Write-Host "`n=== Complete ===" -ForegroundColor Green

