-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "clientOpId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_clientOpId_key" ON "appointments"("clientOpId");
