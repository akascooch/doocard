-- Persist stylist/barber payout deduction audit fields on appointment settlements.
ALTER TABLE "appointments"
ADD COLUMN "barberPayoutGrossAmount" BIGINT,
ADD COLUMN "settlementDeductionAmount" BIGINT,
ADD COLUMN "barberPayoutNetAmount" BIGINT,
ADD COLUMN "deductionPerAppointmentAmount" BIGINT;

