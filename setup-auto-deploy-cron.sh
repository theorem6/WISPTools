#!/bin/bash

# Setup Automated Deployment via Cron
# This script sets up a cron job to automatically deploy from git

set -e

echo "🕐 Setting up automated deployment via cron..."

# Configuration
DEPLOY_SCRIPT="/opt/wisptools/deploy-from-git.sh"
CRON_SCHEDULE="*/15 * * * *"  # Every 15 minutes
REPO_DIR="/opt/wisptools-repo"

# Create repository directory
echo "📁 Creating repository directory..."
sudo mkdir -p "$REPO_DIR"
sudo chown $USER:$USER "$REPO_DIR"

# Clone repository if it doesn't exist
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/theorem6/lte-pci-mapper.git "$REPO_DIR"
fi

# Copy deployment script
echo "📝 Installing deployment script..."
sudo cp deploy-from-git.sh "$DEPLOY_SCRIPT"
sudo chmod +x "$DEPLOY_SCRIPT"

# Create wrapper script that changes to repo directory
echo "🔧 Creating wrapper script..."
sudo tee /opt/wisptools/auto-deploy-wrapper.sh > /dev/null << 'EOF'
#!/bin/bash
cd /opt/wisptools-repo
exec /opt/wisptools/deploy-from-git.sh "$@"
EOF

sudo chmod +x /opt/wisptools/auto-deploy-wrapper.sh

# Setup cron job
echo "⏰ Setting up cron job..."
(crontab -l 2>/dev/null | grep -v "auto-deploy-wrapper"; echo "$CRON_SCHEDULE /opt/wisptools/auto-deploy-wrapper.sh >> /var/log/wisptools-deploy.log 2>&1") | crontab -

# Create log rotation
echo "📊 Setting up log rotation..."
sudo tee /etc/logrotate.d/wisptools-deploy > /dev/null << 'EOF'
/var/log/wisptools-deploy.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 root root
}
EOF

# Create systemd timer as alternative to cron
echo "⏱️ Creating systemd timer..."
sudo tee /etc/systemd/system/wisptools-deploy.service > /dev/null << 'EOF'
[Unit]
Description=WISPTools Auto Deploy
After=network.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/opt/wisptools-repo
ExecStart=/opt/wisptools/auto-deploy-wrapper.sh
StandardOutput=journal
StandardError=journal
EOF

sudo tee /etc/systemd/system/wisptools-deploy.timer > /dev/null << 'EOF'
[Unit]
Description=Run WISPTools Auto Deploy every 15 minutes
Requires=wisptools-deploy.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start timer
sudo systemctl daemon-reload
sudo systemctl enable wisptools-deploy.timer
sudo systemctl start wisptools-deploy.timer

# Test deployment
echo "🧪 Testing deployment..."
/opt/wisptools/auto-deploy-wrapper.sh

echo "✅ Automated deployment setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "  • Repository: $REPO_DIR"
echo "  • Deploy Script: $DEPLOY_SCRIPT"
echo "  • Cron Schedule: $CRON_SCHEDULE"
echo "  • Log File: /var/log/wisptools-deploy.log"
echo ""
echo "🔧 Management Commands:"
echo "  • Check cron: crontab -l"
echo "  • Check timer: sudo systemctl status wisptools-deploy.timer"
echo "  • View logs: tail -f /var/log/wisptools-deploy.log"
echo "  • Manual deploy: /opt/wisptools/auto-deploy-wrapper.sh"
echo "  • Disable auto-deploy: sudo systemctl stop wisptools-deploy.timer"
echo ""
echo "🎉 Automated deployment is now active!"