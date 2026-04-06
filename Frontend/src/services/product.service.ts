import api from "./api";
import axios from "axios";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
} from "../types/product";

// Fetch all products, with optional type/status/color filters
export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const { data } = await api.get<Product[]>("/products", { params: filters });
  return data;
}

// Fetch a single product by its ID
export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`);
  return data;
}

// Create a new product
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

// Upload a raw product image — returns the Supabase storage path
export async function uploadRawImage(
  file: File,
  productId?: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  if (productId) formData.append("productId", productId);

  const { data } = await axios.post<{ storagePath: string }>(
    "/api/uploads/raw",
    formData
  );
  return data.storagePath;
}
