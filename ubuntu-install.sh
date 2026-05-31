#!/bin/bash
#
# Sales Bot USA - Ubuntu Quick Install Script
# This script automates the setup of all dependencies on Ubuntu 20.04/22.04
#
# Usage: 
#   curl -fsSL https://your-url/ubuntu-install.sh | bash
#   or
#   chmod +x ubuntu-install.sh && ./ubuntu-install.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_ubuntu() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "ubuntu" ]]; then
            print_success "Running on Ubuntu $VERSION_ID"
            return 0
        fi
    fi
    print_error "This script is designed for Ubuntu. Your OS may not be supported."
    exit 1
}

# Main installation
main() {
    print_header "Sales Bot USA - Ubuntu Installation"
    
    echo "This script will install:"
    echo "  • Python 3.12"
    echo "  • Node.js 20.x LTS"
    echo "  • MongoDB 7.0"
    echo "  • Nginx web server"
    echo "  • Required system dependencies"
    echo ""
    
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    # Check OS
    check_ubuntu
    
    # Update system
    print_header "Updating System Packages"
    sudo apt update
    sudo apt upgrade -y
    print_success "System updated"
    
    # Install core dependencies
    print_header "Installing Core Dependencies"
    sudo apt install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        nginx \
        2>&1 | grep -v "^debconf"
    print_success "Core dependencies installed"
    
    # Install Python 3.12
    print_header "Installing Python 3.12"
    if ! command -v python3.12 &> /dev/null; then
        sudo add-apt-repository ppa:deadsnakes/ppa -y
        sudo apt update
        sudo apt install -y \
            python3.12 \
            python3.12-venv \
            python3.12-dev \
            python3-pip
        print_success "Python 3.12 installed"
    else
        print_success "Python 3.12 already installed"
    fi
    
    # Verify Python
    PYTHON_VERSION=$(python3.12 --version 2>&1)
    print_success "Python version: $PYTHON_VERSION"
    
    # Install Node.js
    print_header "Installing Node.js 20.x LTS"
    if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
        sudo apt install -y nodejs
        print_success "Node.js installed"
    else
        print_success "Node.js 20.x already installed"
    fi
    
    # Verify Node.js
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    print_success "Node.js version: $NODE_VERSION"
    print_success "npm version: $NPM_VERSION"
    
    # Install MongoDB
    print_header "Installing MongoDB 7.0"
    if ! command -v mongosh &> /dev/null; then
        # Import MongoDB GPG key
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor 2>/dev/null
        
        # Add MongoDB repository
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
            sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
        
        # Install MongoDB
        sudo apt update
        sudo apt install -y mongodb-org
        
        # Start MongoDB
        sudo systemctl start mongod
        sudo systemctl enable mongod
        
        print_success "MongoDB installed and started"
    else
        print_success "MongoDB already installed"
    fi
    
    # Verify MongoDB
    if sudo systemctl is-active --quiet mongod; then
        print_success "MongoDB is running"
    else
        print_warning "MongoDB is not running. Start it with: sudo systemctl start mongod"
    fi
    
    # Configure firewall
    print_header "Configuring Firewall (UFW)"
    if ! sudo ufw status | grep -q "Status: active"; then
        sudo ufw allow 22/tcp    # SSH
        sudo ufw allow 80/tcp    # HTTP
        sudo ufw allow 443/tcp   # HTTPS
        sudo ufw allow 8000/tcp  # Backend API
        echo "y" | sudo ufw enable >/dev/null 2>&1
        print_success "Firewall configured and enabled"
    else
        print_success "Firewall already configured"
    fi
    
    # Install optional tools
    print_header "Installing Optional Tools"
    sudo apt install -y htop iotop nethogs 2>&1 | grep -v "^debconf"
    print_success "Monitoring tools installed"
    
    # Summary
    print_header "Installation Complete!"
    
    echo -e "${GREEN}✓ All dependencies installed successfully!${NC}\n"
    
    echo "Installed versions:"
    echo "  • Python: $(python3.12 --version 2>&1)"
    echo "  • Node.js: $(node --version)"
    echo "  • npm: $(npm --version)"
    echo "  • MongoDB: $(mongod --version | head -n 1)"
    echo ""
    
    echo "Next steps:"
    echo "  1. Clone your repository:"
    echo "     git clone https://github.com/your-repo/receptionist-hub.git"
    echo ""
    echo "  2. Setup backend:"
    echo "     cd receptionist-hub/backend/reception_labs"
    echo "     python3.12 -m venv venv"
    echo "     source venv/bin/activate"
    echo "     pip install -r requirements.txt"
    echo "     pip install -e ."
    echo ""
    echo "  3. Setup frontend:"
    echo "     cd receptionist-hub/frontend"
    echo "     npm install"
    echo "     npm run build"
    echo ""
    echo "  4. Configure environment:"
    echo "     cp backend/reception_labs/.env.example backend/reception_labs/.env"
    echo "     nano backend/reception_labs/.env"
    echo ""
    echo "  5. Read the full setup guide:"
    echo "     cat UBUNTU_SETUP.md"
    echo ""
    
    print_success "Installation script completed!"
}

# Run main function
main "$@"
