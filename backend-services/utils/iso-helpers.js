// ISO Generation Helper Functions
// Isolated utilities for ISO creation - DO NOT MODIFY unless fixing ISO-specific issues

const crypto = require('crypto');

/**
 * Generate cloud-init configuration with embedded credentials
 */
function generateCloudInitConfig(config) {
  const { epc_id, tenant_id, auth_code, api_key, secret_key, site_name, gce_ip, hss_port, origin_host_fqdn } = config;
  
  return `#cloud-config
# WISPTools.io EPC Boot Disc
# EPC: ${epc_id}
# Tenant: ${tenant_id}
# Generated: ${new Date().toISOString()}

autoinstall:
  version: 1
  interactive-sections: []
  
  locale: en_US.UTF-8
  keyboard:
    layout: us
  
  identity:
    hostname: ${site_name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}
    password: "$6$rounds=4096$saltsalt$hBHuZm7adhEYRKKp7oSfFkFq8C5L5CfLXqJ3qvQZQBfVZb9kCL3HH8wJOhZ8L5nKkTRqy8FqKLMnLmKMnLM8."
    username: wisp
  
  ssh:
    install-server: yes
    allow-pw: yes
  
  network:
    version: 2
    ethernets:
      any:
        match:
          name: "en*"
        dhcp4: true
        dhcp6: false
  
  storage:
    layout:
      name: direct
      match:
        size: largest
  
  packages:
    - curl
    - wget
    - jq
  
  late-commands:
    # Create wisptools directories
    - curtin in-target --target=/target -- mkdir -p /etc/wisptools
    - curtin in-target --target=/target -- mkdir -p /opt/wisptools
    
    # Embed EPC credentials
    - curtin in-target --target=/target -- bash -c "cat > /etc/wisptools/credentials.env << 'CREDS_EOF'
# WISPTools.io EPC Credentials
# DO NOT SHARE OR MODIFY
EPC_ID=${epc_id}
TENANT_ID=${tenant_id}
EPC_AUTH_CODE=${auth_code}
EPC_API_KEY=${api_key}
EPC_SECRET_KEY=${secret_key}
GCE_SERVER=${gce_ip}
HSS_PORT=${hss_port}
${origin_host_fqdn ? `ORIGIN_HOST_FQDN=${origin_host_fqdn}` : ''}
CREDS_EOF
"
    - curtin in-target --target=/target -- chmod 600 /etc/wisptools/credentials.env
    
    # Download and install bootstrap script
    - curtin in-target --target=/target -- wget -O /opt/wisptools/bootstrap.sh http://${gce_ip}:${hss_port}/api/epc/${epc_id}/bootstrap?auth_code=${auth_code}
    - curtin in-target --target=/target -- chmod +x /opt/wisptools/bootstrap.sh
    
    # Create systemd service for first boot
    - curtin in-target --target=/target -- bash -c "cat > /etc/systemd/system/wisptools-bootstrap.service << 'SERVICE_EOF'
[Unit]
Description=WISPTools.io EPC Bootstrap
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/wisptools/.bootstrapped

[Service]
Type=oneshot
ExecStart=/opt/wisptools/bootstrap.sh
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_EOF
"
    - curtin in-target --target=/target -- systemctl enable wisptools-bootstrap.service
  
  shutdown: reboot
`;
}

module.exports = {
  generateCloudInitConfig
};
