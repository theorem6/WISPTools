/**
 * Generate script header and initialization section
 * @param {Object} config - Configuration object
 * @param {string} config.siteName - Site name
 * @param {string} config.epc_id - EPC identifier
 * @param {string} config.deploymentType - Deployment type
 * @param {boolean} config.installEPC - Whether to install EPC
 * @param {boolean} config.installSNMP - Whether to install SNMP
 * @param {string} config.gce_ip - GCE server IP
 * @param {string} config.hss_port - HSS port
 */
function generateScriptHeader(config) {
  const { siteName, epc_id, deploymentType, installEPC, installSNMP, gce_ip, hss_port } = config;
  
  return `#!/bin/bash
# WISPTools.io Deployment Script
# Site: ${siteName}
# EPC ID: ${epc_id}
# Deployment Type: ${deploymentType}
# Install EPC: ${installEPC ? 'YES' : 'NO'}
# Install SNMP Agent: ${installSNMP ? 'YES' : 'NO'}

set -e

# Color codes for output
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${CYAN}→\${NC} \$1"
}

print_success() {
    echo -e "\${GREEN}✓\${NC} \$1"
}

print_error() {
    echo -e "\${RED}✗\${NC} \$1"
}

print_header() {
    echo ""
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${CYAN}  \$1\${NC}"
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo ""
}

# Load credentials
source /etc/wisptools/credentials.env

# Use ORIGIN_HOST_FQDN as S6a Identity (unique per EPC)
# This was generated during ISO creation: mme-{epc-id}.wisptools.io
S6A_IDENTITY="\${ORIGIN_HOST_FQDN:-mme.\$EPC_ID.wisptools.local}"
if [ -z "\$ORIGIN_HOST_FQDN" ]; then
    print_status "ORIGIN_HOST_FQDN not found, using fallback: \$S6A_IDENTITY"
else
    print_success "Using unique S6a Identity: \$S6A_IDENTITY"
fi

print_header "WISPTools.io EPC Deployment"
echo "EPC ID: \$EPC_ID"
echo "Tenant ID: \$TENANT_ID"
echo "S6a Identity: \$S6A_IDENTITY"
echo "Cloud HSS: ${gce_ip}:${hss_port}"
echo ""
`;
}

module.exports = { generateScriptHeader };

