import { Request, Response } from 'express';
import * as aiService from '../services/ai.service';
import prisma from '../lib/prisma';

const DEFAULT_LIMIT = 8;
const COLOR_BOOST = 0.10;
const COLOR_SIGMA = 65; // Gaussian std-dev in RGB space — boost decays smoothly with color distance
const RELATIVE_WINDOW = 0.15;
const ABSOLUTE_FLOOR = 0.65;
// Text-image CLIP similarities are naturally lower (0.15–0.35).
// TEXT_ABSOLUTE_FLOOR: if even the best result is below this, the query has no fashion relevance — return empty.
// TEXT_RELATIVE_WINDOW: only show results within this delta of the best score.
const TEXT_RELATIVE_WINDOW = 0.04;
const TEXT_ABSOLUTE_FLOOR = 0.25;

// Hebrew and English color words → base color code.
// Covers grammatical variants (gender/number) common in Hebrew queries.
const QUERY_COLOR_WORDS: Record<string, string> = {
  // Hebrew
  'שחור': 'BLACK',  'שחורה': 'BLACK',  'שחורים': 'BLACK',  'שחורות': 'BLACK',
  'לבן':  'WHITE',  'לבנה':  'WHITE',  'לבנים':  'WHITE',  'לבנות':  'WHITE',
  'חום':  'BROWN',  'חומה':  'BROWN',  'חומים':  'BROWN',  'חומות':  'BROWN',
  'אדום': 'RED',    'אדומה': 'RED',    'אדומים': 'RED',    'אדומות': 'RED',
  'אפור': 'GRAY',   'אפורה': 'GRAY',   'אפורים': 'GRAY',   'אפורות': 'GRAY',
  'צהוב': 'YELLOW', 'צהובה': 'YELLOW', 'צהובים': 'YELLOW', 'צהובות': 'YELLOW',
  'כחול': 'NAVY',   'כחולה': 'NAVY',   'כחולים': 'NAVY',   'כחולות': 'NAVY',
  'נייבי': 'NAVY',  'תכלת': 'SKY_BLUE',
  'ירוק': 'GREEN',  'ירוקה': 'GREEN',  'ירוקים': 'GREEN',  'ירוקות': 'GREEN',
  'זית':  'OLIVE',
  'ורוד': 'PINK',   'ורודה': 'PINK',   'ורודים': 'PINK',   'ורודות': 'PINK',
  'סגול': 'PURPLE', 'סגולה': 'PURPLE', 'סגולים': 'PURPLE', 'סגולות': 'PURPLE',
  'כתום': 'ORANGE', 'כתומה': 'ORANGE', 'כתומים': 'ORANGE', 'כתומות': 'ORANGE',
  "בז'":  'BEIGE',  'בז':    'BEIGE',  'בז׳':    'BEIGE',
  'קרם':  'CREAM',  'שמנת': 'IVORY',  'בורדו': 'BURGUNDY', 'טורקיז': 'TURQUOISE',
  // English
  'black': 'BLACK', 'white': 'WHITE', 'brown': 'BROWN', 'red': 'RED',
  'gray':  'GRAY',  'grey':  'GRAY',  'yellow': 'YELLOW', 'navy': 'NAVY',
  'blue':  'NAVY',  'teal':  'TURQUOISE', 'green': 'GREEN', 'olive': 'OLIVE',
  'pink':  'PINK',  'purple': 'PURPLE', 'orange': 'ORANGE', 'beige': 'BEIGE',
  'cream': 'CREAM', 'ivory': 'IVORY', 'burgundy': 'BURGUNDY', 'turquoise': 'TURQUOISE',
  'charcoal': 'GRAY', 'sky': 'SKY_BLUE',
};

// When filtering by a detected color, include visually adjacent color families.
const COLOR_FILTER_FAMILY: Record<string, string[]> = {
  BLACK:     ['BLACK'],
  WHITE:     ['WHITE', 'IVORY', 'CREAM'],
  BROWN:     ['BROWN'],
  RED:       ['RED', 'BURGUNDY'],
  GRAY:      ['GRAY'],
  SKY_BLUE:  ['SKY_BLUE', 'TURQUOISE'],
  YELLOW:    ['YELLOW'],
  CREAM:     ['CREAM', 'IVORY', 'BEIGE'],
  IVORY:     ['IVORY', 'CREAM', 'WHITE', 'BEIGE'],
  PURPLE:    ['PURPLE'],
  NAVY:      ['NAVY'],
  ORANGE:    ['ORANGE'],
  GREEN:     ['GREEN', 'OLIVE'],
  OLIVE:     ['OLIVE', 'GREEN'],
  PINK:      ['PINK'],
  BURGUNDY:  ['BURGUNDY', 'RED'],
  TURQUOISE: ['TURQUOISE', 'SKY_BLUE'],
  BEIGE:     ['BEIGE', 'CREAM', 'IVORY'],
};

