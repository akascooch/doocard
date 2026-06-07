#!/usr/bin/env bash
sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM appointments WHERE "deletedAt" IS NULL;'
sudo -u postgres psql -d doocard -tAc 'SELECT COUNT(*) FROM "User";'
sudo -u postgres psql -d doocard -tAc 'SELECT tablename FROM pg_tables WHERE schemaname='"'"'public'"'"' LIMIT 10;'
