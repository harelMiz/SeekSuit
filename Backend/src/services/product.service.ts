import prisma from '../lib/prisma';
import { CreateProductInput, UpdateProductInput, ProductFilters } from '../types/product.types';

// Insert a new product row into the database.
export const createProduct = async (data: CreateProductInput) => {
  return prisma.product.create({ data });
};

// Fetch all products, optionally filtered by type, status, or color.
// Only filters that are provided will be applied — omitting all returns everything.
// Results are sorted newest first.
export const getAllProducts = async (filters: ProductFilters = {}) => {
  return prisma.product.findMany({
    where: {
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.color && { color: filters.color }),
    },
    orderBy: { createdAt: 'desc' },
  });
};

// Fetch a single product by its unique ID.
// Returns null if no product is found.
export const getProductById = async (id: string) => {
  return prisma.product.findUnique({ where: { id } });
};

// Update only the provided fields of an existing product.
// Prisma handles partial updates natively — unspecified fields remain unchanged.
export const updateProduct = async (id: string, data: UpdateProductInput) => {
  return prisma.product.update({ where: { id }, data });
};

// Permanently delete a product by its unique ID.
export const deleteProduct = async (id: string) => {
  return prisma.product.delete({ where: { id } });
};
