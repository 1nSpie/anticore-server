-- AlterTable
ALTER TABLE "pending_registrations" ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "pending_registrations" ADD COLUMN "personalDataConsentAt" TIMESTAMP(3);
ALTER TABLE "pending_registrations" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "cabinet_users" ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "cabinet_users" ADD COLUMN "personalDataConsentAt" TIMESTAMP(3);
ALTER TABLE "cabinet_users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
