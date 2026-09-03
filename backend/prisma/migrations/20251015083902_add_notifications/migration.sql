-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('CUSTOMER_REGISTERED', 'APPOINTMENT_CREATED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_SETTLED', 'APPOINTMENT_CANCELLED', 'DEBT_CREATED', 'DEBT_SETTLED', 'TRANSACTION_CREATED', 'PAYMENT_RECEIVED', 'GENERAL');

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "roleTarget" TEXT,
    "userIdTarget" INTEGER,
    "relatedEntity" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userIdTarget_isRead_idx" ON "public"."notifications"("userIdTarget", "isRead");

-- CreateIndex
CREATE INDEX "notifications_roleTarget_isRead_idx" ON "public"."notifications"("roleTarget", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "public"."notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userIdTarget_fkey" FOREIGN KEY ("userIdTarget") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
