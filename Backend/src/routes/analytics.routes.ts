import { Router } from 'express';
import { recordView, getSearchHistory, getTopProducts } from '../controllers/analytics.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// POST /api/analytics/view  { productId, source, searchQuery? }  — public, skips admin check
router.post('/view', recordView);

// GET  /api/analytics/searches?limit=50  — admin only
router.get('/searches', requireAdmin, getSearchHistory);

// GET  /api/analytics/top-products?limit=8&days=30  — admin only
router.get('/top-products', requireAdmin, getTopProducts);

export default router;
