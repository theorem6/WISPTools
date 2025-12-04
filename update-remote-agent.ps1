# PowerShell script to update remote EPC agent
$remoteHost = "10.0.25.134"
$username = "wisp"
$password = "wisp123"

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
Write-Host "Please enter password 'wisp123' when prompted..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no "$username@$remoteHost" "sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && echo '✅ Script updated' && ls -lh /opt/wisptools/epc-checkin-agent.sh"


