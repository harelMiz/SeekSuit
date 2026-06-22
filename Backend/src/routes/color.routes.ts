import { Router } from 'express';
import { getColors, createColor } from '../controllers/color.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.get('/', getColors);
router.post('/', requireAdmin, createColor);

export default router;
