# HOW-TO: Deploy Grant-Mode Server on DigitalOcean

This guide documents two supported paths for putting the **Grant-Mode / charm-mcp** server in production on DigitalOcean:

1. **App Platform (PaaS)** – quickest, managed TLS & auto-deploys.
2. **Droplet + Docker Compose** – full control, ideal for custom infra.

> No code changes are required. The steps only cover infrastructure and configuration.

---

## 0. Prerequisites

• GitHub repository containing your code (private or public).  
• An **Anthropic API key**.  
• DigitalOcean account with billing enabled.

Directory paths that must persist between deployments:

```
logs/        # created by LoggingService
uploads/     # user-supplied files
storage/     # generated CSV, artifacts, knowledge-graphs
```

Mount a volume or bind-mount these paths in both deployment modes.

---

## 1. Deployment via DigitalOcean App Platform

### 1.1 Create the App

1. DO Console → *Apps* → **Create App** → *GitHub Repo* → choose repo/branch.
2. DO detects a Node service; click **Edit**.

### 1.2 Build & Run commands

| Field | Value |
|-------|-------|
| Build command | `npm ci && npm run build` |
| Run command   | `npm run start` |

### 1.3 Environment variables

Add the following in the *Environment* tab:

```
NODE_ENV=production
ANTHROPIC_API_KEY=sk-...
DEBUG=false   # or true for verbose server + MCP logs
```

### 1.4 Persistent Volume

1. Left panel → **Storage** → *Add Volume*.  
2. Example: 5 GB, mount path `/app/persist`.
3. The container's working dir is `/app`, so logs and uploads written to `./logs` etc. automatically reside inside the mounted volume.

### 1.5 Health Check

*Method:* `GET`, *Path:* `/` (or `/api/health` if you add one), *Port:* `3000`.

### 1.6 Final settings

• Instance size: *Basic 1 GB / 1 vCPU* (scale later).  
• Enable **Auto-deploy on push**.

Click **Deploy** – App Platform builds the image and streams logs. HTTPS is provisioned automatically.

---

## 2. Deployment via Droplet + Docker Compose

### 2.1 Provision the Droplet

*Ubuntu 22.04 LTS*, 2 GB RAM recommended. Attach an SSH key.

```bash
# optional firewall hardening
ufw allow OpenSSH
ufw allow http
ufw allow https
ufw enable
```

### 2.2 Install dependencies

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs docker.io docker-compose fail2ban
sudo usermod -aG docker $USER  # re-login for group effects
```

### 2.3 Project checkout

```bash
git clone https://github.com/<you>/charm-mcp.git
cd charm-mcp
cp env.example.txt .env            # populate ANTHROPIC_API_KEY
```

### 2.4 Dockerfile (project root)

```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build      # builds React UI
ENV NODE_ENV=production
CMD ["npm","run","start"]
```

### 2.5 docker-compose.yml

```yaml
version: "3.9"
services:
  grantmode:
    build: .
    ports:
      - "80:3000"    # Express listens on 3000
    env_file: .env
    volumes:
      - persist:/app/persist   # logs, uploads, storage
    restart: unless-stopped

volumes:
  persist:
    driver: local
```

#### Volume mapping

Container path | Host path (auto) | Purpose
-------------- | ---------------- | -------
`/app/persist/logs` | `/var/lib/docker/volumes/.../_data/logs` | LoggingService output
`/app/persist/uploads` | … | User uploads
`/app/persist/storage` | … | Generated artifacts

### 2.6 HTTPS

Option A – **DO Load Balancer** in front, with TLS termination.  
Option B – install Nginx + Certbot inside the Droplet:

```bash
sudo apt install nginx python3-certbot-nginx -y
sudo certbot --nginx -d grants.example.com
```

Proxy Nginx to `localhost:3000`.

### 2.7 Run

```bash
docker compose up -d
docker compose logs -f grantmode
```

---

## 3. Backups & Snapshots

• App Platform volumes and Droplet volumes can be snapshotted on a schedule in the DO UI.  
• For off-site storage, run a nightly cron job that `tar.gz`'s `/app/persist` and uploads to **DigitalOcean Spaces** (S3-compatible) via `rclone`.

---

## 4. Monitoring & Alerts

App Platform already tracks restarts and resource graphs. On Droplets:

```bash
# Example CPU alert via doctl
 doctl monitoring alert create \
   --metric cpu --comparison GreaterThan --value 80 \
   --window 5m --type droplet --droplet-id <ID> \
   --email you@example.com
```

Or install **node-exporter** + ship metrics to Grafana Cloud / Prometheus.

---

## 5. FAQ

**Q: Where do MCP child processes write their own logs?**  
They inherit stdout/stderr, so everything funnels into the main container logs *and* the files under `logs/` handled by `LoggingService`.

**Q: Do I need a database?**  
No. All state is file-based (uploads, artifacts, logs). Attach a volume for durability.

**Q: Can I scale to multiple instances?**  
App Platform: yes, but child MCP servers run inside each instance, so you may hit duplicate background work. Droplet: use a Load Balancer in front of multiple Droplets if you make storage a shared NFS or S3 backend.

---

*Last updated: <!-- CURSOR_AUTOINJECT_DATE -->* 