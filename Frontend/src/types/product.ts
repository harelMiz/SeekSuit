// Product type — matches the ProductType enum in the backend schema
export type ProductType =
  | "JACKET"
  | "PANTS"
  | "SHIRT"
  | "VEST"
  | "SHOES"
  | "TIE"
  | "BOW_TIE"
  | "BELT";

// Product status — matches the ProductStatus enum in the backend schema
export type ProductStatus = "IN_STOCK" | "OUT_OF_STOCK";

// Full product object as returned by the API
export interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  color: string;
  status: ProductStatus;
  rawImageUrl: string | null;
  processedImageUrl: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// Input for creating a new product
export interface CreateProductInput {
  name: string;
  sku: string;
  type: ProductType;
  color: string;
  status?: ProductStatus;
  rawImageUrl?: string;
  processedImageUrl?: string;
  attributes?: Record<string, unknown>;
}

// Input for updating a product — all fields are optional
export type UpdateProductInput = Partial<CreateProductInput>;

// Query filters for the product list endpoint
export interface ProductFilters {
  type?: ProductType;
  status?: ProductStatus;
  color?: string;
}
