#!/bin/bash
# WISPTools EPC Check-in Agent
# Runs periodically on remote EPCs to:
#   1. Report service status and system metrics
#   2. Receive and execute queued commands
#   3. Report command results
#
# Install: curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh | sudo bash -s install
# Run once: sudo /opt/wisptools/epc-checkin-agent.sh
# Check status: systemctl status wisptools-checkin

CENTRAL_SERVER="hss.wisptools.io"
API_URL="https://${CENTRAL_SERVER}/api/epc"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"
CHECKIN_INTERVAL=60  # Default 60 seconds

# Required services to monitor
REQUIRED_SERVICES="open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd snmpd"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] $1" | tee -a "$LOG_FILE"
}

# Get device code
get_device_code() {
    if [ -f "$CONFIG_DIR/device-code.env" ]; then
        source "$CONFIG_DIR/device-code.env"
        echo "$DEVICE_CODE"
    elif [ -f "$CONFIG_DIR/device_code" ]; then
        cat "$CONFIG_DIR/device_code"
    else
        # Generate from MAC address
        ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]'
    fi
}

# Get hardware ID (primary MAC address)
get_hardware_id() {
    ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr '[:lower:]' '[:upper:]'
}

# Get primary IP address
get_ip_address() {
    hostname -I | awk '{print $1}'
}

# Get service status - sanitize all output
get_service_status() {
    local svc=$1
    local status="unknown"
    local uptime_sec=0
    local memory_mb=0
    
    if ! systemctl list-unit-files 2>/dev/null | grep -q "^${svc}"; then
        echo '{"status":"not-found","uptime_seconds":0,"memory_mb":0}'
        return
    fi
    
    status=$(systemctl is-active "$svc" 2>/dev/null | tr -d '\n\r' || echo "inactive")
    [ -z "$status" ] && status="inactive"
    
    if [ "$status" = "active" ]; then
        # Get uptime - with error handling
        local start_time=$(systemctl show "$svc" --property=ActiveEnterTimestamp --value 2>/dev/null | tr -d '\n\r')
        if [ -n "$start_time" ] && [ "$start_time" != "" ]; then
            local start_epoch=$(date -d "$start_time" +%s 2>/dev/null)
            local now_epoch=$(date +%s 2>/dev/null)
            if [ -n "$start_epoch" ] && [ -n "$now_epoch" ]; then
                uptime_sec=$((now_epoch - start_epoch)) 2>/dev/null || uptime_sec=0
            fi
        fi
        
        # Get memory usage
        local pid=$(systemctl show "$svc" --property=MainPID --value 2>/dev/null | tr -d '\n\r')
        if [ -n "$pid" ] && [ "$pid" != "0" ]; then
            memory_mb=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.0f", $1/1024}') || memory_mb=0
            [ -z "$memory_mb" ] && memory_mb=0
        fi
    fi
    
    # Ensure numeric values
    [ -z "$uptime_sec" ] && uptime_sec=0
    [ -z "$memory_mb" ] && memory_mb=0
    
    echo "{\"status\":\"$status\",\"uptime_seconds\":$uptime_sec,\"memory_mb\":$memory_mb}"
}

