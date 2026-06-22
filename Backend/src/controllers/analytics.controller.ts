import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const VALID_SOURCES = ['BROWSE', 'SEARCH_RESULT', 'SIMILAR'] as const;

// GET /api/analytics/searches?limit=500&days=7
// days=0 or omitted → return all history
export const getSearchHistory = async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? 500), 10) || 500, 2000);
  const days = parseInt(String(req.query.days ?? 0), 10) || 0;
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

  const logs = await prisma.searchLog.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      query: true,
      queryType: true,
      resultCount: true,
      detectedColor: true,
      detectedType: true,
      createdAt: true,
    },
  });

  res.json(logs);
};

// GET /api/analytics/top-products?limit=8&days=30
// Returns top products by weighted view score (SEARCH_RESULT click = 3×, BROWSE = 1×).
export const getTopProducts = async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? 8), 10) || 8, 20);
  const days = Math.min(parseInt(String(req.query.days ?? 30), 10) || 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const views = await prisma.productView.findMany({
    where: { createdAt: { gte: since } },
    select: { productId: true, source: true },
  });

  if (!views.length) { res.json([]); return; }

  const scores: Record<string, number> = {};
  for (const v of views) {
    scores[v.productId] = (scores[v.productId] ?? 0) + (v.source === 'SEARCH_RESULT' ? 3 : 1);
  }

  const topIds = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const products = await prisma.product.findMany({
    where: { id: { in: topIds } },
    select: {
      id: true,
      name: true,
      type: true,
      images: {
        where: { processedUrl: { not: null } },
        orderBy: [{ isMain: 'desc' }, { order: 'asc' }],
        take: 1,
        select: { processedUrl: true },
      },
    },
  });

  const result = topIds
    .map(id => {
      const p = products.find(pr => pr.id === id);
      if (!p || !p.images[0]?.processedUrl) return null;
      return { id: p.id, name: p.name, type: p.type, imageUrl: p.images[0].processedUrl, score: scores[id] };
    })
    .filter(Boolean);

  res.json(result);
};

// POST /api/analytics/view
// Records a product page view from a public user.
// Frontend must skip this call when an admin session is active.
export const recordView = async (req: Request, res: Response) => {
  const { productId, source, searchQuery } = req.body as {
    productId?: string;
    source?: string;
    searchQuery?: string;
  };

  if (!productId || !source || !VALID_SOURCES.includes(source as any)) {
    res.status(400).json({ error: 'productId and valid source are required' });
    return;
  }

  if (process.env.SKIP_ANALYTICS !== 'true') {
    await prisma.productView.create({
      data: {
        productId,
        source: source as 'BROWSE' | 'SEARCH_RESULT' | 'SIMILAR',
        searchQuery: searchQuery ?? null,
      },
    });
  }

  res.status(204).send();
};
