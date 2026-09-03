-- Historical stub restored for local migrate history parity.
-- Applied on local DB (one finished row + one rolled_back duplicate row).
-- Adds composite index used by local employee_withdrawal_requests table.

CREATE INDEX IF NOT EXISTS "employee_withdrawal_requests_employeeId_status_requestedAt_idx"
  ON "employee_withdrawal_requests"("employeeId", "status", "requestedAt");
