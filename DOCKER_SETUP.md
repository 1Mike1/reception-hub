# 🐳 Docker Deployment Guide
## Sales Bot USA - Container-Based Setup

---

## 🚀 **Quick Start with Docker**

### **Prerequisites**

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 4GB+ RAM available
- 10GB+ disk space

---

## 📦 **Installation**

### **Step 1: Install Docker**

#### **Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

#### **CentOS/RHEL:**
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

#### **Windows/Mac:**
Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)

### **Step 2: Install Docker Compose**

```bash
sudo apt install -y docker-compose
# or
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### **Verify Installation:**
```bash
docker --version
docker-compose --version
```

---

## 🔧 **Setup Application**

### **Step 1: Clone Repository**

```bash
git clone https://github.com/your-repo/receptionist-hub.git
cd receptionist-hub
```

### **Step 2: Build Frontend**

```bash
cd frontend
npm install
npm run build
cd ..
```

### **Step 3: Configure Environment**

```bash
# Copy environment template
cp .env.docker .env

# Edit configuration
nano .env
```

**Update these values in `.env`:**

```env
# MongoDB password
MONGO_PASSWORD=your_secure_mongodb_password

# ElevenLabs
ELEVENLABS_API_KEY=your_actual_api_key
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# SMTP
SMTP_PASSWORD=your_smtp_password
```

---

## 🚀 **Launch Application**

### **Start All Services**

```bash
docker-compose up -d
```

### **Check Status**

```bash
docker-compose ps
```

You should see:
```
NAME                    STATUS              PORTS
salesbot-mongodb        Up (healthy)        27017/tcp
salesbot-backend        Up (healthy)        0.0.0.0:8000->8000/tcp
salesbot-frontend       Up (healthy)        0.0.0.0:8080->80/tcp
```

### **View Logs**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### **Stop Services**

```bash
docker-compose stop
```

### **Start Services**

```bash
docker-compose start
```

### **Restart Services**

```bash
docker-compose restart
```

### **Stop and Remove**

```bash
docker-compose down
```

### **Stop and Remove (including volumes)**

```bash
docker-compose down -v
```

---

## 🌐 **Access Application**

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MongoDB**: localhost:27017

### **Default Credentials**

**Admin Login:**
- Email: `admin@example.com`
- Password: `admin123`

**Test Client Login:**
- Email: `test@example.com`
- Password: `test123`

---

## 🔍 **Health Checks**

```bash
# Backend health
curl http://localhost:8000/system/info

# Frontend health
curl http://localhost:8080/health

# MongoDB health
docker exec salesbot-mongodb mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

---

## 📊 **Container Management**

### **View Running Containers**

```bash
docker ps
```

### **View All Containers**

```bash
docker ps -a
```

### **View Resource Usage**

```bash
docker stats
```

### **Execute Commands in Container**

```bash
# Backend shell
docker exec -it salesbot-backend /bin/bash

# MongoDB shell
docker exec -it salesbot-mongodb mongosh

# Frontend shell
docker exec -it salesbot-frontend /bin/sh
```

### **View Container Logs**

```bash
# Last 100 lines
docker logs salesbot-backend --tail 100

# Follow logs
docker logs -f salesbot-backend

# With timestamps
docker logs -f --timestamps salesbot-backend
```

---

## 🔄 **Update Application**

### **Pull Latest Code**

```bash
git pull origin main
```

### **Rebuild Frontend**

```bash
cd frontend
npm install
npm run build
cd ..
```

### **Rebuild and Restart**

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Update Single Service**

```bash
# Rebuild backend only
docker-compose up -d --build --no-deps backend

# Restart frontend only
docker-compose restart frontend
```

---

## 💾 **Backup and Restore**

### **Backup MongoDB**

```bash
# Create backup directory
mkdir -p backups

# Backup all databases
docker exec salesbot-mongodb mongodump --out /backup
docker cp salesbot-mongodb:/backup ./backups/$(date +%Y%m%d_%H%M%S)
```

### **Restore MongoDB**

```bash
# Restore from backup
docker cp ./backups/20260531_120000 salesbot-mongodb:/restore
docker exec salesbot-mongodb mongorestore /restore
```

### **Backup Docker Volumes**

```bash
# Backup MongoDB volume
docker run --rm -v receptionist-hub_mongodb_data:/data -v $(pwd)/backups:/backup ubuntu tar czf /backup/mongodb-$(date +%Y%m%d).tar.gz /data
```

---

## 🔒 **Production Deployment**

### **Use Production Configuration**

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - /var/lib/mongodb:/data/db

  backend:
    restart: always
    environment:
      STRIPE_SECRET_KEY: ${STRIPE_LIVE_KEY}
      FRONTEND_URL: https://yourdomain.com
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

**Deploy:**

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🐛 **Troubleshooting**

### **Container Won't Start**

```bash
# Check logs
docker-compose logs backend

# Check status
docker-compose ps

# Rebuild
docker-compose build --no-cache backend
docker-compose up -d
```

### **MongoDB Connection Failed**

```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs salesbot-mongodb

# Test connection
docker exec salesbot-mongodb mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

### **Port Already in Use**

```bash
# Find process using port
sudo lsof -i :8000

# Kill process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8001:8000"  # Use 8001 instead
```

### **Out of Disk Space**

```bash
# Clean up old images
docker system prune -a

# Clean up volumes
docker volume prune

# Check disk usage
docker system df
```

### **Backend Health Check Failing**

```bash
# Check backend logs
docker logs salesbot-backend

# Check if backend is responding
docker exec salesbot-backend curl -f http://localhost:8000/system/info

# Restart backend
docker-compose restart backend
```

---

## 📈 **Monitoring**

### **View Container Stats**

```bash
docker stats --no-stream
```

### **Setup Prometheus + Grafana (Optional)**

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## 🔧 **Advanced Configuration**

### **Enable HTTPS with Let's Encrypt**

1. Install certbot on host:
```bash
sudo apt install -y certbot
```

2. Get certificates:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. Mount certificates in docker-compose.yml:
```yaml
frontend:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

4. Update nginx config for SSL

### **Scale Services**

```bash
# Run multiple backend instances
docker-compose up -d --scale backend=3
```

### **Custom Network**

```bash
# Create custom network
docker network create salesbot-net

# Update docker-compose.yml
networks:
  default:
    external:
      name: salesbot-net
```

---

## 📋 **Docker Commands Reference**

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Execute command
docker-compose exec backend bash

# Scale service
docker-compose up -d --scale backend=2

# Remove everything
docker-compose down -v

# View resource usage
docker-compose top
```

---

## ✅ **Checklist**

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Repository cloned
- [ ] Frontend built
- [ ] .env configured
- [ ] Services started
- [ ] Health checks passing
- [ ] Can access frontend (port 8080)
- [ ] Can access backend (port 8000)
- [ ] MongoDB running
- [ ] Logs look clean

---

**Your Sales Bot USA is now running in Docker containers!** 🐳🚀
