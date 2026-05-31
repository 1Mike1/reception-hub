# 🐧 Ubuntu Server Setup Guide
## Sales Bot USA - Complete Deployment Instructions

---

## 📋 **System Requirements**

- **Ubuntu**: 20.04 LTS or 22.04 LTS (recommended)
- **RAM**: Minimum 2GB, recommended 4GB+
- **CPU**: 2+ cores recommended
- **Disk**: 10GB+ free space
- **Network**: Public IP or domain for webhooks

---

## 🚀 **Quick Install (Automated)**

```bash
# Download and run the automated setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/ubuntu-setup.sh | bash
```

Or follow the manual steps below for full control.

---

## 📦 **Step 1: System Dependencies**

### **Update System Packages**

```bash
sudo apt update && sudo apt upgrade -y
```

### **Install Core Dependencies**

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

---

## 🐍 **Step 2: Install Python 3.12+**

### **Add Deadsnakes PPA (for latest Python)**

```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
```

### **Install Python 3.12**

```bash
sudo apt install -y \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    python3-pip
```

### **Set Python 3.12 as Default (Optional)**

```bash
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
sudo update-alternatives --config python3
```

### **Verify Installation**

```bash
python3 --version
# Should output: Python 3.12.x
```

---

## 📦 **Step 3: Install Node.js (for Frontend)**

### **Install Node.js 20.x LTS**

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and npm
sudo apt install -y nodejs

# Verify installation
node --version   # Should be v20.x.x
npm --version    # Should be 10.x.x
```

### **Install Bun (Optional - Frontend uses bun)**

```bash
curl -fsSL https://bun.sh/install | bash

# Add to PATH (add to ~/.bashrc for persistence)
export PATH="$HOME/.bun/bin:$PATH"

# Verify
bun --version
```

---

## 🗄️ **Step 4: Install MongoDB**

### **Import MongoDB GPG Key**

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
```

### **Add MongoDB Repository**

```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

### **Install MongoDB**

```bash
sudo apt update
sudo apt install -y mongodb-org
```

### **Start and Enable MongoDB**

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

### **Verify MongoDB**

```bash
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### **Secure MongoDB (Production)**

```bash
# Create admin user
mongosh <<EOF
use admin
db.createUser({
  user: "admin",
  pwd: "YourSecurePassword123!",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})
exit
EOF

# Enable authentication
sudo nano /etc/mongod.conf
# Add:
# security:
#   authorization: enabled

sudo systemctl restart mongod
```

---

## 🔥 **Step 5: Configure Firewall**

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow backend API (if direct access needed)
sudo ufw allow 8000/tcp

# Allow frontend dev server (development only)
# sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## 📂 **Step 6: Clone and Setup Application**

### **Create Application User (Recommended)**

```bash
sudo useradd -m -s /bin/bash salesbot
sudo usermod -aG sudo salesbot
sudo su - salesbot
```

### **Clone Repository**

```bash
cd ~
git clone https://github.com/your-repo/receptionist-hub.git
cd receptionist-hub
```

### **Setup Backend**

```bash
cd backend/reception_labs

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Install package in editable mode
pip install -e .

# Verify installation
python -c "import reception_labs; print('Backend setup successful!')"
```

### **Configure Environment Variables**

```bash
# Copy example env file
cp .env.example .env

# Edit configuration
nano .env
```

**Required `.env` Configuration:**

```env
# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# SMTP Email
SMTP_HOST=mail.2ndwaveai.com
SMTP_PORT=587
SMTP_USER=support@2ndwaveai.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=Sales Bot USA <support@2ndwaveai.com>
SMTP_USE_TLS=true

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=sales_bot_usa
```

### **Setup Frontend**

```bash
cd ~/receptionist-hub/frontend

# Install dependencies (using npm)
npm install

# Or using bun (faster)
bun install

# Build for production
npm run build
# Or: bun run build

# Output will be in: dist/
```

---

## 🔄 **Step 7: Setup Systemd Services**

### **Backend Service**

```bash
sudo nano /etc/systemd/system/salesbot-backend.service
```

**Content:**

```ini
[Unit]
Description=Sales Bot USA Backend API
After=network.target mongod.service

[Service]
Type=simple
User=salesbot
Group=salesbot
WorkingDirectory=/home/salesbot/receptionist-hub/backend
Environment="PATH=/home/salesbot/receptionist-hub/backend/reception_labs/venv/bin"
ExecStart=/home/salesbot/receptionist-hub/backend/reception_labs/venv/bin/uvicorn reception_labs.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

# Logging
StandardOutput=append:/var/log/salesbot/backend.log
StandardError=append:/var/log/salesbot/backend-error.log

[Install]
WantedBy=multi-user.target
```

### **Create Log Directory**

```bash
sudo mkdir -p /var/log/salesbot
sudo chown salesbot:salesbot /var/log/salesbot
```

### **Enable and Start Backend**

