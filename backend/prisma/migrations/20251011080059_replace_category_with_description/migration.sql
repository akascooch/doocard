/*
  Warnings:

  - You are about to drop the column `category` on the `services` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."services" DROP COLUMN "category",
ADD COLUMN     "description" TEXT;
