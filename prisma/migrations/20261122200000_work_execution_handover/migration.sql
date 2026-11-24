-- CreateEnum
CREATE TYPE "WorkItemKind" AS ENUM ('AGREED', 'EXTRA');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'DONE', 'PAUSED', 'NEEDS_APPROVAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('PHONE', 'MESSENGER', 'EMAIL', 'IN_PERSON', 'OTHER');

-- AlterTable
ALTER TABLE "visit_work_items" ADD COLUMN "actualVolume" VARCHAR(300),
ADD COLUMN "approvalChannel" "ApprovalChannel",
ADD COLUMN "approvalNote" VARCHAR(300),
ADD COLUMN "approvalStatus" "ApprovalStatus",
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" VARCHAR(120),
ADD COLUMN "defectPlace" VARCHAR(200),
ADD COLUMN "finishedAt" TIMESTAMP(3),
ADD COLUMN "kind" "WorkItemKind" NOT NULL DEFAULT 'AGREED',
ADD COLUMN "masterId" INTEGER,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "status" "WorkStatus" NOT NULL DEFAULT 'WAITING',
ADD COLUMN "termChangeNote" VARCHAR(200),
ADD COLUMN "workNote" VARCHAR(500);

-- AlterTable
ALTER TABLE "visit_photos" ADD COLUMN "workItemId" INTEGER;

-- CreateTable
CREATE TABLE "visit_handovers" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "issuedById" INTEGER,
    "mileageKm" INTEGER,
    "fuelPercent" INTEGER,
    "warrantyBookIssued" BOOLEAN,
    "warrantyTermsExplained" BOOLEAN,
    "warrantyMonths" INTEGER,
    "warrantyStartsAt" DATE,
    "warrantyTerms" VARCHAR(1000),
    "careRecommendations" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_handovers_visitId_key" ON "visit_handovers"("visitId");

-- CreateIndex
CREATE INDEX "visit_photos_workItemId_idx" ON "visit_photos"("workItemId");

-- AddForeignKey
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "visit_work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_handovers" ADD CONSTRAINT "visit_handovers_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_handovers" ADD CONSTRAINT "visit_handovers_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
