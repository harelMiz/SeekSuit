import prisma from '../lib/prisma';
import { CreateProductInput, UpdateProductInput, ProductFilters } from '../types/product.types';

// Always include images sorted by order when returning a product.
// vtoJobs: at most 1 DONE job per product — used by the inventory page VTO-ready filter.
const includeImages = {
  images:   { orderBy: { order: 'asc' as const } },
  vtoJobs:  { where: { status: 'DONE' as const }, select: { id: true }, take: 1 },
};

// Insert a new product row into the database.
export const createProduct = async (data: CreateProductInput) => {
  return prisma.product.create({ data, include: includeImages });
};

// Fetch all products, optionally filtered by type, status, or color.
// Results are sorted newest first. Each product includes its images.
export const getAllProducts = async (filters: ProductFilters = {}) => {
  return prisma.product.findMany({
    where: {
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.color && { color: filters.color }),
    },
    orderBy: { createdAt: 'desc' },
    include: includeImages,
  });
};

// Fetch a single product by its unique ID, including all images.
export const getProductById = async (id: string) => {
  return prisma.product.findUnique({ where: { id }, include: includeImages });
};

// Update only the provided fields of an existing product.
export const updateProduct = async (id: string, data: UpdateProductInput) => {
  return prisma.product.update({ where: { id }, data, include: includeImages });
};

// Permanently delete a product by its unique ID.
// ProductImages and ProcessingJobs are cascade-deleted by the DB.
export const deleteProduct = async (id: string) => {
  return prisma.product.delete({ where: { id } });
};

// ── Image helpers ──

// Create a new ProductImage row.
// productId can be null for images uploaded before product assignment.
// If isMain is true and productId is set, demote all other images of that product first.
export const addProductImage = async (
  productId: string | null,
  rawUrl: string,
  isMain: boolean,
  order: number
) => {
  if (isMain && productId) {
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isMain: false },
    });
  }
  return prisma.productImage.create({
    data: { productId, rawUrl, isMain, order },
  });
};

// Assign an unassigned image to a product (bulk upload flow).
export const assignImageToProduct = async (
  imageId: string,
  productId: string,
  isMain: boolean,
  order: number
) => {
  if (isMain) {
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isMain: false },
    });
  }
  return prisma.productImage.update({
    where: { id: imageId },
    data: { productId, isMain, order },
  });
};

// Fetch all ProductImage rows that have no productId (awaiting assignment).
export const getUnassignedImages = async () => {
  return prisma.productImage.findMany({
    where: { productId: null },
    orderBy: { createdAt: 'desc' },
  });
};

// Set one image as main, demoting all others for that product.
export const setMainImage = async (productId: string, imageId: string) => {
  await prisma.productImage.updateMany({
    where: { productId },
    data: { isMain: false },
  });
  return prisma.productImage.update({
    where: { id: imageId },
    data: { isMain: true },
  });
};

// Set the processedUrl, CLIP embedding, and dominant color on a ProductImage after AI processing.
// The embedding is stored via raw SQL because Prisma doesn't support the vector type natively.
export const setProcessedUrl = async (
  imageId: string,
  processedUrl: string,
  embedding?: number[],
  dominantColor?: string
) => {
  await prisma.productImage.update({
    where: { id: imageId },
    data: { processedUrl, ...(dominantColor ? { dominantColor } : {}) },
  });

  if (embedding && embedding.length > 0) {
    const pgVector = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
      UPDATE "ProductImage"
      SET embedding = ${pgVector}::vector
      WHERE id = ${imageId}
    `;
  }
};

// Delete a single ProductImage by ID.
export const deleteProductImage = async (imageId: string) => {
  return prisma.productImage.delete({ where: { id: imageId } });
};

// Fetch a single ProductImage by ID (used by the job controller).
export const getProductImageById = async (imageId: string) => {
  return prisma.productImage.findUnique({ where: { id: imageId } });
};

// Fetch all images for a product.
export const getProductImages = async (productId: string) => {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { order: 'asc' },
  });
};

// Reorder product images: set order 0..n-1 for provided IDs, first becomes isMain.
// All other images for this product are unpublished.
// Throws if any imageId does not belong to productId (prevents IDOR).
export const reorderProductImages = async (productId: string, imageIds: string[]) => {
  const owned = await prisma.productImage.findMany({
    where: { id: { in: imageIds }, productId },
    select: { id: true },
  });
  if (owned.length !== imageIds.length) {
    throw new Error('One or more imageIds do not belong to this product');
  }

  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isMain: false, isPublished: false } }),
    ...imageIds.map((id, idx) =>
      prisma.productImage.update({ where: { id }, data: { order: idx, isMain: idx === 0, isPublished: true } })
    ),
  ]);
};

// Set isPublished=false on a single image (removes from public gallery without deleting).
export const unpublishImage = async (imageId: string) => {
  return prisma.productImage.update({
    where: { id: imageId },
    data: { isPublished: false },
  });
};
