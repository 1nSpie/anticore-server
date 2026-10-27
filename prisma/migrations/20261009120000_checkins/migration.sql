-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "geoConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "checkins" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "location" "CrmLocation" NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracyM" INTEGER,
    "distanceM" INTEGER NOT NULL,
    "outOfRadius" BOOLEAN NOT NULL DEFAULT false,
    "status" "CheckinStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkins_date_location_idx" ON "checkins"("date", "location");

-- CreateIndex
CREATE UNIQUE INDEX "checkins_staffId_date_key" ON "checkins"("staffId", "date");

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

