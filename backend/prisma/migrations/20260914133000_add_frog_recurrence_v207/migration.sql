-- CreateTable
CREATE TABLE "admin_frog_recurrences" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_frog_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_frog_recurrences_userId_isActive_idx" ON "admin_frog_recurrences"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "admin_frog_recurrences" ADD CONSTRAINT "admin_frog_recurrences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