function detectQueryColor(query: string): string | null {
  const words = query.trim().split(/[\s,]+/);
  for (const word of words) {
    const color = QUERY_COLOR_WORDS[word] ?? QUERY_COLOR_WORDS[word.toLowerCase()];
    if (color) return color;
  }
  return null;
}

// Returns true if either the AI-detected dominant color OR the manually-entered
// product color falls within the expected color family.
// Using both signals handles cases where AI color detection is thrown off by a
// large metallic element (e.g. a silver buckle dominating a red belt image).
function productMatchesColorFamily(
  detectedColor: string,
  dominantColor: string | null,
  manualColor: string | null,
): boolean {
  const family = COLOR_FILTER_FAMILY[detectedColor] ?? [detectedColor];

  if (dominantColor && family.includes(extractBaseColor(dominantColor))) return true;

  if (manualColor) {
    const code = QUERY_COLOR_WORDS[manualColor] ?? QUERY_COLOR_WORDS[manualColor.toLowerCase()];
    if (code && family.includes(extractBaseColor(code))) return true;
  }

  return false;
}

// Hebrew and English pattern (texture) words → pattern suffix stored in color keys.
const QUERY_PATTERN_WORDS: Record<string, string> = {
  'מנוקד': 'DOTTED', 'מנוקדת': 'DOTTED', 'מנוקדים': 'DOTTED', 'מנוקדות': 'DOTTED',
  'נקודות': 'DOTTED', 'נקודה': 'DOTTED',
  'מפוספס': 'STRIPED', 'מפוספסת': 'STRIPED', 'מפוספסים': 'STRIPED', 'מפוספסות': 'STRIPED',
  'פסים': 'STRIPED', 'פס': 'STRIPED',
  'dotted': 'DOTTED', 'polka': 'DOTTED', 'dots': 'DOTTED',
  'striped': 'STRIPED', 'stripes': 'STRIPED',
};

function detectQueryPattern(query: string): string | null {
  const words = query.trim().split(/[\s,]+/);
  for (const word of words) {
    const pattern = QUERY_PATTERN_WORDS[word] ?? QUERY_PATTERN_WORDS[word.toLowerCase()];
    if (pattern) return pattern;
  }
  return null;
}

const BASE_COLORS = [
  "BLACK", "WHITE", "BROWN", "RED", "GRAY", "SKY_BLUE", "YELLOW",
  "CREAM", "IVORY", "PURPLE", "NAVY", "ORANGE", "GREEN", "OLIVE",
  "PINK", "BURGUNDY", "TURQUOISE", "BEIGE",
];

// RGB reference points — must stay in sync with _COLOR_REFS in embedder.py
const COLOR_RGB_REFS: Record<string, [number, number, number]> = {
  BLACK:     [20,  20,  20],
  WHITE:     [245, 245, 245],
  BROWN:     [110, 70,  35],
  RED:       [180, 30,  30],
  GRAY:      [128, 128, 128],
  SKY_BLUE:  [80,  170, 220],
  YELLOW:    [230, 200, 50],
  CREAM:     [235, 215, 175],
  IVORY:     [245, 235, 210],
  PURPLE:    [100, 50,  150],
  NAVY:      [25,  50,  130],
  ORANGE:    [220, 110, 30],
  GREEN:     [40,  120, 40],
  OLIVE:     [90,  110, 50],
  PINK:      [220, 140, 160],
  BURGUNDY:  [110, 20,  35],
  TURQUOISE: [40,  180, 170],
  BEIGE:     [185, 158, 120],
};

// Extracts the base color from a stored color key (e.g. "LIGHT_NAVY" → "NAVY", "GRAY_STRIPED" → "GRAY").
function extractBaseColor(color: string): string {
  const upper = color.toUpperCase();
  for (const base of BASE_COLORS) {
    if (upper === base || upper === `LIGHT_${base}` || upper === `DARK_${base}` ||
        upper === `${base}_DOTTED` || upper === `${base}_STRIPED`) {
      return base;
    }
  }
  return upper;
}

