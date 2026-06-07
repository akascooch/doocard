-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('BARBER', 'SERVICE');

-- AlterTable
ALTER TABLE "barbers" ADD COLUMN     "type" "StaffType" NOT NULL DEFAULT 'BARBER';
