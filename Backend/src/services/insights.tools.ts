import prisma from '../lib/prisma';

const BROWSE_WEIGHT = 1;
const SEARCH_CLICK_WEIGHT = 3;

// --- Inventory tools ---

export async function getInventoryOverview() {
  const products = await prisma.product.findMany({
    select: { type: true, status: true },
  });

  const total = products.length;
  const inStock = products.filter(p => p.status === 'IN_STOCK').length;
  const outOfStock = total - inStock;

  const byType: Record<string, { total: number; inStock: number; outOfStock: number }> = {};
  for (const p of products) {
    if (!byType[p.type]) byType[p.type] = { total: 0, inStock: 0, outOfStock: 0 };
    byType[p.type].total++;
    if (p.status === 'IN_STOCK') byType[p.type].inStock++;
    else byType[p.type].outOfStock++;
  }

  return { total, inStock, outOfStock, byType };
}

export async function getStockDetails(type?: string) {
  const products = await prisma.product.findMany({
    where: {
      status: 'OUT_OF_STOCK',
      ...(type ? { type: type as any } : {}),
    },
    select: { id: true, name: true, sku: true, type: true, color: true },
    orderBy: { type: 'asc' },
  });
  return products;
}

export async function getColorDistribution() {
  const products = await prisma.product.findMany({
    select: { color: true, status: true },
  });

  const dist: Record<string, { total: number; outOfStock: number }> = {};
  for (const p of products) {
    const key = p.color ?? 'UNKNOWN';
    if (!dist[key]) dist[key] = { total: 0, outOfStock: 0 };
    dist[key].total++;
    if (p.status === 'OUT_OF_STOCK') dist[key].outOfStock++;
  }

  return Object.entries(dist)
    .map(([color, counts]) => ({ color, ...counts }))
    .sort((a, b) => b.total - a.total);
}

export async function getImageCoverage() {
  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, sku: true, type: true,
      images: { select: { processedUrl: true } },
    },
  });

  const withImages = products.filter(p => p.images.every(img => img.processedUrl));
  // products with at least one image that still lacks a processedUrl
  const withoutImages = products.filter(p => p.images.some(img => !img.processedUrl));

  // Total ProductImage rows (assigned to products) that still lack a processedUrl
  const totalMissingProcessedImages = await prisma.productImage.count({
    where: { productId: { not: null }, processedUrl: null },
  });

  return {
    total: products.length,
    withImages: withImages.length,
    withoutImages: withoutImages.length,
    totalMissingProcessedImages,
    missingList: withoutImages.map(p => ({ id: p.id, name: p.name, sku: p.sku, type: p.type })),
  };
}

// Returns counts for the uploads queue (unassigned ProductImages):
// total, already processed, and currently pending/processing.
export async function getUploadsStatus() {
  const [total, processed, unassignedImages] = await Promise.all([
    prisma.productImage.count({ where: { productId: null } }),
    prisma.productImage.count({ where: { productId: null, processedUrl: { not: null } } }),
    prisma.productImage.findMany({ where: { productId: null }, select: { id: true } }),
  ]);

  const unassignedIds = unassignedImages.map(img => img.id);
  const processing = unassignedIds.length > 0
    ? await prisma.processingJob.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] }, productImageId: { in: unassignedIds } },
      })
    : 0;

  return { total, processed, processing, unprocessed: total - processed };
}

// --- Search / demand tools ---

export async function getSearchTrends(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.searchLog.findMany({
    where: { createdAt: { gte: since }, queryType: 'TEXT', query: { not: null } },
    select: { query: true, resultCount: true, detectedColor: true },
  });

  // Query frequency
  const queryCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  const zeroResultQueries: Record<string, number> = {};

  for (const log of logs) {
    const q = log.query!.toLowerCase().trim();
    queryCounts[q] = (queryCounts[q] ?? 0) + 1;
    if (log.resultCount === 0) zeroResultQueries[q] = (zeroResultQueries[q] ?? 0) + 1;
    if (log.detectedColor) {
      colorCounts[log.detectedColor] = (colorCounts[log.detectedColor] ?? 0) + 1;
    }
  }

  const topQueries = Object.entries(queryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  const topColors = Object.entries(colorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([color, count]) => ({ color, count }));

  const topZeroResult = Object.entries(zeroResultQueries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  const imageSearaches = await prisma.searchLog.count({
    where: { createdAt: { gte: since }, queryType: 'IMAGE' },
  });

  return {
    totalTextSearches: logs.length,
    totalImageSearches: imageSearaches,
    topQueries,
    topColors,
    topZeroResultQueries: topZeroResult,
  };
}

export async function getProductViewTrends(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const views = await prisma.productView.findMany({
    where: { createdAt: { gte: since } },
    select: { productId: true, source: true, product: { select: { name: true, type: true, color: true } } },
  });

  const scores: Record<string, { productId: string; name: string; type: string; color: string | null; score: number; views: number }> = {};

  for (const v of views) {
    const weight = v.source === 'SEARCH_RESULT' ? SEARCH_CLICK_WEIGHT : BROWSE_WEIGHT;
    if (!scores[v.productId]) {
      scores[v.productId] = {
        productId: v.productId,
        name: v.product.name,
        type: v.product.type,
        color: v.product.color,
        score: 0,
        views: 0,
      };
    }
    scores[v.productId].score += weight;
    scores[v.productId].views++;
  }

  return Object.values(scores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// Returns colors/types searched frequently but with high out-of-stock or zero-result rates
export async function getStockGapFromSearch(days: number = 30) {
  const trends = await getSearchTrends(days);
  const inventory = await getInventoryOverview();

  // Colors searched but heavily out of stock
  const colorGaps = trends.topColors
    .map(({ color, count }) => {
      const inv = inventory.byType; // byType, not color — approximate via colorDistribution below
      return { color, searchCount: count };
    })
    .filter(g => g.searchCount >= 3);

  // Zero-result queries that were searched multiple times (unmet demand)
  const unmetDemand = trends.topZeroResultQueries.filter(q => q.count >= 2);

  return { colorGaps, unmetDemand };
}
