# Release note: v2.0.13 theme remediation

Status: SUCCESSFULLY DEPLOYED TO PRODUCTION.

Deployed source remains commit `2451a57b8507eef577817c978ec7245701e8d098`. The local tag `v2.0.13-theme-remediation` stays on that commit because that is the tree that was built and shipped. This closeout note is a later documentation commit and was not pushed.

## Identity

| Item | Value |
|---|---|
| Commit | `2451a57b8507eef577817c978ec7245701e8d098` |
| Branch | `release/v2.0.7` (ahead of origin by 2, not pushed) |
| Local tag | `v2.0.13-theme-remediation` on that commit. Not pushed. |
| Accepted build | `ytyQe_k7jkuz8iEQ7P1gX` |
| Built with | Node v20.11.1, Next.js 14.1.0, `output: 'standalone'` |
| Archive | `tmp/doocard-frontend-v2.0.13-theme-remediation-node20.tar.gz` |
| Archive size | 36373344 bytes |
| Archive SHA256 | `0699C0AF5DCE31A72E890AE245B0CB56FF87A026B29A776897F5C845596F0402` |

The archive was packed from the existing `frontend/.next/standalone` tree. `npm run build` was not run again. The archived file `.next/standalone/.next/BUILD_ID` reads `ytyQe_k7jkuz8iEQ7P1gX`. The tree includes `server.js`, `public/` (including `public/logo/logo-2048.png`), and `.next/static/ytyQe_k7jkuz8iEQ7P1gX/`.

## Production state observed read-only on 2026-10-06

No file under `/var/www/doocard` was written. PM2 was not restarted.

| Check | Result |
|---|---|
| `doocard-frontend` | online, fork mode, Node 20.11.1, restarts 23, uptime about 2h |
| PID | 2201853 (`next-server`, started Tue Oct 6 11:38:28 2026) |
| Script | `/var/www/doocard/frontend/.next/standalone/server.js` |
| cwd | `/var/www/doocard/frontend/.next/standalone` |
| Live `frontend/.next/BUILD_ID` | `QP60mQ3zAW6vfVHDCTbN4` |
| Live standalone `BUILD_ID` | `QP60mQ3zAW6vfVHDCTbN4` |
| Disk `/var/www` (`/dev/sda1`) | 39G size, 29G used, 11G free, 73% |
| Safety backup | `/var/www/doocard/backups/live-v2.0.9-backup-20261006_112650/` |
| Backup `BUILD_ID` and `standalone/.next/BUILD_ID` | both `5E8VVtRnOpvYH3CcllQl_` |

Nginx on `doocardbarbershop.com` aliases `/_next/static/` and public assets (`sw.js`, `manifest.json`, `favicon.ico`, `logo/`, `images/`) to paths inside `frontend/.next/standalone`. The swap unit is that standalone directory, plus the sibling `frontend/.next/BUILD_ID` file.

`5E8VVtRnOpvYH3CcllQl_` is the pre-palette live baseline. It is not a copy of the current live build `QP60mQ3zAW6vfVHDCTbN4`.

## Rollback

Take a new backup of the current live tree before any swap. Do not delete or overwrite `live-v2.0.9-backup-20261006_112650`.

1. Roll back to the current production build `QP60mQ3zAW6vfVHDCTbN4` only from the backup created in Phase 8 immediately before the swap. Restore that copy to `frontend/.next/standalone`, write `QP60mQ3zAW6vfVHDCTbN4` to `frontend/.next/BUILD_ID`, then `pm2 restart doocard-frontend` only.
2. Roll back further to `5E8VVtRnOpvYH3CcllQl_` from `/var/www/doocard/backups/live-v2.0.9-backup-20261006_112650/` using the same restore shape. That returns the frontend to the pre-`v2.0.12-palette-tokens` tree, not to `QP60mQ3zAW6vfVHDCTbN4`.

Trigger rollback if the frontend process crashes, routes return 5xx, or the core CSS/static alias 404s. Do not restart `doocard-backend`. Do not touch the database.

## Phase 8 overlay steps

These steps are not authorized by this note.

