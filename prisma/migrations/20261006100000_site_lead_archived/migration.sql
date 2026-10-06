-- AlterTable: заявку можно убрать из списка CRM крестиком (мягкое удаление)
ALTER TABLE "site_leads" ADD COLUMN "archivedAt" TIMESTAMP(3);
