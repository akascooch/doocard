-- Additive waitlist for out-of-stock shop products (no notification send in this migration).

CREATE TYPE "StockWaitlistChannel" AS ENUM ('SMS', 'IN_APP');
CREATE TYPE "StockWaitlistStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'NOTIFIED');

CREATE TABLE "product_stock_subscriptions" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "channel" "StockWaitlistChannel" NOT NULL DEFAULT 'SMS',
    "status" "StockWaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "product_stock_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_stock_subscriptions_userId_status_idx"
  ON "product_stock_subscriptions"("userId", "status");
CREATE INDEX "product_stock_subscriptions_productId_status_idx"
  ON "product_stock_subscriptions"("productId", "status");
CREATE INDEX "product_stock_subscriptions_phone_status_idx"
  ON "product_stock_subscriptions"("phone", "status");

CREATE UNIQUE INDEX "product_stock_subscriptions_active_product_user_key"
  ON "product_stock_subscriptions"("productId", "userId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "product_stock_subscriptions"
  ADD CONSTRAINT "product_stock_subscriptions_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_stock_subscriptions"
  ADD CONSTRAINT "product_stock_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
