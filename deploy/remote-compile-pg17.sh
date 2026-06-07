#!/usr/bin/env bash
set -euo pipefail
LOG=/root/compile-pg17.log
exec > >(tee -a "$LOG") 2>&1
echo "=== PG17 compile start $(date -Is) ==="
apt-get install -y build-essential libreadline-dev zlib1g-dev libssl-dev libicu-dev pkg-config bison flex
cd /root
rm -rf postgresql-17.5
tar xzf postgresql-17.5.tar.gz
cd postgresql-17.5
./configure --prefix=/usr/local/pgsql --with-openssl --with-icu
make -j2 world
make install-world
/usr/local/pgsql/bin/postgres --version
/usr/local/pgsql/bin/pg_restore --version
echo "PG17_COMPILE_DONE"
