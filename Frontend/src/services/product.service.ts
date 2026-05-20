import api from "./api";
import axios from "axios";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
} from "../types/product";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

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

  const { data } = await axios.post<{ imageId: string; rawUrl: string }>(
    `${API_BASE}/api/uploads/raw`,
    formData
  );
  return data;
}

// Delete a specific product image (Storage + DB row)
export async function deleteProductImage(imageId: string): Promise<void> {
  await axios.delete(`${API_BASE}/api/uploads/image/${imageId}`);
}

// Set a specific image as the main image for its product
export async function setMainImage(imageId: string): Promise<void> {
  await axios.patch(`${API_BASE}/api/uploads/image/${imageId}/main`);
}

// Upload multiple files at once — all unassigned (bulk upload flow)
// Returns array of ProductImage rows
export async function uploadBulkImages(files: File[]): Promise<import("../types/product").ProductImage[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const { data } = await axios.post<import("../types/product").ProductImage[]>(
    `${API_BASE}/api/uploads/bulk`,
    formData
  );
  return data;
}

// Fetch all images that have no product yet
export async function getUnassignedImages(): Promise<import("../types/product").ProductImage[]> {
  const { data } = await axios.get<import("../types/product").ProductImage[]>(
    `${API_BASE}/api/uploads/unassigned`
  );
  return data;
}

// Create a new product and assign selected image IDs to it
export async function assignImagesToProduct(
  imageIds: string[],
  product: import("../types/product").CreateProductInput
): Promise<Product> {
  const { data } = await axios.post<Product>(`${API_BASE}/api/uploads/assign`, {
    imageIds,
    product,
  });
  return data;
}

// Trigger AI background removal for ALL unprocessed images of a product
export async function processAllImages(productId: string): Promise<void> {
  await axios.post(`${API_BASE}/api/jobs/product/${productId}`);
}

// Trigger AI background removal for a single image
export async function processImage(imageId: string): Promise<void> {
  await axios.post(`${API_BASE}/api/jobs/image/${imageId}`);
}
