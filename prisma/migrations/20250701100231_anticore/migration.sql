/*
  Warnings:

  - You are about to drop the column `bodyType` on the `BodyTypePrice` table. All the data in the column will be lost.
  - You are about to drop the column `carId` on the `BodyTypePrice` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `BodyTypePrice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[segment]` on the table `BodyTypePrice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `segment` to the `BodyTypePrice` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BodyTypePrice" DROP CONSTRAINT "BodyTypePrice_carId_fkey";

-- AlterTable
ALTER TABLE "BodyTypePrice" DROP COLUMN "bodyType",
DROP COLUMN "carId",
DROP COLUMN "price",
ADD COLUMN     "complexML" INTEGER,
ADD COLUMN     "complexMLBody" INTEGER,
ADD COLUMN     "segment" INTEGER NOT NULL,
ADD COLUMN     "standartML" INTEGER,
ADD COLUMN     "standartMLBody" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BodyTypePrice_segment_key" ON "BodyTypePrice"("segment");
