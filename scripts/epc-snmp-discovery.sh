#!/bin/bash
# SNMP Network Discovery Script for Remote EPC
# Scans local network for SNMP-enabled devices and reports findings

CENTRAL_SERVER="hss.wisptools.io"
API_URL="https://${CENTRAL_SERVER}/api/epc"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-snmp-discovery.log"

log() {
    # Write logs to stderr and log file, NOT stdout (stdout is used for JSON output)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SNMP-DISCOVERY] $1" | tee -a "$LOG_FILE" >&2
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

# Get Mikrotik-specific info via SNMP
get_mikrotik_info() {
    local ip=$1
    local community=$2
    
    local mikrotik_data="{}"
    
    # Mikrotik-specific OIDs
    local identity=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.1.1.3.0 2>/dev/null | sed 's/.*STRING: //' | tr -d '\n\r' | head -c 100)
    local version=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.1.1.4.0 2>/dev/null | sed 's/.*STRING: //' | tr -d '\n\r' | head -c 50)
    local serial=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.1.1.7.0 2>/dev/null | sed 's/.*STRING: //' | tr -d '\n\r' | head -c 50)
    local board=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.1.1.9.0 2>/dev/null | sed 's/.*STRING: //' | tr -d '\n\r' | head -c 100)
    local cpu_load=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.3.1.0 2>/dev/null | grep -oE '[0-9]+' | head -1)
    local temp=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.4.1.14988.1.1.1.8.2.0 2>/dev/null | grep -oE '[0-9]+' | head -1)
    local uptime_ticks=$(snmpget -v2c -c "$community" "$ip" 1.3.6.1.2.1.1.3.0 2>/dev/null | sed 's/.*Timeticks: //' | grep -oE '[0-9]+' | head -1)
    
    # Build Mikrotik info JSON
    if command -v jq &> /dev/null; then
        mikrotik_data=$(jq -n \
            --arg identity "$identity" \
            --arg version "$version" \
            --arg serial "$serial" \
            --arg board "$board" \
            --argjson cpu_load "${cpu_load:-0}" \
            --argjson temp "${temp:-0}" \
            --argjson uptime_ticks "${uptime_ticks:-0}" \
            '{
                identity: (if $identity != "" then $identity else null end),
                routerOS_version: (if $version != "" then $version else null end),
                serial_number: (if $serial != "" then $serial else null end),
                board_name: (if $board != "" then $board else null end),
                cpu_load_percent: (if $cpu_load > 0 then $cpu_load else null end),
                temperature_celsius: (if $temp > 0 then $temp else null end),
                uptime_ticks: (if $uptime_ticks > 0 then $uptime_ticks else null end)
            }')
    else
        # Fallback JSON construction
        local parts=()
        [ -n "$identity" ] && parts+=("\"identity\":\"$identity\"")
        [ -n "$version" ] && parts+=("\"routerOS_version\":\"$version\"")
        [ -n "$serial" ] && parts+=("\"serial_number\":\"$serial\"")
        [ -n "$board" ] && parts+=("\"board_name\":\"$board\"")
        [ -n "$cpu_load" ] && parts+=("\"cpu_load_percent\":$cpu_load")
        [ -n "$temp" ] && parts+=("\"temperature_celsius\":$temp")
        [ -n "$uptime_ticks" ] && parts+=("\"uptime_ticks\":$uptime_ticks")
        mikrotik_data="{$(IFS=,; echo "${parts[*]}")}"
    fi
    
    echo "$mikrotik_data"
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
    local is_mikrotik=false
    if echo "$sysDescr" | grep -qi "mikrotik\|routeros"; then
        device_type="mikrotik"
        is_mikrotik=true
    fi
    
    # Get Mikrotik-specific information if it's a Mikrotik device
    local mikrotik_info="{}"
    if [ "$device_type" = "mikrotik" ]; then
        log "  Detected Mikrotik device, gathering additional information..."
        mikrotik_info=$(get_mikrotik_info "$ip" "$community")
    fi
    
    # Use jq to properly construct JSON with escaped strings
    if command -v jq &> /dev/null; then
        if [ "$device_type" = "mikrotik" ]; then
            # Include Mikrotik-specific info
            jq -n \
                --arg ip "$ip" \
                --arg sysDescr "$sysDescr" \
                --arg sysObjectID "$sysObjectID" \
                --arg sysName "$sysName" \
                --argjson sysUpTime "$sysUpTime" \
                --arg device_type "$device_type" \
                --arg community "$community" \
                --argjson mikrotik_info "$mikrotik_info" \
                '{
                    ip_address: $ip,
                    sysDescr: $sysDescr,
                    sysObjectID: $sysObjectID,
                    sysName: $sysName,
                    sysUpTime: $sysUpTime,
                    device_type: $device_type,
                    community: $community,
                    mikrotik: $mikrotik_info
                }'
        else
            # Standard device info
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
        fi
    else
        # Fallback: use printf to escape values properly
        if [ "$device_type" = "mikrotik" ] && [ "$mikrotik_info" != "{}" ]; then
            printf '{"ip_address":"%s","sysDescr":"%s","sysObjectID":"%s","sysName":"%s","sysUpTime":%s,"device_type":"%s","community":"%s","mikrotik":%s}' \
                "$(printf '%s' "$ip" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
                "$(printf '%s' "$sysDescr" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$(printf '%s' "$sysObjectID" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$(printf '%s' "$sysName" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$sysUpTime" \
                "$device_type" \
                "$community" \
                "$mikrotik_info"
        else
            printf '{"ip_address":"%s","sysDescr":"%s","sysObjectID":"%s","sysName":"%s","sysUpTime":%s,"device_type":"%s","community":"%s"}' \
                "$(printf '%s' "$ip" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
                "$(printf '%s' "$sysDescr" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$(printf '%s' "$sysObjectID" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$(printf '%s' "$sysName" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r//g')" \
                "$sysUpTime" \
                "$device_type" \
                "$community"
        fi
    fi
}

