import { Request, Response } from 'express';
import * as productService from '../services/product.service';
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
// Returns all products, optionally filtered by type, status, or color via query params.
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const filters: ProductFilters = {
      // req.query values can be string | string[] — we only accept single string values
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
// Returns a single product by ID. Responds with 404 if not found.
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
    // Handle product not found (Prisma record not found code)
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    // Handle duplicate SKU (Prisma unique constraint violation code)
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'A product with this SKU already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// DELETE /api/products/:id
// Permanently deletes a product by ID.
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    await productService.deleteProduct(String(req.params.id));
    res.status(204).send();
  } catch (error: any) {
    // Handle product not found (Prisma record not found code)
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete product' });
  }
};
