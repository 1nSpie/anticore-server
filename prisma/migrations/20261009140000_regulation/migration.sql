-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "regulationAckAt" TIMESTAMP(3),
ADD COLUMN     "regulationAckVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "regulation_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "changeNote" VARCHAR(1000),
    "publishedAt" TIMESTAMP(3),
    "dirty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "regulation_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_sections" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reg_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_articles" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reg_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reg_attachments" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reg_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reg_sections_parentId_sortOrder_idx" ON "reg_sections"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "reg_articles_sectionId_sortOrder_idx" ON "reg_articles"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "reg_attachments_articleId_idx" ON "reg_attachments"("articleId");

-- AddForeignKey
ALTER TABLE "reg_sections" ADD CONSTRAINT "reg_sections_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "reg_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_articles" ADD CONSTRAINT "reg_articles_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "reg_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reg_attachments" ADD CONSTRAINT "reg_attachments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "reg_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

