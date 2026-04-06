import { Router } from 'express';
import { createJob, getAllJobs } from '../controllers/job.controller';

const router = Router();

// GET  /api/jobs         — list all jobs (polled by frontend)
// POST /api/jobs/:productId — trigger AI processing for a product
router.get('/', getAllJobs);
router.post('/:productId', createJob);

export default router;
