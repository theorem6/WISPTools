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

# Get service status
get_service_status() {
    local svc=$1
    local status
    local uptime_sec=0
    local memory_mb=0
    
    if ! systemctl list-unit-files | grep -q "^${svc}"; then
        echo '{"status":"not-found"}'
        return
    fi
    
    status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
    
    if [ "$status" = "active" ]; then
        # Get uptime
        local start_time=$(systemctl show "$svc" --property=ActiveEnterTimestamp --value 2>/dev/null)
        if [ -n "$start_time" ] && [ "$start_time" != "" ]; then
            local start_epoch=$(date -d "$start_time" +%s 2>/dev/null || echo 0)
            local now_epoch=$(date +%s)
            uptime_sec=$((now_epoch - start_epoch))
        fi
        
        # Get memory usage
        local pid=$(systemctl show "$svc" --property=MainPID --value 2>/dev/null)
        if [ -n "$pid" ] && [ "$pid" != "0" ]; then
            memory_mb=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.0f", $1/1024}' || echo 0)
        fi
    fi
    
    echo "{\"status\":\"$status\",\"uptime_seconds\":$uptime_sec,\"memory_mb\":$memory_mb}"
}

# Get system metrics - using jq for proper JSON
get_system_metrics() {
    local cpu_percent=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}' | cut -d. -f1 2>/dev/null || echo 0)
    local mem_total=$(free -m | awk 'NR==2{print $2}')
    local mem_used=$(free -m | awk 'NR==2{print $3}')
    local mem_percent=$((mem_used * 100 / mem_total))
    local disk_info=$(df -m / | awk 'NR==2{print $2" "$3" "$5}' | tr -d '%')
    local disk_total=$(echo "$disk_info" | awk '{printf "%.1f", $1/1024}')
    local disk_used=$(echo "$disk_info" | awk '{printf "%.1f", $2/1024}')
    local disk_percent=$(echo "$disk_info" | awk '{print $3}')
    local uptime_sec=$(awk '{print int($1)}' /proc/uptime)
    local load1=$(awk '{print $1}' /proc/loadavg)
    local load5=$(awk '{print $2}' /proc/loadavg)
    local load15=$(awk '{print $3}' /proc/loadavg)
    
    jq -n \
        --argjson uptime "$uptime_sec" \
        --argjson load1 "$load1" \
        --argjson load5 "$load5" \
        --argjson load15 "$load15" \
        --argjson cpu "$cpu_percent" \
        --argjson mem_pct "$mem_percent" \
        --argjson mem_total "$mem_total" \
        --argjson mem_used "$mem_used" \
        --argjson disk_pct "$disk_percent" \
        --argjson disk_total "$disk_total" \
        --argjson disk_used "$disk_used" \
        '{uptime_seconds: $uptime, load_average: [$load1, $load5, $load15], cpu_percent: $cpu, memory_percent: $mem_pct, memory_total_mb: $mem_total, memory_used_mb: $mem_used, disk_percent: $disk_pct, disk_total_gb: $disk_total, disk_used_gb: $disk_used}'
}

# Get network info - using jq for proper JSON
get_network_info() {
    local ip=$(get_ip_address)
    local interfaces=$(ip -j addr show 2>/dev/null | jq '[.[] | select(.ifname != "lo") | {name: .ifname, ip: ((.addr_info // [])[] | select(.family == "inet") | .local) // null, mac: .address, status: .operstate}]' 2>/dev/null || echo "[]")
    
    jq -n --arg ip "$ip" --argjson ifaces "$interfaces" '{ip_address: $ip, interfaces: $ifaces}'
}

# Get version info - using jq for proper JSON
get_versions() {
    local os_info=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d'"' -f2 || echo "Unknown")
    local kernel=$(uname -r)
    local open5gs_version=$(dpkg -l 2>/dev/null | grep open5gs-mme | awk '{print $3}' | head -1)
    [ -z "$open5gs_version" ] && open5gs_version="not installed"
    
    jq -n --arg os "$os_info" --arg kernel "$kernel" --arg o5gs "$open5gs_version" \
        '{os: $os, kernel: $kernel, open5gs: $o5gs}'
}

# Execute a command
execute_command() {
    local cmd_id=$1
    local cmd_type=$2
    local action=$3
    local target_services=$4
    local script_content=$5
    local script_url=$6
    
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
            
        script)
            log "  -> Executing script"
            local script_file="/tmp/wisptools-cmd-$cmd_id.sh"
            
            if [ -n "$script_content" ]; then
                echo "$script_content" > "$script_file"
            elif [ -n "$script_url" ]; then
                if ! curl -fsSL "$script_url" -o "$script_file" 2>&1; then
                    result_success=false
                    result_error="Failed to download script from $script_url"
                    exit_code=1
                fi
            else
                result_success=false
                result_error="No script content or URL provided"
                exit_code=1
            fi
            
            if [ "$result_success" = true ] && [ -f "$script_file" ]; then
                chmod +x "$script_file"
                if output=$("$script_file" 2>&1); then
                    result_output="$output"
                else
                    exit_code=$?
                    result_success=false
                    result_error="$output"
                fi
                rm -f "$script_file"
            fi
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
        }" >/dev/null 2>&1
    
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
    
    # Collect service status using jq
    local services_json="{}"
    for svc in $REQUIRED_SERVICES; do
        local status=$(get_service_status "$svc")
        services_json=$(echo "$services_json" | jq --arg svc "$svc" --argjson stat "$status" '. + {($svc): $stat}')
    done
    
    # Collect system metrics
    local system_json=$(get_system_metrics)
    local network_json=$(get_network_info)
    local versions_json=$(get_versions)
    
    # Build check-in payload using jq for proper escaping
    local payload=$(jq -n \
        --arg dc "$device_code" \
        --arg hw "$hardware_id" \
        --arg ip "$ip_address" \
        --argjson svcs "$services_json" \
        --argjson sys "$system_json" \
        --argjson net "$network_json" \
        --argjson ver "$versions_json" \
        '{device_code: $dc, hardware_id: $hw, ip_address: $ip, services: $svcs, system: $sys, network: $net, versions: $ver}'
    )
    
    # Send check-in
    local response=$(curl -s -X POST "${API_URL}/checkin" \
        -H "Content-Type: application/json" \
        -H "X-Device-Code: $device_code" \
        -d "$payload" 2>&1)
    
    if [ $? -ne 0 ]; then
        log "ERROR: Check-in failed - network error"
        return 1
    fi
    
    # Parse response
    local status=$(echo "$response" | jq -r '.status // "error"')
    
    if [ "$status" = "ok" ]; then
        local epc_id=$(echo "$response" | jq -r '.epc_id')
        local cmd_count=$(echo "$response" | jq -r '.commands | length')
        
        log "Check-in successful. EPC: $epc_id, Commands: $cmd_count"
        
        # Update check-in interval if provided
        local new_interval=$(echo "$response" | jq -r '.checkin_interval // empty')
        if [ -n "$new_interval" ] && [ "$new_interval" != "null" ]; then
            CHECKIN_INTERVAL=$new_interval
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
                
                execute_command "$cmd_id" "$cmd_type" "$action" "$target_services" "$script_content" "$script_url"
            done
        fi
        
    elif [ "$status" = "unregistered" ]; then
        log "Device not registered. Enter code $device_code in the management portal."
    else
        log "ERROR: Check-in failed - $response"
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

