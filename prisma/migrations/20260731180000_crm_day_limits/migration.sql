-- CreateTable
CREATE TABLE "crm_day_limits" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "maxAppointments" INTEGER NOT NULL,
    "note" VARCHAR(300),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_day_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_day_limits_date_key" ON "crm_day_limits"("date");
