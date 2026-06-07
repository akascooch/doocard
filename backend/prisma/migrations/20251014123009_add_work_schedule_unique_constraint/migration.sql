/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,weekday,startTime]` on the table `work_schedules` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_employeeId_weekday_startTime_key" ON "work_schedules"("employeeId", "weekday", "startTime");
