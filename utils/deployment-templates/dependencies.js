/**
 * Generate dependency installation section
 */
function generateDependencyInstallation() {
  return `print_header "Installing Dependencies"
print_status "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

print_status "Installing essential build tools and dependencies..."
# Install all required packages for EPC deployment - explicitly exclude GUI dependencies
# Using --no-install-recommends to prevent pulling in GUI packages
apt-get install -y --no-install-recommends \\
    wget curl gnupg software-properties-common apt-transport-https ca-certificates \\
    build-essential git make gcc g++ autoconf automake libtool pkg-config \\
    cmake flex bison \\
    libssl-dev libpcre3-dev zlib1g-dev libncurses5-dev libreadline-dev \\
    libyaml-dev libffi-dev python3 python3-pip \\
    systemd networkd-dispatcher net-tools iproute2 iputils-ping \\
    dbus dbus-user-session \\
    logrotate rsyslog cron \\
    vim nano less \\
    jq \\
    bash-completion || print_warning "Some packages may have failed (continuing...)"

print_header "Installing Node.js"
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js \$(node --version) installed"
else
    print_success "Node.js \$(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat htop
`;
}

module.exports = { generateDependencyInstallation };

