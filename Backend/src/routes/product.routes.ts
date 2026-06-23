import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// POST   /api/products        — create a new product (admin only)
// GET    /api/products        — get all products (public)
router.route('/')
      .post(requireAdmin, createProduct)
      .get(getAllProducts);

// GET    /api/products/:id    — get a single product by ID (public)
// PATCH  /api/products/:id    — update a product's fields (admin only)
// DELETE /api/products/:id    — delete a product (admin only)
router.route('/:id')
      .get(getProductById)
      .patch(requireAdmin, updateProduct)
      .delete(requireAdmin, deleteProduct);

export default router;
