import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import * as storageService from '../services/storage.service';
import { ProductFilters } from '../types/product.types';

// POST /api/products
// Creates a new product using the request body.
export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    // Handle duplicate SKU (Prisma unique constraint violation code)
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'A product with this SKU already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// GET /api/products
// Returns all products with their images, optionally filtered by type, status, or color.
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const filters: ProductFilters = {
      type: (req.query.type as string | undefined) as ProductFilters['type'],
      status: (req.query.status as string | undefined) as ProductFilters['status'],
      color: req.query.color as string | undefined,
    };
    const products = await productService.getAllProducts(filters);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// GET /api/products/:id
// Returns a single product with all its images. Responds with 404 if not found.
export const getProductById = async (req: Request, res: Response) => {
  try {
    const product = await productService.getProductById(String(req.params.id));
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// PATCH /api/products/:id
// Updates only the provided fields of an existing product.
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.updateProduct(String(req.params.id), req.body);
    res.status(200).json(product);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'A product with this SKU already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// DELETE /api/products/:id
// Deletes a product. Storage files for all images are removed first,
// then the DB record is deleted (ProductImages cascade automatically).
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.getProductById(String(req.params.id));
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Delete Storage files for every image
    for (const image of product.images) {
      if (image.rawUrl) {
        await storageService.deleteFileBySignedUrl(image.rawUrl, 'raw-images');
      }
      if (image.processedUrl) {
        await storageService.deleteFileBySignedUrl(image.processedUrl, 'processed-images');
      }
    }

    await productService.deleteProduct(String(req.params.id));
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete product' });
  }
};
