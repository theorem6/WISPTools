#!/bin/bash
# SNMP Network Discovery Script for Remote EPC
# Scans local network for SNMP-enabled devices and reports findings

CENTRAL_SERVER="hss.wisptools.io"
API_URL="https://${CENTRAL_SERVER}/api/epc"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-snmp-discovery.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SNMP-DISCOVERY] $1" | tee -a "$LOG_FILE"
}

# Get device code
get_device_code() {
    if [ -f "$CONFIG_DIR/device-code.env" ]; then
        source "$CONFIG_DIR/device-code.env"
        echo "$DEVICE_CODE"
    elif [ -f "$CONFIG_DIR/device_code" ]; then
        cat "$CONFIG_DIR/device_code"
    else
        ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]'
    fi
}

# Get primary IP address and network
get_network_info() {
    local ip=$(hostname -I | awk '{print $1}')
    local netmask=$(ip route | grep "$ip" | awk '{print $1}' | head -1)
    echo "$ip|$netmask"
}

# Test SNMP device
test_snmp_device() {
    local ip=$1
    local community=$2
    local timeout=2
    
    # Try to get sysDescr OID (1.3.6.1.2.1.1.1.0)
    local result=$(timeout $timeout snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.1.0 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$result" ]; then
        echo "$result"
        return 0
    fi
    
    return 1
}

# Get device info via SNMP
get_device_info() {
    local ip=$1
    local community=$2
    
    # Get SNMP values - strip prefixes and clean up
    local sysDescr_raw=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.1.0 2>/dev/null | sed 's/.*STRING: //' | tr -d '\n\r')
    local sysObjectID_raw=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.2.0 2>/dev/null | sed 's/.*OID: //' | tr -d '\n\r')
    local sysName_raw=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.5.0 2>/dev/null | sed 's/.*STRING: //' | sed 's/"//g' | tr -d '\n\r')
    local sysUpTime_raw=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.3.0 2>/dev/null | sed 's/.*Timeticks: //' | awk '{print $1}' | tr -d '\n\r')
    
    # Sanitize values - remove control characters and limit length
    local sysDescr=$(echo "$sysDescr_raw" | tr -d '\000-\037\177-\377' | cut -c1-200)
    local sysObjectID=$(echo "$sysObjectID_raw" | tr -d '\000-\037\177-\377' | cut -c1-100)
    local sysName=$(echo "$sysName_raw" | tr -d '\000-\037\177-\377' | cut -c1-100)
    local sysUpTime=$(echo "$sysUpTime_raw" | tr -d '\000-\037\177-\377' | grep -oE '[0-9]+' | head -1)
    
    # Set defaults if empty
    [ -z "$sysDescr" ] && sysDescr=""
    [ -z "$sysObjectID" ] && sysObjectID=""
    [ -z "$sysName" ] && sysName=""
    [ -z "$sysUpTime" ] && sysUpTime=0
    
    # Detect device type from sysObjectID
    local device_type="generic"
    if echo "$sysObjectID" | grep -q "1.3.6.1.4.1.14988"; then
        device_type="mikrotik"
    elif echo "$sysObjectID" | grep -q "1.3.6.1.4.1.9"; then
        device_type="cisco"
    elif echo "$sysObjectID" | grep -q "1.3.6.1.4.1.2011"; then
        device_type="huawei"
    fi
    
    # Detect if Mikrotik from description
    if echo "$sysDescr" | grep -qi "mikrotik\|routeros"; then
        device_type="mikrotik"
    fi
    
    # Use jq to properly construct JSON with escaped strings
    if command -v jq &> /dev/null; then
        jq -n \
            --arg ip "$ip" \
            --arg sysDescr "$sysDescr" \
            --arg sysObjectID "$sysObjectID" \
            --arg sysName "$sysName" \
            --argjson sysUpTime "$sysUpTime" \
            --arg device_type "$device_type" \
            --arg community "$community" \
            '{
                ip_address: $ip,
                sysDescr: $sysDescr,
                sysObjectID: $sysObjectID,
                sysName: $sysName,
                sysUpTime: $sysUpTime,
                device_type: $device_type,
                community: $community
            }'
    else
        # Fallback: use printf to escape values properly
        printf '{"ip_address":"%s","sysDescr":"%s","sysObjectID":"%s","sysName":"%s","sysUpTime":%s,"device_type":"%s","community":"%s"}' \
            "$(printf '%s' "$ip" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
            "$(printf '%s' "$sysDescr" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
            "$(printf '%s' "$sysObjectID" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
            "$(printf '%s' "$sysName" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
            "$sysUpTime" \
            "$device_type" \
            "$community"
    fi
}

