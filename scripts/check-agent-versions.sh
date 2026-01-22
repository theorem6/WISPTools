#!/bin/bash
# Quick script to check what hashes the agent would report

echo "=== Current Agent Script Hashes ==="
echo ""

if [ -f "/opt/wisptools/epc-checkin-agent.sh" ]; then
    HASH=$(sha256sum /opt/wisptools/epc-checkin-agent.sh | awk '{print $1}')
    echo "epc-checkin-agent.sh: $HASH"
else
    echo "epc-checkin-agent.sh: FILE NOT FOUND"
fi

if [ -f "/opt/wisptools/epc-snmp-discovery.js" ]; then
    HASH=$(sha256sum /opt/wisptools/epc-snmp-discovery.js | awk '{print $1}')
    echo "epc-snmp-discovery.js: $HASH"
else
    echo "epc-snmp-discovery.js: FILE NOT FOUND"
fi

if [ -f "/opt/wisptools/epc-snmp-discovery.sh" ]; then
    HASH=$(sha256sum /opt/wisptools/epc-snmp-discovery.sh | awk '{print $1}')
    echo "epc-snmp-discovery.sh: $HASH"
else
    echo "epc-snmp-discovery.sh: FILE NOT FOUND"
fi

echo ""
echo "=== Expected Hashes (from manifest) ==="
echo "epc-checkin-agent.sh: 9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2"
echo "epc-snmp-discovery.js: b11d13244a256939a9880ba821e06fa3ee04394be6d1a9e22e183339c4d9cc81"
echo "epc-snmp-discovery.sh: 1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6"

