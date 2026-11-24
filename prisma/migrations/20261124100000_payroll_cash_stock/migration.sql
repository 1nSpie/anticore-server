-- CreateEnum
CREATE TYPE "PayrollRole" AS ENUM ('MASTER', 'RECEIVER');

-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockMoveKind" AS ENUM ('IN', 'OUT', 'ADJUST');

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "receiverId" INTEGER;

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "masterBaseRub" INTEGER NOT NULL DEFAULT 0,
    "receiverBaseRub" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_bonus_types" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "role" "PayrollRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_bonus_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_entries" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "staffId" INTEGER,
    "staffName" VARCHAR(120) NOT NULL,
    "role" "PayrollRole" NOT NULL,
    "baseRub" INTEGER NOT NULL,
    "accruedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_bonuses" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "typeId" INTEGER,
    "title" VARCHAR(80) NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "grantedBy" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_entries" (
    "id" SERIAL NOT NULL,
    "location" "CrmLocation" NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "category" VARCHAR(60),
    "comment" VARCHAR(300),
    "date" DATE NOT NULL,
    "visitId" INTEGER,
    "createdBy" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" VARCHAR(64),
    "voidReason" VARCHAR(300),

    CONSTRAINT "cash_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "minQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "location" "CrmLocation" NOT NULL,
    "kind" "StockMoveKind" NOT NULL,
    "delta" DECIMAL(12,3) NOT NULL,
    "comment" VARCHAR(300),
    "visitId" INTEGER,
    "createdBy" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_entries_staffId_accruedAt_idx" ON "payroll_entries"("staffId", "accruedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_entries_visitId_staffId_role_key" ON "payroll_entries"("visitId", "staffId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_bonuses_entryId_typeId_key" ON "payroll_bonuses"("entryId", "typeId");

-- CreateIndex
CREATE INDEX "cash_entries_location_date_idx" ON "cash_entries"("location", "date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_name_key" ON "stock_items"("name");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_location_idx" ON "stock_movements"("itemId", "location");

-- AddForeignKey
ALTER TABLE "visit_history" ADD CONSTRAINT "visit_history_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_bonuses" ADD CONSTRAINT "payroll_bonuses_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "payroll_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_bonuses" ADD CONSTRAINT "payroll_bonuses_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "payroll_bonus_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;