// Returns a Gaussian-scaled boost based on RGB distance between detected and product color.
// Full COLOR_BOOST at distance=0 (exact match), decaying smoothly with sigma=COLOR_SIGMA.
// This allows near-miss colors (e.g. CREAM query → IVORY/BEIGE product) to get partial credit.
function colorProximityBoost(detectedColor: string, productColor: string | null): number {
  if (!productColor) return 0;
  const baseProduct = extractBaseColor(productColor);

  const refDetected = COLOR_RGB_REFS[detectedColor];
  const refProduct = COLOR_RGB_REFS[baseProduct];
  if (!refDetected || !refProduct) return 0;

  const distSq =
    (refDetected[0] - refProduct[0]) ** 2 +
    (refDetected[1] - refProduct[1]) ** 2 +
    (refDetected[2] - refProduct[2]) ** 2;

  return COLOR_BOOST * Math.exp(-distSq / (2 * COLOR_SIGMA * COLOR_SIGMA));
}

interface SearchResult {
  id: string;
  name: string;
  sku: string;
  type: string;
  color: string | null;
  dominantColor: string | null;
  status: string;
  attributes: unknown;
  processedUrl: string;
  similarity: number;
}

// GET /api/search/similar/:productId?limit=4
// Finds the embedding of the product's main image and returns the most
// visually similar OTHER products, excluding the product itself.
export const getSimilarProducts = async (req: Request, res: Response) => {
  const { productId } = req.params;
  const limit = Math.min(parseInt(String(req.query.limit ?? 4), 10) || 4, 8);

  // Fetch the stored CLIP embedding of the product's main (or first) processed image
  const imageRows = await prisma.$queryRaw<{ embedding: string }[]>`
    SELECT pi.embedding::text AS embedding
    FROM "ProductImage" pi
    WHERE pi."productId" = ${productId}
      AND pi.embedding IS NOT NULL
    ORDER BY pi."isMain" DESC, pi."order" ASC
    LIMIT 1
  `;

  if (imageRows.length === 0 || !imageRows[0].embedding) {
    res.json({ results: [] });
    return;
  }

  const pgVector = imageRows[0].embedding;

  // Score each product by its best-matching image, but display its main image.
  const rows = await prisma.$queryRaw<SearchResult[]>`
    WITH scored AS (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.sku,
        p.type::text,
        p.color,
        p.status::text,
        p.attributes,
        pi."dominantColor",
        1 - (pi.embedding <=> ${pgVector}::vector) AS similarity
      FROM "ProductImage" pi
      JOIN "Product" p ON pi."productId" = p.id
      WHERE pi.embedding IS NOT NULL
        AND pi."productId" IS NOT NULL
        AND pi."processedUrl" IS NOT NULL
        AND p.id != ${productId}
      ORDER BY p.id, pi.embedding <=> ${pgVector}::vector ASC
    ),
    main_img AS (
      SELECT DISTINCT ON ("productId")
        "productId",
        "processedUrl"
      FROM "ProductImage"
      WHERE "productId" IS NOT NULL AND "processedUrl" IS NOT NULL
      ORDER BY "productId", "isMain" DESC, "order" ASC
    )
    SELECT s.id, s.name, s.sku, s.type, s.color, s.status, s.attributes,
           s."dominantColor",
           mi."processedUrl",
           s.similarity
    FROM scored s
    JOIN main_img mi ON mi."productId" = s.id
    ORDER BY s.similarity DESC
    LIMIT ${limit}
  `;

  res.json({ results: rows });
};

