#!/bin/bash

echo "Checking appointment prices in database..."

PGPASSWORD='q7T!r9Zp#V4mS2B' psql -h localhost -U doocard_user -d MOVA << 'EOF'
SELECT 
  id, 
  amount,
  CAST(amount AS BIGINT) / 10 AS amount_in_tomans,
  services::jsonb->0->>'priceAtBooking' AS price_in_service
FROM appointments 
ORDER BY id ASC 
LIMIT 10;
EOF

