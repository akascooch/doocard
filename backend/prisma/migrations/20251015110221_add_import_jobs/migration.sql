-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."import_jobs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "logPath" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_batchId_key" ON "public"."import_jobs"("batchId");

-- CreateIndex
CREATE INDEX "import_jobs_userId_status_idx" ON "public"."import_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "import_jobs_batchId_idx" ON "public"."import_jobs"("batchId");

-- CreateIndex
CREATE INDEX "import_jobs_createdAt_idx" ON "public"."import_jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."import_jobs" ADD CONSTRAINT "import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
