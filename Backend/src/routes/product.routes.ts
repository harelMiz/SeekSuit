import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';

const router = Router();

// POST   /api/products        — create a new product
// GET    /api/products        — get all products (supports ?type=, ?status=, ?color= filters)
router.route('/')
      .post(createProduct)
      .get(getAllProducts);

// GET    /api/products/:id    — get a single product by ID
// PATCH  /api/products/:id    — update a product's fields
// DELETE /api/products/:id    — delete a product
router.route('/:id')
      .get(getProductById)
      .patch(updateProduct)
      .delete(deleteProduct);

export default router;
