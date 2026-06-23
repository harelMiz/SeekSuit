import { Router } from 'express';
import {
  getGallery,
  createGalleryImage,
  uploadBulkGalleryImages,
  deleteGalleryImage,
  reorderGallery,
  uploadMiddleware,
  uploadBulkMiddleware,
} from '../controllers/gallery.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.get('/', getGallery);
router.post('/upload', requireAdmin, uploadMiddleware, createGalleryImage);
router.post('/upload-bulk', requireAdmin, uploadBulkMiddleware, uploadBulkGalleryImages);
router.put('/reorder', requireAdmin, reorderGallery);
router.delete('/:id', requireAdmin, deleteGalleryImage);

export default router;
