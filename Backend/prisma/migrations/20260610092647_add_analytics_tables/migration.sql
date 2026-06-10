-- CreateEnum
CREATE TYPE "QueryType" AS ENUM ('TEXT', 'IMAGE', 'DETECT');

-- CreateEnum
CREATE TYPE "ViewSource" AS ENUM ('BROWSE', 'SEARCH_RESULT', 'SIMILAR');

-- DropIndex
DROP INDEX "ProductImage_embedding_idx";

-- AlterTable
ALTER TABLE "ProductImage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "query" TEXT,
    "queryType" "QueryType" NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "detectedColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductView" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" "ViewSource" NOT NULL,
    "searchQuery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
