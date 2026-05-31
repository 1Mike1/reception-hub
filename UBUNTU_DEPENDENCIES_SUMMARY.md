# 📦 Ubuntu Dependencies & Setup Summary

## Quick Reference for Ubuntu Deployment

---

## 🎯 **Three Setup Options**

Choose the method that best fits your needs:

### **1. 🐳 Docker (Recommended - Easiest)**
- ✅ Isolated environment
- ✅ Quick setup
- ✅ Easy updates
- ❌ Requires Docker knowledge

**Setup Time: ~15 minutes**

[See DOCKER_SETUP.md](DOCKER_SETUP.md)

```bash
docker-compose up -d
```

---

### **2. 🔧 Manual Install (Full Control)**
- ✅ Complete control
- ✅ Native performance
- ✅ Detailed configuration
- ❌ More setup steps

**Setup Time: ~45 minutes**

[See UBUNTU_SETUP.md](UBUNTU_SETUP.md)

```bash
curl -fsSL https://your-url/ubuntu-install.sh | bash
```

---

### **3. ⚡ Quick Install Script (Automated)**
- ✅ Automated setup
- ✅ Installs all dependencies
- ✅ Good for fresh servers
- ❌ Less customization

**Setup Time: ~20 minutes**

```bash
chmod +x ubuntu-install.sh
./ubuntu-install.sh
```

---

## 📋 **Core Dependencies**

### **System Requirements**
- Ubuntu 20.04 LTS or 22.04 LTS
- 2GB RAM minimum (4GB+ recommended)
- 2+ CPU cores
- 10GB+ disk space

### **Software Stack**

| Component | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12+ | Backend API |
| Node.js | 20.x LTS | Frontend build |
| MongoDB | 7.0+ | Database |
| Nginx | Latest | Web server |
| Docker | 20.10+ | Containerization (optional) |

---

## 🐍 **Python Dependencies**

```txt
fastapi==0.104.1       # Web framework
uvicorn==0.24.0        # ASGI server
httpx==0.25.0          # HTTP client
pydantic==2.5.0        # Data validation
python-dotenv==1.0.0   # Environment variables
stripe==7.0.0          # Payment processing
pymongo==4.6.0         # MongoDB driver
```

**Install:**
```bash
cd backend/reception_labs
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

---

## 📦 **Node.js Dependencies**

**Key Packages:**
- React 18.3.1 - UI library
- TypeScript 5.8.3 - Type safety
- Vite 5.4.19 - Build tool
- TanStack Query 5.83.0 - Data fetching
- Radix UI - Component library
- Tailwind CSS 3.4.17 - Styling

**Install:**
```bash
cd frontend
npm install
npm run build
```

---

## 🗄️ **External Services Required**

### **1. MongoDB Database**
- **Local**: Install MongoDB 7.0+
- **Cloud**: MongoDB Atlas (free tier available)
- **Connection**: `mongodb://localhost:27017`

### **2. ElevenLabs AI**
- **Account**: [elevenlabs.io](https://elevenlabs.io)
- **API Key**: Required
- **Webhook**: Configure for call notifications

### **3. Stripe Payment**
- **Account**: [stripe.com](https://stripe.com)
- **API Keys**: Test/Live mode
- **Webhook**: Configure for payment confirmation

### **4. SMTP Email**
- **Server**: mail.2ndwaveai.com:587
- **Credentials**: Required for notifications
- **TLS**: Enabled

---

## 🚀 **Quick Install Commands**

### **Ubuntu 22.04 - One-Line Install**

```bash
# Install all dependencies
sudo apt update && \
sudo apt install -y curl wget git build-essential software-properties-common && \
sudo add-apt-repository ppa:deadsnakes/ppa -y && \
sudo apt install -y python3.12 python3.12-venv python3.12-dev python3-pip && \
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
sudo apt install -y nodejs mongodb-org nginx
```

---

## 🔥 **Firewall Configuration**

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8000/tcp  # Backend API (optional)
sudo ufw enable
```

---

## 🔍 **Verify Installation**

```bash
# Check versions
python3.12 --version    # Should be 3.12.x
node --version          # Should be v20.x.x
mongod --version        # Should be 7.0.x
nginx -v                # Should be 1.x

# Check services
sudo systemctl status mongod
sudo systemctl status nginx

# Test backend
curl http://localhost:8000/system/info

# Test frontend
curl http://localhost:8080
```

---

## 📊 **Port Usage**

| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | Remote access |
| 80 | Nginx | HTTP frontend |
| 443 | Nginx | HTTPS frontend |
| 8000 | Backend | FastAPI API |
| 8080 | Frontend Dev | Vite dev server |
| 27017 | MongoDB | Database |

---

## 🐛 **Common Issues & Solutions**

### **Python not found**
```bash
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
```

### **MongoDB won't start**
```bash
sudo systemctl status mongod
sudo journalctl -u mongod
sudo systemctl restart mongod
```

### **Port already in use**
```bash
sudo lsof -i :8000
sudo kill -9 <PID>
```

### **Permission denied**
```bash
sudo chown -R $USER:$USER ~/receptionist-hub
chmod +x ubuntu-install.sh
```

---

## 📚 **Documentation Index**

| Document | Description |
|----------|-------------|
| [UBUNTU_SETUP.md](UBUNTU_SETUP.md) | Complete Ubuntu installation guide |
| [DOCKER_SETUP.md](DOCKER_SETUP.md) | Docker container deployment |
| [DEPENDENCIES.md](DEPENDENCIES.md) | Full dependency reference |
| [STRIPE_SETUP.md](STRIPE_SETUP.md) | Payment gateway configuration |
| [ubuntu-install.sh](ubuntu-install.sh) | Automated setup script |

---

## ✅ **Setup Checklist**

- [ ] Ubuntu 20.04/22.04 installed
- [ ] Python 3.12+ installed
- [ ] Node.js 20+ installed
- [ ] MongoDB 7.0+ installed
- [ ] Nginx installed
- [ ] Firewall configured
- [ ] Application cloned
- [ ] Backend dependencies installed
- [ ] Frontend built
- [ ] Environment variables configured
- [ ] Services running
- [ ] SSL certificates configured (production)
- [ ] External services configured (ElevenLabs, Stripe, SMTP)

---

## 🆘 **Get Help**

If you encounter issues:

1. **Check logs**: `sudo journalctl -u salesbot-backend`
2. **Run health check**: `python test_stripe_config.py`
3. **Verify services**: `sudo systemctl status mongod nginx`
4. **Test connectivity**: `curl http://localhost:8000/system/info`

---

## 📖 **Next Steps**

After installing dependencies:

1. **Configure environment** → Edit `.env` file
2. **Setup database** → Initialize MongoDB
3. **Configure services** → ElevenLabs, Stripe, SMTP
4. **Deploy application** → Follow [UBUNTU_SETUP.md](UBUNTU_SETUP.md)
5. **Test payment flow** → See [STRIPE_SETUP.md](STRIPE_SETUP.md)

---

**Ready to deploy Sales Bot USA on Ubuntu!** 🚀
