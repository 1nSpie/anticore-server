-- CRM: расширение клиентов, записи календаря, справочники, админы

ALTER TABLE "cabinet_users" ADD COLUMN IF NOT EXISTS "vin" VARCHAR(17);
ALTER TABLE "cabinet_users" ADD COLUMN IF NOT EXISTS "adminComment" TEXT;
ALTER TABLE "cabinet_users" ADD COLUMN IF NOT EXISTS "photoReportUrl" VARCHAR(2000);

CREATE TABLE IF NOT EXISTS "service_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_types_name_key" ON "service_types"("name");

ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "priceRub" INTEGER;
ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "serviceTypeId" INTEGER;
ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "reviewSmsSentAt" TIMESTAMP(3);
ALTER TABLE "visit_history" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "visit_history"
SET "startsAt" = ("visitDate"::timestamp + TIME '10:00'),
    "endsAt" = ("visitDate"::timestamp + TIME '11:00')
WHERE "startsAt" IS NULL;

ALTER TABLE "visit_history" DROP CONSTRAINT IF EXISTS "visit_history_serviceTypeId_fkey";
ALTER TABLE "visit_history" ADD CONSTRAINT "visit_history_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "pending_review_sms" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "pending_review_sms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pending_review_sms_visitId_key" ON "pending_review_sms"("visitId");
CREATE INDEX IF NOT EXISTS "pending_review_sms_sendAt_sentAt_idx" ON "pending_review_sms"("sendAt", "sentAt");

ALTER TABLE "pending_review_sms" DROP CONSTRAINT IF EXISTS "pending_review_sms_visitId_fkey";
ALTER TABLE "pending_review_sms" ADD CONSTRAINT "pending_review_sms_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "crm_admins" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_admins_phone_key" ON "crm_admins"("phone");

CREATE TYPE "SmsTemplateKind" AS ENUM ('APPOINTMENT', 'REVIEW', 'BIRTHDAY');

CREATE TABLE IF NOT EXISTS "sms_templates" (
    "kind" "SmsTemplateKind" NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("kind")
);

CREATE TABLE IF NOT EXISTS "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'АванКор',
    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sms_logs" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_logs_phone_kind_sentAt_idx" ON "sms_logs"("phone", "kind", "sentAt");

INSERT INTO "company_settings" ("id", "companyName")
VALUES (1, 'АванКор')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "service_types" ("name", "sortOrder", "active")
VALUES
    ('Диагностика', 1, true),
    ('Шиномонтаж', 2, true),
    ('Кузовной ремонт', 3, true),
    ('Замена масла', 4, true),
    ('Электрика', 5, true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "sms_templates" ("kind", "body")
VALUES
    ('APPOINTMENT', 'Здравствуйте, {NAME}! Запись в {COMPANY} на {DATE} в {TIME}. Услуга: {SERVICE}. Стоимость: {PRICE} руб.'),
    ('REVIEW', '{NAME}, спасибо за визит в {COMPANY}! Будем благодарны за отзыв о нашей работе.'),
    ('BIRTHDAY', 'С днём рождения, {NAME}! Команда {COMPANY} желает вам отличного настроения и надёжного авто!')
ON CONFLICT ("kind") DO NOTHING;
