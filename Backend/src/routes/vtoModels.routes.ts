import { Router } from 'express';
import multer from 'multer';
import { listModels, uploadPhoto, deleteFolder, deletePhoto, renameFolder } from '../controllers/vtoModels.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG images are allowed'));
  },
});

const router = Router();
router.use(requireAdmin);

// GET    /api/vto-models                              — list all folders + photos
// POST   /api/vto-models/:folderName/photos           — upload photo to folder
// DELETE /api/vto-models/:folderName                  — delete entire model folder
// DELETE /api/vto-models/:folderName/photos/:filename — delete single photo
// PATCH  /api/vto-models/:folderName/rename           — rename folder { newName }
router.get('/', listModels);
router.post('/:folderName/photos', upload.single('file'), uploadPhoto);
router.delete('/:folderName/photos/:filename', deletePhoto);
router.delete('/:folderName', deleteFolder);
router.patch('/:folderName/rename', renameFolder);

export default router;
