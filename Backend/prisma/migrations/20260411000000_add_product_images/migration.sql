-- Migration: add_product_images
-- Replaces rawImageUrl/processedImageUrl on Product with a separate ProductImage table.
-- ProcessingJob now references productImageId instead of productId.
-- All existing test data is cleared first.

-- Clear existing test data
DELETE FROM "ProcessingJob";
DELETE FROM "Product";

-- Remove old image columns from Product
ALTER TABLE "Product" DROP COLUMN IF EXISTS "rawImageUrl";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "processedImageUrl";

-- Create ProductImage table
CREATE TABLE "ProductImage" (
  "id"           TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "rawUrl"       TEXT,
  "processedUrl" TEXT,
  "isMain"       BOOLEAN NOT NULL DEFAULT false,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- FK: ProductImage -> Product (cascade delete)
ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old FK and column from ProcessingJob, add new productImageId column
ALTER TABLE "ProcessingJob" DROP CONSTRAINT IF EXISTS "ProcessingJob_productId_fkey";
ALTER TABLE "ProcessingJob" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "ProcessingJob" ADD COLUMN "productImageId" TEXT NOT NULL DEFAULT '';

-- Remove the temporary default
ALTER TABLE "ProcessingJob" ALTER COLUMN "productImageId" DROP DEFAULT;

-- FK: ProcessingJob -> ProductImage (cascade delete)
ALTER TABLE "ProcessingJob"
  ADD CONSTRAINT "ProcessingJob_productImageId_fkey"
  FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
