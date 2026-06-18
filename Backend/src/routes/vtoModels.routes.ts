import { Router } from 'express';
import multer from 'multer';
import { listModels, uploadModel, deleteModel } from '../controllers/vtoModels.controller';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// GET    /api/vto-models              — list all model photos
// POST   /api/vto-models              — upload a new model photo
// DELETE /api/vto-models/:filename    — delete a model photo
router.get('/', listModels);
router.post('/', upload.single('file'), uploadModel);
router.delete('/:filename', deleteModel);

export default router;