# Ping a single IP address (quick check if host is alive)
ping_single_ip() {
    local test_ip=$1
    local timeout=1
    
    # Skip our own IP
    local our_ip=$(hostname -I | awk '{print $1}')
    if [ "$test_ip" = "$our_ip" ]; then
        return 1  # Skip self
    fi
    
    # Use ping -c 1 -W timeout (Linux)
    if ping -c 1 -W "$timeout" "$test_ip" >/dev/null 2>&1; then
        return 0  # Host is alive
    fi
    
    return 1  # Host not responding
}

# Scan a single IP address for SNMP
scan_single_ip_snmp() {
    local test_ip=$1
    local communities=$2
    local results_file=$3
    
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

# Create a generic device entry for ping-only devices (no SNMP)
create_ping_only_device() {
    local ip=$1
    
    if command -v jq &> /dev/null; then
        jq -n \
            --arg ip "$ip" \
            '{
                ip_address: $ip,
                sysDescr: "Device responding to ping (SNMP not enabled or not accessible)",
                sysObjectID: "",
                sysName: "",
                sysUpTime: 0,
                device_type: "generic",
                community: "",
                snmp_enabled: false,
                discovered_via: "ping_only"
            }'
    else
        printf '{"ip_address":"%s","sysDescr":"Device responding to ping (SNMP not enabled or not accessible)","sysObjectID":"","sysName":"","sysUpTime":0,"device_type":"generic","community":"","snmp_enabled":false,"discovered_via":"ping_only"}' \
            "$(printf '%s' "$ip" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    fi
}

