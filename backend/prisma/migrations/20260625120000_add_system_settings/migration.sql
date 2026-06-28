-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "autoBackupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupIntervalDays" INTEGER NOT NULL DEFAULT 7,
    "backupPath" TEXT,
    "lastBackupDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Singleton row
INSERT INTO "system_settings" ("id", "autoBackupEnabled", "backupIntervalDays", "updatedAt")
VALUES (1, false, 7, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
