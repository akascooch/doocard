-- Product packaging (per-product sell units) plus historical snapshots on stock/sales rows.
CREATE TABLE "product_packagings" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "unitsPerPackage" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_packagings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_packagings_productId_isActive_idx" ON "product_packagings"("productId", "isActive");

ALTER TABLE "product_packagings"
    ADD CONSTRAINT "product_packagings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
    ADD COLUMN "packagingId" INTEGER,
    ADD COLUMN "packagingName" TEXT,
    ADD COLUMN "packagingUnit" TEXT,
    ADD COLUMN "unitsPerPackage" INTEGER;

ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_packagingId_fkey"
    FOREIGN KEY ("packagingId") REFERENCES "product_packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_products"
    ADD COLUMN "packagingId" INTEGER,
    ADD COLUMN "packagingName" TEXT,
    ADD COLUMN "packagingUnit" TEXT,
    ADD COLUMN "unitsPerPackage" INTEGER;

ALTER TABLE "appointment_products"
    ADD CONSTRAINT "appointment_products_packagingId_fkey"
    FOREIGN KEY ("packagingId") REFERENCES "product_packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
    ADD COLUMN "packagingId" INTEGER,
    ADD COLUMN "packagingName" TEXT,
    ADD COLUMN "packagingUnit" TEXT,
    ADD COLUMN "unitsPerPackage" INTEGER;

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_packagingId_fkey"
    FOREIGN KEY ("packagingId") REFERENCES "product_packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
