import prisma from '../lib/prisma';
import { JobStatus } from '@prisma/client';

// Create a new PENDING job for a specific product image
export const createJob = async (productImageId: string) => {
  return prisma.processingJob.create({ data: { productImageId } });
};

// Fetch all jobs, newest first, including image and product info for display
export const getAllJobs = async () => {
  return prisma.processingJob.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      image: {
        select: {
          id: true,
          productId: true,
          isMain: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
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
