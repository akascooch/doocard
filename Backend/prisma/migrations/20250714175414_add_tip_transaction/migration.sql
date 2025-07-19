-- CreateEnum
CREATE TYPE "TipTransactionType" AS ENUM ('deposit', 'withdraw');

-- CreateEnum
CREATE TYPE "TipTransactionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "TipTransaction" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" INTEGER,
    "appointmentId" INTEGER,
    "type" "TipTransactionType" NOT NULL,
    "status" "TipTransactionStatus" NOT NULL DEFAULT 'pending',
    "createdById" INTEGER,

    CONSTRAINT "TipTransaction_pkey" PRIMARY KEY ("id")
);
