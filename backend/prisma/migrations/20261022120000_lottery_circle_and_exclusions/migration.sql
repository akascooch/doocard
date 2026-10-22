-- Additive lottery circle tables, circle-account flag, and nullable arrear contribution link.
-- Forward-only. Does not rewrite existing transactions or payroll.

ALTER TABLE "bank_accounts" ADD COLUMN "isCircleAccount" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "LotteryGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "LotteryCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "LotteryMemberStatus" AS ENUM ('ACTIVE', 'EXITED');
CREATE TYPE "LotteryContributionStatus" AS ENUM ('POSTED', 'ARREARS', 'SKIPPED');
CREATE TYPE "LotteryPayoutStatus" AS ENUM ('POSTED', 'BLOCKED_INSUFFICIENT_POT', 'VOIDED');
CREATE TYPE "LotteryArrearStatus" AS ENUM ('OPEN', 'PARTIAL', 'SETTLED');

CREATE TABLE "lottery_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyAmountRial" BIGINT NOT NULL,
    "cronDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "circleAccountId" INTEGER NOT NULL,
    "status" "LotteryGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_members" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "status" "LotteryMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "prepaidRial" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_cycles" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "cycleIndex" INTEGER NOT NULL,
    "status" "LotteryCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "periodStartYm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_slots" (
    "id" SERIAL NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_contribution_events" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "status" "LotteryContributionStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "transactionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_contribution_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_payout_events" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "slotId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "collectedRial" BIGINT NOT NULL DEFAULT 0,
    "payoutShortfallRial" BIGINT NOT NULL DEFAULT 0,
    "status" "LotteryPayoutStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "transactionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_payout_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lottery_arrears" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "originalRial" BIGINT NOT NULL,
    "status" "LotteryArrearStatus" NOT NULL,
    "contributionEventId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lottery_arrears_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lottery_members_groupId_employeeId_key" ON "lottery_members"("groupId", "employeeId");
CREATE INDEX "lottery_members_groupId_status_idx" ON "lottery_members"("groupId", "status");
CREATE INDEX "lottery_members_employeeId_status_idx" ON "lottery_members"("employeeId", "status");

CREATE UNIQUE INDEX "lottery_cycles_groupId_cycleIndex_key" ON "lottery_cycles"("groupId", "cycleIndex");
CREATE INDEX "lottery_cycles_groupId_status_idx" ON "lottery_cycles"("groupId", "status");

CREATE UNIQUE INDEX "lottery_slots_cycleId_slotIndex_key" ON "lottery_slots"("cycleId", "slotIndex");
CREATE UNIQUE INDEX "lottery_slots_cycleId_periodKey_key" ON "lottery_slots"("cycleId", "periodKey");
CREATE UNIQUE INDEX "lottery_slots_memberId_cycleId_key" ON "lottery_slots"("memberId", "cycleId");
CREATE INDEX "lottery_slots_cycleId_idx" ON "lottery_slots"("cycleId");

CREATE UNIQUE INDEX "lottery_contribution_events_idempotencyKey_key" ON "lottery_contribution_events"("idempotencyKey");
CREATE UNIQUE INDEX "lottery_contribution_events_cycleId_periodKey_memberId_key" ON "lottery_contribution_events"("cycleId", "periodKey", "memberId");
CREATE INDEX "lottery_contribution_events_groupId_periodKey_idx" ON "lottery_contribution_events"("groupId", "periodKey");

CREATE UNIQUE INDEX "lottery_payout_events_idempotencyKey_key" ON "lottery_payout_events"("idempotencyKey");
CREATE UNIQUE INDEX "lottery_payout_events_cycleId_periodKey_key" ON "lottery_payout_events"("cycleId", "periodKey");

CREATE UNIQUE INDEX "lottery_arrears_memberId_cycleId_periodKey_key" ON "lottery_arrears"("memberId", "cycleId", "periodKey");
CREATE INDEX "lottery_arrears_groupId_status_idx" ON "lottery_arrears"("groupId", "status");

ALTER TABLE "lottery_groups" ADD CONSTRAINT "lottery_groups_circleAccountId_fkey" FOREIGN KEY ("circleAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_groups" ADD CONSTRAINT "lottery_groups_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_members" ADD CONSTRAINT "lottery_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_members" ADD CONSTRAINT "lottery_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_cycles" ADD CONSTRAINT "lottery_cycles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_slots" ADD CONSTRAINT "lottery_slots_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "lottery_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_slots" ADD CONSTRAINT "lottery_slots_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "lottery_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_contribution_events" ADD CONSTRAINT "lottery_contribution_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_contribution_events" ADD CONSTRAINT "lottery_contribution_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "lottery_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_contribution_events" ADD CONSTRAINT "lottery_contribution_events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "lottery_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_payout_events" ADD CONSTRAINT "lottery_payout_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_payout_events" ADD CONSTRAINT "lottery_payout_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "lottery_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_payout_events" ADD CONSTRAINT "lottery_payout_events_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "lottery_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_payout_events" ADD CONSTRAINT "lottery_payout_events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "lottery_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_arrears" ADD CONSTRAINT "lottery_arrears_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "lottery_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_arrears" ADD CONSTRAINT "lottery_arrears_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "lottery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_arrears" ADD CONSTRAINT "lottery_arrears_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "lottery_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lottery_arrears" ADD CONSTRAINT "lottery_arrears_contributionEventId_fkey" FOREIGN KEY ("contributionEventId") REFERENCES "lottery_contribution_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
