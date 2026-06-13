import { Request, Response } from 'express';
import * as jobService from '../services/job.service';
import * as productService from '../services/product.service';
import * as aiService from '../services/ai.service';
import prisma from '../lib/prisma';

// In-memory processing queue — ensures only one AI job runs at a time so the
// Python AI service (single-threaded) is never overwhelmed by concurrent uploads.
let _queueActive = 0;
const _queue: (() => Promise<void>)[] = [];
const MAX_CONCURRENT = 1;

function enqueueJob(fn: () => Promise<void>): void {
  _queue.push(fn);
  _drainQueue();
}

function _drainQueue(): void {
  while (_queueActive < MAX_CONCURRENT && _queue.length > 0) {
    const fn = _queue.shift()!;
    _queueActive++;
    fn().finally(() => {
      _queueActive--;
      _drainQueue();
    });
  }
}

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

  // Product type determines which BG-removal model to use.
  // Priority: linked product > productType in request body (bulk-upload flow) > null (pipeline uses default)
  const product = image.productId ? await productService.getProductById(image.productId) : null;
  const productType = product?.type ?? (req.body?.productType as string | null) ?? null;

  const job = await jobService.createJob(imageId);
  res.status(201).json(job);

  enqueueJob(() => runProcessing(job.id, imageId, image.rawUrl!, productType));
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

  const product = await productService.getProductById(productId);
  const productType = product?.type ?? null;

  const jobs = await Promise.all(pending.map((img) => jobService.createJob(img.id)));
  res.status(201).json(jobs);

  // Fire background processing for each image — product type is known here
  for (const img of pending) {
    const job = jobs.find((j) => j.productImageId === img.id);
    if (job && img.rawUrl) enqueueJob(() => runProcessing(job.id, img.id, img.rawUrl!, productType));
  }
};

async function runProcessing(
  jobId: string,
  imageId: string,
  rawUrl: string,
  productType?: string | null
): Promise<void> {
  try {
    await jobService.updateJobStatus(jobId, 'PROCESSING');

    // Download the raw image from Supabase Storage
    const imageResponse = await fetch(rawUrl);
    if (!imageResponse.ok) throw new Error('Failed to download raw image');
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    // Preserve original filename so the AI service can infer type from it if productType is null
    const filename = rawUrl.split('/').pop()?.split('?')[0] ?? `image_${imageId}.jpg`;

    // Send to Python AI service — returns processedImageUrl, CLIP embedding, and dominant color
    const { processedImageUrl: processedUrl, embedding, dominantColor } = await aiService.processImage(buffer, filename, productType);

    // Save the processed URL, CLIP embedding, and dominant color on the ProductImage row
    await productService.setProcessedUrl(imageId, processedUrl, embedding, dominantColor ?? undefined);
    await jobService.updateJobStatus(jobId, 'DONE');
  } catch (err: any) {
    await jobService.updateJobStatus(jobId, 'FAILED', err.message ?? 'Unknown error');
  }
}

// POST /api/jobs/process-all
// Creates jobs for ALL ProductImages that have a rawUrl but no processedUrl yet.
// Used by the dashboard "Process All" button.
export const createJobsForAll = async (_req: Request, res: Response) => {
  const images = await prisma.productImage.findMany({
    where: { rawUrl: { not: null }, processedUrl: null },
    include: { product: { select: { type: true } } },
  });

  if (!images.length) {
    res.status(200).json({ message: 'All images already processed', jobs: [] });
    return;
  }

  const jobs = await Promise.all(images.map(img => jobService.createJob(img.id)));
  res.status(201).json({ queued: jobs.length, jobs });

  for (const img of images) {
    const job = jobs.find(j => j.productImageId === img.id);
    if (job && img.rawUrl) {
      const productType = img.product?.type ?? null;
      enqueueJob(() => runProcessing(job.id, img.id, img.rawUrl!, productType));
    }
  }
};

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
