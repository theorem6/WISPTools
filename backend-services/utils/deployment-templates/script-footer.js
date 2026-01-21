/**
 * Generate script footer and completion section
 * @param {Object} config - Configuration object
 * @param {string} config.siteName - Site name
 * @param {string} config.deploymentType - Deployment type
 */
function generateScriptFooter(config) {
  const { siteName, deploymentType } = config;
  
  return `print_header "Deployment Complete"
print_success "Deployment completed successfully!"
echo ""
echo "Site: ${siteName}"
echo "EPC ID: \\$EPC_ID"
echo "Deployment Type: ${deploymentType}"
echo ""

if [ "\\$INSTALL_EPC" = "1" ]; then
  echo "EPC Configuration:"
  echo "  MME IP: \\$MME_IP"
  echo "  Cloud HSS: \\$HSS_ADDR:\\$HSS_PORT"
  echo "  MCC/MNC: \\${MCC}/\\${MNC}"
  echo "  TAC: \\${TAC}"
  echo "  APN: \\$APN_NAME"
  echo ""
fi

echo "Services running:"
if [ "\\$INSTALL_EPC" = "1" ]; then
  systemctl list-units --type=service --state=running | grep "open5gs" || echo "  (EPC services check failed)"
fi
if [ "\\$INSTALL_SNMP" = "1" ]; then
  systemctl list-units --type=service --state=running | grep "epc-snmp-agent" || echo "  (SNMP agent check failed)"
fi
echo ""

if [ "\\$INSTALL_SNMP" = "1" ]; then
  echo "Monitoring:"
  echo "  SNMP Agent: Collecting metrics every 60 seconds"
  echo "  Reporting to: http://\\$HSS_ADDR:\\$HSS_PORT/api/epc/metrics"
  echo ""
fi

if [ "\\$INSTALL_EPC" = "1" ]; then
  print_success "EPC is ready to accept connections!"
elif [ "\\$INSTALL_SNMP" = "1" ]; then
  print_success "SNMP monitoring agent is running and reporting!"
fi
echo ""

exit 0
`;
}

module.exports = { generateScriptFooter };
