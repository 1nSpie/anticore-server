-- AlterTable
ALTER TABLE "cabinet_users" ADD COLUMN "noPatronymic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "client_vehicles" ADD COLUMN "plate" VARCHAR(15),
ADD COLUMN "year" INTEGER;
