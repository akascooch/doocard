#!/usr/bin/env python3
"""
Restart Doocard NestJS backend on remote Linux server via PuTTY plink.

Reads connection details from ip.txt and runs systemd path fix + restart.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional

DEFAULT_IP_FILE = Path(r"C:\Users\a.hosseini\Desktop\apk\files\ip.txt")
DEFAULT_HOST_KEY = (
    "ssh-ed25519 255 SHA256:EJ3wNAgZiDp63Pm4yoRx9Ny01DilHKzrZJJQIWGLX1g"
)
PLINK_CANDIDATES = [
    Path(r"C:\Program Files\PuTTY\plink.exe"),
    Path(r"C:\Program Files (x86)\PuTTY\plink.exe"),
]

REMOTE_COMMANDS = r"""
cd /var/www/doocard/doocard-repo

echo "Checking .env file"
ls -la .env

echo "Fixing systemd service paths if needed"
sudo sed -i 's|/var/www/doocard/current|/var/www/doocard/doocard-repo|g' /etc/systemd/system/doocard-backend.service

sudo systemctl daemon-reload

echo "Restarting backend"
sudo systemctl restart doocard-backend

echo "Checking service status"
sudo systemctl status doocard-backend --no-pager
""".strip()


def find_plink() -> Path:
    for candidate in PLINK_CANDIDATES:
        if candidate.is_file():
            return candidate
    found = shutil.which("plink")
    if found:
        return Path(found)
    raise FileNotFoundError(
        "plink.exe not found. Install PuTTY or add plink to PATH.\n"
        "Expected locations:\n"
        + "\n".join(f"  - {p}" for p in PLINK_CANDIDATES)
    )


def parse_ip_file(path: Path) -> Dict[str, str]:
    if not path.is_file():
        raise FileNotFoundError(f"Connection file not found: {path}")

    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    values: Dict[str, str] = {}
    keys = ("ip", "user", "port", "password")
    i = 0
    while i < len(lines):
        line = lines[i]
        for key in keys:
            # Format: key: value
            match = re.match(rf"^{key}\s*:\s*(.+)$", line, re.IGNORECASE)
            if match:
                values[key.lower()] = match.group(1).strip()
                break
            # Format: key:  (value on next line)
            if re.match(rf"^{key}\s*:\s*$", line, re.IGNORECASE):
                if i + 1 < len(lines):
                    values[key.lower()] = lines[i + 1].strip()
                    i += 1
                break
        i += 1

    missing = [k for k in keys if not values.get(k)]
    if missing:
        raise ValueError(
            f"Missing required field(s) in {path}: {', '.join(missing)}"
        )

    if not re.fullmatch(r"\d+", values["port"]):
        raise ValueError(f"Invalid port in {path}: {values['port']!r}")

    return values


def run_plink(
    plink: Path,
    creds: Dict[str, str],
    remote_command: str,
    host_key: str,
) -> int:
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
        host_key,
        creds["ip"],
        remote_command,
    ]

    print("=" * 60)
    print(f"Connecting to {creds['user']}@{creds['ip']}:{creds['port']}")
    print("=" * 60)

    try:
        result = subprocess.run(
            args,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=False,
        )
        return result.returncode
    except FileNotFoundError:
        print(f"ERROR: plink executable missing: {plink}", file=sys.stderr)
        return 127
    except OSError as exc:
        print(f"ERROR: Failed to run plink: {exc}", file=sys.stderr)
        return 1


def main(argv: Optional[list[str]] = None) -> int:
    argv = argv or sys.argv[1:]
    ip_file = Path(argv[0]) if argv else DEFAULT_IP_FILE
    host_key = os.environ.get("DOOCARD_SSH_HOST_KEY", DEFAULT_HOST_KEY)

    print(f"Reading connection details from: {ip_file}")

    try:
        creds = parse_ip_file(ip_file)
        plink = find_plink()
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    exit_code = run_plink(plink, creds, REMOTE_COMMANDS, host_key)

    print("=" * 60)
    if exit_code == 0:
        print("Backend restart completed successfully.")
    else:
        print(f"Remote command failed with exit code {exit_code}.", file=sys.stderr)
        print("Common causes:", file=sys.stderr)
        print("  - Wrong password or blocked SSH port", file=sys.stderr)
        print("  - Host key changed (update DOOCARD_SSH_HOST_KEY)", file=sys.stderr)
        print("  - Service path or permissions issue on server", file=sys.stderr)

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
