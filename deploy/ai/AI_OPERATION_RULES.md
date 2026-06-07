# AI Operation Rules — Doocard Production

## Hard constraints

1. **Never** rebuild or reprovision the server
2. **Never** modify DNS (Cloudflare only)
3. **Never** change application ports (3000 frontend, 3001 backend)
4. **Never** run destructive DB commands without explicit approval
5. **Never** commit or expose secrets (.env, keys, passwords)
6. **Never** skip `httpd -t` before Apache reload
7. **Never** lock out SSH (verify before changing PermitRootLogin, PasswordAuthentication, UFW)

## Session startup checklist

1. `systemctl status doocard-backend doocard-frontend httpd`
2. DNS: `dig +short www.doocardbarbershop.com A` → 45.159.114.60
3. SSL expiry check
4. `curl -sf https://www.doocardbarbershop.com/api/health`

## Safe deploy workflow

1. Edit files in `/var/www/doocard/current` or upload via pscp
2. Backend: `cd backend && npm run build && systemctl restart doocard-backend`
3. Frontend: verify memory/swap, `npm run build`, `systemctl restart doocard-frontend`
4. Config: `httpd -t && systemctl reload httpd`
5. Smoke: `bash /var/www/doocard/current/deploy/doctor.sh`

## Authoritative scripts

| Script | Purpose |
|--------|---------|
| `deploy/doctor.sh` | Health monitoring |
| `deploy/production-stabilize.sh` | Full stabilization |
| `/root/remote-apache-proxy.sh` | Apache proxy apply |
| `/root/remote-cutover-finish.sh` | DNS + SSL cutover |

## DirectAdmin notes

- Panel path: `/usr/local/directadmin/`
- SSL: DirectAdmin AutoSSL or certbot webroot `/var/www/html`
- NOT cPanel — do not assume cPanel paths
