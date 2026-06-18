import { Request, Response } from 'express';
import * as storageService from '../services/storage.service';

// GET /api/vto-models — list all model photos in the vto-models bucket
export const listModels = async (_req: Request, res: Response) => {
  try {
    const models = await storageService.listVTOModels();
    res.status(200).json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Failed to list models' });
  }
};

// POST /api/vto-models — upload a new model photo (multipart file field: "file")
export const uploadModel = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const model = await storageService.uploadVTOModel(file.buffer, file.originalname);
    res.status(201).json(model);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Upload failed' });
  }
};

// DELETE /api/vto-models/:filename — remove a model photo from the bucket
export const deleteModel = async (req: Request, res: Response) => {
  try {
    const filename = String(req.params.filename);
    await storageService.deleteVTOModel(filename);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Delete failed' });
  }
};
