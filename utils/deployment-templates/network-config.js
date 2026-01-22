/**
 * Generate network configuration and auto-detection section
 */
function generateNetworkConfiguration() {
  return `# Auto-detect network configuration
print_header "Network Configuration (Auto-Detected)"
MME_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print \$7; exit}' || hostname -I | awk '{print \$1}')
if [ -z "\$MME_IP" ]; then
    print_error "Could not detect IP address"
    exit 1
fi

SGWC_IP="\$MME_IP"
SGWU_IP="\$MME_IP"
SMF_IP="\$MME_IP"
UPF_IP="\$MME_IP"

print_success "Auto-detected Primary IP: \$MME_IP"
print_status "All EPC components will use: \$MME_IP"
echo ""
`;
}

/**
 * Generate network configuration variables
 * @param {Object} config - Configuration object
 * @param {string} config.mcc - Mobile Country Code
 * @param {string} config.mnc - Mobile Network Code
 * @param {string} config.tac - Tracking Area Code
 * @param {string} config.apn - APN name
 * @param {string} config.dnsPrimary - Primary DNS
 * @param {string} config.dnsSecondary - Secondary DNS
 * @param {string} config.gce_ip - GCE server IP
 * @param {string} config.hss_port - HSS port
 * @param {boolean} config.installEPC - Whether to install EPC
 * @param {boolean} config.installSNMP - Whether to install SNMP
 */
function generateNetworkVariables(config) {
  const { mcc, mnc, tac, apn, dnsPrimary, dnsSecondary, gce_ip, hss_port, installEPC, installSNMP } = config;
  
  return `# Network configuration
MCC="${mcc}"
MNC="${mnc}"
TAC="${tac}"
APN_NAME="${apn}"
APN_POOL="10.45.0.0/16"
DNS_PRIMARY="${dnsPrimary}"
DNS_SECONDARY="${dnsSecondary}"
HSS_ADDR="${gce_ip}"
HSS_PORT="${hss_port}"

# Deployment type flags
INSTALL_EPC=${installEPC ? '1' : '0'}
INSTALL_SNMP=${installSNMP ? '1' : '0'}
`;
}

module.exports = { generateNetworkConfiguration, generateNetworkVariables };

