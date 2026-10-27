-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'MASTER');

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'MASTER',
    "locations" "CrmLocation"[],
    "blockedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_audit_logs" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER,
    "actor" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(300),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_login_key" ON "staff"("login");

-- CreateIndex
CREATE INDEX "staff_audit_logs_staffId_createdAt_idx" ON "staff_audit_logs"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "staff_audit_logs_action_createdAt_idx" ON "staff_audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "staff_audit_logs" ADD CONSTRAINT "staff_audit_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