# Scan network for SNMP devices
scan_network() {
    local subnet=$1
    local communities=${2:-"public,private"}
    
    log "Starting SNMP discovery scan on subnet: $subnet"
    
    # Check if snmpget is available
    if ! command -v snmpget &> /dev/null; then
        log "ERROR: snmpget command not found. Install net-snmp package: sudo apt install snmp"
        echo "[]"
        return 1
    fi
    
    # Extract network and CIDR
    local network=$(echo "$subnet" | cut -d'/' -f1)
    local cidr=$(echo "$subnet" | cut -d'/' -f2)
    
    # Calculate IP range (simple /24 scan for now)
    local base_ip=$(echo "$network" | cut -d'.' -f1-3)
    local discovered_devices="["
    local first=true
    local count=0
    
    # Scan first 254 IPs (limit to avoid long scans)
    for i in $(seq 1 254); do
        local test_ip="${base_ip}.${i}"
        
        # Skip our own IP
        if [ "$test_ip" = "$(hostname -I | awk '{print $1}')" ]; then
            continue
        fi
        
        # Try each community string
        for community in $(echo "$communities" | tr ',' ' '); do
            if test_snmp_device "$test_ip" "$community"; then
                log "Found SNMP device: $test_ip (community: $community)"
                
                local device_info=$(get_device_info "$test_ip" "$community")
                
                if [ "$first" = true ]; then
                    first=false
                else
                    discovered_devices="${discovered_devices},"
                fi
                
                discovered_devices="${discovered_devices}${device_info}"
                count=$((count + 1))
                break  # Found working community, move to next IP
            fi
        done
        
        # Limit total devices discovered per scan
        if [ $count -ge 50 ]; then
            log "Reached discovery limit (50 devices), stopping scan"
            break
        fi
    done
    
    discovered_devices="${discovered_devices}]"
    
    log "Discovery complete. Found $count SNMP devices"
    
    if [ "$count" -eq 0 ]; then
        log "No SNMP devices found. This is normal if no SNMP-enabled devices are on the network."
    fi
    
    echo "$discovered_devices"
}

# Report discovered devices to server
report_discovered_devices() {
    local device_code=$(get_device_code)
    local discovered_devices=$1
    
    if [ -z "$device_code" ]; then
        log "ERROR: No device code found"
        return 1
    fi
    
    # Always report, even if empty (so server knows discovery ran)
    if [ -z "$discovered_devices" ] || [ "$discovered_devices" = "[]" ]; then
        log "No SNMP devices discovered - reporting empty result"
        discovered_devices="[]"
    fi
    
    # Validate JSON before sending
    if ! echo "$discovered_devices" | jq empty 2>/dev/null; then
        log "ERROR: Invalid JSON generated for discovered devices"
        log "JSON content: $discovered_devices"
        discovered_devices="[]"
    fi
    
    local device_count=$(echo "$discovered_devices" | jq -r 'length // 0' 2>/dev/null || echo "0")
    log "Reporting $device_count discovered devices to server..."
    
    # Use jq to properly construct the payload JSON
    local payload
    if command -v jq &> /dev/null; then
        payload=$(jq -n \
            --arg device_code "$device_code" \
            --argjson discovered_devices "$discovered_devices" \
            '{
                device_code: $device_code,
                discovered_devices: $discovered_devices
            }')
    else
        # Fallback: manual construction (less safe)
        payload="{\"device_code\":\"$device_code\",\"discovered_devices\":$discovered_devices}"
    fi
    
    local response=$(curl -s -X POST "${API_URL}/snmp/discovered" \
        -H "Content-Type: application/json" \
        -H "X-Device-Code: $device_code" \
        -w "\nHTTP_CODE:%{http_code}" \
        -d "$payload" 2>&1)
    
    local http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ -n "$http_code" ] && [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        local success=$(echo "$response_body" | jq -r '.success // false' 2>/dev/null)
        if [ "$success" = "true" ]; then
            local processed=$(echo "$response_body" | jq -r '.processed // 0' 2>/dev/null)
            log "Successfully reported discovery: $processed devices processed"
            echo "$response_body"
            return 0
        else
            local error_msg=$(echo "$response_body" | jq -r '.error // .message // "Unknown error"' 2>/dev/null)
            log "ERROR: Server rejected discovery report: $error_msg"
            echo "$response_body"
            return 1
        fi
    else
        log "ERROR: Failed to report discovered devices (HTTP $http_code): $response_body"
        return 1
    fi
}

# Main discovery function
main() {
    local network_info=$(get_network_info)
    local local_ip=$(echo "$network_info" | cut -d'|' -f1)
    local network=$(echo "$local_ip" | cut -d'.' -f1-3)
    
    # Default to /24 subnet
    local subnet="${network}.0/24"
    
    log "Starting SNMP discovery on subnet: $subnet"
    
    # Common SNMP communities to try
    local communities="public,private,community"
    
    # Scan network
    local discovered_devices=$(scan_network "$subnet" "$communities")
    
    # Report to server
    report_discovered_devices "$discovered_devices"
}

# Run discovery if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

