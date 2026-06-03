-- Add AI-detected dominant color column to ProductImage.
-- Populated by the /process endpoint going forward; existing rows stay NULL
-- until a backfill script is run.
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "dominantColor" TEXT;