```bash
sudo systemctl daemon-reload
sudo systemctl enable salesbot-backend
sudo systemctl start salesbot-backend
sudo systemctl status salesbot-backend
```

### **Check Logs**

```bash
# Real-time logs
sudo journalctl -u salesbot-backend -f

# Or from log file
tail -f /var/log/salesbot/backend.log
```

---

## 🌐 **Step 8: Configure Nginx Reverse Proxy**

### **Create Nginx Configuration**

```bash
sudo nano /etc/nginx/sites-available/salesbot
```

**Content:**

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for webhooks
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /home/salesbot/receptionist-hub/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
}
```

### **Enable Site**

```bash
sudo ln -s /etc/nginx/sites-available/salesbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 **Step 9: Setup SSL with Let's Encrypt**

### **Install Certbot**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### **Obtain SSL Certificates**

```bash
# For backend API
sudo certbot --nginx -d api.yourdomain.com

# For frontend
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### **Auto-Renewal**

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is enabled by default via systemd timer
sudo systemctl status certbot.timer
```

---

## 🔍 **Step 10: Verify Installation**

### **Check Services**

```bash
# Backend
sudo systemctl status salesbot-backend

# MongoDB
sudo systemctl status mongod

# Nginx
sudo systemctl status nginx
```

### **Test Endpoints**

```bash
# Backend health check
curl http://localhost:8000/system/info

# From external
curl https://api.yourdomain.com/system/info
```

### **Check Logs**

```bash
# Backend logs
sudo journalctl -u salesbot-backend -n 50

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 📊 **Step 11: Setup Monitoring (Optional)**

### **Install Monitoring Tools**

```bash
sudo apt install -y htop iotop nethogs
```

### **Setup Log Rotation**

```bash
sudo nano /etc/logrotate.d/salesbot
```

**Content:**

```
/var/log/salesbot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 salesbot salesbot
    sharedscripts
    postrotate
        systemctl reload salesbot-backend > /dev/null 2>&1 || true
    endscript
}
```

---

## 🔄 **Common Operations**

### **Update Application**

```bash
cd ~/receptionist-hub

# Pull latest code
git pull origin main

# Update backend
cd backend/reception_labs
source venv/bin/activate
pip install -r requirements.txt
pip install -e .

# Restart backend
sudo systemctl restart salesbot-backend

# Update frontend
cd ~/receptionist-hub/frontend
npm install
npm run build
```

### **Restart Services**

```bash
# Backend
sudo systemctl restart salesbot-backend

# Nginx
sudo systemctl restart nginx

# MongoDB
sudo systemctl restart mongod
```

### **View Logs**

```bash
# Backend (real-time)
sudo journalctl -u salesbot-backend -f

# Backend (last 100 lines)
sudo journalctl -u salesbot-backend -n 100

# Nginx access
sudo tail -f /var/log/nginx/access.log

# Nginx errors
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 **Troubleshooting**

### **Backend Won't Start**

```bash
# Check service status
sudo systemctl status salesbot-backend

# Check logs
sudo journalctl -u salesbot-backend -n 50 --no-pager

# Test manually
cd ~/receptionist-hub/backend
source reception_labs/venv/bin/activate
uvicorn reception_labs.main:app --host 0.0.0.0 --port 8000
```

### **MongoDB Connection Issues**

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### **Nginx 502 Bad Gateway**

```bash
# Check backend is running
sudo systemctl status salesbot-backend

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test backend directly
curl http://localhost:8000/system/info
```

### **Port Already in Use**

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill process if needed
sudo kill -9 <PID>
```

---

## 📋 **System Checklist**

- [ ] Ubuntu 20.04/22.04 installed
- [ ] Python 3.12+ installed
- [ ] Node.js 20+ installed
- [ ] MongoDB 7.0+ installed and running
- [ ] Firewall configured
- [ ] Application cloned
- [ ] Backend dependencies installed
- [ ] Frontend built
- [ ] Environment variables configured
- [ ] Systemd service created and running
- [ ] Nginx configured
- [ ] SSL certificates obtained
- [ ] Webhooks configured in ElevenLabs/Stripe
- [ ] DNS records pointing to server

---

## 🔗 **Additional Resources**

- **MongoDB Ubuntu Install**: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
- **Node.js Downloads**: https://nodejs.org/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/
- **UFW Firewall**: https://help.ubuntu.com/community/UFW

---

## 🎯 **Production Checklist**

- [ ] Use MongoDB authentication
- [ ] Configure firewall properly
- [ ] Enable SSL/HTTPS
- [ ] Set up log rotation
- [ ] Configure automated backups
- [ ] Set up monitoring/alerting
- [ ] Use strong passwords
- [ ] Keep system updated
- [ ] Document API keys securely
- [ ] Configure CORS properly
- [ ] Set up rate limiting (optional)
- [ ] Configure fail2ban (optional)

---

**Your Sales Bot USA application is now ready for production on Ubuntu!** 🚀
