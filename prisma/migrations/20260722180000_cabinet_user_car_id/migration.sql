-- Align cabinet_users with Prisma schema: carId FK instead of legacy carModel/avatarUrl

ALTER TABLE "cabinet_users" ADD COLUMN IF NOT EXISTS "carId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cabinet_users_carId_fkey'
  ) THEN
    ALTER TABLE "cabinet_users"
      ADD CONSTRAINT "cabinet_users_carId_fkey"
      FOREIGN KEY ("carId") REFERENCES "Car"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Перенос старого текстового carModel в customCar (если колонка ещё есть)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cabinet_users' AND column_name = 'carModel'
  ) THEN
    UPDATE "cabinet_users"
    SET "customCar" = COALESCE(NULLIF(BTRIM("customCar"), ''), NULLIF(BTRIM("carModel"), ''))
    WHERE ("customCar" IS NULL OR BTRIM("customCar") = '')
      AND "carModel" IS NOT NULL
      AND BTRIM("carModel") <> '';

    ALTER TABLE "cabinet_users" DROP COLUMN "carModel";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cabinet_users' AND column_name = 'avatarUrl'
  ) THEN
    ALTER TABLE "cabinet_users" DROP COLUMN "avatarUrl";
  END IF;
END $$;
