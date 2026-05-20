import { Router } from 'express';
import { createJobForImage, createJobsForProduct, getAllJobs } from '../controllers/job.controller';

const router = Router();

// GET  /api/jobs                          — list all jobs (polled by frontend)
// POST /api/jobs/image/:imageId           — trigger AI processing for a single image
// POST /api/jobs/product/:productId       — trigger AI processing for all images of a product
router.get('/', getAllJobs);
router.post('/image/:imageId', createJobForImage);
router.post('/product/:productId', createJobsForProduct);

export default router;
