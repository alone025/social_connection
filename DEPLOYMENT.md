# 🚀 Deployment Guide

This guide covers deployment of the Conference Networking Bot for different environments (development, staging, production).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js** ≥ 18 (for local development)
- **Docker & Docker Compose** (for containerized deployment)
- **MongoDB** ≥ 5 (if running without Docker)
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

---

## Environment Configuration

### Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your values:**
   ```bash
   # Required
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   MONGODB_URI=mongodb://user:password@host:27017/database
   SECOND_SCREEN_API_KEY=your-secure-random-key-here
   
   # Optional but recommended
   MAIN_ADMIN_TELEGRAM_IDS=123456789,987654321
   BASE_URL=https://your-domain.com
   PORT=3000
   NODE_ENV=production
   ```

### Environment-Specific Files

The application supports environment-specific configuration files:

- `.env.development` — For local development
- `.env.staging` — For staging environment  
- `.env.production` — For production

**How it works:**
1. Application reads `NODE_ENV` environment variable (defaults to `development`)
2. Loads `.env.<NODE_ENV>` if it exists
3. Falls back to `.env` if environment-specific file doesn't exist
4. Validates all required variables on startup

**Important:** All `.env*` files are ignored by git. Never commit secrets to the repository.

---

## Local Development

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with your development values
   ```

3. **Start MongoDB** (if not using Docker):
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongo mongo:6
   
   # Or use your existing MongoDB instance
   ```

4. **Start the application:**
   ```bash
   # Development mode (uses .env.development or .env)
   npm run dev
   
   # Or explicitly set environment
   NODE_ENV=development npm start
   ```

The application will:
- Validate all required environment variables on startup
- Show clear error messages if required variables are missing
- Start on `http://localhost:3000`

---

## Docker Deployment

### Quick Start

1. **Create `.env` file** in the project root:
   ```bash
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   SECOND_SCREEN_API_KEY=your-secure-random-key
   MAIN_ADMIN_TELEGRAM_IDS=123456789
   MONGO_ROOT_USER=root
   MONGO_ROOT_PASSWORD=your-secure-password
   ```

2. **Build and start:**
   ```bash
   docker-compose up --build -d
   ```

This will:
- Start MongoDB container on port `27017`
- Build and run the application container on port `3000`
- Automatically configure `MONGODB_URI` using Docker service names

### Docker Compose Configuration

The `docker-compose.yml` file automatically constructs the MongoDB URI:

```yaml
MONGODB_URI: mongodb://${MONGO_ROOT_USER:-root}:${MONGO_ROOT_PASSWORD:-example}@mongo:27017/conference_networking?authSource=admin
```

**Important:** 
- Replace `example` with a secure password in your `.env` file
- The `mongo` hostname refers to the MongoDB service in Docker Compose
- For external MongoDB, set `MONGODB_URI` directly in `.env`

### Using External MongoDB

If you want to use an external MongoDB instance instead of the Docker container:

1. **Comment out the `mongo` service** in `docker-compose.yml`
2. **Set `MONGODB_URI` directly** in your `.env`:
   ```bash
   MONGODB_URI=mongodb://user:password@external-host:27017/database?authSource=admin
   ```
3. **Remove `depends_on: - mongo`** from the `app` service

---

## Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Set up production environment:**
   ```bash
   # On your server
   git clone <repository-url>
   cd Social_Connections_bot
   ```

2. **Create production environment file on the server:**
   ```bash
   # On your production server
   cp .env.example .env.production
   # Edit .env.production with production values
   # IMPORTANT: This file must be created on the server, it's not in the repository
   ```
   
   **Critical:** The `.env.production` file does NOT exist in the repository (it's in `.gitignore`). 
   You MUST create it manually on your production server with production values.

3. **Update `docker-compose.yml`** to use production environment:
   ```yaml
   app:
     environment:
       NODE_ENV: production  # Already set
       # ... other variables
   ```

4. **Start services:**
   ```bash
   docker-compose up --build -d
   ```

5. **Set up reverse proxy** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Option 2: PM2 (Process Manager)

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [{
       name: 'conference-bot',
       script: 'src/index.js',
       instances: 1,
       exec_mode: 'fork',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
     }]
   };
   ```

3. **Start with PM2:**
   ```bash
   NODE_ENV=production pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### Option 3: Systemd Service

