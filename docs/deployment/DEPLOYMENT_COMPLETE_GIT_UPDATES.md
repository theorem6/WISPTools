# Git-Based Update System - Deployment Complete

## ✅ Deployment Status

### Existing Agent (10.0.25.134)
- ✅ Git installed
- ✅ Repository cloned to `/opt/wisptools/repo`
- ✅ Agent script updated with git-based code
- ✅ Service restarted

### Future Agents
- ✅ `install_agent()` function includes git setup
- ✅ `setup-epc-device.sh` updated to use git
- ✅ `build-live-iso.sh` updated to use git
- ✅ Downloads directory has updated script for initial installs

## How It Works

### For New Agents

When a new agent is installed (via `install` command or deployment scripts):

1. **Git Installation**: Automatically installs git if not present
2. **Repository Clone**: Clones `https://github.com/theorem6/lte-pci-mapper.git` to `/opt/wisptools/repo`
3. **Script Installation**: Copies scripts from repository to `/opt/wisptools/`
4. **Fallback**: If git fails, falls back to curl download

### For Updates

When backend detects script updates needed:

1. **Backend generates git pull command** (instead of curl download)
2. **Agent executes**: `git pull` to update repository
3. **Scripts copied**: From repo to `/opt/wisptools/`
4. **Apt updates**: Optional system package updates
5. **Service restart**: Automatic restart of check-in service

## Verification

**On existing agent:**
```bash
# Check git is installed
command -v git

# Check repository exists
ls -la /opt/wisptools/repo/backend-services/scripts/

# Check agent has git config
grep GIT_REPO /opt/wisptools/epc-checkin-agent.sh
```

**For new agents:**
The `install_agent()` function will automatically:
- Install git
- Clone repository
- Copy scripts
- Set up systemd service

## Benefits

1. **Consistent Codebase**: All agents use same git repository
2. **Version Control**: Easy to track what version each agent runs
3. **Atomic Updates**: All scripts updated together
4. **Rollback Support**: Can checkout specific commits
5. **Package Management**: Can update apt packages alongside code

---

**Status**: ✅ Deployed and ready  
**Date**: 2025-12-06
