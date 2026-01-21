/**
 * Generate services startup section
 */
function generateServicesStartup() {
  return `print_header "Starting Services"

# Start EPC services if installed
if [ "\\$INSTALL_EPC" = "1" ]; then
  print_status "Enabling and starting EPC components..."
  
  systemctl enable open5gs-mmed
  systemctl enable open5gs-sgwcd
  systemctl enable open5gs-sgwud
  systemctl enable open5gs-smfd
  systemctl enable open5gs-upfd
  systemctl enable open5gs-pcrfd
  systemctl enable open5gs-tuning
  
  systemctl start open5gs-mmed
  systemctl start open5gs-sgwcd
  systemctl start open5gs-sgwud
  systemctl start open5gs-smfd
  systemctl start open5gs-upfd
  systemctl start open5gs-pcrfd
  
  sleep 3
  
  # Start tuning service after UPF is running (to tune ogstun interface)
  systemctl start open5gs-tuning
  
  # Check EPC service status
  print_status "Checking EPC service status..."
  if systemctl is-active --quiet open5gs-mmed && \\
     systemctl is-active --quiet open5gs-sgwcd && \\
     systemctl is-active --quiet open5gs-sgwud && \\
     systemctl is-active --quiet open5gs-smfd && \\
     systemctl is-active --quiet open5gs-upfd && \\
     systemctl is-active --quiet open5gs-pcrfd; then
      print_success "All Open5GS EPC services are running"
  else
      print_error "Some EPC services failed to start. Check logs: journalctl -u open5gs-*"
  fi
fi

# Start SNMP agent if installed
if [ "\\$INSTALL_SNMP" = "1" ]; then
  print_status "Starting SNMP monitoring agent..."
  systemctl enable epc-snmp-agent
  systemctl start epc-snmp-agent
  sleep 2
  
  # Check SNMP agent status
  if systemctl is-active --quiet epc-snmp-agent; then
      print_success "SNMP monitoring agent is running"
  else
      print_error "SNMP agent failed to start. Check logs: journalctl -u epc-snmp-agent"
  fi
fi
`;
}

module.exports = { generateServicesStartup };
