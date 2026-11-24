-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CONTRACT', 'ACCEPTANCE', 'WORKS');

-- CreateEnum
CREATE TYPE "DocumentVersionStatus" AS ENUM ('READY', 'SIGNED', 'VOID');

-- AlterTable
ALTER TABLE "visit_history" ADD COLUMN "docDate" TIMESTAMP(3),
ADD COLUMN "docNumber" VARCHAR(20);

-- CreateTable
CREATE TABLE "document_counters" (
    "prefix" VARCHAR(4) NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentVersionStatus" NOT NULL DEFAULT 'READY',
    "snapshot" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "formedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formedBy" VARCHAR(64) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signedBy" VARCHAR(64),
    "scanKey" VARCHAR(200),
    "voidedAt" TIMESTAMP(3),
    "voidedBy" VARCHAR(64),
    "voidReason" VARCHAR(300),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_visitId_kind_key" ON "documents"("visitId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "visit_history_docNumber_key" ON "visit_history"("docNumber");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visit_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
