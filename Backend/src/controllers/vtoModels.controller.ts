import { Request, Response } from 'express';
import * as storageService from '../services/storage.service';

// GET /api/vto-models
export const listModels = async (_req: Request, res: Response) => {
  try {
    res.status(200).json(await storageService.listVTOModelFolders());
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Failed to list models' });
  }
};

// POST /api/vto-models/:folderName/photos — upload photo to existing or new folder
export const uploadPhoto = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }
    const folderName = String(req.params.folderName);
    const photo = await storageService.uploadVTOModelPhoto(folderName, file.buffer, file.originalname);
    res.status(201).json(photo);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Upload failed' });
  }
};

// DELETE /api/vto-models/:folderName — delete entire model folder
export const deleteFolder = async (req: Request, res: Response) => {
  try {
    await storageService.deleteVTOModelFolder(String(req.params.folderName));
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Delete failed' });
  }
};

// DELETE /api/vto-models/:folderName/photos/:filename — delete single photo
export const deletePhoto = async (req: Request, res: Response) => {
  try {
    await storageService.deleteVTOModelPhoto(
      String(req.params.folderName),
      String(req.params.filename),
    );
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Delete failed' });
  }
};

// PATCH /api/vto-models/:folderName/rename  body: { newName }
export const renameFolder = async (req: Request, res: Response) => {
  try {
    const { newName } = req.body as { newName?: string };
    if (!newName?.trim()) { res.status(400).json({ error: 'newName is required' }); return; }
    await storageService.renameVTOModelFolder(String(req.params.folderName), newName.trim());
    res.status(200).json({ name: newName.trim() });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Rename failed' });
  }
};
