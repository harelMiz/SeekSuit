import { Router } from 'express';
import multer from 'multer';
import { uploadRawImage } from '../controllers/upload.controller';

// Store uploaded files in memory — buffer goes straight to Supabase, never written to disk
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// POST /api/uploads/raw — upload a raw product image
router.post('/raw', upload.single('file'), uploadRawImage);

export default router;
