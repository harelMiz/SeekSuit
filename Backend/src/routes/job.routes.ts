import { Router } from 'express';
import { createJobForImage, createJobsForProduct, createJobsForAll, getAllJobs } from '../controllers/job.controller';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// All job routes are admin-only
router.use(requireAdmin);

// GET  /api/jobs                          — list all jobs (polled by frontend)
// POST /api/jobs/process-all             — queue jobs for every unprocessed image
// POST /api/jobs/image/:imageId           — trigger AI processing for a single image
// POST /api/jobs/product/:productId       — trigger AI processing for all images of a product
router.get('/', getAllJobs);
router.post('/process-all', createJobsForAll);
router.post('/image/:imageId', createJobForImage);
router.post('/product/:productId', createJobsForProduct);

export default router;
