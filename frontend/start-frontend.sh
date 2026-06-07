#!/bin/bash
cd /var/www/doocard/frontend
export PORT=3000
exec node node_modules/next/dist/bin/next start
