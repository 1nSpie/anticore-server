-- AlterTable
ALTER TABLE "crm_day_limits" ADD COLUMN "location" "CrmLocation" NOT NULL DEFAULT 'ZHUKOVSKY';

-- DropIndex
DROP INDEX "crm_day_limits_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "crm_day_limits_date_location_key" ON "crm_day_limits"("date", "location");

-- CreateIndex
CREATE INDEX "crm_day_limits_location_date_idx" ON "crm_day_limits"("location", "date");
