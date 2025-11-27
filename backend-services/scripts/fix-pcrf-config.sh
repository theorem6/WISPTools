#!/bin/bash
# Fix PCRF config to use MongoDB Atlas (same as HSS)

echo "Fixing PCRF configuration..."

# Get MongoDB URI from HSS config (first line)
MONGO_URI=$(head -1 /etc/open5gs/hss.yaml)
echo "Using MongoDB URI from HSS: ${MONGO_URI:0:50}..."

# Create fixed PCRF config
cat > /tmp/pcrf-new.yaml << EOF
$MONGO_URI
logger:
  file:
    path: /var/log/open5gs/pcrf.log
  level: info

global:
  max:
    ue: 1024

pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
  metrics:
    server:
      - address: 0.0.0.0
        port: 9091
EOF

# Backup and replace
cp /etc/open5gs/pcrf.yaml /etc/open5gs/pcrf.yaml.bak
cp /tmp/pcrf-new.yaml /etc/open5gs/pcrf.yaml

# Also fix PCRF FreeDiameter config if needed
if [ ! -s /etc/freeDiameter/pcrf.conf ] || [ $(wc -l < /etc/freeDiameter/pcrf.conf) -lt 5 ]; then
    echo "Fixing PCRF FreeDiameter config..."
    cat > /etc/freeDiameter/pcrf.conf << 'FDCONF'
# PCRF FreeDiameter configuration
Identity = "pcrf.wisptools.io";
Realm = "wisptools.io";
Port = 3869;
ListenOn = "0.0.0.0";
No_SCTP;
No_TLS;
LoadExtension = "dbg_msg_dumps.fdx" : "0x8888";
LoadExtension = "dict_rfc5777.fdx";
LoadExtension = "dict_mip6i.fdx";
LoadExtension = "dict_nasreq.fdx";
LoadExtension = "dict_nas_mipv6.fdx";
LoadExtension = "dict_dcca.fdx";
LoadExtension = "dict_dcca_3gpp/dict_dcca_3gpp.fdx";
FDCONF
fi

# Restart PCRF
systemctl restart open5gs-pcrfd
sleep 2

echo ""
echo "PCRF Status:"
systemctl status open5gs-pcrfd --no-pager | head -10

