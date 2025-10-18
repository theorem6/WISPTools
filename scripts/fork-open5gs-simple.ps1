# Simple Open5GS Fork Script
param(
    [string]$SourceRepo = "https://github.com/open5gs/open5gs.git",
    [string]$TargetRepo = "https://github.com/theorem6/open5gs-distributed.git"
)

$WorkDir = "C:\temp\open5gs-fork"

Write-Host "🚀 Open5GS Distributed EPC Fork Script" -ForegroundColor Blue
Write-Host "=======================================" -ForegroundColor Blue

# Check if git is available
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install git first." -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (!(Test-Path "docs\distributed-epc\OPEN5GS_FORK_MODIFICATIONS.md")) {
    Write-Host "❌ Please run this script from the PCI_mapper root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Fork Configuration:" -ForegroundColor Yellow
Write-Host "  Source: $SourceRepo"
Write-Host "  Target: $TargetRepo"
Write-Host "  Work Dir: $WorkDir"

# Create work directory
Write-Host "📁 Creating work directory..." -ForegroundColor Blue
if (Test-Path $WorkDir) {
    Remove-Item $WorkDir -Recurse -Force
}
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
Set-Location $WorkDir

# Clone the source repository
Write-Host "📥 Cloning Open5GS repository..." -ForegroundColor Blue
git clone --depth 1 $SourceRepo open5gs-distributed
Set-Location open5gs-distributed

# Update repository information
Write-Host "📝 Updating repository information..." -ForegroundColor Blue

# Create new README.md
$ReadmeContent = @"
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

``````bash
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
``````

### Configuration

See the [Distributed EPC Configuration Guide](docs/DISTRIBUTED_EPC_CONFIG.md) for detailed setup instructions.

### Deployment

Use the included deployment script for remote EPC sites:

``````bash
./scripts/install-distributed-epc.sh
``````

## Documentation

- [Distributed EPC Overview](docs/DISTRIBUTED_EPC_OVERVIEW.md)
- [Configuration Guide](docs/DISTRIBUTED_EPC_CONFIG.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Original Open5GS

This project is based on the excellent [Open5GS](https://github.com/open5gs/open5gs) project by [Sukchan Lee](https://github.com/herlesupreeth).

## License

This project is licensed under the same license as Open5GS (GPL-2.0).
"@

Set-Content -Path "README.md" -Value $ReadmeContent

# Create docs directory and copy our documentation
Write-Host "📚 Setting up documentation..." -ForegroundColor Blue
New-Item -ItemType Directory -Path "docs\distributed-epc" -Force | Out-Null

# Copy documentation files
$SourceDocs = "C:\Users\david\Downloads\PCI_mapper\docs\distributed-epc\*.md"
if (Test-Path $SourceDocs) {
    Copy-Item $SourceDocs "docs\distributed-epc\" -Force
}

# Create distributed EPC specific files
New-Item -ItemType Directory -Path "scripts\distributed-epc" -Force | Out-Null

# Copy scripts
$ScriptFiles = @(
    "install-distributed-epc.sh",
    "open5gs-metrics-agent.js",
    "open5gs-metrics-agent.service"
)

foreach ($file in $ScriptFiles) {
    $sourceFile = "C:\Users\david\Downloads\PCI_mapper\$file"
    if (Test-Path $sourceFile) {
        if ($file -eq "install-distributed-epc.sh") {
            Copy-Item $sourceFile "scripts\" -Force
        } else {
            Copy-Item $sourceFile "scripts\distributed-epc\" -Force
        }
    }
}

# Create CMakeLists.txt modifications
Write-Host "🔧 Setting up build modifications..." -ForegroundColor Blue

# Backup original CMakeLists.txt
Copy-Item "CMakeLists.txt" "CMakeLists.txt.original"

# Add distributed EPC options
$CmakeAddition = @"

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
"@

Add-Content -Path "CMakeLists.txt" -Value $CmakeAddition

# Create initial commit
Write-Host "📝 Creating initial commit..." -ForegroundColor Blue
git add .
git commit -m "Initial distributed EPC fork

- Add distributed EPC documentation
- Include deployment scripts and metrics agent
- Add build options for distributed features
- Update README with distributed EPC information"

# Set up remote for the new repository
Write-Host "🔗 Setting up remote repository..." -ForegroundColor Blue
git remote remove origin 2>$null
git remote add origin $TargetRepo

# Create and push to main branch
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Blue
git branch -M main
git push -u origin main

# Create distributed-epc branch for development
Write-Host "🌿 Creating development branch..." -ForegroundColor Blue
git checkout -b distributed-epc
git push -u origin distributed-epc

# Switch back to main
git checkout main

Write-Host ""
Write-Host "✅ Open5GS fork created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Visit: https://github.com/theorem6/open5gs-distributed"
Write-Host "2. Review the documentation in docs/distributed-epc/"
Write-Host "3. Start implementing modifications on the 'distributed-epc' branch"
Write-Host "4. Use the deployment scripts in scripts/"
Write-Host ""

# Return to original directory
Set-Location "C:\Users\david\Downloads\PCI_mapper"

Write-Host "🎉 Fork process completed successfully!" -ForegroundColor Green


