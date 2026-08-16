-- CreateTable
CREATE TABLE "client_vehicles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "carId" INTEGER,
    "customLabel" VARCHAR(200),
    "vin" VARCHAR(17),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_vehicles_userId_idx" ON "client_vehicles"("userId");

-- AddForeignKey
ALTER TABLE "client_vehicles" ADD CONSTRAINT "client_vehicles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "cabinet_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_vehicles" ADD CONSTRAINT "client_vehicles_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "vehicleId" INTEGER;

-- CreateIndex
CREATE INDEX "visit_history_vehicleId_idx" ON "visit_history"("vehicleId");

-- AddForeignKey
ALTER TABLE "visit_history" ADD CONSTRAINT "visit_history_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "client_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one vehicle per user that had car/vin/customCar
INSERT INTO "client_vehicles" ("userId", "carId", "customLabel", "vin", "isPrimary", "createdAt", "updatedAt")
SELECT
  u.id,
  u."carId",
  u."customCar",
  u.vin,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cabinet_users" u
WHERE u."carId" IS NOT NULL OR u."customCar" IS NOT NULL OR u.vin IS NOT NULL;

-- Attach existing visits to the primary (only) vehicle of that user
UPDATE "visit_history" v
SET "vehicleId" = cv.id
FROM "client_vehicles" cv
WHERE cv."userId" = v."userId"
  AND cv."isPrimary" = true
  AND v."vehicleId" IS NULL;
