#!/bin/bash
set -euo pipefail
APP=/var/www/doocard/backend
cd "$APP"

# Confirm healthy
ss -lntp | grep 3001
grep -n "admin/tips/report" /root/.pm2/logs/doocard-backend-out-14.log 2>/dev/null | tail -5 || \
  grep -n "admin/tips/report" /root/.pm2/logs/doocard-backend-out.log | tail -5 || true

# Ensure util dir
mkdir -p dist/common/utils

# Inline-patch settle tip description in appointments.service.js (no new import needed)
python3 <<'PY'
from pathlib import Path
import re
p = Path('dist/appointments/appointments.service.js')
s = p.read_text(encoding='utf-8')
# common compiled patterns
patterns = [
    (r'description:\s*`انعام نوبت #\$\{id\}`',
     'description: `انعام نوبت #${id} - مشتری: ${(appointment?.customer?.user?.name) || \"نامشخص\"} - آرایشگر: ${(appointment?.employee?.user?.name) || \"نامشخص\"} - نوع: ${tipRecipientType || \"نامشخص\"}`'),
    (r'description:\s*"انعام نوبت #"\s*\+\s*id',
     'description: ("انعام نوبت #" + id + " - مشتری: " + (((appointment.customer||{}).user||{}).name || "نامشخص") + " - آرایشگر: " + (((appointment.employee||{}).user||{}).name || "نامشخص") + " - نوع: " + (tipRecipientType || "نامشخص"))'),
    (r"description:\s*'انعام نوبت #'\s*\+\s*id",
     'description: (\'انعام نوبت #\' + id + \' - مشتری: \' + (((appointment.customer||{}).user||{}).name || \'نامشخص\') + \' - آرایشگر: \' + (((appointment.employee||{}).user||{}).name || \'نامشخص\') + \' - نوع: \' + (tipRecipientType || \'نامشخص\'))'),
]
changed = False
for a,b in patterns:
    ns, n = re.subn(a, b, s, count=1)
    if n:
        s = ns
        changed = True
        print('PATCHED_DESC_PATTERN', a[:40])
        break
if not changed:
    # locate nearby context
    idx = s.find('انعام نوبت #')
    print('DESC_IDX', idx)
    if idx != -1:
        print(repr(s[idx-80:idx+120]))
    raise SystemExit('Could not patch tip description')
p.write_text(s, encoding='utf-8')
print('APPOINTMENTS_DESC_OK')
PY

echo "=== READY FOR ADMIN TIPS OVERLAY ==="
test -f dist/admin/admin-tips.service.js && echo HAS_ADMIN_TIPS=yes
pm2 list
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/admin/tips/report || true