1. **Create service file** (`/etc/systemd/system/conference-bot.service`):
   ```ini
   [Unit]
   Description=Conference Networking Bot
   After=network.target mongod.service
   
   [Service]
   Type=simple
   User=your-user
   WorkingDirectory=/path/to/Social_Connections_bot
   Environment="NODE_ENV=production"
   EnvironmentFile=/path/to/Social_Connections_bot/.env.production
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and start:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable conference-bot
   sudo systemctl start conference-bot
   ```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | `123456:ABC-DEF...` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://user:pass@host:27017/db` |
| `SECOND_SCREEN_API_KEY` | Secret key for second screen API | Generate with `openssl rand -hex 32` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MAIN_ADMIN_TELEGRAM_IDS` | Comma-separated Telegram user IDs | `''` | `123456789,987654321` |
| `PORT` | HTTP server port | `3000` | `3000` |
| `BASE_URL` | Base URL for second screen links | `http://localhost:3000` | `https://your-domain.com` |
| `SERVER_URL` | Alternative to BASE_URL | - | `https://your-domain.com` |
| `NODE_ENV` | Environment mode | `development` | `production` |

### Generating Secure Keys

**Generate SECOND_SCREEN_API_KEY:**
```bash
# Linux/Mac
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get your Telegram User ID:**
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy your user ID from the response

---

## Troubleshooting

### Application won't start

**Error: `MONGODB_URI is not set in environment`**
- Solution: Ensure `.env` or `.env.<NODE_ENV>` file exists and contains `MONGODB_URI`
- Check: Application loads environment files in this order: `.env.<NODE_ENV>` → `.env`

**Error: `Environment variable validation error`**
- Solution: Check that all required variables are set in your `.env` file
- Required: `TELEGRAM_BOT_TOKEN`, `MONGODB_URI`, `SECOND_SCREEN_API_KEY`

### Docker issues

**Error: `Port 3000 is already in use`**
- Solution: Change `PORT` in `.env` or stop the process using port 3000
- Check: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (Linux/Mac)

**Error: `Cannot connect to MongoDB`**
- Solution: Ensure MongoDB container is running: `docker-compose ps`
- Check: MongoDB URI uses `mongo` as hostname (Docker service name), not `localhost`

### Environment-specific issues

**Application uses wrong environment variables**
- Check: `NODE_ENV` is set correctly
- Verify: `.env.<NODE_ENV>` file exists and contains correct values
- Note: Application falls back to `.env` if environment-specific file doesn't exist

**Variables not loading in Docker**
- Solution: Ensure `.env` file is in the same directory as `docker-compose.yml`
- Check: Docker Compose reads `.env` automatically, but you can also set variables in `docker-compose.yml`

---

## Security Checklist

Before deploying to production:

- [ ] All secrets are in `.env.production` (not committed to git)
- [ ] `SECOND_SCREEN_API_KEY` is a strong random string (32+ characters)
- [ ] `MONGO_ROOT_PASSWORD` is strong and unique
- [ ] `BASE_URL` is set to your production domain
- [ ] MongoDB is not exposed to the internet (use firewall/VPC)
- [ ] Application runs behind a reverse proxy (nginx/traefik)
- [ ] SSL/TLS is configured for HTTPS
- [ ] Regular backups of MongoDB are configured

---

## Support

For issues or questions:
1. Check the [README.md](./README.md) for basic usage
2. Review this deployment guide
3. Check application logs: `docker-compose logs app` or `pm2 logs`
4. Verify environment variables: Application validates on startup and shows clear errors
