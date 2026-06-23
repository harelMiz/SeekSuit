import { Request, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { uploadSiteImage } from '../services/storage.service';

export const uploadImageMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

// GET /api/content — public, returns all overrides as { key: { he, en } }
export const getContent = async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.siteContent.findMany();
  const result: Record<string, { he: string; en: string }> = {};
  for (const row of rows) {
    result[row.key] = { he: row.he, en: row.en };
  }
  res.json(result);
};

// PUT /api/content — admin, upsert a single key override
export const updateContent = async (req: Request, res: Response): Promise<void> => {
  const { key, he, en } = req.body as { key?: string; he?: string; en?: string };
  if (!key || he === undefined || en === undefined) {
    res.status(400).json({ error: 'key, he, and en are required' });
    return;
  }
  const row = await prisma.siteContent.upsert({
    where: { key },
    create: { key, he, en },
    update: { he, en },
  });
  res.json(row);
};

// POST /api/content/upload-image — admin, upload a site image and save URL override
export const uploadSiteImageAndSave = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;
  const key = typeof req.body.key === 'string' ? req.body.key : '';
  if (!file || !key) {
    res.status(400).json({ error: 'image file and key are required' });
    return;
  }
  const url = await uploadSiteImage(file.buffer, file.originalname);
  const row = await prisma.siteContent.upsert({
    where: { key },
    create: { key, he: url, en: url },
    update: { he: url, en: url },
  });
  res.json({ url, row });
};

// DELETE /api/content/:key — admin, remove a content key
export const deleteContent = async (req: Request, res: Response): Promise<void> => {
  const key = String(req.params.key);
  await prisma.siteContent.deleteMany({ where: { key } });
  res.json({ deleted: key });
};

// POST /api/content/seed — admin, bulk-upsert all locale keys from frontend defaults
export const seedContent = async (req: Request, res: Response): Promise<void> => {
  const keys = req.body as Record<string, { he: string; en: string }>;
  if (!keys || typeof keys !== 'object') {
    res.status(400).json({ error: 'body must be { [key]: { he, en } }' });
    return;
  }
  const entries = Object.entries(keys);
  await Promise.all(
    entries.map(([key, { he, en }]) =>
      prisma.siteContent.upsert({
        where: { key },
        create: { key, he, en },
        update: { he, en },
      })
    )
  );
  res.json({ seeded: entries.length });
};
