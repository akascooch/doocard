-- AlterTable
ALTER TABLE "_BarberToService" ADD CONSTRAINT "_BarberToService_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BarberToService_AB_unique";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "rating" INTEGER;
