#!/bin/bash

###############################################################################
# Open5GS Fork Script for Distributed EPC
# Creates theorem6/open5gs-distributed from official Open5GS repository
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOURCE_REPO="https://github.com/open5gs/open5gs.git"
TARGET_REPO="https://github.com/theorem6/open5gs-distributed.git"
WORK_DIR="/tmp/open5gs-fork"
BACKUP_DIR="/tmp/open5gs-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}🚀 Open5GS Distributed EPC Fork Script${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "docs/distributed-epc/OPEN5GS_FORK_MODIFICATIONS.md" ]; then
    echo -e "${RED}❌ Please run this script from the PCI_mapper root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Fork Configuration:${NC}"
echo "  Source: $SOURCE_REPO"
echo "  Target: $TARGET_REPO"
echo "  Work Dir: $WORK_DIR"
echo "  Backup Dir: $BACKUP_DIR"
echo ""

# Create work directory
echo -e "${BLUE}📁 Creating work directory...${NC}"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Clone the source repository
echo -e "${BLUE}📥 Cloning Open5GS repository...${NC}"
git clone --depth 1 "$SOURCE_REPO" open5gs-distributed
cd open5gs-distributed

# Create backup of original
echo -e "${BLUE}💾 Creating backup...${NC}"
cp -r . "$BACKUP_DIR"

# Update repository information
echo -e "${BLUE}📝 Updating repository information...${NC}"

# Update README.md
cat > README.md << 'EOF'
# Open5GS Distributed EPC

This is a fork of [Open5GS](https://github.com/open5gs/open5gs) enhanced for distributed EPC deployments with cloud HSS integration.

## Features

- **Cloud HSS Integration**: Connect to remote cloud-based HSS servers
- **Metrics Collection**: Real-time metrics reporting to cloud APIs
- **Multi-Tenant Support**: Isolated configurations per tenant
- **Distributed Architecture**: Support for geographically distributed EPC sites
- **Enhanced Monitoring**: Advanced monitoring and alerting capabilities

## Quick Start

### Prerequisites

- Ubuntu 20.04 LTS or later
- MongoDB (or MongoDB Atlas connection)
- Node.js 18+ (for metrics agent)

### Installation

```bash
# Clone this repository
git clone https://github.com/theorem6/open5gs-distributed.git
cd open5gs-distributed

# Install dependencies
sudo apt update
sudo apt install -y python3-pip python3-setuptools python3-wheel ninja-build \
    build-essential flex bison git pkg-config libtalloc-dev libpcsclite-dev \
    libsctp-dev libssl-dev libidn11-dev libmongoc-dev libbson-dev \
    libyaml-dev libmicrohttpd-dev libcurl4-openssl-dev \
    libnghttp2-dev libtins-dev libtalloc-dev

# Build and install
autoreconf -iv
./configure --prefix=/usr/local --sysconfdir=/etc/local --localstatedir=/var
make -j `nproc`
sudo make install
```

### Configuration

See the [Distributed EPC Configuration Guide](docs/DISTRIBUTED_EPC_CONFIG.md) for detailed setup instructions.

### Deployment

Use the included deployment script for remote EPC sites:

```bash
./scripts/install-distributed-epc.sh
```

## Documentation

- [Distributed EPC Overview](docs/DISTRIBUTED_EPC_OVERVIEW.md)
- [Configuration Guide](docs/DISTRIBUTED_EPC_CONFIG.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Original Open5GS

This project is based on the excellent [Open5GS](https://github.com/open5gs/open5gs) project by [Sukchan Lee](https://github.com/herlesupreeth).

## License

This project is licensed under the same license as Open5GS (GPL-2.0).
EOF

# Create docs directory and copy our documentation
echo -e "${BLUE}📚 Setting up documentation...${NC}"
mkdir -p docs/distributed-epc
cp "$OLDPWD/docs/distributed-epc/"*.md docs/distributed-epc/ 2>/dev/null || true

# Create distributed EPC specific files
mkdir -p scripts/distributed-epc
cp "$OLDPWD/install-distributed-epc.sh" scripts/ 2>/dev/null || true
cp "$OLDPWD/open5gs-metrics-agent.js" scripts/distributed-epc/ 2>/dev/null || true
cp "$OLDPWD/open5gs-metrics-agent.service" scripts/distributed-epc/ 2>/dev/null || true

# Create CMakeLists.txt modifications
echo -e "${BLUE}🔧 Setting up build modifications...${NC}"

# Backup original CMakeLists.txt
cp CMakeLists.txt CMakeLists.txt.original

# Add distributed EPC options
cat >> CMakeLists.txt << 'EOF'

# Distributed EPC Options
option(ENABLE_DISTRIBUTED_EPC "Enable distributed EPC features" ON)
option(ENABLE_CLOUD_MODE "Enable cloud HSS mode" ON)
option(ENABLE_METRICS_COLLECTION "Enable metrics collection" ON)

if(ENABLE_DISTRIBUTED_EPC)
    add_definitions(-DENABLE_DISTRIBUTED_EPC)
    message(STATUS "Distributed EPC features enabled")
endif()

if(ENABLE_CLOUD_MODE)
    add_definitions(-DENABLE_CLOUD_MODE)
    message(STATUS "Cloud HSS mode enabled")
endif()

if(ENABLE_METRICS_COLLECTION)
    add_definitions(-DENABLE_METRICS_COLLECTION)
    message(STATUS "Metrics collection enabled")
endif()
EOF

# Create initial commit
echo -e "${BLUE}📝 Creating initial commit...${NC}"
git add .
git commit -m "Initial distributed EPC fork

- Add distributed EPC documentation
- Include deployment scripts and metrics agent
- Add build options for distributed features
- Update README with distributed EPC information

Based on Open5GS $(git log -1 --format='%h %s')"

# Set up remote for the new repository
echo -e "${BLUE}🔗 Setting up remote repository...${NC}"
git remote remove origin 2>/dev/null || true
git remote add origin "$TARGET_REPO"

# Create and push to main branch
echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
git branch -M main
git push -u origin main

# Create distributed-epc branch for development
echo -e "${BLUE}🌿 Creating development branch...${NC}"
git checkout -b distributed-epc
git push -u origin distributed-epc

# Switch back to main
git checkout main

echo ""
echo -e "${GREEN}✅ Open5GS fork created successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Visit: https://github.com/theorem6/open5gs-distributed"
echo "2. Review the documentation in docs/distributed-epc/"
echo "3. Start implementing modifications on the 'distributed-epc' branch"
echo "4. Use the deployment scripts in scripts/"
echo ""
echo -e "${YELLOW}📁 Backup Location:${NC} $BACKUP_DIR"
echo -e "${YELLOW}📁 Work Directory:${NC} $WORK_DIR"
echo ""
echo -e "${BLUE}🔧 To continue development:${NC}"
echo "cd $WORK_DIR/open5gs-distributed"
echo "git checkout distributed-epc"
echo ""

# Clean up
echo -e "${BLUE}🧹 Cleaning up...${NC}"
cd "$OLDPWD"

echo -e "${GREEN}🎉 Fork process completed successfully!${NC}"
