# Doocard Server Topology

**Server:** 45.159.114.60  
**Domain:** www.doocardbarbershop.com

## Request flow

```
Internet
  │
  ▼
Cloudflare DNS (www.doocardbarbershop.com → 45.159.114.60)
  │
  ▼
Apache httpd (:80 / :443)  ← public edge
  │
  ├─ /api/*      → 127.0.0.1:3001  (doocard-backend)
  ├─ /uploads/*  → 127.0.0.1:3001
  ├─ /socket.io/ → 127.0.0.1:3001 (WebSocket)
  └─ /*          → 127.0.0.1:3000  (doocard-frontend)

nginx (:8080) — internal only, not public edge
```

## Directory layout

```
/var/www/doocard/
├── current/          → active release (symlink)
│   ├── backend/
│   ├── frontend/
│   ├── deploy/
│   └── ai/
├── releases/
└── shared/

/var/log/doocard/     → application logs
/var/log/httpd/       → doocard-access.log, doocard-ssl-*.log
/var/backups/doocard/ → PostgreSQL daily dumps
```

## Systemd units

| Unit | WorkingDirectory | ExecStart |
|------|------------------|-----------|
| doocard-backend | /var/www/doocard/current/backend | node dist/src/main.js |
| doocard-frontend | /var/www/doocard/current/frontend | next start -p 3000 |

## Config reload safety

```bash
httpd -t && systemctl reload httpd
nginx -t && systemctl reload nginx   # internal only
```

## SSH access

- Port: 3031
- User: root
- Do NOT disable password auth without key-based fallback confirmed
