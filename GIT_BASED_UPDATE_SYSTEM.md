# Git-Based Update System for Remote Agents

## Overview

Remote EPC agents now use **git-based updates** instead of downloading scripts from the server. This provides:
- ✅ Version control and tracking
- ✅ Atomic updates (all scripts updated together)
- ✅ Easy rollback capability
- ✅ Consistent codebase across all agents
- ✅ Support for apt package updates

## Architecture

### Agent Setup

When an agent is installed, it:
1. **Installs git** (if not present)
2. **Clones the repository** to `/opt/wisptools/repo`
3. **Copies scripts** from the repository to `/opt/wisptools/`
4. **Falls back to curl download** if git fails

### Update Process

When updates are needed:
1. **Backend detects** script hash mismatches
2. **Generates git pull command** instead of curl download
3. **Agent executes** `git pull` to update repository
4. **Copies updated scripts** from repo to `/opt/wisptools/`
5. **Optionally updates apt packages** if specified
6. **Restarts services** as needed

## Configuration

### Git Repository Settings

Defined in `epc-checkin-agent.sh`:
```bash
GIT_REPO_URL="https://github.com/theorem6/lte-pci-mapper.git"
GIT_REPO_BRANCH="main"
GIT_REPO_DIR="/opt/wisptools/repo"
SCRIPTS_SOURCE_DIR="${GIT_REPO_DIR}/backend-services/scripts"
```

### Update Command Structure

The `generateUpdateCommand()` function now creates:
- **Git pull commands** to update repository
- **File copy commands** to update scripts from repo
- **Apt update commands** for system packages (optional)

## Benefits

1. **Single Source of Truth**: All agents pull from the same git repository
2. **Version Tracking**: Easy to see what version each agent is running
3. **Rollback Support**: Can checkout specific commits if needed
4. **Atomic Updates**: All scripts updated together, reducing inconsistencies
5. **Package Management**: Can update system packages via apt alongside code

## Fallback Mechanism

If git fails (network issues, auth problems, etc.):
- Agent falls back to curl download from server
- Ensures updates can still happen even if git is unavailable

## Future Enhancements

- **Branch Selection**: Allow agents to use different branches (dev, staging, production)
- **Commit Pinning**: Update to specific commits instead of latest
- **Apt Package Lists**: Configure which packages to update via apt
- **Update Scheduling**: Schedule updates at specific times

---

**Status**: ✅ Implemented and committed to git  
**Date**: 2025-12-06