# Get system metrics - using proper CPU calculation that accounts for multi-core systems
get_system_metrics() {
    # Calculate CPU usage from /proc/stat (most accurate, accounts for all cores, fast)
    local cpu_percent=0
    local stat_file="/tmp/cpu_stat_prev"
    
    if [ -f /proc/stat ]; then
        # Read current CPU stats
        local cpu_line=$(head -n 1 /proc/stat)
        local user=$(echo "$cpu_line" | awk '{print $2}')
        local nice=$(echo "$cpu_line" | awk '{print $3}')
        local system=$(echo "$cpu_line" | awk '{print $4}')
        local idle=$(echo "$cpu_line" | awk '{print $5}')
        local iowait=$(echo "$cpu_line" | awk '{print $6}')
        local irq=$(echo "$cpu_line" | awk '{print $7}')
        local softirq=$(echo "$cpu_line" | awk '{print $8}')
        
        local total=$((user + nice + system + idle + iowait + irq + softirq))
        local idle_total=$((idle + iowait))
        
        # Get previous stats if available
        if [ -f "$stat_file" ]; then
            local prev_line=$(cat "$stat_file")
            local prev_user=$(echo "$prev_line" | awk '{print $2}')
            local prev_nice=$(echo "$prev_line" | awk '{print $3}')
            local prev_system=$(echo "$prev_line" | awk '{print $4}')
            local prev_idle=$(echo "$prev_line" | awk '{print $5}')
            local prev_iowait=$(echo "$prev_line" | awk '{print $6}')
            local prev_irq=$(echo "$prev_line" | awk '{print $7}')
            local prev_softirq=$(echo "$prev_line" | awk '{print $8}')
            
            local prev_total=$((prev_user + prev_nice + prev_system + prev_idle + prev_iowait + prev_irq + prev_softirq))
            local prev_idle_total=$((prev_idle + prev_iowait))
            
            local total_delta=$((total - prev_total))
            local idle_delta=$((idle_total - prev_idle_total))
            
            if [ "$total_delta" -gt 0 ]; then
                local used=$((total_delta - idle_delta))
                cpu_percent=$((used * 100 / total_delta))
            fi
        fi
        
        # Save current stats for next call
        echo "$cpu_line" > "$stat_file" 2>/dev/null || true
    fi
    
    # Fallback to top if /proc/stat method didn't work or no previous data
    if [ -z "$cpu_percent" ] || [ "$cpu_percent" -lt 0 ] || [ "$cpu_percent" -gt 100 ]; then
        # Use top - the %Cpu(s) line shows aggregate across all cores
        local cpu_line=$(top -bn1 | grep "^%Cpu" 2>/dev/null | head -1)
        if [ -n "$cpu_line" ]; then
            # Extract all CPU percentages and calculate used
            local us=$(echo "$cpu_line" | grep -oE '[0-9.]+%us' | grep -oE '[0-9.]+' || echo "0")
            local sy=$(echo "$cpu_line" | grep -oE '[0-9.]+%sy' | grep -oE '[0-9.]+' || echo "0")
            local ni=$(echo "$cpu_line" | grep -oE '[0-9.]+%ni' | grep -oE '[0-9.]+' || echo "0")
            local id=$(echo "$cpu_line" | grep -oE '[0-9.]+%id' | grep -oE '[0-9.]+' || echo "100")
            # Calculate used percentage
            cpu_percent=$(awk "BEGIN {printf \"%.0f\", $us + $sy + $ni}" 2>/dev/null || echo "0")
        fi
    fi
    
    [ -z "$cpu_percent" ] && cpu_percent=0
    # Ensure value is between 0 and 100
    [ "$cpu_percent" -lt 0 ] && cpu_percent=0
    [ "$cpu_percent" -gt 100 ] && cpu_percent=100
    local mem_total=$(free -m | awk 'NR==2{print $2}' 2>/dev/null)
    [ -z "$mem_total" ] && mem_total=1
    local mem_used=$(free -m | awk 'NR==2{print $3}' 2>/dev/null)
    [ -z "$mem_used" ] && mem_used=0
    local mem_percent=$((mem_used * 100 / mem_total))
    local disk_info=$(df -m / 2>/dev/null | awk 'NR==2{print $2" "$3" "$5}' | tr -d '%')
    local disk_total=$(echo "$disk_info" | awk '{printf "%.1f", $1/1024}' 2>/dev/null)
    [ -z "$disk_total" ] && disk_total=0
    local disk_used=$(echo "$disk_info" | awk '{printf "%.1f", $2/1024}' 2>/dev/null)
    [ -z "$disk_used" ] && disk_used=0
    local disk_percent=$(echo "$disk_info" | awk '{print $3}' 2>/dev/null)
    [ -z "$disk_percent" ] && disk_percent=0
    local uptime_sec=$(awk '{print int($1)}' /proc/uptime 2>/dev/null)
    [ -z "$uptime_sec" ] && uptime_sec=0
    local load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null)
    [ -z "$load1" ] && load1=0
    local load5=$(awk '{print $2}' /proc/loadavg 2>/dev/null)
    [ -z "$load5" ] && load5=0
    local load15=$(awk '{print $3}' /proc/loadavg 2>/dev/null)
    [ -z "$load15" ] && load15=0
    
    # Build JSON with proper error handling
    echo "{\"uptime_seconds\":$uptime_sec,\"load_average\":[$load1,$load5,$load15],\"cpu_percent\":$cpu_percent,\"memory_percent\":$mem_percent,\"memory_total_mb\":$mem_total,\"memory_used_mb\":$mem_used,\"disk_percent\":$disk_percent,\"disk_total_gb\":$disk_total,\"disk_used_gb\":$disk_used}"
}

# Get network info - simple JSON without jq dependency issues
get_network_info() {
    local ip=$(get_ip_address)
    [ -z "$ip" ] && ip="unknown"
    echo "{\"ip_address\":\"$ip\",\"interfaces\":[]}"
}

