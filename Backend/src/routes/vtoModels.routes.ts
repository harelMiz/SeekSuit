import { Router } from 'express';
import multer from 'multer';
import { listModels, uploadModel, deleteModel } from '../controllers/vtoModels.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG images are allowed'));
  },
});

const router = Router();

// All VTO model management endpoints require admin auth
router.use(requireAdmin);

// GET    /api/vto-models              — list all model photos
// POST   /api/vto-models              — upload a new model photo
// DELETE /api/vto-models/:filename    — delete a model photo
router.get('/', listModels);
router.post('/', upload.single('file'), uploadModel);
router.delete('/:filename', deleteModel);

export default router;