# Ping sweep - find all responding IPs (Phase 1)
ping_sweep() {
    local subnet=$1
    local base_ip=$(echo "$subnet" | cut -d'/' -f1 | cut -d'.' -f1-3)
    local ping_file=$(mktemp)
    local pids=()
    local max_parallel=50  # Ping 50 IPs in parallel (ping is fast)
    local scanned=0
    local start_time=$(date +%s)
    
    log "Step 1: Ping sweep - finding responding hosts on subnet: $subnet"
    
    # Ping all IPs in parallel
    for i in $(seq 1 254); do
        local test_ip="${base_ip}.${i}"
        scanned=$((scanned + 1))
        
        # Show progress every 50 IPs
        if [ $scanned -eq 1 ] || [ $((scanned % 50)) -eq 0 ]; then
            local elapsed=$(($(date +%s) - start_time))
            local current_found=$(wc -l < "$ping_file" 2>/dev/null | tr -d ' ' || echo "0")
            log "  Ping progress: $scanned/254 IPs (${elapsed}s, $current_found host(s) responding)..."
        fi
        
        # Wait for available slot if we have too many parallel pings
        while [ ${#pids[@]} -ge $max_parallel ]; do
            for pid_idx in "${!pids[@]}"; do
                if ! kill -0 "${pids[$pid_idx]}" 2>/dev/null; then
                    wait "${pids[$pid_idx]}" 2>/dev/null
                    unset pids[$pid_idx]
                fi
            done
            # Rebuild array without gaps
            pids=("${pids[@]}")
            sleep 0.05
        done
        
        # Ping in background
        (ping_single_ip "$test_ip" && echo "$test_ip" >> "$ping_file") &
        pids+=($!)
    done
    
    # Wait for all pings to complete
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null
    done
    
    # Read responding IPs
    local responding_ips=()
    if [ -s "$ping_file" ]; then
        while IFS= read -r ip; do
            if [ -n "$ip" ]; then
                responding_ips+=("$ip")
            fi
        done < "$ping_file"
    fi
    
    rm -f "$ping_file"
    
    local elapsed=$(($(date +%s) - start_time))
    log "  Ping sweep complete: Found ${#responding_ips[@]} responding hosts in ${elapsed} seconds"
    
    # Return array of IPs (space-separated string for bash array)
    echo "${responding_ips[*]}"
}

# Scan network for SNMP devices (two-phase: ping first, then SNMP)
scan_network() {
    local subnet=$1
    local communities=${2:-"public,private"}
    
    log "Starting two-phase network discovery on subnet: $subnet"
    
    # Phase 1: Ping sweep to find responding hosts
    local responding_ips_str=$(ping_sweep "$subnet")
    local responding_ips=($responding_ips_str)
    
    if [ ${#responding_ips[@]} -eq 0 ]; then
        log "No responding hosts found on subnet $subnet"
        echo "[]"
        return 0
    fi
    
    log "Step 2: SNMP discovery - checking ${#responding_ips[@]} responding hosts for SNMP..."
    
    # Check if snmpget is available
    local snmp_available=true
    if ! command -v snmpget &> /dev/null; then
        log "WARNING: snmpget not found. Will only report ping-responding devices."
        snmp_available=false
    fi
    
    if [ "$snmp_available" = false ]; then
        # Still create devices for ping-only hosts
        local ping_only_devices="["
        local first=true
        for ip in "${responding_ips[@]}"; do
            if [ "$first" = true ]; then
                first=false
            else
                ping_only_devices="${ping_only_devices},"
            fi
            ping_only_devices="${ping_only_devices}$(create_ping_only_device "$ip")"
        done
        ping_only_devices="${ping_only_devices}]"
        echo "$ping_only_devices"
        return 0
    fi
    
    # Phase 2: SNMP scan on responding hosts
    local snmp_results_file=$(mktemp)
    local ping_only_file=$(mktemp)
    local pids=()
    local max_parallel=20  # SNMP queries in parallel
    local scanned=0
    local start_time=$(date +%s)
    
    # Scan responding IPs for SNMP
    for test_ip in "${responding_ips[@]}"; do
        scanned=$((scanned + 1))
        
        # Show progress
        if [ $scanned -eq 1 ] || [ $((scanned % 10)) -eq 0 ]; then
            local elapsed=$(($(date +%s) - start_time))
            local current_snmp=$(wc -l < "$snmp_results_file" 2>/dev/null | tr -d ' ' || echo "0")
            log "  SNMP progress: $scanned/${#responding_ips[@]} hosts (${elapsed}s, $current_snmp SNMP device(s) found)..."
        fi
        
        # Wait for available slot
        while [ ${#pids[@]} -ge $max_parallel ]; do
            for pid_idx in "${!pids[@]}"; do
                if ! kill -0 "${pids[$pid_idx]}" 2>/dev/null; then
                    wait "${pids[$pid_idx]}" 2>/dev/null
                    unset pids[$pid_idx]
                fi
            done
            pids=("${pids[@]}")
            sleep 0.1
        done
        
        # Scan SNMP in background
        (
            if scan_single_ip_snmp "$test_ip" "$communities" "$snmp_results_file"; then
                :  # SNMP device found, already written to results
            else
                # No SNMP, but host responded to ping - add as ping-only device
                echo "$test_ip" >> "$ping_only_file"
            fi
        ) &
        pids+=($!)
    done
    
    # Wait for all SNMP scans to complete
    log "  Waiting for SNMP scans to complete..."
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null
    done
    
    # Build final device array
    local devices_array="[]"
    local snmp_count=0
    local ping_only_count=0
    
    # Get SNMP devices
    if [ -s "$snmp_results_file" ]; then
        if command -v jq &> /dev/null; then
            local snmp_devices=$(jq -s '.' < "$snmp_results_file" 2>/dev/null || echo "[]")
            snmp_count=$(echo "$snmp_devices" | jq -r 'length // 0' 2>/dev/null || echo "0")
            
            # Start with SNMP devices
            devices_array="$snmp_devices"
        else
            # Fallback
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
                    snmp_count=$((snmp_count + 1))
                fi
            done < "$snmp_results_file"
            devices_array="${devices_array}]"
        fi
    fi
    
    # Add ping-only devices (no SNMP)
    if [ -s "$ping_only_file" ]; then
        while IFS= read -r ping_ip; do
            if [ -n "$ping_ip" ]; then
                ping_only_count=$((ping_only_count + 1))
                local ping_device=$(create_ping_only_device "$ping_ip")
                
                if command -v jq &> /dev/null; then
                    # Validate ping_device JSON first
                    if echo "$ping_device" | jq empty 2>/dev/null; then
                        # Merge ping device into array
                        local merged=$(echo "$devices_array" | jq ". + [$ping_device]" 2>&1)
                        if [ $? -eq 0 ] && echo "$merged" | jq empty 2>/dev/null; then
                            devices_array="$merged"
                        else
                            log "WARNING: Failed to merge ping device $ping_ip into array: $merged"
                        fi
                    else
                        log "WARNING: Invalid JSON for ping device $ping_ip: $ping_device"
                    fi
                else
                    # Manual merge
                    devices_array=$(echo "$devices_array" | sed 's/\]$//')
                    if [ "$devices_array" != "[]" ]; then
                        devices_array="${devices_array},"
                    else
                        devices_array="["
                    fi
                    devices_array="${devices_array}${ping_device}]"
                fi
            fi
        done < "$ping_only_file"
    fi
    
    # Clean up
    rm -f "$snmp_results_file" "$ping_only_file"
    
    local elapsed=$(($(date +%s) - start_time))
    local total_count=$((snmp_count + ping_only_count))
    log "Discovery complete: $total_count total devices (${snmp_count} SNMP-enabled, ${ping_only_count} ping-only) in ${elapsed} seconds"
    
    # Final validation and logging
    if command -v jq &> /dev/null; then
        if ! echo "$devices_array" | jq empty 2>/dev/null; then
            log "ERROR: Generated invalid JSON array, returning empty array"
            log "DEBUG: Invalid array was: ${devices_array:0:500}"
            devices_array="[]"
            total_count=0
        else
            total_count=$(echo "$devices_array" | jq -r 'length // 0' 2>/dev/null || echo "0")
            if [ "$total_count" != "$((snmp_count + ping_only_count))" ]; then
                log "WARNING: Device count mismatch - expected $((snmp_count + ping_only_count)), got $total_count"
                log "DEBUG: SNMP count: $snmp_count, Ping-only count: $ping_only_count, Array length: $total_count"
                # Try to rebuild array if count is wrong but array is valid JSON
                if [ "$total_count" -eq 0 ] && [ "$((snmp_count + ping_only_count))" -gt 0 ]; then
                    log "ERROR: Array is empty but devices were found - rebuilding array..."
                    # Array might have been cleared - log for debugging
                fi
            fi
        fi
    else
        # Without jq, use manual count
        total_count=$((snmp_count + ping_only_count))
    fi
    
    log "Returning $total_count device(s) from discovery (SNMP: $snmp_count, Ping-only: $ping_only_count)"
    
    # Final check - if we have devices but array is empty, log warning
    if [ "$total_count" -eq 0 ] && [ "$((snmp_count + ping_only_count))" -gt 0 ]; then
        log "ERROR: Devices were found but array is empty! SNMP: $snmp_count, Ping-only: $ping_only_count"
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
        log "JSON content (first 500 chars): ${discovered_devices:0:500}"
        discovered_devices="[]"
    fi
    
    local device_count=$(echo "$discovered_devices" | jq -r 'length // 0' 2>/dev/null || echo "0")
    log "Reporting $device_count discovered devices to server..."
    
    # Log device IPs for debugging
    if [ "$device_count" -gt 0 ]; then
        local device_ips=$(echo "$discovered_devices" | jq -r '.[].ip_address // empty' 2>/dev/null | head -10 | tr '\n' ',' | sed 's/,$//')
        log "Device IPs being reported: ${device_ips:-none}"
    else
        log "WARNING: No devices in array to report - this may indicate a merge/collection issue"
    fi
    
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
            }' 2>/dev/null)
        
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
    
    # Capture curl response (stdout) but keep stderr visible for debugging
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
    
    # Scan network - capture only stdout (JSON), stderr (logs) goes to terminal/log
    local discovered_devices=$(scan_network "$subnet" "$communities" 2>/dev/null)
    
    # Report to server
    report_discovered_devices "$discovered_devices"
}

# Run discovery if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