# Get file hash (SHA256) if sha256sum is available, otherwise use md5sum
get_file_hash() {
    local file_path=$1
    if [ ! -f "$file_path" ]; then
        echo "missing"
        return
    fi
    
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file_path" 2>/dev/null | cut -d' ' -f1 | tr -d '\n\r' || echo "unknown"
    elif command -v md5sum >/dev/null 2>&1; then
        md5sum "$file_path" 2>/dev/null | cut -d' ' -f1 | tr -d '\n\r' || echo "unknown"
    else
        # Fallback: use stat for modification time
        stat -c %Y "$file_path" 2>/dev/null | tr -d '\n\r' || echo "unknown"
    fi
}

# Get version info - simple JSON with sanitization
get_versions() {
    local os_info=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d'"' -f2 | tr -d '\n\r' | sed 's/["\\\t]//g' || echo "Unknown")
    [ -z "$os_info" ] && os_info="Unknown"
    local kernel=$(uname -r 2>/dev/null | tr -d '\n\r' || echo "unknown")
    [ -z "$kernel" ] && kernel="unknown"
    local open5gs_version=$(dpkg -l 2>/dev/null | grep open5gs-mme | awk '{print $3}' | head -1 | tr -d '\n\r')
    [ -z "$open5gs_version" ] && open5gs_version="not installed"
    
    # Get script versions/hashes
    local agent_hash=$(get_file_hash "/opt/wisptools/epc-checkin-agent.sh")
    local snmp_hash=""
    local snmp_js_hash=""
    
    # Get hash for bash version (if exists)
    if [ -f "/opt/wisptools/epc-snmp-discovery.sh" ]; then
        snmp_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.sh")
    fi
    
    # Get hash for Node.js version (if exists)
    if [ -f "/opt/wisptools/epc-snmp-discovery.js" ]; then
        snmp_js_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.js")
    fi
    
    # Build scripts object
    local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
    [ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
    [ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
    scripts_json="${scripts_json}}"
    
    echo "{\"os\":\"$os_info\",\"kernel\":\"$kernel\",\"open5gs\":\"$open5gs_version\",$scripts_json}"
}

# Execute a command
execute_command() {
    local cmd_id=$1
    local cmd_type=$2
    local action=$3
    local target_services=$4
    local script_content=$5
    local script_url=$6
    local cmd_json_file=$7  # Path to JSON file containing full command (for config_data extraction)
    
    log "Executing command $cmd_id: $cmd_type / $action"
    
    local result_success=true
    local result_output=""
    local result_error=""
    local exit_code=0
    
    case "$cmd_type" in
        service_control)
            if [ "$target_services" = "all" ] || [ -z "$target_services" ]; then
                target_services="$REQUIRED_SERVICES"
            fi
            
            for svc in $target_services; do
                log "  -> $action $svc"
                case "$action" in
                    start|stop|restart)
                        if output=$(systemctl $action "$svc" 2>&1); then
                            result_output+="$svc: $action OK\n"
                        else
                            result_output+="$svc: $action FAILED - $output\n"
                            result_success=false
                        fi
                        ;;
                    enable|disable)
                        systemctl $action "$svc" 2>&1
                        ;;
                    status)
                        result_output+="$svc: $(systemctl is-active $svc)\n"
                        ;;
                esac
            done
            ;;
            
        reboot)
            log "  -> System reboot requested"
            result_output="Rebooting system..."
            # Report result before rebooting
            report_command_result "$cmd_id" "true" "$result_output" "" 0
            sync
            sleep 2
            reboot
            ;;
            
        update)
            log "  -> System update requested"
            if output=$(apt-get update -qq && apt-get upgrade -y 2>&1); then
                result_output="Update completed: $output"
            else
                result_success=false
                result_error="Update failed: $output"
                exit_code=1
            fi
            ;;
            
        script|script_execution)
            log "  -> Executing script"
            local script_file="/tmp/wisptools-cmd-$cmd_id.sh"
            
            if [ -n "$script_content" ]; then
                log "  -> Script provided as content (${#script_content} chars)"
                echo "$script_content" > "$script_file" 2>&1 || {
                    result_success=false
                    result_error="Failed to write script file"
                    exit_code=1
                    log "ERROR: Failed to write script to $script_file"
                }
            elif [ -n "$script_url" ]; then
                log "  -> Downloading script from $script_url"
                if ! curl -fsSL "$script_url" -o "$script_file" 2>&1; then
                    result_success=false
                    result_error="Failed to download script from $script_url"
                    exit_code=1
                    log "ERROR: Failed to download script: $result_error"
                else
                    log "  -> Script downloaded successfully ($(stat -c%s "$script_file" 2>/dev/null || echo 0) bytes)"
                fi
            else
                result_success=false
                result_error="No script content or URL provided"
                exit_code=1
                log "ERROR: No script content or URL in command"
            fi
            
            if [ "$result_success" = true ] && [ -f "$script_file" ]; then
                chmod +x "$script_file" 2>&1 || log "WARNING: Failed to chmod script file"
                
                # Log script first few lines for debugging
                log "  -> Script preview: $(head -3 "$script_file" | tr '\n' '; ')"
                
                # Capture both stdout and stderr
                log "  -> Running script..."
                if output=$("$script_file" 2>&1); then
                    result_output="$output"
                    log "  -> Script executed successfully"
                    log "  -> Output: $(echo "$output" | head -5 | tr '\n' '; ')"
                else
                    exit_code=$?
                    result_success=false
                    result_error="$output"
                    log "ERROR: Script execution failed with exit code $exit_code"
                    log "ERROR: Script output: $(echo "$output" | head -10 | tr '\n' '; ')"
                fi
                rm -f "$script_file"
            elif [ "$result_success" = false ]; then
                log "ERROR: Script file not created or command already failed"
            fi
            ;;
            
        config_update)
            log "  -> Applying configuration update"
            
            # Extract config_data from command JSON file
            local config_data=""
            if [ -n "$cmd_json_file" ] && [ -f "$cmd_json_file" ]; then
                # First check if config_data exists in the JSON
                local has_config_data=$(cat "$cmd_json_file" | jq -r 'if .config_data != null then "yes" else "no" end' 2>/dev/null || echo "no")
                log "  -> Command JSON file found. Has config_data: $has_config_data"
                
                if [ "$has_config_data" = "yes" ]; then
                    config_data=$(cat "$cmd_json_file" | jq -c '.config_data' 2>/dev/null)
                    local config_size=${#config_data}
                    log "  -> Extracted config_data (${config_size} chars): ${config_data:0:200}..."
                    
                    # Validate it's valid JSON
                    if ! echo "$config_data" | jq . >/dev/null 2>&1; then
                        log "ERROR: Extracted config_data is not valid JSON"
                        config_data=""
                    fi
                else
                    log "ERROR: Command JSON does not contain config_data field"
                    log "Command JSON keys: $(cat "$cmd_json_file" | jq -r 'keys | join(", ")' 2>/dev/null || echo "unknown")"
                    log "Full command JSON: $(cat "$cmd_json_file" 2>/dev/null | head -c 500)"
                fi
            else
                log "ERROR: Command JSON file not found: ${cmd_json_file:-none}"
            fi
            
            if [ -z "$config_data" ] || [ "$config_data" = "null" ] || [ "$config_data" = "{}" ]; then
                result_success=false
                result_error="No config_data provided in command"
                log "ERROR: Config data is empty or invalid after extraction"
                exit_code=1
            else
                # Store configuration for later use
                local config_file="/etc/wisptools/epc-config.json"
                echo "$config_data" > "$config_file" 2>/dev/null || {
                    result_success=false
                    result_error="Failed to write config file"
                    exit_code=1
                }
                
                if [ "$result_success" = true ]; then
                    # Extract key config values
                    local site_name=$(echo "$config_data" | jq -r '.site_name // empty')
                    local site_id=$(echo "$config_data" | jq -r '.site_id // empty')
                    
                    # Update registration.json if it exists
                    local reg_file="/etc/wisptools/registration.json"
                    if [ -f "$reg_file" ]; then
                        local reg_data=$(cat "$reg_file" 2>/dev/null || echo "{}")
                        reg_data=$(echo "$reg_data" | jq --arg site_name "$site_name" --arg site_id "$site_id" \
                            '.config.site_name = $site_name | .config.site_id = $site_id')
                        echo "$reg_data" > "$reg_file" 2>/dev/null || true
                    fi
                    
                    result_output="Configuration updated successfully"
                    if [ -n "$site_name" ]; then
                        result_output+="\nSite: $site_name"
                    fi
                    if [ -n "$site_id" ]; then
                        result_output+="\nSite ID: $site_id"
                    fi
                    
                    log "Configuration update applied - Site: ${site_name:-N/A}, Site ID: ${site_id:-N/A}"
                fi
            fi
            
            # Clean up command JSON file
            [ -n "$cmd_json_file" ] && [ -f "$cmd_json_file" ] && rm -f "$cmd_json_file"
            ;;
            
        *)
            result_success=false
            result_error="Unknown command type: $cmd_type"
            exit_code=1
            ;;
    esac
    
    # Report result
    report_command_result "$cmd_id" "$result_success" "$result_output" "$result_error" "$exit_code"
}

