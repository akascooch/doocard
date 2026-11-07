-- Add fixed-salary staff roles. Do not apply in the local implementation phase.
-- PostgreSQL 12+ allows ADD VALUE inside a migration transaction.
-- New values must not be used in the same transaction that adds them.
ALTER TYPE "UserRole" ADD VALUE 'KITCHEN';
ALTER TYPE "UserRole" ADD VALUE 'CASHIER';
