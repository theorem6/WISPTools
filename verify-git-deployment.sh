#!/bin/bash
# Verify git deployment on agent

OUTPUT_FILE="/tmp/git-deployment-status.txt"

{
    echo "=== Git Installation Check ==="
    if command -v git >/dev/null 2>&1; then
        echo "✅ Git installed: $(git --version)"
    else
        echo "❌ Git NOT installed"
    fi
    
    echo ""
    echo "=== Repository Check ==="
    if [ -d "/opt/wisptools/repo/.git" ]; then
        echo "✅ Repository exists"
        cd /opt/wisptools/repo
        echo "Latest commit: $(git log -1 --oneline 2>/dev/null || echo 'ERROR')"
    else
        echo "❌ Repository NOT found"
    fi
    
    echo ""
    echo "=== Scripts in Repository ==="
    if [ -d "/opt/wisptools/repo/backend-services/scripts" ]; then
        SCRIPT_COUNT=$(ls -1 /opt/wisptools/repo/backend-services/scripts/*.sh /opt/wisptools/repo/backend-services/scripts/*.js 2>/dev/null | wc -l)
        echo "Found $SCRIPT_COUNT scripts"
        ls -1 /opt/wisptools/repo/backend-services/scripts/*.sh /opt/wisptools/repo/backend-services/scripts/*.js 2>/dev/null | head -5
    else
        echo "❌ Scripts directory not found"
    fi
    
    echo ""
    echo "=== Agent Script Git Config ==="
    GIT_CONFIG_LINES=$(grep -c "GIT_REPO" /opt/wisptools/epc-checkin-agent.sh 2>/dev/null || echo "0")
    echo "Git config lines: $GIT_CONFIG_LINES"
    if [ "$GIT_CONFIG_LINES" -gt 0 ]; then
        echo "✅ Agent has git configuration"
        grep "GIT_REPO" /opt/wisptools/epc-checkin-agent.sh | head -4
    else
        echo "❌ Agent does NOT have git configuration"
    fi
    
    echo ""
    echo "=== Service Status ==="
    if systemctl is-active --quiet wisptools-checkin; then
        echo "✅ Service is active"
    else
        echo "❌ Service is NOT active"
    fi
} > "$OUTPUT_FILE" 2>&1

cat "$OUTPUT_FILE"