# Ping a single device and return result
ping_device() {
    local ip=$1
    local timeout=2
    
    # Skip our own IP
    local our_ip=$(hostname -I | awk '{print $1}')
    if [ "$ip" = "$our_ip" ]; then
        return 1
    fi
    
    # Use ping with timeout
    local start_time=$(date +%s%3N 2>/dev/null || date +%s)
    if ping -c 1 -W "$timeout" "$ip" >/dev/null 2>&1; then
        local end_time=$(date +%s%3N 2>/dev/null || date +%s)
        local response_time=$((end_time - start_time))
        
        # Try to extract actual response time from ping output
        local ping_output=$(ping -c 1 -W "$timeout" "$ip" 2>&1)
        local time_match=$(echo "$ping_output" | grep -oP 'time=\K[\d.]+' | head -1)
        
        if [ -n "$time_match" ]; then
            echo "{\"success\":true,\"response_time_ms\":${time_match},\"error\":null}"
        else
            echo "{\"success\":true,\"response_time_ms\":${response_time},\"error\":null}"
        fi
        return 0
    else
        echo "{\"success\":false,\"response_time_ms\":null,\"error\":\"No reply received\"}"
        return 1
    fi
}

# Get list of devices to monitor from backend
get_monitoring_devices() {
    local device_code=$1
    
    if [ -z "$device_code" ]; then
        echo "[]"
        return 1
    fi
    
    local response=$(curl -s --max-time 30 --connect-timeout 10 "${API_URL}/checkin/monitoring-devices?device_code=${device_code}")
    
    if [ $? -eq 0 ] && echo "$response" | jq . >/dev/null 2>&1; then
        local devices=$(echo "$response" | jq -c '.devices // []')
        echo "$devices"
        return 0
    else
        echo "[]"
        return 1
    fi
}

