import { Router } from 'express';
import {
  triggerVTO,
  getVTOStatus,
  getProductVTOJobs,
  updateSelections,
  publishVTO,
  setFrontView,
  deleteResult,
} from '../controllers/vto.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// All VTO routes are admin-only
router.use(requireAdmin);

// POST   /api/vto/trigger                   — start a VTO generation job
router.post('/trigger', triggerVTO);

// GET    /api/vto/status/:jobId             — poll job status (lazy-pulls RunPod)
router.get('/status/:jobId', getVTOStatus);

// GET    /api/vto/product/:productId        — list all VTO jobs for a product
router.get('/product/:productId', getProductVTOJobs);

// PATCH  /api/vto/:jobId/selections         — update which model images are selected
router.patch('/:jobId/selections', updateSelections);

// POST   /api/vto/:jobId/publish            — copy ordered images into ProductImage table
router.post('/:jobId/publish', publishVTO);

// DELETE /api/vto/:jobId/result/:modelKey   — delete a VTO result from storage + job JSON
router.delete('/:jobId/result/:modelKey', deleteResult);

// PATCH  /api/vto/image/:imageId/front-view — mark/unmark an image as front view
router.patch('/image/:imageId/front-view', setFrontView);

export default router;
