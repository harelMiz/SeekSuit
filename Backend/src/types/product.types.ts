import { type Prisma, ProductType, ProductStatus } from '@prisma/client';

// Shape of the request body when creating a new product.
// name, sku, and type are required — everything else is optional.
export interface CreateProductInput {
  name: string;
  sku: string;
  type: ProductType;
  color?: string;
  status?: ProductStatus;
  rawImageUrl?: string;
  processedImageUrl?: string;
  attributes?: Prisma.InputJsonObject;
}

// Shape of the request body when updating an existing product (PATCH).
// All fields are optional — only the provided fields will be updated.
export interface UpdateProductInput {
  name?: string;
  sku?: string;
  type?: ProductType;
  color?: string;
  status?: ProductStatus;
  rawImageUrl?: string;
  processedImageUrl?: string;
  attributes?: Prisma.InputJsonObject;
}

// Optional query parameters for filtering the product list.
// Used in GET /api/products?type=JACKET&status=IN_STOCK
export interface ProductFilters {
  type?: ProductType;
  status?: ProductStatus;
  color?: string;
}