# Perform ping monitoring for all devices
perform_ping_monitoring() {
    local device_code=$(get_device_code)
    
    if [ -z "$device_code" ]; then
        log "ERROR: No device code for ping monitoring"
        return 1
    fi
    
    log "Starting ping monitoring..."
    
    # Get list of devices to monitor
    local devices_json=$(get_monitoring_devices "$device_code")
    
    if [ -z "$devices_json" ] || [ "$devices_json" = "[]" ]; then
        log "No devices to monitor for ping"
        return 0
    fi
    
    local device_count=$(echo "$devices_json" | jq '. | length')
    log "Found $device_count device(s) to monitor"
    
    # Build ping metrics using jq - process all devices and build array
    local metrics_file=$(mktemp /tmp/ping-metrics-XXXXXX.json)
    
    # Start with empty array
    echo "[]" > "$metrics_file"
    
    # Process devices and add metrics
    local device_index=0
    while [ $device_index -lt $device_count ]; do
        local device=$(echo "$devices_json" | jq -c ".[$device_index]")
        local device_id=$(echo "$device" | jq -r '.device_id // empty')
        local ip_address=$(echo "$device" | jq -r '.ip_address // empty')
        
        if [ -n "$device_id" ] && [ -n "$ip_address" ]; then
            log "Pinging $ip_address ($device_id)..."
            
            # Ping the device
            local ping_result=$(ping_device "$ip_address")
            
            if [ -n "$ping_result" ]; then
                local success=$(echo "$ping_result" | jq -r '.success // false')
                local response_time=$(echo "$ping_result" | jq -r '.response_time_ms // null')
                local error=$(echo "$ping_result" | jq -r '.error // null')
                
                # Build metric JSON
                local metric=$(jq -n \
                    --arg device_id "$device_id" \
                    --arg ip_address "$ip_address" \
                    --argjson success "$success" \
                    --argjson response_time "$response_time" \
                    --arg error "${error:-null}" \
                    '{
                        device_id: $device_id,
                        ip_address: $ip_address,
                        success: $success,
                        response_time_ms: $response_time,
                        error: (if $error == "null" then null else $error end)
                    }' 2>/dev/null)
                
                if [ -n "$metric" ]; then
                    # Add metric to array in file
                    local current=$(cat "$metrics_file")
                    echo "$current" | jq --argjson new "$metric" '. + [$new]' > "$metrics_file"
                fi
            fi
        fi
        
        device_index=$((device_index + 1))
    done
    
    local ping_metrics=$(cat "$metrics_file")
    rm -f "$metrics_file"
    
    # Send ping metrics to backend
    local metric_count=$(echo "$ping_metrics" | jq '. | length')
    if [ "$metric_count" -gt 0 ]; then
        log "Sending $metric_count ping metric(s) to backend..."
        
        local payload=$(jq -n \
            --arg device_code "$device_code" \
            --argjson ping_metrics "$ping_metrics" \
            '{
                device_code: $device_code,
                ping_metrics: $ping_metrics
            }' 2>/dev/null)
        
        if [ -z "$payload" ] || [ "$payload" = "null" ]; then
            log "ERROR: Failed to build ping metrics payload"
            return 1
        fi
        
        local http_code=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/ping-metrics" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: $device_code" \
            -d "$payload" \
            --max-time 30 \
            --connect-timeout 10 \
            2>&1 | tail -1)
        
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            log "Ping metrics sent successfully (HTTP $http_code)"
        else
            log "WARNING: Failed to send ping metrics (HTTP $http_code)"
        fi
    else
        log "No ping metrics collected"
    fi
}

