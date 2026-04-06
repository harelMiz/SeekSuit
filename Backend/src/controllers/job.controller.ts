import { Request, Response } from 'express';
import * as jobService from '../services/job.service';
import * as productService from '../services/product.service';
import * as storageService from '../services/storage.service';
import * as aiService from '../services/ai.service';

// POST /api/jobs/:productId
// Creates a processing job and triggers AI pipeline in the background.
export const createJob = async (req: Request, res: Response) => {
  const productId = String(req.params.productId);

  const product = await productService.getProductById(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  if (!product.rawImageUrl) {
    res.status(400).json({ error: 'Product has no raw image to process' });
    return;
  }

  // Create the job row and return immediately — processing runs in the background
  const job = await jobService.createJob(productId);
  res.status(201).json(job);

  // Background processing — errors update the job status, never crash the server
  runProcessing(job.id, productId, product.rawImageUrl);
};

async function runProcessing(
  jobId: string,
  productId: string,
  rawImageUrl: string
): Promise<void> {
  try {
    await jobService.updateJobStatus(jobId, 'PROCESSING');

    // Download the raw image from Supabase Storage via its signed URL
    const imageResponse = await fetch(rawImageUrl);
    if (!imageResponse.ok) throw new Error('Failed to download raw image');
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    // Send to Python AI service for background removal + enhancement
    const processedImageUrl = await aiService.processImage(buffer, `product_${productId}.jpg`);

    // Save the processed image URL on the product
    await productService.updateProduct(productId, { processedImageUrl });
    await jobService.updateJobStatus(jobId, 'DONE');
  } catch (err: any) {
    await jobService.updateJobStatus(jobId, 'FAILED', err.message ?? 'Unknown error');
  }
}

// GET /api/jobs
// Returns all processing jobs with their product info.
export const getAllJobs = async (_req: Request, res: Response) => {
  try {
    const jobs = await jobService.getAllJobs();
    res.status(200).json(jobs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};
