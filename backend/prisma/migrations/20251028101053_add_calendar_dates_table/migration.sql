-- AlterTable
ALTER TABLE "public"."appointments" ADD COLUMN     "calendarDateId" INTEGER;

-- AlterTable
ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."calendar_dates" (
    "id" SERIAL NOT NULL,
    "gregorianDate" DATE NOT NULL,
    "jalaliDate" TEXT NOT NULL,
    "gregorianDayOfWeek" INTEGER NOT NULL,
    "jalaliDayOfWeek" INTEGER NOT NULL,
    "isoWeek" INTEGER,
    "gregorianYear" INTEGER NOT NULL,
    "gregorianMonth" INTEGER NOT NULL,
    "gregorianDay" INTEGER NOT NULL,
    "jalaliYear" INTEGER NOT NULL,
    "jalaliMonth" INTEGER NOT NULL,
    "jalaliDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_dates_gregorianDate_key" ON "public"."calendar_dates"("gregorianDate");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_dates_jalaliDate_key" ON "public"."calendar_dates"("jalaliDate");

-- CreateIndex
CREATE INDEX "calendar_dates_gregorianDate_idx" ON "public"."calendar_dates"("gregorianDate");

-- CreateIndex
CREATE INDEX "calendar_dates_jalaliDate_idx" ON "public"."calendar_dates"("jalaliDate");

-- CreateIndex
CREATE INDEX "calendar_dates_gregorianYear_gregorianMonth_idx" ON "public"."calendar_dates"("gregorianYear", "gregorianMonth");

-- CreateIndex
CREATE INDEX "calendar_dates_jalaliYear_jalaliMonth_idx" ON "public"."calendar_dates"("jalaliYear", "jalaliMonth");

-- CreateIndex
CREATE INDEX "appointments_calendarDateId_idx" ON "public"."appointments"("calendarDateId");

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_calendarDateId_fkey" FOREIGN KEY ("calendarDateId") REFERENCES "public"."calendar_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