# Report command result back to server
report_command_result() {
    local cmd_id=$1
    local success=$2
    local output=$3
    local error=$4
    local exit_code=$5
    
    local device_code=$(get_device_code)
    
    # Escape strings for JSON
    output=$(echo "$output" | sed 's/"/\\"/g' | tr '\n' ' ')
    error=$(echo "$error" | sed 's/"/\\"/g' | tr '\n' ' ')
    
    curl -s -X POST "${API_URL}/checkin/commands/${cmd_id}/result" \
        -H "Content-Type: application/json" \
        -H "X-Device-Code: $device_code" \
        -d "{
            \"success\": $success,
            \"output\": \"$output\",
            \"error\": \"$error\",
            \"exit_code\": $exit_code
        }" \
        --max-time 30 \
        --connect-timeout 10 \
        >/dev/null 2>&1
    
    log "Command $cmd_id result reported: success=$success"
}

# Main check-in function
do_checkin() {
    local device_code=$(get_device_code)
    local hardware_id=$(get_hardware_id)
    local ip_address=$(get_ip_address)
    
    if [ -z "$device_code" ]; then
        log "ERROR: No device code found"
        return 1
    fi
    
    log "Checking in as $device_code from $ip_address"
    
    # Collect service status - build JSON manually
    local services_json="{"
    local first=true
    for svc in $REQUIRED_SERVICES; do
        local status=$(get_service_status "$svc")
        if [ "$first" = true ]; then
            first=false
        else
            services_json="$services_json,"
        fi
        services_json="$services_json\"$svc\":$status"
    done
    services_json="$services_json}"
    
    # Collect system metrics
    local system_json=$(get_system_metrics)
    local network_json=$(get_network_info)
    local versions_json=$(get_versions)
    
    # Collect recent logs (last 50 lines from check-in log, max 5000 chars)
    # Sanitize control characters before building JSON
    local logs_json="[]"
    if [ -f "$LOG_FILE" ] && command -v jq >/dev/null 2>&1; then
        local recent_logs=$(tail -n 50 "$LOG_FILE" 2>/dev/null | head -c 5000 | tr -d '\000-\010\013-\037' || echo "")
        if [ -n "$recent_logs" ]; then
            logs_json=$(echo "$recent_logs" | jq -Rs '[split("\n") | map(select(length > 0)) | .[] | {
                "source": "checkin-agent",
                "level": "info",
                "message": .
            }]' 2>/dev/null || echo "[]")
        fi
    fi
    
    # Build check-in payload using jq to ensure proper JSON escaping
    local payload
    if command -v jq >/dev/null 2>&1; then
        payload=$(jq -n \
            --arg device_code "$device_code" \
            --arg hardware_id "$hardware_id" \
            --arg ip_address "$ip_address" \
            --argjson services "$services_json" \
            --argjson system "$system_json" \
            --argjson network "$network_json" \
            --argjson versions "$versions_json" \
            --argjson logs "$logs_json" \
            '{
                device_code: $device_code,
                hardware_id: $hardware_id,
                ip_address: $ip_address,
                services: $services,
                system: $system,
                network: $network,
                versions: $versions,
                logs: $logs
            }' 2>/dev/null)
        
        # Fallback to manual construction if jq fails
        if [ -z "$payload" ] || [ "$payload" = "null" ]; then
            payload="{\"device_code\":\"$device_code\",\"hardware_id\":\"$hardware_id\",\"ip_address\":\"$ip_address\",\"services\":$services_json,\"system\":$system_json,\"network\":$network_json,\"versions\":$versions_json,\"logs\":$logs_json}"
        fi
    else
        # Manual construction without logs if jq not available
        payload="{\"device_code\":\"$device_code\",\"hardware_id\":\"$hardware_id\",\"ip_address\":\"$ip_address\",\"services\":$services_json,\"system\":$system_json,\"network\":$network_json,\"versions\":$versions_json,\"logs\":[]}"
    fi
    
    # Send check-in with HTTP status code capture
    local http_code=0
    local response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin" \
        -H "Content-Type: application/json" \
        -H "X-Device-Code: $device_code" \
        -d "$payload" \
        --max-time 30 \
        --connect-timeout 10 \
        2>&1)
    
    local curl_exit_code=$?
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')  # Remove last line (HTTP code)
    
    # Check for curl errors (exit code != 0) or HTTP 000 (connection failed)
    if [ $curl_exit_code -ne 0 ] || [ "$http_code" = "000" ]; then
        log "ERROR: Check-in failed - connection error (curl exit: $curl_exit_code, HTTP: $http_code)"
        if [ -n "$response" ]; then
            log "Error details: $(echo "$response" | head -c 200)"
        fi
        return 1
    fi
    
    # Only check for HTML on error status codes (4xx, 5xx)
    # Don't check for HTML on successful responses (2xx) as they should be JSON
    if [ "$http_code" -ge 400 ]; then
        # Check if response starts with HTML document structure
        if echo "$response" | head -c 100 | grep -qiE "^[[:space:]]*<(!DOCTYPE|html|head|body)"; then
            log "ERROR: Check-in failed - Backend returned HTML error page (HTTP $http_code)"
            log "Response preview: $(echo "$response" | head -c 200)"
            return 1
        fi
        
        # Also check for nginx error pages by looking for specific HTML structure
        if echo "$response" | grep -qi "<center><h1>.*Bad Gateway\|<title>.*Bad Gateway"; then
            log "ERROR: Check-in failed - Backend returned HTML error page (HTTP $http_code)"
            log "Response preview: $(echo "$response" | head -c 200)"
            return 1
        fi
    fi
    
    # Validate JSON response before parsing
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        log "ERROR: Check-in failed - Invalid JSON response (HTTP $http_code)"
        log "Response preview: $(echo "$response" | head -c 200)"
        return 1
    fi
    
    # Parse response
    local status=$(echo "$response" | jq -r '.status // "error"')
    
    if [ "$status" = "ok" ]; then
        local epc_id=$(echo "$response" | jq -r '.epc_id')
        local tenant_id=$(echo "$response" | jq -r '.tenant_id // empty')
        local cmd_count=$(echo "$response" | jq -r '.commands | length')
        
        log "Check-in successful. EPC: $epc_id, Commands: $cmd_count"
        
        # Cache tenant_id for SNMP discovery script
        if [ -n "$tenant_id" ] && [ "$tenant_id" != "null" ]; then
            echo "$tenant_id" > /tmp/epc-tenant-id 2>/dev/null || true
        fi
        
        # Update check-in interval if provided
        local new_interval=$(echo "$response" | jq -r '.checkin_interval // empty')
        if [ -n "$new_interval" ] && [ "$new_interval" != "null" ]; then
            CHECKIN_INTERVAL=$new_interval
        fi
        
        # Check for configuration changes
        local received_config=$(echo "$response" | jq -c '.config // {}')
        local stored_config_file="/etc/wisptools/last-config.json"
        
        if [ -n "$received_config" ] && [ "$received_config" != "null" ] && [ "$received_config" != "{}" ]; then
            local config_changed=false
            local stored_config="{}"
            
            if [ -f "$stored_config_file" ]; then
                stored_config=$(cat "$stored_config_file" 2>/dev/null || echo "{}")
            fi
            
            # Compare configs (simple string comparison for now)
            local received_hash=$(echo "$received_config" | md5sum | awk '{print $1}')
            local stored_hash=$(echo "$stored_config" | md5sum | awk '{print $1}')
            
            if [ "$received_hash" != "$stored_hash" ]; then
                config_changed=true
                log "Configuration changed detected - updating stored configuration"
                
                # Store new config
                echo "$received_config" > "$stored_config_file" 2>/dev/null || true
                
                # Log config details
                local site_name=$(echo "$received_config" | jq -r '.site_name // "unknown"')
                log "New site_name: $site_name"
            fi
        fi
        
        # Run SNMP discovery every hour (separate from regular check-in)
        # Prefer Node.js version, fallback to bash script
        local last_discovery_file="/tmp/last-snmp-discovery"
        local should_discover=true
        if [ -f "$last_discovery_file" ]; then
            local last_discovery=$(cat "$last_discovery_file" 2>/dev/null || echo "0")
            local now=$(date +%s)
            local elapsed=$((now - last_discovery))
            if [ $elapsed -lt 3600 ]; then
                should_discover=false
            fi
        fi
        
        if [ "$should_discover" = true ]; then
            log "Starting SNMP discovery in background..."
            
            # Try Node.js version first, fallback to bash script
            if command -v node >/dev/null 2>&1 && [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
                node /opt/wisptools/epc-snmp-discovery.js >> "$LOG_FILE" 2>&1 &
            elif [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
                /opt/wisptools/epc-snmp-discovery.sh >> "$LOG_FILE" 2>&1 &
            else
                log "WARNING: SNMP discovery script not found"
            fi
            
            echo "$(date +%s)" > "$last_discovery_file"
        fi
        
        # Run ping monitoring every 5 minutes (separate from regular check-in)
        local last_ping_file="/tmp/last-ping-monitoring"
        local should_ping=true
        if [ -f "$last_ping_file" ]; then
            local last_ping=$(cat "$last_ping_file" 2>/dev/null || echo "0")
            local now=$(date +%s)
            local elapsed=$((now - last_ping))
            if [ $elapsed -lt 300 ]; then
                should_ping=false
            fi
        fi
        
        if [ "$should_ping" = true ]; then
            log "Starting ping monitoring in background..."
            perform_ping_monitoring >> "$LOG_FILE" 2>&1 &
            echo "$(date +%s)" > "$last_ping_file"
        fi
        
        # Execute commands
        if [ "$cmd_count" -gt 0 ]; then
            echo "$response" | jq -c '.commands[]' | while read -r cmd; do
                local cmd_id=$(echo "$cmd" | jq -r '.id')
                local cmd_type=$(echo "$cmd" | jq -r '.type')
                local action=$(echo "$cmd" | jq -r '.action // empty')
                local target_services=$(echo "$cmd" | jq -r '.target_services | join(" ") // "all"')
                local script_content=$(echo "$cmd" | jq -r '.script_content // empty')
                local script_url=$(echo "$cmd" | jq -r '.script_url // empty')
                
                # For config_update, pass the full command JSON so we can extract config_data properly
                local cmd_json_file="/tmp/wisptools-cmd-$cmd_id.json"
                echo "$cmd" > "$cmd_json_file"
                
                # Log command details for debugging
                log "Command details - ID: $cmd_id, Type: $cmd_type, Has config_data: $(echo "$cmd" | jq -r 'if .config_data then "yes" else "no" end')"
                
                execute_command "$cmd_id" "$cmd_type" "$action" "$target_services" "$script_content" "$script_url" "$cmd_json_file"
            done
        fi
        
    elif [ "$status" = "unregistered" ]; then
        log "Device not registered. Enter code $device_code in the management portal."
    else
        # Extract error message from response if available
        local error_msg=$(echo "$response" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Unknown error")
        log "ERROR: Check-in failed (HTTP $http_code) - $error_msg"
        log "Full response: $(echo "$response" | head -c 500)"
        return 1
    fi
}

# Install the agent
install_agent() {
    echo "======================================"
    echo "Installing WISPTools Check-in Agent"
    echo "======================================"
    
    # Create directories
    mkdir -p /opt/wisptools
    mkdir -p "$CONFIG_DIR"
    
    # Download the script (handles piped install)
    echo "Downloading check-in agent..."
    curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o /opt/wisptools/epc-checkin-agent.sh
    chmod +x /opt/wisptools/epc-checkin-agent.sh
    
    # Download SNMP discovery scripts (Node.js preferred, bash as fallback)
    echo "Downloading SNMP discovery scripts..."
    
    # Node.js version
    curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-snmp-discovery.js" -o /opt/wisptools/epc-snmp-discovery.js 2>/dev/null || true
    if [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
        chmod +x /opt/wisptools/epc-snmp-discovery.js
        echo "Node.js SNMP discovery script downloaded"
        
        # Install npm packages if Node.js is available
        if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
            echo "Installing npm packages for SNMP discovery..."
            cd /opt/wisptools
            npm init -y >/dev/null 2>&1 || true
            npm install --no-save ping-scanner net-snmp >/dev/null 2>&1 || echo "Warning: Failed to install npm packages, will use fallback methods"
        fi
    fi
    
    # Bash version (fallback)
    curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-snmp-discovery.sh" -o /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
    if [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
        chmod +x /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
        echo "Bash SNMP discovery script downloaded (fallback)"
    fi
    
    # Create systemd service
    cat > /etc/systemd/system/wisptools-checkin.service << 'SVCEOF'
[Unit]
Description=WISPTools EPC Check-in Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/wisptools/epc-checkin-agent.sh daemon
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
SVCEOF
    
    systemctl daemon-reload
    systemctl enable wisptools-checkin
    systemctl start wisptools-checkin
    
    echo ""
    echo "Agent installed and started!"
    echo "Check status: systemctl status wisptools-checkin"
    echo "View logs: tail -f $LOG_FILE"
}

# Daemon mode - continuous check-in loop
daemon_mode() {
    log "Starting check-in daemon (interval: ${CHECKIN_INTERVAL}s)"
    
    while true; do
        do_checkin
        sleep "$CHECKIN_INTERVAL"
    done
}

# Main
case "$1" in
    install)
        install_agent
        ;;
    daemon)
        daemon_mode
        ;;
    once)
        do_checkin
        ;;
    *)
        # Default: run once
        do_checkin
        ;;
esac