Prohibited on production: `git pull`, `rsync --delete`, backend or database changes, unmasking or starting apache2, changing UFW or fail2ban, and restarting any PM2 process other than `doocard-frontend` after the swap.

1. Copy `tmp/doocard-frontend-v2.0.13-theme-remediation-node20.tar.gz` to `/tmp` on the server. Do not extract it into `/var/www/doocard`.
2. SHA256 must equal `0699C0AF5DCE31A72E890AE245B0CB56FF87A026B29A776897F5C845596F0402` before extract. Stop on mismatch.
3. Extract into an empty directory under `/tmp`, for example `/tmp/doocard-v213-stage`.
4. The extracted build file `/tmp/doocard-v213-stage/.next/standalone/.next/BUILD_ID` must read `ytyQe_k7jkuz8iEQ7P1gX`. `server.js` must be present. Stop on mismatch.
5. Re-read live `frontend/.next/BUILD_ID` and the standalone copy. Both must still be `QP60mQ3zAW6vfVHDCTbN4`. Re-read both backup build files. Both must still be `5E8VVtRnOpvYH3CcllQl_`. Re-check `df -h /var/www`. Stop if any of these differ.
6. Backup the current live tree to a new directory such as `/var/www/doocard/backups/live-QP60mQ3zAW6vfVHDCTbN4-<timestamp>/`. Copy `frontend/.next/standalone` and `frontend/.next/BUILD_ID`. Confirm the backup build id is `QP60mQ3zAW6vfVHDCTbN4` before continuing.
7. Copy the staged standalone tree to `frontend/.next/standalone.next-ytyQe_k7jkuz8iEQ7P1gX` and confirm its `BUILD_ID`.
8. Swap by rename, not by `rsync --delete`:
   - `mv frontend/.next/standalone frontend/.next/standalone.rollback-QP60mQ3zAW6vfVHDCTbN4`
   - `mv frontend/.next/standalone.next-ytyQe_k7jkuz8iEQ7P1gX frontend/.next/standalone`
   - write `ytyQe_k7jkuz8iEQ7P1gX` to `frontend/.next/BUILD_ID`
9. `pm2 restart doocard-frontend` only.
10. Smoke: `GET /login`, `GET /`, and one CSS file under the new `/_next/static/` hash. Confirm both build-id files read `ytyQe_k7jkuz8iEQ7P1gX`. On crash, 5xx, or missing static assets, rename the `rollback-QP60` directory back into place, restore `QP60mQ3zAW6vfVHDCTbN4` into `frontend/.next/BUILD_ID`, and restart only `doocard-frontend`.

## Closeout

Completed 2026-10-06 14:52 +0330 (11:22 UTC). Final live build: `ytyQe_k7jkuz8iEQ7P1gX`. Status: SUCCESSFULLY DEPLOYED TO PRODUCTION.

The cutover used `pm2 reload doocard-frontend`. `doocard-backend` was not restarted. After cleanup on 2026-10-06T11:40:27Z:

| Item | State |
|---|---|
| Removed | `/tmp/doocard-frontend-v2.0.13-theme-remediation-node20.tar.gz` |
| Removed | `/var/www/doocard/.release-staging/v2.0.13-theme-remediation-20261006T111827Z` (empty `.next` left after the standalone directory was renamed into place) |
| Retained snapshot | `/var/www/doocard/backups/live-v2.0.13-predeploy-20261006T112153Z` (`QP60mQ3zAW6vfVHDCTbN4`) |
| Retained hold | `/var/www/doocard/frontend/.next/standalone.predeploy-20261006T112153Z` |
| Disk `/var/www` | 39G size, 29G used, 11G free, 74% on `/dev/sda1` |
| `doocard-frontend` | online, PID 2212447, restarts 24, uptime 17m at the check |
| `doocard-backend` | online, PID 1296311, restarts 23 |
| `https://doocardbarbershop.com/` | `HTTP/2 200`, `content-type: text/html; charset=utf-8` |

Both live build files still read `ytyQe_k7jkuz8iEQ7P1gX` after the temporary files were removed.
