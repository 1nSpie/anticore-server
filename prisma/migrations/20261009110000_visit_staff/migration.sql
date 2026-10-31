-- CreateTable
CREATE TABLE "visit_staff" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_staff_staffId_idx" ON "visit_staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "visit_staff_visitId_staffId_key" ON "visit_staff"("visitId", "staffId");

-- AddForeignKey
ALTER TABLE "visit_staff" ADD CONSTRAINT "visit_staff_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_staff" ADD CONSTRAINT "visit_staff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

