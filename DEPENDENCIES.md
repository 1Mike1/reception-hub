# Ubuntu Dependencies Quick Reference

## 🎯 Core Requirements

### System Packages
```bash
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
    nginx
```

### Python 3.12+
```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip
```

### Node.js 20.x LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### MongoDB 7.0
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

---

## 📦 Python Dependencies (Backend)

From `requirements.txt`:

```
fastapi==0.104.1
uvicorn==0.24.0
httpx==0.25.0
pydantic==2.5.0
python-dotenv==1.0.0
stripe==7.0.0
pymongo==4.6.0
```

Install:
```bash
cd backend/reception_labs
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

---

## 📦 Node.js Dependencies (Frontend)

Key packages from `package.json`:

### Runtime Dependencies
- react ^18.3.1
- react-dom ^18.3.1
- react-router-dom ^6.30.1
- @tanstack/react-query ^5.83.0
- lucide-react ^0.462.0
- date-fns ^3.6.0
- zod ^3.25.76

### UI Components (@radix-ui)
- Multiple Radix UI components for dialogs, dropdowns, etc.

### Development Dependencies
- vite ^5.4.19
- typescript ^5.8.3
- tailwindcss ^3.4.17
- eslint ^9.32.0

Install:
```bash
cd frontend
npm install
# or
bun install
```

---

## 🔧 Build Tools Required

### For Python packages:
- `gcc` (C compiler)
- `python3-dev` (Python headers)
- `build-essential` (compilation tools)

### For Node.js native modules:
- `build-essential`
- `node-gyp` (installed via npm)

---

## 🔥 Firewall Configuration

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8000/tcp  # Backend API (optional)
sudo ufw enable
```

---

## 🌐 Nginx (Web Server)

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 🔒 SSL/TLS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 📊 Optional Monitoring Tools

```bash
sudo apt install -y \
    htop \
    iotop \
    nethogs \
    net-tools
```

---

## 🐳 Alternative: Docker Setup

If you prefer containerization:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose

# Run application
docker-compose up -d
```

---

## ✅ Verification Commands

```bash
# Check Python
python3.12 --version

# Check Node.js
node --version
npm --version

# Check MongoDB
mongosh --eval "db.runCommand({ connectionStatus: 1 })"

# Check Nginx
sudo systemctl status nginx

# Check ports
sudo netstat -tulpn | grep -E ':(80|443|8000)'
```

---

## 📝 Minimum Versions

- **OS**: Ubuntu 20.04 LTS or newer
- **Python**: 3.8+ (3.12+ recommended)
- **Node.js**: 18+ (20 LTS recommended)
- **MongoDB**: 5.0+ (7.0 recommended)
- **npm**: 9+
- **RAM**: 2GB minimum, 4GB+ recommended
- **Disk**: 10GB+ free space

---

## 🚀 Quick Install Script

```bash
# Download and run automated setup
curl -fsSL https://raw.githubusercontent.com/your-repo/ubuntu-install.sh | bash

# Or manually
chmod +x ubuntu-install.sh
./ubuntu-install.sh
```

---

See **UBUNTU_SETUP.md** for complete installation instructions!
