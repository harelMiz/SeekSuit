import prisma from '../lib/prisma';
import { JobStatus } from '@prisma/client';

// Create a new PENDING job for a product
export const createJob = async (productId: string) => {
  return prisma.processingJob.create({ data: { productId } });
};

// Fetch all jobs, newest first, including product name for display
export const getAllJobs = async () => {
  return prisma.processingJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });
};

// Update the status (and optional error message) of a job
export const updateJobStatus = async (
  id: string,
  status: JobStatus,
  errorMsg?: string
) => {
  return prisma.processingJob.update({
    where: { id },
    data: { status, ...(errorMsg !== undefined && { errorMsg }) },
  });
};
