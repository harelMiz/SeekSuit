/*
  Warnings:

  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Product` table. All the data in the column will be lost.
  - Added the required column `type` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('JACKET', 'PANTS', 'SHIRT', 'VEST', 'SHOES', 'TIE', 'BOW_TIE', 'BELT');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK');

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "price",
DROP COLUMN "quantity",
ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "processedImageUrl" TEXT,
ADD COLUMN     "rawImageUrl" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN     "type" "ProductType" NOT NULL;
