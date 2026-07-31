-- CreateEnum
CREATE TYPE "CrmLocation" AS ENUM ('ZHUKOVSKY', 'RAMENSKOYE', 'KOLOMNA');

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "location" "CrmLocation" NOT NULL DEFAULT 'ZHUKOVSKY';

-- CreateIndex
CREATE INDEX "visit_history_location_startsAt_idx" ON "visit_history"("location", "startsAt");
