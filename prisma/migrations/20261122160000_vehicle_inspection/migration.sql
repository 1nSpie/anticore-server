-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('SCRATCH', 'DENT', 'CORROSION', 'CHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "PhotoStage" AS ENUM ('RECEPTION', 'WORK_BEFORE', 'WORK_AFTER', 'ISSUE');

-- CreateEnum
CREATE TYPE "PhotoSection" AS ENUM ('GENERAL', 'EXTERIOR', 'INTERIOR');

-- CreateTable
CREATE TABLE "vehicle_inspections" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "receivedById" INTEGER,
    "mileageKm" INTEGER,
    "fuelPercent" INTEGER,
    "keysCount" INTEGER,
    "noDefectsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "exteriorNote" VARCHAR(2000),
    "interior" JSONB,
    "interiorNote" VARCHAR(2000),
    "systems" JSONB,
    "systemsNote" VARCHAR(2000),
    "specialTerms" VARCHAR(2000),
    "note" VARCHAR(2000),
    "dataVerifiedAt" TIMESTAMP(3),
    "dataVerifiedBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_marks" (
    "id" SERIAL NOT NULL,
    "inspectionId" INTEGER NOT NULL,
    "type" "DamageType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "element" VARCHAR(100) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_photos" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "stage" "PhotoStage" NOT NULL DEFAULT 'RECEPTION',
    "section" "PhotoSection" NOT NULL DEFAULT 'GENERAL',
    "markId" INTEGER,
    "key" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_inspections_visitId_key" ON "vehicle_inspections"("visitId");

-- CreateIndex
CREATE INDEX "inspection_marks_inspectionId_idx" ON "inspection_marks"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "visit_photos_key_key" ON "visit_photos"("key");

-- CreateIndex
CREATE INDEX "visit_photos_visitId_stage_idx" ON "visit_photos"("visitId", "stage");

-- CreateIndex
CREATE INDEX "visit_photos_markId_idx" ON "visit_photos"("markId");

-- AddForeignKey
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_marks" ADD CONSTRAINT "inspection_marks_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "vehicle_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_markId_fkey" FOREIGN KEY ("markId") REFERENCES "inspection_marks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