// POST /api/search/text
// Accepts a text query, embeds it with CLIP's text encoder, and returns the
// most visually matching products by cross-modal cosine similarity.
export const searchByText = async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };
  if (!query || !query.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 50);

  let embedding: number[];
  try {
    ({ embedding } = await aiService.embedText(query.trim()));
  } catch (err: any) {
    res.status(502).json({ error: `Text embedding failed: ${err.message}` });
    return;
  }

  const pgVector = `[${embedding.join(',')}]`;

  // CLIP text-image similarities are lower than image-image (typically 0.15-0.35),
  // so we skip the absolute floor and only apply the relative window.
  // Score each product by its best-matching image, but display its main image.
  const rows = await prisma.$queryRaw<SearchResult[]>`
    WITH scored AS (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.sku,
        p.type::text,
        p.color,
        p.status::text,
        p.attributes,
        pi."dominantColor",
        1 - (pi.embedding <=> ${pgVector}::vector) AS similarity
      FROM "ProductImage" pi
      JOIN "Product" p ON pi."productId" = p.id
      WHERE pi.embedding IS NOT NULL
        AND pi."productId" IS NOT NULL
        AND pi."processedUrl" IS NOT NULL
      ORDER BY p.id, pi.embedding <=> ${pgVector}::vector ASC
    ),
    main_img AS (
      SELECT DISTINCT ON ("productId")
        "productId",
        "processedUrl"
      FROM "ProductImage"
      WHERE "productId" IS NOT NULL AND "processedUrl" IS NOT NULL
      ORDER BY "productId", "isMain" DESC, "order" ASC
    )
    SELECT s.id, s.name, s.sku, s.type, s.color, s.status, s.attributes,
           s."dominantColor",
           mi."processedUrl",
           s.similarity
    FROM scored s
    JOIN main_img mi ON mi."productId" = s.id
    ORDER BY s.similarity DESC
    LIMIT ${limit}
  `;

  const bestScore = rows.length > 0 ? Number(rows[0].similarity) : 0;

  // If the best result doesn't clear the absolute floor, the query has no fashion relevance.
  if (bestScore < TEXT_ABSOLUTE_FLOOR) {
    res.json({ results: [] });
    return;
  }

  let results = rows
    .filter(r => Number(r.similarity) >= bestScore - TEXT_RELATIVE_WINDOW)
    .map(r => ({ ...r, similarity: Number(r.similarity) }));

  // Hard-filter by color family when a color word is detected in the query.
  const detectedColor = detectQueryColor(query.trim());
  if (detectedColor) {
    const colorFiltered = results.filter(r => productMatchesColorFamily(detectedColor, r.dominantColor, r.color));
    if (colorFiltered.length > 0) results = colorFiltered;
  }

  // Hard-filter by pattern (dotted/striped) when a pattern word is detected.
  const detectedPattern = detectQueryPattern(query.trim());
  if (detectedPattern) {
    const patternFiltered = results.filter(r =>
      r.color?.toUpperCase().includes(`_${detectedPattern}`) ?? false
    );
    if (patternFiltered.length > 0) results = patternFiltered;
  }

  res.json({ results });
};

// POST /api/search/image
// Accepts a multipart image upload, embeds it with CLIP, and returns the
// most visually similar products ranked by cosine similarity.
export const searchByImage = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 50);

  let embedding: number[];
  let dominantColor: string | null = null;
  try {
    ({ embedding, dominantColor } = await aiService.embedImage(file.buffer, file.originalname || 'query.jpg'));
  } catch (err: any) {
    res.status(502).json({ error: `Embedding failed: ${err.message}` });
    return;
  }

  const pgVector = `[${embedding.join(',')}]`;

  // Score each product by its best-matching image, but display its main image.
  const rows = await prisma.$queryRaw<SearchResult[]>`
    WITH scored AS (
      SELECT DISTINCT ON (p.id)
        p.id,
        p.name,
        p.sku,
        p.type::text,
        p.color,
        p.status::text,
        p.attributes,
        pi."dominantColor",
        1 - (pi.embedding <=> ${pgVector}::vector) AS similarity
      FROM "ProductImage" pi
      JOIN "Product" p ON pi."productId" = p.id
      WHERE pi.embedding IS NOT NULL
        AND pi."productId" IS NOT NULL
        AND pi."processedUrl" IS NOT NULL
      ORDER BY p.id, pi.embedding <=> ${pgVector}::vector ASC
    ),
    main_img AS (
      SELECT DISTINCT ON ("productId")
        "productId",
        "processedUrl"
      FROM "ProductImage"
      WHERE "productId" IS NOT NULL AND "processedUrl" IS NOT NULL
      ORDER BY "productId", "isMain" DESC, "order" ASC
    )
    SELECT s.id, s.name, s.sku, s.type, s.color, s.status, s.attributes,
           s."dominantColor",
           mi."processedUrl",
           s.similarity
    FROM scored s
    JOIN main_img mi ON mi."productId" = s.id
    ORDER BY s.similarity DESC
    LIMIT ${limit}
  `;

  // Apply proximity-based color boost, then filter by relative threshold and re-sort
  const boosted = rows.map(r => {
    const boost = dominantColor ? colorProximityBoost(dominantColor, r.dominantColor) : 0;
    return { ...r, similarity: boost > 0 ? Math.min(r.similarity + boost, 1) : r.similarity };
  });

  const bestScore = boosted.length > 0 ? boosted[0].similarity : 0;
  const minThreshold = Math.max(bestScore - RELATIVE_WINDOW, ABSOLUTE_FLOOR);

  const results = boosted
    .filter(r => r.similarity >= minThreshold)
    .sort((a, b) => b.similarity - a.similarity);

  res.json({ results, dominantColor });
};
