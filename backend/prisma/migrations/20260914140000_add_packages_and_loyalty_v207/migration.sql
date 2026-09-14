-- CreateEnum
CREATE TYPE "CustomerPackageStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_package_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceRial" BIGINT NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_package_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_package_templates_serviceId_idx" ON "service_package_templates"("serviceId");
CREATE INDEX "service_package_templates_isActive_idx" ON "service_package_templates"("isActive");

ALTER TABLE "service_package_templates" ADD CONSTRAINT "service_package_templates_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "customer_service_packages" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "packageTemplateId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "remainingSessions" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "CustomerPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_service_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_service_packages_customerId_status_idx" ON "customer_service_packages"("customerId", "status");

ALTER TABLE "customer_service_packages" ADD CONSTRAINT "customer_service_packages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_service_packages" ADD CONSTRAINT "customer_service_packages_packageTemplateId_fkey" FOREIGN KEY ("packageTemplateId") REFERENCES "service_package_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "customer_package_consumptions" (
    "id" TEXT NOT NULL,
    "customerPackageId" TEXT NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_package_consumptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_package_consumptions_appointmentId_key" ON "customer_package_consumptions"("appointmentId");
CREATE UNIQUE INDEX "customer_package_consumptions_customerPackageId_appointmentId_key" ON "customer_package_consumptions"("customerPackageId", "appointmentId");

ALTER TABLE "customer_package_consumptions" ADD CONSTRAINT "customer_package_consumptions_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "customer_service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_package_consumptions" ADD CONSTRAINT "customer_package_consumptions_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "loyalty_point_transactions" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_point_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loyalty_point_transactions_customerId_createdAt_idx" ON "loyalty_point_transactions"("customerId", "createdAt");

ALTER TABLE "loyalty_point_transactions" ADD CONSTRAINT "loyalty_point_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "customer_wallet_ledger" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_wallet_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_wallet_ledger_customerId_createdAt_idx" ON "customer_wallet_ledger"("customerId", "createdAt");

ALTER TABLE "customer_wallet_ledger" ADD CONSTRAINT "customer_wallet_ledger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
