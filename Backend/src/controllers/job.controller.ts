import { Request, Response } from 'express';
import * as jobService from '../services/job.service';
import * as productService from '../services/product.service';
import * as aiService from '../services/ai.service';

// POST /api/jobs/image/:imageId
// Creates a processing job for a single product image and runs AI in the background.
export const createJobForImage = async (req: Request, res: Response) => {
  const imageId = String(req.params.imageId);

  const image = await productService.getProductImageById(imageId);
  if (!image) {
    res.status(404).json({ error: 'Product image not found' });
    return;
  }
  if (!image.rawUrl) {
    res.status(400).json({ error: 'Image has no raw file to process' });
    return;
  }

  const job = await jobService.createJob(imageId);
  res.status(201).json(job);

  // Background processing
  runProcessing(job.id, imageId, image.rawUrl);
};

// POST /api/jobs/product/:productId
// Creates processing jobs for ALL unprocessed images of a product.
export const createJobsForProduct = async (req: Request, res: Response) => {
  const productId = String(req.params.productId);

  const images = await productService.getProductImages(productId);
  if (!images.length) {
    res.status(404).json({ error: 'No images found for this product' });
    return;
  }

  // Only process images that have a rawUrl but no processedUrl yet
  const pending = images.filter((img) => img.rawUrl && !img.processedUrl);
  if (!pending.length) {
    res.status(200).json({ message: 'All images already processed', jobs: [] });
    return;
  }

  const jobs = await Promise.all(pending.map((img) => jobService.createJob(img.id)));
  res.status(201).json(jobs);

  // Fire background processing for each image
  for (const img of pending) {
    const job = jobs.find((j) => j.productImageId === img.id);
    if (job && img.rawUrl) runProcessing(job.id, img.id, img.rawUrl);
  }
};

async function runProcessing(
  jobId: string,
  imageId: string,
  rawUrl: string
): Promise<void> {
  try {
    await jobService.updateJobStatus(jobId, 'PROCESSING');

    // Download the raw image from Supabase Storage
    const imageResponse = await fetch(rawUrl);
    if (!imageResponse.ok) throw new Error('Failed to download raw image');
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    // Send to Python AI service for background removal
    const processedUrl = await aiService.processImage(buffer, `image_${imageId}.jpg`);

    // Save the processed URL on the ProductImage row
    await productService.setProcessedUrl(imageId, processedUrl);
    await jobService.updateJobStatus(jobId, 'DONE');
  } catch (err: any) {
    await jobService.updateJobStatus(jobId, 'FAILED', err.message ?? 'Unknown error');
  }
}

// GET /api/jobs
// Returns all processing jobs with image + product info.
export const getAllJobs = async (_req: Request, res: Response) => {
  try {
    const jobs = await jobService.getAllJobs();
    res.status(200).json(jobs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};
