-- AlterEnum
ALTER TYPE "SiteLeadStatus" ADD VALUE 'NEEDS_CLARIFICATION';

-- AlterTable
ALTER TABLE "site_leads" ADD COLUMN "followUpAt" TIMESTAMP(3);
