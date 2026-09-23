# Pavo Tweak — Online License Backend & System Deployment Guide

This guide explains how to deploy the **Pavo Tweak Online License Backend & API**, connect the **Discord Bot**, and distribute the **Pavo Tweak** client.

---

## Architecture Overview

```
               ┌──────────────────────┐
               │     Discord Bot      │
               │ (/license create/ban)│
               └──────────┬───────────┘
                          │ (Admin API with X-Admin-Key)
                          ▼
        ┌────────────────────────────────────┐
        │     Pavo License Backend API       │
        │     (Express + Rate Limiting)      │
        └─────────────────┬──────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
  ┌───────────────────┐       ┌───────────────────┐
  │Persistent SQLite  │       │  Pavo Tweak App   │
  │Database (Volume)  │       │(Client Heartbeat) │
  └───────────────────┘       └───────────────────┘
```

---

## 🚀 Option 1: Docker / Docker Compose Deployment (Recommended for VPS)

Any Ubuntu / Debian / CentOS Linux VPS (e.g. Hetzner, DigitalOcean, Linode, AWS EC2, OVH) with Docker installed.

### 1. Upload the `backend` folder to your VPS
```bash
scp -r backend user@your-server-ip:/opt/pavo-backend
ssh user@your-server-ip
cd /opt/pavo-backend
```

### 2. Configure Environment Variables
Create your production `.env` file:
```bash
cp .env.example .env
nano .env
```
Set strong production secrets:
```env
PORT=5000
NODE_ENV=production
ADMIN_API_KEY=YOUR_SUPER_STRONG_RANDOM_SECRET_KEY_HERE
SIGNING_SECRET=YOUR_SUPER_STRONG_HMAC_SECRET_HERE
DB_PATH=/app/data/licenses.db
RATE_LIMIT_PUBLIC=120
RATE_LIMIT_ADMIN=500
```

### 3. Start the Backend Container
```bash
docker compose up -d --build
```
Check container status and logs:
```bash
docker compose logs -f
```

The persistent database will be automatically preserved in the `pavo_license_data` Docker volume across restarts and server reboots.

---

## 🌐 Option 2: Cloud 1-Click Deployment (Render / Railway / Fly.io)

### Deploying to Render.com
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your Git repository.
3. Set **Root Directory** to `backend`.
4. Set **Runtime** to `Node`.
5. Set **Build Command** to `npm install`.
6. Set **Start Command** to `npm start`.
7. Add a **Persistent Disk** mounted at `/app/data` (size: 1 GB is plenty).
8. Under **Environment Variables**, add:
   - `ADMIN_API_KEY`: `YOUR_STRONG_SECRET_KEY`
   - `SIGNING_SECRET`: `YOUR_HMAC_SECRET`
   - `DB_PATH`: `/app/data/licenses.db`
   - `NODE_ENV`: `production`

---

## 🔒 HTTPS & Nginx Reverse Proxy Setup (for VPS with Custom Domain)

To bind your domain (e.g., `https://api.pavotweak.com`):

### 1. Install Nginx and Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx
Create `/etc/nginx/sites-available/pavo-api`:
```nginx
server {
    server_name api.pavotweak.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/pavo-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Obtain Free Let's Encrypt SSL Certificate
```bash
sudo certbot --nginx -d api.pavotweak.com
```

---

## 🤖 Connecting the Discord Bot

1. Open `pavo-bot/.env` on your bot host.
2. Configure:
   ```env
   LICENSE_API_URL=https://api.pavotweak.com
   LICENSE_API_KEY=YOUR_SUPER_STRONG_RANDOM_SECRET_KEY_HERE
   ```
3. Start the Discord Bot:
   ```bash
   cd pavo-bot
   npm start
   ```

### Available Discord Slash Commands:
- `/license create [duration] [user] [note]` — Generates a new license key with custom duration.
- `/license ban <key> [reason]` — Instantly bans a key and locks connected tweak clients on heartbeat.
- `/license unban <key>` — Restores a banned key.
- `/license info <key>` — Shows license status, bound HWID, creation date, and expiration.
- `/license list [status]` — Lists all licenses.
- `/license resethwid <key>` — Clears device binding so customer can migrate PCs.
- `/license delete <key>` — Permanently deletes a license.

---

## 💻 Connecting Pavo Tweak Desktop Client

To point the Pavo Tweak executable to your live production API:
1. In `src/LicenseClient.cs`, you can set the default fallback URL or place a `license_api.json` alongside `PavoTweak.exe`:
```json
{
  "apiUrl": "https://api.pavotweak.com"
}
```
2. Build the binaries using `build.bat`:
```cmd
build.bat
```
Output binaries generated in the root directory:
- `PavoTweak.exe` (Main Application)
- `PavoSetup.exe` (Single-file Installer)
- `Uninstall.exe` (Uninstaller)

---

## 🧪 Quick Test Checklist

| Step | Action | Expected Result |
|---|---|---|
| 1 | `GET /health` | Status 200 `{"status":"online"}` |
| 2 | `/license create` via Discord | Creates `PAVO-XXXX-XXXX-XXXX` and replies with embed |
| 3 | Enter key in Pavo Tweak | Grants access, binds HWID, opens main app |
| 4 | Run `/license ban <key>` | Database updates status to `banned` |
| 5 | Wait for Heartbeat (60s) | Pavo Tweak locks immediately & displays *"License banned"* |
| 6 | Enter fake key `PAVO-1234-5678-9999` | Rejected with *"Invalid license"* |
