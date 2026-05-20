-- Migration: nullable_product_image_product_id
-- Makes ProductImage.productId nullable so images can exist without a product
-- while awaiting assignment in the bulk upload flow.

ALTER TABLE "ProductImage" ALTER COLUMN "productId" DROP NOT NULL;
