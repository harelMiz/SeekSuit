import prisma from '../lib/prisma';
import { createClient } from '@supabase/supabase-js';

const RUNPOD_API_KEY     = process.env.RUNPOD_API_KEY     ?? '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID ?? '';
const RUNPOD_BASE        = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

const VTO_BUCKET = 'vto-results';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Shape stored in VTOJob.results
export interface VTOResult {
  modelKey:          string;
  url:               string;
  selected:          boolean;
  storagePath?:      string;  // Supabase path inside vto-results bucket for deletion
  publishedImageId?: string;  // ProductImage.id if this result was published
}

// ── RunPod Serverless helpers ─────────────────────────────────────────────────

async function runpodRun(input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${RUNPOD_BASE}/run`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`RunPod /run failed: ${res.status}`);
  const data = await res.json() as { id: string };
  return data.id;
}

async function runpodStatus(runpodJobId: string): Promise<{ status: string; output?: unknown }> {
  const res = await fetch(`${RUNPOD_BASE}/status/${runpodJobId}`, {
    headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
  });
  if (!res.ok) throw new Error(`RunPod /status failed: ${res.status}`);
  return res.json() as Promise<{ status: string; output?: unknown }>;
}

// ── VTO service ──────────────────────────────────────────────────────────────

// Trigger a new VTO generation job.
export async function triggerVTOJob(productId: string, sourceImageId: string, seed?: number) {
  // Prevent duplicate PENDING/RUNNING jobs for the same source image
  const existing = await prisma.vTOJob.findFirst({
    where: { sourceImageId, status: { in: ['PENDING', 'RUNNING'] } },
  });
  if (existing) return existing;

  const sourceImage = await prisma.productImage.findUnique({ where: { id: sourceImageId } });
  if (!sourceImage?.processedUrl) {
    throw new Error('Source image must have a processedUrl before VTO');
  }

  const job = await prisma.vTOJob.create({
    data: { productId, sourceImageId, status: 'PENDING' },
  });

  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    await prisma.vTOJob.update({
      where: { id: job.id },
      data:  { status: 'FAILED', errorMsg: 'RUNPOD_API_KEY / RUNPOD_ENDPOINT_ID not configured in .env' },
    });
    return prisma.vTOJob.findUniqueOrThrow({ where: { id: job.id } });
  }

  try {
    const runpodJobId = await runpodRun({
      garment_url:     sourceImage.processedUrl,
      garment_type:    'JACKETS',
      product_id:      productId,
      source_image_id: sourceImageId,
      ...(seed !== undefined && { seed }),
    });
    return prisma.vTOJob.update({
      where: { id: job.id },
      data:  { runpodJobId, status: 'RUNNING' },
    });
  } catch (err: any) {
    await prisma.vTOJob.update({
      where: { id: job.id },
      data:  { status: 'FAILED', errorMsg: String(err.message) },
    });
    throw err;
  }
}

// Poll RunPod for updates — "lazy pull" pattern called by the status endpoint.
export async function getVTOJobStatus(jobId: string) {
  const job = await prisma.vTOJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  if (job.status === 'DONE' || job.status === 'FAILED' || !job.runpodJobId) return job;

  try {
    const rp = await runpodStatus(job.runpodJobId);

    if (rp.status === 'COMPLETED') {
      const output  = rp.output as { results: Array<{ modelKey: string; url: string; storagePath?: string }> };
      const results: VTOResult[] = (output?.results ?? []).map((r) => ({
        modelKey:    r.modelKey,
        url:         r.url,
        selected:    true,
        storagePath: r.storagePath,
      }));
      return prisma.vTOJob.update({
        where: { id: jobId },
        data:  { status: 'DONE', results: results as unknown as import('@prisma/client').Prisma.JsonArray },
      });
    }

    if (rp.status === 'FAILED') {
      return prisma.vTOJob.update({
        where: { id: jobId },
        data:  { status: 'FAILED', errorMsg: 'RunPod job failed' },
      });
    }
  } catch (_) {
    // RunPod temporarily unreachable — return current DB state
  }

  return job;
}

// Return all VTO jobs for a product.
export async function getVTOJobsForProduct(productId: string) {
  return prisma.vTOJob.findMany({
    where:   { productId },
    orderBy: { createdAt: 'desc' },
  });
}

// Update admin's selection of which model images to include.
export async function updateVTOSelections(jobId: string, selections: Record<string, boolean>) {
  const job = await prisma.vTOJob.findUnique({ where: { id: jobId } });
  if (!job || !job.results) throw new Error('VTOJob not found or has no results');

  const results = (job.results as unknown as VTOResult[]).map((r) => ({
    ...r,
    selected: selections[r.modelKey] ?? r.selected,
  }));

  return prisma.vTOJob.update({
    where: { id: jobId },
    data:  { results: results as unknown as import('@prisma/client').Prisma.JsonArray },
  });
}

// Publish VTO images as ProductImage rows so they appear in the product gallery.
// orderedKeys: modelKeys in desired display order — first item becomes the main image.
export async function publishVTOImages(jobId: string, orderedKeys: string[]) {
  if (!orderedKeys.length) throw new Error('No images selected for publishing');

  const job = await prisma.vTOJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'DONE' || !job.results) throw new Error('VTOJob not done');

  const allResults = job.results as unknown as VTOResult[];
  const byKey      = new Map(allResults.map((r) => [r.modelKey, r]));

  const existing = await prisma.productImage.findMany({
    where:   { productId: job.productId },
    orderBy: { order: 'desc' },
    take:    1,
  });
  let order = (existing[0]?.order ?? -1) + 1;

  // Demote any existing main image so the first published VTO image can take over
  await prisma.productImage.updateMany({
    where: { productId: job.productId, isMain: true },
    data:  { isMain: false },
  });

  const created: string[] = [];
  const updatedResults    = [...allResults];

  for (let i = 0; i < orderedKeys.length; i++) {
    const key = orderedKeys[i];
    const r   = byKey.get(key);
    if (!r) continue;

    const img = await prisma.productImage.create({
      data: {
        productId:    job.productId,
        processedUrl: r.url,
        isMain:       i === 0,  // First in ordered list becomes main
        order:        order++,
      },
    });
    created.push(img.id);

    // Record which ProductImage was created from this VTO result
    const idx = updatedResults.findIndex((x) => x.modelKey === key);
    if (idx !== -1) updatedResults[idx] = { ...updatedResults[idx], publishedImageId: img.id };
  }

  // Persist the publishedImageId fields back to the job
  await prisma.vTOJob.update({
    where: { id: jobId },
    data:  { results: updatedResults as unknown as import('@prisma/client').Prisma.JsonArray },
  });

  return { published: created.length, imageIds: created };
}

// Delete a single VTO result: remove from Supabase storage + remove from job results JSON.
export async function deleteVTOResult(jobId: string, modelKey: string) {
  const job = await prisma.vTOJob.findUnique({ where: { id: jobId } });
  if (!job || !job.results) throw new Error('VTOJob not found');

  const results = job.results as unknown as VTOResult[];
  const target  = results.find((r) => r.modelKey === modelKey);
  if (!target) throw new Error(`Result ${modelKey} not found`);

  // Delete from Supabase storage if we have the path
  if (target.storagePath) {
    await supabase.storage.from(VTO_BUCKET).remove([target.storagePath]);
  }

  const updated = results.filter((r) => r.modelKey !== modelKey);
  return prisma.vTOJob.update({
    where: { id: jobId },
    data:  { results: updated as unknown as import('@prisma/client').Prisma.JsonArray },
  });
}

// Toggle isFrontView on a ProductImage.
export async function setFrontView(imageId: string, isFrontView: boolean) {
  return prisma.productImage.update({
    where: { id: imageId },
    data:  { isFrontView },
  });
}
