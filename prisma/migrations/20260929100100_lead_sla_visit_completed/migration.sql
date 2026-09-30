-- AlterTable
ALTER TABLE "site_leads" ADD COLUMN "surfacedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Data: «В работе» теперь означает «авто сегодня на подъёмнике».
-- Заявки, которые админ взял, но ещё не записал, → «Обрабатывается».
UPDATE "site_leads" SET "status" = 'PROCESSING'
WHERE "status" = 'IN_PROGRESS' AND "visitId" IS NULL;

-- Уже закрытые заявки → закрываем и их записи в календаре.
UPDATE "visit_history" v SET "completedAt" = COALESCE(l."processedAt", l."updatedAt")
FROM "site_leads" l
WHERE l."visitId" = v."id" AND l."status" = 'COMPLETED' AND v."completedAt" IS NULL;
