import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getColors = async (_req: Request, res: Response) => {
  const colors = await prisma.color.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(colors);
};

export const createColor = async (req: Request, res: Response) => {
  const { key, labelHe, labelEn, hex } = req.body as {
    key?: string; labelHe?: string; labelEn?: string; hex?: string;
  };

  if (!key || !labelHe || !labelEn || !hex) {
    res.status(400).json({ error: 'key, labelHe, labelEn, hex are required' });
    return;
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    res.status(400).json({ error: 'Key must start with uppercase letter, only A-Z 0-9 _' });
    return;
  }

  try {
    const color = await prisma.color.create({ data: { key, labelHe, labelEn, hex } });
    res.status(201).json(color);
  } catch (e: any) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Color key already exists' });
      return;
    }
    throw e;
  }
};
