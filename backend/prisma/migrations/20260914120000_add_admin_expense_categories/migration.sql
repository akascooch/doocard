-- CreateTable
CREATE TABLE "admin_expense_categories" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_expense_categories_userId_name_key" ON "admin_expense_categories"("userId", "name");

-- CreateIndex
CREATE INDEX "admin_expense_categories_userId_idx" ON "admin_expense_categories"("userId");

-- AddForeignKey
ALTER TABLE "admin_expense_categories" ADD CONSTRAINT "admin_expense_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "admin_personal_expenses" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "admin_personal_expenses_categoryId_idx" ON "admin_personal_expenses"("categoryId");

-- AddForeignKey
ALTER TABLE "admin_personal_expenses" ADD CONSTRAINT "admin_personal_expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "admin_expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
