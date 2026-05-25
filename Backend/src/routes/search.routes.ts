import { Router } from 'express';
import multer from 'multer';
import { searchByImage, searchByText, getSimilarProducts } from '../controllers/search.controller';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// POST /api/search/image?limit=8
router.post('/image', upload.single('file'), searchByImage);

// POST /api/search/text?limit=8  { query: string }
router.post('/text', searchByText);

// GET /api/search/similar/:productId?limit=4
router.get('/similar/:productId', getSimilarProducts);

export default router;
