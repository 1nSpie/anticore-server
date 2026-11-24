-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_SBP', 'INVOICE_IP');

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "discountPercent" DOUBLE PRECISION,
ADD COLUMN "discountRub" INTEGER,
ADD COLUMN "paidRub" INTEGER,
ADD COLUMN "paymentMethod" "PaymentMethod";

-- CreateTable
CREATE TABLE "service_categories" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_option_groups" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "key" VARCHAR(30) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT true,
    "allowCustom" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_options" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "service_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_work_items" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "selections" JSONB NOT NULL,
    "comment" VARCHAR(500),
    "priceRub" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_work_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_option_groups_categoryId_key_key" ON "service_option_groups"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "service_options_groupId_name_key" ON "service_options"("groupId", "name");

-- CreateIndex
CREATE INDEX "visit_work_items_visitId_sortOrder_idx" ON "visit_work_items"("visitId", "sortOrder");

-- AddForeignKey
ALTER TABLE "service_option_groups" ADD CONSTRAINT "service_option_groups_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "service_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_work_items" ADD CONSTRAINT "visit_work_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Начальный справочник по ТЗ §9. Значения групп расширяются из админки; для сварочных работ
-- ТЗ задаёт только состав полей, поэтому начальные значения ориентировочные.
INSERT INTO "service_categories" ("code", "name", "sortOrder") VALUES ('ANTICOR', 'Антикоррозийная обработка', 1);
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'kind', 'Основные виды', true, false, 1 FROM "service_categories" WHERE "code" = 'ANTICOR';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Комплексная обработка', 1), ('Базовая обработка', 2), ('Локальная обработка', 3), ('Обработка скрытых полостей', 4)) AS v("name", "ord") WHERE c."code" = 'ANTICOR' AND g."key" = 'kind';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'addon', 'Дополнительные варианты', true, false, 2 FROM "service_categories" WHERE "code" = 'ANTICOR';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('ML', 1), ('ML + BODY', 2), ('BODY на пороги', 3)) AS v("name", "ord") WHERE c."code" = 'ANTICOR' AND g."key" = 'addon';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'detail', 'Уточняющие параметры', true, true, 3 FROM "service_categories" WHERE "code" = 'ANTICOR';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('С разбором', 1), ('Без разбора', 2), ('Двойные подкрылки', 3), ('Установка элементов', 4)) AS v("name", "ord") WHERE c."code" = 'ANTICOR' AND g."key" = 'detail';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'zones', 'Зоны автомобиля', true, true, 4 FROM "service_categories" WHERE "code" = 'ANTICOR';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Днище', 1), ('Арки', 2), ('Пороги', 3), ('Двери', 4), ('Капот', 5), ('Крышка багажника', 6), ('Лонжероны', 7), ('Рама', 8)) AS v("name", "ord") WHERE c."code" = 'ANTICOR' AND g."key" = 'zones';
INSERT INTO "service_categories" ("code", "name", "sortOrder") VALUES ('WELDING', 'Сварочные и кузовные восстановительные работы', 2);
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'operation', 'Вид операции', false, false, 1 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Замена', 1), ('Ремонт', 2), ('Усиление', 3), ('Восстановление', 4)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'operation';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'element', 'Кузовной элемент', true, true, 2 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Порог', 1), ('Арка колёсная', 2), ('Пол', 3), ('Лонжерон', 4), ('Крыло', 5), ('Дверь', 6), ('Крышка багажника', 7), ('Капот', 8)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'element';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'side', 'Сторона', true, false, 3 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Левая', 1), ('Правая', 2), ('Передняя', 3), ('Задняя', 4)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'side';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'area', 'Участок повреждения', true, true, 4 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Передняя часть', 1), ('Задняя часть', 2), ('Центральная часть', 3), ('Колёсная арка', 4)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'area';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'method', 'Способ восстановления', true, true, 5 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Вварка ремонтной вставки', 1), ('Наложение заплаты', 2), ('Рихтовка', 3), ('Замена элемента целиком', 4)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'method';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'materials', 'Заменяемые элементы и материалы', true, true, 6 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Ремонтная вставка', 1), ('Металл', 2), ('Герметик', 3), ('Грунт', 4)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'materials';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'conditions', 'Дополнительные условия', true, true, 7 FROM "service_categories" WHERE "code" = 'WELDING';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Требуется демонтаж', 1), ('Требуется покраска', 2)) AS v("name", "ord") WHERE c."code" = 'WELDING' AND g."key" = 'conditions';
INSERT INTO "service_categories" ("code", "name", "sortOrder") VALUES ('LASER', 'Лазерная очистка коррозии', 3);
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'zones', 'Элементы и зоны очистки', true, true, 1 FROM "service_categories" WHERE "code" = 'LASER';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Днище', 1), ('Арки', 2), ('Пороги', 3), ('Двери', 4), ('Капот', 5), ('Крышка багажника', 6), ('Лонжероны', 7), ('Рама', 8)) AS v("name", "ord") WHERE c."code" = 'LASER' AND g."key" = 'zones';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'volume', 'Объём работ', false, false, 2 FROM "service_categories" WHERE "code" = 'LASER';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Полный', 1), ('Частичный', 2), ('Локальный', 3)) AS v("name", "ord") WHERE c."code" = 'LASER' AND g."key" = 'volume';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'features', 'Особенности', true, true, 3 FROM "service_categories" WHERE "code" = 'LASER';
INSERT INTO "service_categories" ("code", "name", "sortOrder") VALUES ('UNDERBODY_WASH', 'Мойка днища', 4);
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'mode', 'Вариант', false, false, 1 FROM "service_categories" WHERE "code" = 'UNDERBODY_WASH';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('С разбором', 1), ('Без разбора', 2)) AS v("name", "ord") WHERE c."code" = 'UNDERBODY_WASH' AND g."key" = 'mode';
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'dismantle', 'Объём демонтажа', true, true, 2 FROM "service_categories" WHERE "code" = 'UNDERBODY_WASH';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Подкрылки', 1), ('Защита картера', 2), ('Пластиковые элементы днища', 3)) AS v("name", "ord") WHERE c."code" = 'UNDERBODY_WASH' AND g."key" = 'dismantle';
INSERT INTO "service_categories" ("code", "name", "sortOrder") VALUES ('DIAGNOSTICS', 'Диагностика', 5);
INSERT INTO "service_option_groups" ("categoryId", "key", "label", "multiple", "allowCustom", "sortOrder") SELECT "id", 'kind', 'Вид диагностики', false, true, 1 FROM "service_categories" WHERE "code" = 'DIAGNOSTICS';
INSERT INTO "service_options" ("groupId", "name", "sortOrder") SELECT g."id", v."name", v."ord" FROM "service_option_groups" g JOIN "service_categories" c ON c."id" = g."categoryId" CROSS JOIN (VALUES ('Первичная', 1), ('Повторная', 2), ('Перед сварочными работами', 3), ('Перед антикоррозийной обработкой', 4)) AS v("name", "ord") WHERE c."code" = 'DIAGNOSTICS' AND g."key" = 'kind';
