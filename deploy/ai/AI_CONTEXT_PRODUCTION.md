# Doocard — AI Production Context

**Environment:** LIVE PRODUCTION  
**Domain:** https://www.doocardbarbershop.com  
**Server IP:** 45.159.114.60  
**OS:** Ubuntu 22.04  
**Control Panel:** DirectAdmin 1.697 (NOT cPanel)

## Application

| Component | Path | Port |
|-----------|------|------|
| App root (current) | /var/www/doocard/current | — |
| Backend (NestJS) | /var/www/doocard/current/backend | 3001 |
| Frontend (Next.js) | /var/www/doocard/current/frontend | 3000 |
| Backend entry | dist/src/main.js | — |

## Runtime services (systemd)

- `doocard-backend.service` → Node backend on :3001
- `doocard-frontend.service` → Next.js on :3000
- `httpd` → Apache edge proxy (80/443)
- `nginx` → internal proxy on :8080 only
- `postgresql` → database `doocard`
- `redis-server` → Bull queue / cache

## Edge routing (Apache)

Config: `/etc/httpd/conf/extra/httpd-doocard-proxy.conf`  
Included via: `/etc/httpd/conf/extra/httpd-includes.conf`

| Path | Upstream |
|------|----------|
| /api/ | http://127.0.0.1:3001/api/ |
| /uploads/ | http://127.0.0.1:3001/uploads/ |
| /socket.io/ | ws://127.0.0.1:3001/socket.io/ |
| / | http://127.0.0.1:3000/ |

## SSL

- Certificate file: `/etc/httpd/conf/ssl.crt/server.crt.combined`
- Private key: `/etc/httpd/conf/ssl.key/server.key`
- Issuer: Let's Encrypt (YR2)
- Expiry: ~2026-09-01 (verify on server)
- DNS: Cloudflare (not modifiable from server)

## Health check

```bash
curl -sf https://www.doocardbarbershop.com/api/health
# Expected: {"status":"ok","info":{"database":{"status":"up"}}}
```

## Deploy authority

Scripts in `/var/www/doocard/current/deploy/` are operational source of truth.  
Never rebuild server. Never change DNS from server. Never change app ports.
