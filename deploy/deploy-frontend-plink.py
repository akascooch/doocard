#!/usr/bin/env python3
"""Deploy frontend null-safety fixes to production via plink + pscp."""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict

DEFAULT_IP_FILE = Path(r"C:\Users\a.hosseini\Desktop\apk\files\ip.txt")
DEFAULT_HOST_KEY = (
    "ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g"
)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
REMOTE_FRONTEND = "/var/www/doocard/doocard-repo/frontend"

PLINK_CANDIDATES = [
    Path(r"C:\Program Files\PuTTY\plink.exe"),
    Path(r"C:\Program Files (x86)\PuTTY\plink.exe"),
]
PSCP_CANDIDATES = [
    Path(r"C:\Program Files\PuTTY\pscp.exe"),
    Path(r"C:\Program Files (x86)\PuTTY\pscp.exe"),
]

REMOTE_COMMANDS = f"""
set -e
cd {REMOTE_FRONTEND}

echo "=== syncing uploaded src ==="
ls -la src/app/dashboard/customer/page.tsx

echo "=== npm install ==="
npm install

echo "=== npm run build ==="
npm run build

echo "=== verify .next build ==="
ls -la .next

echo "=== restart backend ==="
sudo systemctl restart doocard-backend

echo "=== restart nginx ==="
sudo systemctl restart nginx

echo "=== backend status ==="
sudo systemctl status doocard-backend --no-pager

echo "=== backend logs (last 50) ==="
sudo journalctl -u doocard-backend -n 50 --no-pager
""".strip()


def find_exe(candidates: list[Path], name: str) -> Path:
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    found = shutil.which(name)
    if found:
        return Path(found)
    raise FileNotFoundError(f"{name} not found. Install PuTTY.")


def parse_ip_file(path: Path) -> Dict[str, str]:
    if not path.is_file():
        raise FileNotFoundError(f"Connection file not found: {path}")

    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    values: Dict[str, str] = {}
    keys = ("ip", "user", "port", "password")
    i = 0
    while i < len(lines):
        line = lines[i]
        for key in keys:
            match = re.match(rf"^{key}\s*:\s*(.+)$", line, re.IGNORECASE)
            if match:
                values[key.lower()] = match.group(1).strip()
                break
            if re.match(rf"^{key}\s*:\s*$", line, re.IGNORECASE) and i + 1 < len(lines):
                values[key.lower()] = lines[i + 1].strip()
                i += 1
                break
        i += 1

    missing = [k for k in keys if not values.get(k)]
    if missing:
        raise ValueError(f"Missing field(s) in {path}: {', '.join(missing)}")
    return values


def run_upload(pscp: Path, plink: Path, creds: Dict[str, str]) -> int:
    if not FRONTEND_SRC.is_dir():
        print(f"ERROR: frontend src not found: {FRONTEND_SRC}", file=sys.stderr)
        return 1

    remote_target = f"{creds['user']}@{creds['ip']}:{REMOTE_FRONTEND}/"
    args = [
        str(pscp),
        "-batch",
        "-r",
        "-P",
        creds["port"],
        "-hostkey",
        DEFAULT_HOST_KEY,
        "-pw",
        creds["password"],
        str(FRONTEND_SRC),
        remote_target,
    ]
    print("=" * 60)
    print(f"Uploading {FRONTEND_SRC} -> {remote_target}")
    print("=" * 60)
    return subprocess.run(args).returncode


def run_remote(plink: Path, creds: Dict[str, str]) -> int:
    args = [
        str(plink),
        "-batch",
        "-ssh",
        "-P",
        creds["port"],
        "-l",
        creds["user"],
        "-pw",
        creds["password"],
        "-hostkey",
        DEFAULT_HOST_KEY,
        creds["ip"],
        REMOTE_COMMANDS,
    ]
    print("=" * 60)
    print(f"Running remote deploy on {creds['user']}@{creds['ip']}:{creds['port']}")
    print("=" * 60)
    return subprocess.run(args).returncode


def main() -> int:
    ip_file = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_IP_FILE
    try:
        creds = parse_ip_file(ip_file)
        plink = find_exe(PLINK_CANDIDATES, "plink")
        pscp = find_exe(PSCP_CANDIDATES, "pscp")
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    upload_code = run_upload(pscp, plink, creds)
    if upload_code != 0:
        print(f"Upload failed with exit code {upload_code}", file=sys.stderr)
        return upload_code

    return run_remote(plink, creds)


if __name__ == "__main__":
    raise SystemExit(main())
