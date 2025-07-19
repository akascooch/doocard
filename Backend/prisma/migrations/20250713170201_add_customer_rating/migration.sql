/*
  Warnings:

  - The primary key for the `_BarberToService` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_BarberToService` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "_BarberToService" DROP CONSTRAINT "_BarberToService_AB_pkey";

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "rating" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "_BarberToService_AB_unique" ON "_BarberToService"("A", "B");
