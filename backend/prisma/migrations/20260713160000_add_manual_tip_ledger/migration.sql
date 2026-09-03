-- Manual tip ledger (appointment tips remain on appointments / appointment_tip_allocations).
-- Non-destructive: CREATE TYPE / CREATE TABLE / CREATE INDEX only.

CREATE TYPE "TipSourceOrigin" AS ENUM ('MANUAL');
CREATE TYPE "TipSourceStatus" AS ENUM ('ACTIVE', 'VOIDED');

CREATE TABLE "tip_sources" (
    "id" SERIAL NOT NULL,
    "origin" "TipSourceOrigin" NOT NULL DEFAULT 'MANUAL',
    "tipType" "TipRecipientType" NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "effectiveBusinessAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "TipSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" INTEGER,
    "voidReason" TEXT,
    "recipientEmployeeId" INTEGER,
    "teamMemberIds" JSONB,
    CONSTRAINT "tip_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "manual_tip_allocations" (
    "id" SERIAL NOT NULL,
    "tipSourceId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "paidInSettlementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "manual_tip_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tip_sources_idempotencyKey_key" ON "tip_sources"("idempotencyKey");
CREATE INDEX "tip_sources_effectiveBusinessAt_idx" ON "tip_sources"("effectiveBusinessAt");
CREATE INDEX "tip_sources_status_tipType_idx" ON "tip_sources"("status", "tipType");
CREATE INDEX "tip_sources_createdByUserId_idx" ON "tip_sources"("createdByUserId");

CREATE UNIQUE INDEX "manual_tip_allocations_tipSourceId_employeeId_key" ON "manual_tip_allocations"("tipSourceId", "employeeId");
CREATE INDEX "manual_tip_allocations_employeeId_idx" ON "manual_tip_allocations"("employeeId");
CREATE INDEX "manual_tip_allocations_paidInSettlementId_idx" ON "manual_tip_allocations"("paidInSettlementId");

ALTER TABLE "tip_sources" ADD CONSTRAINT "tip_sources_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tip_sources" ADD CONSTRAINT "tip_sources_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tip_sources" ADD CONSTRAINT "tip_sources_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "manual_tip_allocations" ADD CONSTRAINT "manual_tip_allocations_tipSourceId_fkey" FOREIGN KEY ("tipSourceId") REFERENCES "tip_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manual_tip_allocations" ADD CONSTRAINT "manual_tip_allocations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_tip_allocations" ADD CONSTRAINT "manual_tip_allocations_paidInSettlementId_fkey" FOREIGN KEY ("paidInSettlementId") REFERENCES "employee_commission_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
