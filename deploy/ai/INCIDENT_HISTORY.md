# Doocard Incident History

## 2026-06-02 — Production cutover to 45.159.114.60

- Migrated from legacy server 185.255.88.158
- Apache reverse proxy configured (`httpd-doocard-proxy.conf`)
- systemd services: `doocard-backend`, `doocard-frontend`
- DNS cutover required manual Cloudflare A-record change
- Let's Encrypt SSL issued after DNS propagation

## 2026-06-02 — Apache vhost binding

- vhost binds to `45.159.114.60:80/443` (not 127.0.0.1)
- Local curl requires `Host: www.doocardbarbershop.com` when testing via IP

## 2026-02 — Calendar / timezone fix

- PersianDatePicker portal fix deployed
- Tehran-time "today" detection in `appointments.service.ts`

## Known constraints

| Constraint | Reason |
|------------|--------|
| No DNS changes from server | Cloudflare controlled externally |
| No port changes | Apache proxy hardcoded to 3000/3001 |
| No server rebuild | Live production with customer data |
| Memory before build | Frontend build OOM without swap |

## Recovery commands

```bash
systemctl status doocard-backend doocard-frontend httpd
journalctl -u doocard-backend -n 50 --no-pager
bash /var/www/doocard/current/deploy/doctor.sh
httpd -t && systemctl reload httpd
```
