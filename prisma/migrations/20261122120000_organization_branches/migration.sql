-- CreateTable
CREATE TABLE "organization" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fullName" VARCHAR(200) NOT NULL,
    "brandName" VARCHAR(100) NOT NULL,
    "inn" VARCHAR(12) NOT NULL,
    "ogrnip" VARCHAR(15) NOT NULL,
    "legalAddress" VARCHAR(300) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "signerName" VARCHAR(100) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "location" "CrmLocation" NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "docPrefix" VARCHAR(4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("location")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_docPrefix_key" ON "branches"("docPrefix");

-- Начальные данные: реквизиты из действующих шаблонов договора и актов.
INSERT INTO "organization" ("id", "fullName", "brandName", "inn", "ogrnip", "legalAddress", "phone", "email", "signerName", "updatedAt")
VALUES (1, 'ИП Стражников А.Л.', 'АванКор', '504032243409', '321508100480776',
        '140181, обл Московская, г. Жуковский, ул Маяковского, д. 20, кв. 55',
        '+7(993)-245-68-82', 'anticorpower@mail.ru', 'Стражников А.Л.', CURRENT_TIMESTAMP);

INSERT INTO "branches" ("location", "city", "address", "docPrefix", "updatedAt") VALUES
  ('ZHUKOVSKY',  'Жуковский', '140180, Московская область, г. Жуковский, Речной проезд, 14', 'Ж', CURRENT_TIMESTAMP),
  ('RAMENSKOYE', 'Раменское', 'Московская область, г. Раменское, мкр. Гостица, квартал Западная Гостица, вл. 1', 'Р', CURRENT_TIMESTAMP),
  ('KOLOMNA',    'Коломна',   'Московская область, городской округ Коломна, с. Чанки, ул. Центральная, 152', 'К', CURRENT_TIMESTAMP);
