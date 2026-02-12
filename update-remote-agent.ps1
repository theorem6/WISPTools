# PowerShell script to update remote EPC agent.
# Usage: .\update-remote-agent.ps1
# Optional env: REMOTE_AGENT_HOST (default 10.0.25.134), REMOTE_AGENT_USER (default wisp).
# Use SSH key auth when possible; no password in repo.
$remoteHost = if ($env:REMOTE_AGENT_HOST) { $env:REMOTE_AGENT_HOST } else { '10.0.25.134' }
$username = if ($env:REMOTE_AGENT_USER) { $env:REMOTE_AGENT_USER } else { 'wisp' }

Write-Host "Connecting to $username@$remoteHost..." -ForegroundColor Cyan

# Create SSH command script
$sshCommands = @"
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
echo "Script updated successfully"
ls -lh /opt/wisptools/epc-checkin-agent.sh
"@

# Write commands to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$sshCommands | Out-File -FilePath $tempFile -Encoding ASCII

# Use plink or SSH with password
Write-Host "Attempting SSH connection..." -ForegroundColor Yellow

# Try using ssh command directly (may require manual password entry)
Write-Host "Enter SSH password when prompted (or use key-based auth)." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "$username@$remoteHost" "sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && echo '✅ Script updated' && ls -lh /opt/wisptools/epc-checkin-agent.sh"


