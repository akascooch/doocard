-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN     "preferredEmployeeId" INTEGER;

-- AlterTable
ALTER TABLE "public"."employees" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_preferredEmployeeId_fkey" FOREIGN KEY ("preferredEmployeeId") REFERENCES "public"."employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
