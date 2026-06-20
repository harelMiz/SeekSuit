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

// A single image belonging to a product
export interface ProductImage {
  id: string;
  productId: string;
  rawUrl: string | null;
  processedUrl: string | null;
  isMain: boolean;
  isFrontView: boolean;
  isPublished: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// A single model result inside a VTOJob
export interface VTOResult {
  modelKey:          string;
  url:               string;
  selected:          boolean;
  storagePath?:      string;  // Supabase path inside vto-results bucket
  publishedImageId?: string;  // ProductImage.id if this result was published to gallery
}

export type VTOStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export interface VTOJob {
  id: string;
  productId: string;
  sourceImageId: string;
  runpodJobId: string | null;
  status: VTOStatus;
  errorMsg: string | null;
  results: VTOResult[] | null;
  createdAt: string;
  updatedAt: string;
}

// Full product object as returned by the API (always includes images array)
export interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  color: string;
  status: ProductStatus;
  attributes: Record<string, unknown> | null;
  images: ProductImage[];
  // Populated by the list endpoint only: at most 1 element when a DONE VTOJob exists
  vtoJobs?: { id: string }[];
  createdAt: string;
  updatedAt: string;
}

// Input for creating a new product (images are uploaded separately)
export interface CreateProductInput {
  name: string;
  sku: string;
  type: ProductType;
  color: string;
  status?: ProductStatus;
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

// Helper: return the best display URL for an image (processed > raw)
export function bestImageUrl(image: ProductImage): string | null {
  return image.processedUrl ?? image.rawUrl;
}

// Helper: return the main published image of a product, or the first published, or null
export function mainImage(product: Product): ProductImage | null {
  const published = product.images.filter((img) => img.isPublished);
  return (
    published.find((img) => img.isMain) ??
    published[0] ??
    null
  );
}
