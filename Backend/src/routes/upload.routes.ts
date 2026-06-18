import { Router } from 'express';
import multer from 'multer';
import {
  uploadRawImage,
  uploadBulkImages,
  getUnassignedImages,
  assignImagesToProduct,
  deleteImage,
  setMainImage,
  reorderImages,
  unpublishImage,
} from '../controllers/upload.controller';

// Store uploaded files in memory — buffer goes straight to Supabase, never written to disk
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// POST   /api/uploads/raw                   — upload a single raw image (optional productId)
// POST   /api/uploads/bulk                  — upload multiple images at once, all unassigned
// GET    /api/uploads/unassigned            — list all images with no product yet
// POST   /api/uploads/assign               — create product + assign selected image IDs to it
// DELETE /api/uploads/image/:imageId        — delete a product image (Storage + DB)
// PATCH  /api/uploads/image/:imageId/main   — set image as main for its product
router.post('/raw', upload.single('file'), uploadRawImage);
router.post('/bulk', upload.array('files', 50), uploadBulkImages);
router.get('/unassigned', getUnassignedImages);
router.post('/assign', assignImagesToProduct);
router.delete('/image/:imageId', deleteImage);
router.patch('/image/:imageId/main', setMainImage);
router.patch('/image/:imageId/unpublish', unpublishImage);
router.patch('/product/:productId/reorder', reorderImages);

export default router;
