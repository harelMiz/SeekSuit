import api from "./api";
import axios from "axios";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  VTOJob,
} from "../types/product";

// Only used for the AI service (port 8001), which is a separate Docker container
const AI_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:5000").replace(":5000", ":8001");

// Fetch all products (each includes images array)
export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const { data } = await api.get<Product[]>("/products", { params: filters });
  return data;
}

// Fetch a single product by ID (includes images array)
export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`);
  return data;
}

// Create a new product (no images yet — upload separately)
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await api.post<Product>("/products", input);
  return data;
}

// Update an existing product (partial update)
export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  const { data } = await api.patch<Product>(`/products/${id}`, input);
  return data;
}

// Delete a product by ID
export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

// Upload a raw image for a product — creates a ProductImage row
// Returns the new image ID and its rawUrl
export async function uploadRawImage(
  file: File,
  productId: string,
  isMain: boolean,
  order: number
): Promise<{ imageId: string; rawUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("productId", productId);
  formData.append("isMain", String(isMain));
  formData.append("order", String(order));

  const { data } = await api.post<{ imageId: string; rawUrl: string }>("/uploads/raw", formData, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

// Delete a specific product image (Storage + DB row)
export async function deleteProductImage(imageId: string): Promise<void> {
  await api.delete(`/uploads/image/${imageId}`);
}

// Set a specific image as the main image for its product
export async function setMainImage(imageId: string): Promise<void> {
  await api.patch(`/uploads/image/${imageId}/main`);
}

// Upload multiple files at once — all unassigned (bulk upload flow)
// Returns array of ProductImage rows
export async function uploadBulkImages(files: File[]): Promise<import("../types/product").ProductImage[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const { data } = await api.post<import("../types/product").ProductImage[]>("/uploads/bulk", formData, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

// Fetch all images that have no product yet
export async function getUnassignedImages(): Promise<import("../types/product").ProductImage[]> {
  const { data } = await api.get<import("../types/product").ProductImage[]>("/uploads/unassigned");
  return data;
}

// Create a new product and assign selected image IDs to it
export async function assignImagesToProduct(
  imageIds: string[],
  product: import("../types/product").CreateProductInput
): Promise<Product> {
  const { data } = await api.post<Product>("/uploads/assign", { imageIds, product });
  return data;
}

// Trigger AI background removal for ALL unprocessed images of a product
export async function processAllImages(productId: string): Promise<void> {
  await api.post(`/jobs/product/${productId}`);
}

// Trigger AI background removal for a single image
export async function processImage(imageId: string): Promise<void> {
  await api.post(`/jobs/image/${imageId}`);
}

// Queue AI background removal for every image that still lacks a processedUrl
export async function processAllUnprocessed(): Promise<{ queued: number }> {
  const { data } = await api.post<{ queued: number }>("/jobs/process-all");
  return data;
}

// ── VTO (Virtual Try-On) ────────────────────────────────────────────────────

// Mark / unmark a processed image as the front-view source for VTO
export async function setFrontView(imageId: string, isFrontView: boolean): Promise<void> {
  await api.patch(`/vto/image/${imageId}/front-view`, { isFrontView });
}

// Trigger a VTO generation job for a given product + source image.
// selectedModels: folder names to restrict VTO to; omit or empty = all models.
export async function triggerVTO(productId: string, sourceImageId: string, selectedModels?: string[]): Promise<VTOJob> {
  const { data } = await api.post<VTOJob>("/vto/trigger", {
    productId,
    sourceImageId,
    ...(selectedModels && selectedModels.length > 0 && { selectedModels }),
  });
  return data;
}

// Get current status of a VTO job (also triggers RunPod poll on the backend)
export async function getVTOStatus(jobId: string): Promise<VTOJob> {
  const { data } = await api.get<VTOJob>(`/vto/status/${jobId}`);
  return data;
}

// Get all VTO jobs for a product
export async function getProductVTOJobs(productId: string): Promise<VTOJob[]> {
  const { data } = await api.get<VTOJob[]>(`/vto/product/${productId}`);
  return data;
}

// Update which model images are selected for publishing
export async function updateVTOSelections(
  jobId: string,
  selections: Record<string, boolean>
): Promise<VTOJob> {
  const { data } = await api.patch<VTOJob>(`/vto/${jobId}/selections`, { selections });
  return data;
}

// Publish VTO images as ProductImage rows in the specified order (first = main image)
export async function publishVTOImages(
  jobId: string,
  orderedKeys: string[]
): Promise<{ published: number; imageIds: string[] }> {
  const { data } = await api.post<{ published: number; imageIds: string[] }>(
    `/vto/${jobId}/publish`,
    { orderedKeys }
  );
  return data;
}

// Reorder product images: set order 0..n-1 and isMain on first; unpublishes all others
export async function reorderProductImages(productId: string, imageIds: string[]): Promise<void> {
  await api.patch(`/uploads/product/${productId}/reorder`, { imageIds });
}

// Remove an image from the public gallery without deleting it from storage
export async function unpublishImage(imageId: string): Promise<void> {
  await api.patch(`/uploads/image/${imageId}/unpublish`);
}

// Delete a VTO result image from storage and remove it from the job
export async function deleteVTOResult(jobId: string, modelKey: string): Promise<VTOJob> {
  const { data } = await api.delete<VTOJob>(`/vto/${jobId}/result/${encodeURIComponent(modelKey)}`);
  return data;
}

// Ask the AI service whether an image is a front-facing garment
export async function detectFrontView(
  file: File,
  garmentType: string
): Promise<{ isFront: boolean; confidence: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("garment_type", garmentType);
  const { data } = await axios.post<{ isFront: boolean; confidence: number }>(
    `${AI_BASE}/front-detect`,
    formData
  );
  return data;
}
