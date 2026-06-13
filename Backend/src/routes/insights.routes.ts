import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { getStats, getInsights, chat } from '../controllers/insights.controller';

const router = Router();

// All insights endpoints require an authenticated admin session
router.use(requireAdmin);

router.get('/stats', getStats);
router.get('/auto', getInsights);
router.post('/chat', chat);

export default router;
