-- Site leads from public forms + manager name on calendar appointments

CREATE TYPE "SiteLeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'SCHEDULED', 'REJECTED');
CREATE TYPE "SiteLeadKind" AS ENUM ('CALLBACK', 'PRICE_REQUEST');

CREATE TABLE "site_leads" (
    "id" SERIAL NOT NULL,
    "kind" "SiteLeadKind" NOT NULL DEFAULT 'CALLBACK',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "carDescription" VARCHAR(500),
    "communicationMethod" VARCHAR(50),
    "pageUrl" VARCHAR(500),
    "status" "SiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "visitId" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_leads_visitId_key" ON "site_leads"("visitId");
CREATE INDEX "site_leads_status_createdAt_idx" ON "site_leads"("status", "createdAt");

ALTER TABLE "site_leads" ADD CONSTRAINT "site_leads_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "managerName" VARCHAR(100);
