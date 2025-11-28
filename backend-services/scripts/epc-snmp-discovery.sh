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

# Scan a single IP address
scan_single_ip() {
    local test_ip=$1
    local communities=$2
    local results_file=$3
    local our_ip=$(hostname -I | awk '{print $1}')
    
    # Skip our own IP
    if [ "$test_ip" = "$our_ip" ]; then
        return 0
    fi
    
    # Try each community string
    for community in $(echo "$communities" | tr ',' ' '); do
        if test_snmp_device "$test_ip" "$community"; then
            log "Found SNMP device: $test_ip (community: $community)"
            
            local device_info=$(get_device_info "$test_ip" "$community")
            
            # Validate and write to results file
            if command -v jq &> /dev/null; then
                if echo "$device_info" | jq empty 2>/dev/null; then
                    echo "$device_info" >> "$results_file"
                    return 0
                fi
            else
                # Fallback: write raw JSON
                echo "$device_info" >> "$results_file"
                return 0
            fi
        fi
    done
    
    return 1
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
    local results_file=$(mktemp)
    local pids=()
    local max_parallel=20  # Scan 20 IPs in parallel
    local scanned=0
    local found=0
    local start_time=$(date +%s)
    
    log "Scanning 254 IPs with up to $max_parallel parallel connections..."
    log "Using timeout: 2s per IP, communities: $communities"
    log "Starting scan at $(date)..."
    
    # Use jq to build array properly
    if ! command -v jq &> /dev/null; then
        log "WARNING: jq not found, JSON may have issues. Installing jq is recommended."
    fi
    
    # Initialize results file
    touch "$results_file"
    
    # Scan IPs with parallel processing
    for i in $(seq 1 254); do
        local test_ip="${base_ip}.${i}"
        scanned=$((scanned + 1))
        
        # Show progress every 25 IPs or on first IP
        if [ $scanned -eq 1 ] || [ $((scanned % 25)) -eq 0 ]; then
            local elapsed=$(($(date +%s) - start_time))
            local current_found=0
            if [ -f "$results_file" ] && [ -s "$results_file" ]; then
                current_found=$(wc -l < "$results_file" 2>/dev/null | tr -d ' ' || echo "0")
            fi
            log "Progress: Scanned $scanned/254 IPs (${elapsed}s elapsed, $current_found device(s) found so far)..."
        fi
        
        # Wait for available slot if we have too many parallel scans
        while [ ${#pids[@]} -ge $max_parallel ]; do
            for pid_idx in "${!pids[@]}"; do
                if ! kill -0 "${pids[$pid_idx]}" 2>/dev/null; then
                    wait "${pids[$pid_idx]}" 2>/dev/null
                    unset pids[$pid_idx]
                fi
            done
            # Rebuild array without gaps
            pids=("${pids[@]}")
            sleep 0.1
        done
        
        # Start scan in background
        scan_single_ip "$test_ip" "$communities" "$results_file" &
        pids+=($!)
        
        # Check device count periodically to see if we've hit the limit
        if [ -f "$results_file" ]; then
            local current_count=$(wc -l < "$results_file" 2>/dev/null || echo "0")
            if [ "$current_count" -ge 50 ]; then
                log "Reached discovery limit (50 devices), stopping scan"
                # Kill remaining background jobs
                for pid in "${pids[@]}"; do
                    kill "$pid" 2>/dev/null || true
                done
                break
            fi
        fi
    done
    
    # Wait for all remaining background jobs
    log "Waiting for all scans to complete..."
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null
    done
    
    # Collect results
    local devices_array="[]"
    local count=0
    
    if [ -s "$results_file" ]; then
        if command -v jq &> /dev/null; then
            # Read all results and build JSON array
            devices_array="["
            local first=true
            while IFS= read -r device_json; do
                if [ -n "$device_json" ] && echo "$device_json" | jq empty 2>/dev/null; then
                    if [ "$first" = true ]; then
                        first=false
                    else
                        devices_array="${devices_array},"
                    fi
                    devices_array="${devices_array}${device_json}"
                    count=$((count + 1))
                fi
            done < "$results_file"
            devices_array="${devices_array}]"
        else
            # Fallback: manual array building
            devices_array="["
            local first=true
            while IFS= read -r device_json; do
                if [ -n "$device_json" ]; then
                    if [ "$first" = true ]; then
                        first=false
                    else
                        devices_array="${devices_array},"
                    fi
                    devices_array="${devices_array}${device_json}"
                    count=$((count + 1))
                fi
            done < "$results_file"
            devices_array="${devices_array}]"
        fi
    fi
    
    # Clean up
    rm -f "$results_file"
    
    local elapsed=$(($(date +%s) - start_time))
    log "Discovery complete. Found $count SNMP devices in ${elapsed} seconds"
    
    if [ "$count" -eq 0 ]; then
        log "No SNMP devices found. This is normal if no SNMP-enabled devices are on the network."
        devices_array="[]"
    fi
    
    # Final validation of JSON
    if command -v jq &> /dev/null; then
        if ! echo "$devices_array" | jq empty 2>/dev/null; then
            log "ERROR: Generated invalid JSON array, returning empty array"
            devices_array="[]"
        fi
    fi
    
    echo "$devices_array"
}

# Get tenant ID from cached value (set by check-in agent)
get_tenant_id() {
    local cached_tenant_file="/tmp/epc-tenant-id"
    if [ -f "$cached_tenant_file" ]; then
        local cached_tenant=$(cat "$cached_tenant_file" 2>/dev/null | tr -d '\n\r')
        if [ -n "$cached_tenant" ] && [ "$cached_tenant" != "null" ]; then
            echo "$cached_tenant"
            return 0
        fi
    fi
    echo ""
    return 1
}

# Report discovered devices to server
report_discovered_devices() {
    local device_code=$(get_device_code)
    local discovered_devices=$1
    
    if [ -z "$device_code" ]; then
        log "ERROR: No device code found"
        return 1
    fi
    
    # Get tenant ID from cache (set by check-in agent)
    local tenant_id=$(get_tenant_id)
    
    # Always report, even if empty (so server knows discovery ran)
    if [ -z "$discovered_devices" ] || [ "$discovered_devices" = "[]" ]; then
        log "No SNMP devices discovered - reporting empty result"
        discovered_devices="[]"
    fi
    
    # Ensure discovered_devices is valid JSON array
    if [ -z "$discovered_devices" ]; then
        discovered_devices="[]"
    fi
    
    # Validate JSON before sending
    if ! echo "$discovered_devices" | jq empty 2>/dev/null; then
        log "ERROR: Invalid JSON generated for discovered devices, using empty array"
        log "JSON content: $discovered_devices"
        discovered_devices="[]"
    fi
    
    local device_count=$(echo "$discovered_devices" | jq -r 'length // 0' 2>/dev/null || echo "0")
    log "Reporting $device_count discovered devices to server..."
    
    # Use jq to properly construct the payload JSON - simplified approach
    local payload
    if command -v jq &> /dev/null; then
        # Simple and reliable: use jq to create the payload from scratch
        payload=$(jq -n \
            --arg device_code "$device_code" \
            --argjson discovered_devices "$discovered_devices" \
            '{
                device_code: $device_code,
                discovered_devices: $discovered_devices
            }' 2>&1)
        
        # Check if jq command succeeded
        if [ $? -ne 0 ] || [ -z "$payload" ] || ! echo "$payload" | jq empty 2>/dev/null; then
            log "WARNING: jq payload construction failed: $payload"
            log "Using fallback payload construction"
            # Fallback: construct manually
            if [ "$discovered_devices" = "[]" ]; then
                payload="{\"device_code\":\"$device_code\",\"discovered_devices\":[]}"
            else
                payload="{\"device_code\":\"$device_code\",\"discovered_devices\":$discovered_devices}"
            fi
        fi
    else
        # Fallback: manual construction
        if [ "$discovered_devices" = "[]" ] || [ -z "$discovered_devices" ]; then
            payload="{\"device_code\":\"$device_code\",\"discovered_devices\":[]}"
        else
            payload="{\"device_code\":\"$device_code\",\"discovered_devices\":$discovered_devices}"
        fi
    fi
    
    # Final validation - ensure payload is valid JSON
    if ! echo "$payload" | jq empty 2>/dev/null; then
        log "ERROR: Final payload is invalid JSON, using minimal safe payload"
        log "Payload was: $payload"
        payload="{\"device_code\":\"$device_code\",\"discovered_devices\":[]}"
    fi
    
    # Build curl command with headers
    local curl_headers=("-H" "Content-Type: application/json" "-H" "X-Device-Code: $device_code")
    if [ -n "$tenant_id" ]; then
        curl_headers+=("-H" "X-Tenant-ID: $tenant_id")
        log "Including X-Tenant-ID header"
    else
        log "WARNING: No tenant ID cached - request may fail tenant validation"
    fi
    
    local response=$(curl -s -X POST "${API_URL}/snmp/discovered" \
        "${curl_headers[@]}" \
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

# Scan a single IP address (for testing)
test_single_ip() {
    local test_ip=$1
    local communities=${2:-"public,private,community"}
    
    log "Testing single IP: $test_ip"
    
    # Check if snmpget is available
    if ! command -v snmpget &> /dev/null; then
        log "ERROR: snmpget command not found. Install net-snmp package: sudo apt install snmp"
        return 1
    fi
    
    local results_file=$(mktemp)
    local found=false
    local report_result=0
    
    # Try each community
    for community in $(echo "$communities" | tr ',' ' '); do
        log "Testing $test_ip with community: $community"
        if test_snmp_device "$test_ip" "$community"; then
            log "✓ Found SNMP device at $test_ip (community: $community)"
            local device_info=$(get_device_info "$test_ip" "$community")
            
            # Validate and display
            if command -v jq &> /dev/null; then
                if echo "$device_info" | jq empty 2>/dev/null; then
                    echo ""
                    echo "Device Information:"
                    echo "$device_info" | jq .
                    echo ""
                    echo "$device_info" >> "$results_file"
                    found=true
                else
                    log "ERROR: Invalid JSON generated for device"
                fi
            else
                echo ""
                echo "Device Information:"
                echo "$device_info"
                echo ""
                echo "$device_info" >> "$results_file"
                found=true
            fi
            break
        else
            log "✗ No response from $test_ip with community: $community"
        fi
    done
    
    if [ "$found" = false ]; then
        log "✗ No SNMP response from $test_ip with any community string (tried: $communities)"
        rm -f "$results_file"
        return 1
    fi
    
    # Report to server if device was found
    if [ -s "$results_file" ]; then
        local devices_array="["
        local first=true
        while IFS= read -r device_json; do
            if [ -n "$device_json" ]; then
                if [ "$first" = true ]; then
                    first=false
                else
                    devices_array="${devices_array},"
                fi
                devices_array="${devices_array}${device_json}"
            fi
        done < "$results_file"
        devices_array="${devices_array}]"
        
        log "Reporting discovered device to server..."
        if report_discovered_devices "$devices_array"; then
            report_result=0
        else
            report_result=1
        fi
    fi
    
    rm -f "$results_file"
    return $report_result
}

# Main discovery function
main() {
    # Check if a specific IP was provided as argument
    if [ -n "$1" ]; then
        local target="$1"
        
        # If it's a single IP (no / in it), test that IP
        if ! echo "$target" | grep -q "/"; then
            log "Single IP mode: Testing $target"
            test_single_ip "$target"
            return $?
        else
            # It's a subnet, scan it
            local subnet="$target"
            log "Custom subnet mode: Scanning $subnet"
        fi
    else
        # Default: auto-detect network
        local network_info=$(get_network_info)
        local local_ip=$(echo "$network_info" | cut -d'|' -f1)
        local network=$(echo "$local_ip" | cut -d'.' -f1-3)
        
        # Default to /24 subnet
        local subnet="${network}.0/24"
        log "Auto-detected subnet mode: $subnet"
    fi
    
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

