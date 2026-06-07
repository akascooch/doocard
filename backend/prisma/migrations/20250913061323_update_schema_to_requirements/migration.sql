/*
  Warnings:

  - The values [NORMAL,TRANSFER,PERSONAL_PAYMENT] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `barberId` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `followUpSent` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `reminderSent` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `barberId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `birthDate` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `barberId` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `isPaid` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `month` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `salaryType` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `salaries` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `appointmentId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `bankAccountId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `barberId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `financialEntryId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `transactionType` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `users` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `BarberWithdrawalRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Setting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_BarberToService` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `barbers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `financial_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `financial_entries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tip_transactions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `appointmentDate` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceId` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `salaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodEnd` to the `salaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodStart` to the `salaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `durationMinutes` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'ONLINE');

-- CreateEnum
CREATE TYPE "public"."SalaryStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TransactionType_new" AS ENUM ('SERVICE', 'TIP', 'EXPENSE', 'SALARY');
ALTER TABLE "public"."transactions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "public"."transactions" ALTER COLUMN "type" TYPE "public"."TransactionType_new" USING ("type"::text::"public"."TransactionType_new");
ALTER TYPE "public"."TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "public"."TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "public"."TransactionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."BarberWithdrawalRequest" DROP CONSTRAINT "BarberWithdrawalRequest_barberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_BarberToService" DROP CONSTRAINT "_BarberToService_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_BarberToService" DROP CONSTRAINT "_BarberToService_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_barberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_barberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."financial_entries" DROP CONSTRAINT "financial_entries_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."financial_entries" DROP CONSTRAINT "financial_entries_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."profiles" DROP CONSTRAINT "profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."salaries" DROP CONSTRAINT "salaries_barberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."tip_transactions" DROP CONSTRAINT "tip_transactions_staffId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_barberId_fkey";

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_financialEntryId_fkey";

-- DropIndex
DROP INDEX "public"."customers_phoneNumber_key";

-- DropIndex
DROP INDEX "public"."users_email_key";

-- DropIndex
DROP INDEX "public"."users_phoneNumber_key";

-- AlterTable
ALTER TABLE "public"."appointments" DROP COLUMN "barberId",
DROP COLUMN "date",
DROP COLUMN "followUpSent",
DROP COLUMN "notes",
DROP COLUMN "reminderSent",
ADD COLUMN     "appointmentDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "employeeId" INTEGER NOT NULL,
ADD COLUMN     "serviceId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."customers" DROP COLUMN "barberId",
DROP COLUMN "birthDate",
DROP COLUMN "email",
DROP COLUMN "firstName",
DROP COLUMN "gender",
DROP COLUMN "isActive",
DROP COLUMN "lastName",
DROP COLUMN "phoneNumber",
DROP COLUMN "rating",
ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."salaries" DROP COLUMN "barberId",
DROP COLUMN "description",
DROP COLUMN "endDate",
DROP COLUMN "isPaid",
DROP COLUMN "month",
DROP COLUMN "paidAt",
DROP COLUMN "salaryType",
DROP COLUMN "startDate",
ADD COLUMN     "employeeId" INTEGER NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "public"."SalaryStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."services" DROP COLUMN "description",
DROP COLUMN "duration",
DROP COLUMN "isActive",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."transactions" DROP COLUMN "appointmentId",
DROP COLUMN "bankAccountId",
DROP COLUMN "barberId",
DROP COLUMN "category",
DROP COLUMN "description",
DROP COLUMN "financialEntryId",
DROP COLUMN "paymentMethod",
DROP COLUMN "status",
DROP COLUMN "transactionType",
ADD COLUMN     "method" "public"."PaymentMethod" NOT NULL,
ADD COLUMN     "relatedId" INTEGER,
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "firstName",
DROP COLUMN "isActive",
DROP COLUMN "lastName",
DROP COLUMN "phoneNumber",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "public"."BarberWithdrawalRequest";

-- DropTable
DROP TABLE "public"."Setting";

-- DropTable
DROP TABLE "public"."_BarberToService";

-- DropTable
DROP TABLE "public"."bank_accounts";

-- DropTable
DROP TABLE "public"."barbers";

-- DropTable
DROP TABLE "public"."financial_categories";

-- DropTable
DROP TABLE "public"."financial_entries";

-- DropTable
DROP TABLE "public"."profiles";

-- DropTable
DROP TABLE "public"."tip_transactions";

-- DropEnum
DROP TYPE "public"."EntryStatus";

-- DropEnum
DROP TYPE "public"."EntryType";

-- DropEnum
DROP TYPE "public"."Gender";

-- DropEnum
DROP TYPE "public"."Role";

-- DropEnum
DROP TYPE "public"."StaffType";

-- DropEnum
DROP TYPE "public"."TipTransactionStatus";

-- DropEnum
DROP TYPE "public"."TipTransactionType";

-- DropEnum
DROP TYPE "public"."TransactionCategory";

-- DropEnum
DROP TYPE "public"."TransactionStatus";

-- DropEnum
DROP TYPE "public"."WithdrawalStatus";

-- CreateTable
CREATE TABLE "public"."employees" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "specialty" TEXT,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."CategoryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tips" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."homepage_details" (
    "id" SERIAL NOT NULL,
    "about" TEXT,
    "team" TEXT,
    "products" TEXT,
    "trainings" TEXT,
    "testimonials" TEXT,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "public"."employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_userId_key" ON "public"."customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- AddForeignKey
ALTER TABLE "public"."employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tips" ADD CONSTRAINT "tips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salaries" ADD CONSTRAINT "salaries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
