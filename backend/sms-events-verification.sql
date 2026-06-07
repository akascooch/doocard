-- ============================================
-- SMS EVENTS VERIFICATION QUERIES
-- For Post-Deployment Testing & Monitoring
-- ============================================

-- 1. Check if sms_events table exists
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'sms_events';
-- Expected: 1 row showing sms_events table

-- 2. Verify table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sms_events'
ORDER BY ordinal_position;

-- 3. Check indexes on sms_events
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'sms_events';
-- Expected: 3-4 indexes (appointment_id, status, created_at, primary key)

-- 4. Count total SMS events
SELECT COUNT(*) as total_sms_events FROM sms_events;

-- 5. Count by status
SELECT 
  status, 
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sms_events
GROUP BY status
ORDER BY count DESC;

-- 6. Recent SMS events (last 20)
SELECT 
  id,
  appointment_id,
  to,
  LEFT(message, 50) as message_preview,
  status,
  attempts,
  created_at,
  last_attempt_at
FROM sms_events
ORDER BY created_at DESC
LIMIT 20;

-- 7. Failed SMS that need retry
SELECT 
  id,
  appointment_id,
  to,
  status,
  attempts,
  LEFT(provider_resp, 100) as error_preview,
  last_attempt_at
FROM sms_events
WHERE status = 'FAILED' AND attempts < 3
ORDER BY created_at ASC;

-- 8. SMS events for a specific appointment
-- (Replace <APPOINTMENT_ID> with actual ID)
SELECT 
  id,
  to,
  message,
  status,
  attempts,
  provider_resp,
  created_at,
  last_attempt_at
FROM sms_events
WHERE appointment_id = <APPOINTMENT_ID>
ORDER BY created_at ASC;

-- 9. SMS delivery success rate (last 24 hours)
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sms_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 10. Average attempts per SMS
SELECT 
  ROUND(AVG(attempts), 2) as avg_attempts,
  MAX(attempts) as max_attempts,
  MIN(attempts) as min_attempts
FROM sms_events
WHERE status = 'SENT';

-- 11. SMS events with provider errors
SELECT 
  id,
  to,
  status,
  attempts,
  provider_resp,
  created_at
FROM sms_events
WHERE status = 'FAILED' 
  AND provider_resp IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 12. Daily SMS volume
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_sms,
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
FROM sms_events
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

-- 13. Most common failure reasons
SELECT 
  LEFT(provider_resp, 100) as error_message,
  COUNT(*) as occurrences
FROM sms_events
WHERE status = 'FAILED'
  AND provider_resp IS NOT NULL
GROUP BY LEFT(provider_resp, 100)
ORDER BY occurrences DESC
LIMIT 10;

-- 14. Verify MANAGER role exists
SELECT unnest(enum_range(NULL::"UserRole"))::text as available_roles;
-- Expected to include: MANAGER

-- 15. Check users with MANAGER role and phone numbers
SELECT 
  u.id,
  u.name,
  u.phone,
  u.role
FROM users u
WHERE u.role = 'MANAGER'
  AND u.phone IS NOT NULL;
-- These users will receive SMS notifications

-- 16. Check stylists (employees) with phone numbers
SELECT 
  u.id,
  u.name,
  u.phone,
  e.specialty
FROM users u
JOIN employees e ON e.user_id = u.id
WHERE u.phone IS NOT NULL;
-- These stylists will receive SMS for their appointments

-- ============================================
-- POST-DEPLOYMENT TEST VERIFICATION
-- Run after creating a test appointment
-- ============================================

-- Replace <TEST_APPOINTMENT_ID> with the ID from your test
DO $$
DECLARE
  test_appointment_id INT := <TEST_APPOINTMENT_ID>;
  event_count INT;
  sent_count INT;
BEGIN
  -- Check if SMS events were created
  SELECT COUNT(*) INTO event_count
  FROM sms_events
  WHERE appointment_id = test_appointment_id;
  
  RAISE NOTICE 'SMS Events Created: %', event_count;
  
  -- Check how many were sent successfully
  SELECT COUNT(*) INTO sent_count
  FROM sms_events
  WHERE appointment_id = test_appointment_id
    AND status = 'SENT';
    
  RAISE NOTICE 'SMS Successfully Sent: %', sent_count;
  
  -- Show details
  RAISE NOTICE 'Event Details:';
  FOR r IN (
    SELECT id, to, status, attempts 
    FROM sms_events 
    WHERE appointment_id = test_appointment_id
  ) LOOP
    RAISE NOTICE '  Event %: % -> % (attempts: %)', r.id, r.to, r.status, r.attempts;
  END LOOP;
  
  -- Final verdict
  IF sent_count = event_count AND event_count > 0 THEN
    RAISE NOTICE '✅ TEST PASSED: All SMS sent successfully';
  ELSIF sent_count > 0 THEN
    RAISE NOTICE '⚠️ TEST PARTIAL: % of % SMS sent', sent_count, event_count;
  ELSE
    RAISE NOTICE '❌ TEST FAILED: No SMS sent successfully';
  END IF;
END $$;

-- ============================================
-- CLEANUP (Optional - for testing only)
-- ============================================

-- Delete test SMS events (CAUTION: Only use in development/testing)
-- DELETE FROM sms_events WHERE appointment_id = <TEST_APPOINTMENT_ID>;

-- ============================================
-- MONITORING QUERIES (Run Periodically)
-- ============================================

-- Create a view for easy monitoring
CREATE OR REPLACE VIEW sms_monitoring AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  ROUND(AVG(attempts), 2) as avg_attempts
FROM sms_events
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Use the view
SELECT * FROM sms_monitoring WHERE date > CURRENT_DATE - INTERVAL '7 days';

