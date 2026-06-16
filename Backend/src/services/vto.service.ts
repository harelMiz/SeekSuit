import prisma from '../lib/prisma';

const RUNPOD_API_KEY     = process.env.RUNPOD_API_KEY     ?? '';
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID ?? '';
const RUNPOD_BASE        = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

// Shape stored in VTOJob.results
export interface VTOResult {
  modelKey: string;
  url:      string;
  selected: boolean;
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
      const output  = rp.output as { results: Array<{ modelKey: string; url: string }> };
      const results: VTOResult[] = (output?.results ?? []).map((r) => ({
        modelKey: r.modelKey,
        url:      r.url,
        selected: true,
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

// Publish selected VTO images as ProductImage rows so they appear in the product gallery.
export async function publishVTOImages(jobId: string) {
  const job = await prisma.vTOJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'DONE' || !job.results) throw new Error('VTOJob not done');

  const results  = job.results as unknown as VTOResult[];
  const selected = results.filter((r) => r.selected);

  const existing = await prisma.productImage.findMany({
    where:   { productId: job.productId },
    orderBy: { order: 'desc' },
    take:    1,
  });
  let order = (existing[0]?.order ?? -1) + 1;

  const created: string[] = [];
  for (const r of selected) {
    const img = await prisma.productImage.create({
      data: {
        productId:    job.productId,
        processedUrl: r.url,
        isMain:       false,
        order:        order++,
      },
    });
    created.push(img.id);
  }

  return { published: created.length, imageIds: created };
}

// Toggle isFrontView on a ProductImage.
export async function setFrontView(imageId: string, isFrontView: boolean) {
  return prisma.productImage.update({
    where: { id: imageId },
    data:  { isFrontView },
  });
}
