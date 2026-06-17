import { Request, Response } from 'express';
import * as vtoService from '../services/vto.service';

// POST /api/vto/trigger
export const triggerVTO = async (req: Request, res: Response) => {
  const { productId, sourceImageId } = req.body;
  if (!productId || !sourceImageId) {
    res.status(400).json({ error: 'productId and sourceImageId are required' });
    return;
  }
  try {
    const job = await vtoService.triggerVTOJob(String(productId), String(sourceImageId));
    res.status(201).json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to start VTO job' });
  }
};

// GET /api/vto/status/:jobId
export const getVTOStatus = async (req: Request, res: Response) => {
  const job = await vtoService.getVTOJobStatus(String(req.params.jobId));
  if (!job) { res.status(404).json({ error: 'VTO job not found' }); return; }
  res.json(job);
};

// GET /api/vto/product/:productId
export const getProductVTOJobs = async (req: Request, res: Response) => {
  const jobs = await vtoService.getVTOJobsForProduct(String(req.params.productId));
  res.json(jobs);
};

// PATCH /api/vto/:jobId/selections
export const updateSelections = async (req: Request, res: Response) => {
  const { selections } = req.body;
  if (!selections || typeof selections !== 'object') {
    res.status(400).json({ error: 'selections object is required' });
    return;
  }
  try {
    const job = await vtoService.updateVTOSelections(String(req.params.jobId), selections);
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/vto/:jobId/publish
// Body: { orderedKeys: string[] } — modelKeys in display order, first = main image
export const publishVTO = async (req: Request, res: Response) => {
  const { orderedKeys } = req.body;
  if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) {
    res.status(400).json({ error: 'orderedKeys array is required' });
    return;
  }
  try {
    const result = await vtoService.publishVTOImages(String(req.params.jobId), orderedKeys);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/vto/:jobId/result/:modelKey
export const deleteResult = async (req: Request, res: Response) => {
  try {
    const job = await vtoService.deleteVTOResult(
      String(req.params.jobId),
      String(req.params.modelKey)
    );
    res.json(job);
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
};

// PATCH /api/vto/image/:imageId/front-view
export const setFrontView = async (req: Request, res: Response) => {
  const { isFrontView } = req.body;
  if (typeof isFrontView !== 'boolean') {
    res.status(400).json({ error: 'isFrontView (boolean) is required' });
    return;
  }
  try {
    const img = await vtoService.setFrontView(String(req.params.imageId), isFrontView);
    res.json(img);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
