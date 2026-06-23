import { Request, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { uploadGalleryImage, deleteGalleryFile } from '../services/storage.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG/WEBP images allowed'));
  },
});

export const uploadMiddleware = upload.single('image');
export const uploadBulkMiddleware = upload.array('images', 30);

export const getGallery = async (_req: Request, res: Response): Promise<void> => {
  const images = await prisma.galleryImage.findMany({ orderBy: { order: 'asc' } });
  res.json(images);
};

export const createGalleryImage = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() || undefined : undefined;
  const url = await uploadGalleryImage(req.file.buffer, req.file.originalname);
  const count = await prisma.galleryImage.count();
  const image = await prisma.galleryImage.create({ data: { url, caption, order: count } });
  res.status(201).json(image);
};

export const uploadBulkGalleryImages = async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }
  const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() || undefined : undefined;
  const count = await prisma.galleryImage.count();
  const created = await Promise.all(
    files.map(async (file, idx) => {
      const url = await uploadGalleryImage(file.buffer, file.originalname);
      return prisma.galleryImage.create({ data: { url, caption, order: count + idx } });
    })
  );
  res.status(201).json(created);
};

export const deleteGalleryImage = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const image = await prisma.galleryImage.findUnique({ where: { id } });
  if (!image) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await deleteGalleryFile(image.url);
  await prisma.galleryImage.delete({ where: { id } });
  res.json({ ok: true });
};

export const reorderGallery = async (req: Request, res: Response): Promise<void> => {
  const { order } = req.body as { order?: unknown };
  if (!Array.isArray(order) || order.some(id => typeof id !== 'string')) {
    res.status(400).json({ error: 'order must be an array of string ids' });
    return;
  }
  await Promise.all(
    (order as string[]).map((id, idx) =>
      prisma.galleryImage.update({ where: { id }, data: { order: idx } })
    )
  );
  res.json({ ok: true });
};
