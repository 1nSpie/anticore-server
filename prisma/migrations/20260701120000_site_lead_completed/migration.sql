-- AlterEnum
ALTER TYPE "SiteLeadStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "site_leads" ADD COLUMN "diskLink" TEXT;
