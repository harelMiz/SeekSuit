import { Router } from 'express';
import { getContent, updateContent, deleteContent, uploadSiteImageAndSave, uploadImageMiddleware, seedContent } from '../controllers/content.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.get('/', getContent);
router.put('/', requireAdmin, updateContent);
router.post('/seed', requireAdmin, seedContent);
router.post('/upload-image', requireAdmin, uploadImageMiddleware, uploadSiteImageAndSave);
router.delete('/:key', requireAdmin, deleteContent);

export default router;
