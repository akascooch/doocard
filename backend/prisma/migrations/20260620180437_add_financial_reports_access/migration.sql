-- CreateTable
CREATE TABLE "financial_reports_access" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_reports_access_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "financial_reports_access" ADD CONSTRAINT "financial_reports_access_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
