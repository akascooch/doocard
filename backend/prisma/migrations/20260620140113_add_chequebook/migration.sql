-- CreateEnum
CREATE TYPE "ChequeLeafStatus" AS ENUM ('BLANK', 'ISSUED', 'CLEARED', 'BOUNCED', 'CANCELLED');

-- CreateTable
CREATE TABLE "chequebooks" (
    "id" SERIAL NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "serialNumber" TEXT,
    "startNumber" INTEGER NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chequebooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheque_leaves" (
    "id" SERIAL NOT NULL,
    "chequebookId" INTEGER NOT NULL,
    "leafNumber" INTEGER NOT NULL,
    "status" "ChequeLeafStatus" NOT NULL DEFAULT 'BLANK',
    "amount" BIGINT,
    "payee" TEXT,
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "transactionId" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cheque_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chequebooks_bankAccountId_idx" ON "chequebooks"("bankAccountId");

-- CreateIndex
CREATE INDEX "chequebooks_deletedAt_idx" ON "chequebooks"("deletedAt");

-- CreateIndex
CREATE INDEX "cheque_leaves_chequebookId_status_idx" ON "cheque_leaves"("chequebookId", "status");

-- CreateIndex
CREATE INDEX "cheque_leaves_deletedAt_idx" ON "cheque_leaves"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cheque_leaves_chequebookId_leafNumber_key" ON "cheque_leaves"("chequebookId", "leafNumber");

-- AddForeignKey
ALTER TABLE "chequebooks" ADD CONSTRAINT "chequebooks_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_chequebookId_fkey" FOREIGN KEY ("chequebookId") REFERENCES "chequebooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
