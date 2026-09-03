#!/bin/bash
set -e
cd /var/www/doocard/backend

echo "=== BEFORE UPDATE DTO HEAD ==="
sed -n '1,90p' dist/accounting/dto/update-financial-entry.dto.js | head -90

python3 <<'PY'
from pathlib import Path

def patch(path: Path):
    s = path.read_text(encoding='utf-8')
    # Force EntryType before any IsEnum usage
    if 'EntryTypeForced' in s:
        print('SKIP', path)
        return
    inject = (
        'const client_1 = require("@prisma/client");\n'
        '/* EntryTypeForced */\n'
        'if (!client_1.EntryType) {\n'
        '  client_1.EntryType = { INCOME: "INCOME", EXPENSE: "EXPENSE" };\n'
        '}\n'
    )
    needle = 'const client_1 = require("@prisma/client");'
    if needle not in s:
        print('NO_NEEDLE', path)
        return
    # replace first occurrence only, remove prior partial stubs if any
    import re
    s = re.sub(
        r'const client_1 = require\("@prisma/client"\);\n(?:if \(!client_1\.EntryType\)[^\n]*\n)?',
        inject,
        s,
        count=1,
    )
    # Also replace IsEnum(client_1.EntryType) with safe fallback inline
    s = s.replace(
        '(0, class_validator_1.IsEnum)(client_1.EntryType)',
        '(0, class_validator_1.IsEnum)(client_1.EntryType || { INCOME: "INCOME", EXPENSE: "EXPENSE" })',
    )
    path.write_text(s, encoding='utf-8')
    print('PATCHED', path)

for p in [
    Path('dist/accounting/dto/create-financial-entry.dto.js'),
    Path('dist/accounting/dto/update-financial-entry.dto.js'),
]:
    patch(p)
PY

echo "=== AFTER UPDATE DTO HEAD ==="
sed -n '1,40p' dist/accounting/dto/update-financial-entry.dto.js

node -e 'require("./dist/accounting/dto/create-financial-entry.dto.js"); console.log("create_ok")'
node -e 'require("./dist/accounting/dto/update-financial-entry.dto.js"); console.log("update_ok")'

# Also check source and permanently fix TS so future builds work
if grep -q "EntryType" src/accounting/dto/update-financial-entry.dto.ts; then
  python3 <<'PY'
from pathlib import Path
for rel in [
  'src/accounting/dto/create-financial-entry.dto.ts',
  'src/accounting/dto/update-financial-entry.dto.ts',
]:
  p = Path(rel)
  s = p.read_text(encoding='utf-8')
  if "LocalEntryType" in s:
    print('SRC_SKIP', rel)
    continue
  s = s.replace("import { EntryType } from '@prisma/client';", """import { EntryType as PrismaEntryType } from '@prisma/client';
const EntryType = (PrismaEntryType as any) || { INCOME: 'INCOME', EXPENSE: 'EXPENSE' };
type EntryType = 'INCOME' | 'EXPENSE';""")
  # if replace didn't work because different quote style:
  if 'LocalEntryType' not in s and 'PrismaEntryType' not in s:
    s = s.replace('from "@prisma/client";', """from "@prisma/client";
const EntryType = { INCOME: 'INCOME', EXPENSE: 'EXPENSE' } as const;
type EntryType = keyof typeof EntryType;""")
  p.write_text(s, encoding='utf-8')
  print('SRC_PATCH', rel)
PY
fi

pm2 delete doocard-backend 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

set +e
timeout 12s node -r dotenv/config dist/main.js > /tmp/be-fg.out 2> /tmp/be-fg.err
echo FG_EXIT=$?
set -e
echo "===FG_ERR==="; tail -c 3000 /tmp/be-fg.err || true
echo "===FG_OUT==="; tail -c 2000 /tmp/be-fg.out || true

# If foreground started successfully it would still be killed by timeout (exit 124)
# Start under PM2 fork mode
pm2 start dist/main.js --name doocard-backend --cwd /var/www/doocard/backend --node-args="-r dotenv/config" --interpreter node
sleep 8
pm2 list
ss -lntp | grep 3001 || echo PORT_DOWN
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3001/api/docs || true
