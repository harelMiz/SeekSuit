import { Request, Response } from 'express';
import * as aiService from '../services/ai.service';
import prisma from '../lib/prisma';
import { createClient } from '@supabase/supabase-js';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _supabase;
}

// Skip logging if request has a valid admin JWT — prevents admin actions from polluting analytics.
// Runs fire-and-forget; response is already sent before this resolves.
async function logSearchAsync(req: Request, data: {
  query?: string | null;
  queryType: 'TEXT' | 'IMAGE' | 'DETECT';
  resultCount: number;
  detectedColor?: string | null;
  detectedType?: string | null;
}): Promise<void> {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const { data: { user } } = await getSupabase().auth.getUser(auth.slice(7));
    const meta = user?.app_metadata ?? {};
    if (meta.role === 'admin' || meta.is_admin === true) return;
  }
  await prisma.searchLog.create({ data: {
    query: data.query ?? null,
    queryType: data.queryType,
    resultCount: data.resultCount,
    detectedColor: data.detectedColor ?? null,
    detectedType: data.detectedType ?? null,
  }});
}

function logSearch(req: Request, data: {
  query?: string | null;
  queryType: 'TEXT' | 'IMAGE' | 'DETECT';
  resultCount: number;
  detectedColor?: string | null;
  detectedType?: string | null;
}): void {
  logSearchAsync(req, data).catch(() => {});
}

const DEFAULT_LIMIT = 8;
const COLOR_BOOST = 0.20;
const COLOR_SIGMA = 45; // Gaussian std-dev in RGB space — tighter decay so wrong colors get less credit
const RELATIVE_WINDOW = 0.15;
const ABSOLUTE_FLOOR = 0.65;
// Belts are photographed as a thin worn accessory in picker searches but as a
// standalone studio product in the catalog — a bigger visual context gap than
// large garments (jacket/pants) have, so genuinely matching belts still land
// noticeably lower in raw CLIP similarity. Give BELT its own, lower floor.
const ABSOLUTE_FLOOR_BY_TYPE: Record<string, number> = {
  BELT: 0.60,
};
// Text-image CLIP similarities are naturally lower (0.15–0.35).
// TEXT_ABSOLUTE_FLOOR: if even the best result is below this, the query has no fashion relevance — return empty.
// TEXT_RELATIVE_WINDOW: only show results within this delta of the best score.
const TEXT_RELATIVE_WINDOW = 0.04;
const TEXT_ABSOLUTE_FLOOR = 0.25;

// Hebrew and English product type words → ProductType enum value.
// Covers grammatical variants common in Hebrew queries.
const QUERY_TYPE_WORDS: Record<string, string> = {
  // Hebrew — jackets / suits
  'חליפה': 'JACKET',   'חליפות': 'JACKET',
  "ג'קט":  'JACKET',  "ג'קטים": 'JACKET',
  'בלייזר': 'JACKET',
  // Hebrew — vests
  'ווסט':   'VEST',    'וסט':    'VEST',
  'ווסטים': 'VEST',    'וסטים':  'VEST',
  // Hebrew — pants
  'מכנסיים': 'PANTS',  'מכנס': 'PANTS',
  // Hebrew — shirts
  'חולצה':  'SHIRT',   'חולצות': 'SHIRT',
  // Hebrew — ties
  'עניבה':  'TIE',     'עניבות': 'TIE',
  // Hebrew — bow ties (two-word phrase handled in detectQueryType)
  'פפיון':  'BOW_TIE', 'פפיונים': 'BOW_TIE',
  'פרפרית': 'BOW_TIE',
  // Hebrew — belts
  'חגורה':  'BELT',    'חגורות': 'BELT',
  // Hebrew — shoes
  'נעליים': 'SHOES',   'נעל': 'SHOES',
  // English
  'jacket': 'JACKET',  'jackets': 'JACKET',
  'blazer': 'JACKET',  'blazers': 'JACKET',
  'suit':   'JACKET',  'suits':   'JACKET',
  'vest':   'VEST',    'vests':   'VEST',    'waistcoat': 'VEST',
  'pants':  'PANTS',   'trousers': 'PANTS',
  'shirt':  'SHIRT',   'shirts':  'SHIRT',
  'tie':    'TIE',     'ties':    'TIE',     'necktie': 'TIE',
  'bowtie': 'BOW_TIE', 'bowties': 'BOW_TIE',
  'belt':   'BELT',    'belts':   'BELT',
  'shoes':  'SHOES',   'shoe':    'SHOES',
};

function detectQueryType(query: string): string | null {
  // Check two-word phrases before word splitting
  if (/bow[- ]tie/i.test(query) || query.includes('עניבת פרפר')) return 'BOW_TIE';

  const words = query.trim().split(/[\s,]+/);
  for (const word of words) {
    const type = QUERY_TYPE_WORDS[word] ?? QUERY_TYPE_WORDS[word.toLowerCase()];
    if (type) return type;
  }
  return null;
}

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
  // Achromatics
  BLACK:     ['BLACK'],
  WHITE:     ['WHITE', 'IVORY', 'CREAM'],
  GRAY:      ['GRAY'],
  // Warm neutrals — all adjacent to each other (CLIP often confuses them)
  BROWN:     ['BROWN', 'BEIGE', 'ORANGE'],
  BEIGE:     ['BEIGE', 'CREAM', 'IVORY', 'BROWN', 'YELLOW'],
  CREAM:     ['CREAM', 'IVORY', 'BEIGE', 'BROWN', 'YELLOW'],
  IVORY:     ['IVORY', 'CREAM', 'WHITE', 'BEIGE'],
  YELLOW:    ['YELLOW', 'BEIGE', 'CREAM', 'ORANGE'],
  ORANGE:    ['ORANGE', 'BROWN', 'YELLOW', 'BEIGE'],
  // Reds and pinks
  RED:       ['RED', 'BURGUNDY', 'ORANGE', 'PINK'],
  BURGUNDY:  ['BURGUNDY', 'RED', 'BROWN', 'PURPLE', 'ORANGE'],
  PINK:      ['PINK', 'RED', 'PURPLE'],
  // Blues
  NAVY:      ['NAVY', 'SKY_BLUE', 'PURPLE'],
  SKY_BLUE:  ['SKY_BLUE', 'NAVY', 'TURQUOISE'],
  TURQUOISE: ['TURQUOISE', 'SKY_BLUE', 'GREEN'],
  // Greens
  GREEN:     ['GREEN', 'OLIVE', 'TURQUOISE'],
  OLIVE:     ['OLIVE', 'GREEN', 'BROWN'],
  // Purple
  PURPLE:    ['PURPLE', 'NAVY', 'BURGUNDY', 'PINK'],
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

  if (manualColor && family.includes(extractBaseColor(manualColor))) return true;

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
// Also handles Hebrew color names (e.g. "כתום מפוספס" → "ORANGE") via QUERY_COLOR_WORDS.
function extractBaseColor(color: string): string {
  const upper = color.toUpperCase();
  for (const base of BASE_COLORS) {
    if (upper === base || upper === `LIGHT_${base}` || upper === `DARK_${base}` ||
        upper === `${base}_DOTTED` || upper === `${base}_STRIPED`) {
      return base;
    }
  }
  const words = color.trim().split(/[\s_,]+/);
  for (const word of words) {
    const code = QUERY_COLOR_WORDS[word] ?? QUERY_COLOR_WORDS[word.toLowerCase()];
    if (code) return code;
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

// POST /api/search/detect
// Accepts an image upload, runs OWL-ViT clothing detection, and returns
// detected items with bounding boxes and crop previews for the frontend picker.
export const detectItems = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  try {
    const result = await aiService.detectItems(file.buffer, file.originalname || 'query.jpg');
    logSearch(req, { queryType: 'DETECT', resultCount: result.items.length });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Detection failed: ${err.message}` });
  }
};

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

  // Hard-filter by product type when a type word is detected in the query.
  const detectedType = detectQueryType(query.trim());
  if (detectedType) {
    const typeFiltered = results.filter(r => r.type === detectedType);
    if (typeFiltered.length > 0) results = typeFiltered;
  }

  logSearch(req, { query: query.trim(), queryType: 'TEXT', resultCount: results.length, detectedColor: detectedColor });
  res.json({ results });
};

// POST /api/search/image?limit=8&productType=SHIRT
// Accepts a multipart image upload, embeds it with CLIP, and returns the
// most visually similar products ranked by cosine similarity.
// Optional productType param restricts results to a single ProductType enum value.
export const searchByImage = async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 50);
  const productType = req.query.productType as string | undefined;
  // Types with a lowered ABSOLUTE_FLOOR (see above) need a wider candidate pool
  // fetched from the DB too — otherwise a genuinely matching item ranked just
  // outside the top `limit` by raw similarity never even reaches that lower
  // floor to be considered. The final response is still trimmed to `limit`.
  const fetchLimit = productType && ABSOLUTE_FLOOR_BY_TYPE[productType] ? Math.max(limit, 30) : limit;

  let embedding: number[];
  let dominantColor: string | null = null;
  let dominantColorFamily: string[] | null = null;
  try {
    ({ embedding, dominantColor, dominantColorFamily } = await aiService.embedImage(
      file.buffer,
      file.originalname || 'query.jpg',
      productType ? { clean: true, productType } : {}
    ));
  } catch (err: any) {
    res.status(502).json({ error: `Embedding failed: ${err.message}` });
    return;
  }

  const pgVector = `[${embedding.join(',')}]`;

  // Score each product by its best-matching image, but display its main image.
  // Two query variants to avoid Prisma.sql fragment interpolation issues with the driver adapter.
  const rows = productType
    ? await prisma.$queryRaw<SearchResult[]>`
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
            AND p.type = ${productType}::"ProductType"
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
        LIMIT ${fetchLimit}
      `
    : await prisma.$queryRaw<SearchResult[]>`
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

  // For picker crops (productType set), color detection from a contextual crop is
  // unreliable — skip the boost and rely on CLIP similarity alone.
  const queryColor = productType ? null : dominantColor;

  // Apply proximity-based color boost and re-sort (boost may change ranking)
  const boosted = rows.map(r => {
    const boost = queryColor ? colorProximityBoost(queryColor, r.dominantColor) : 0;
    return { ...r, similarity: boost > 0 ? Math.min(Number(r.similarity) + boost, 1) : Number(r.similarity) };
  });
  boosted.sort((a, b) => b.similarity - a.similarity);

  const bestScore = boosted.length > 0 ? boosted[0].similarity : 0;
  const absoluteFloor = productType ? (ABSOLUTE_FLOOR_BY_TYPE[productType] ?? ABSOLUTE_FLOOR) : ABSOLUTE_FLOOR;
  const minThreshold = Math.max(bestScore - RELATIVE_WINDOW, absoluteFloor);

  let results = boosted.filter(r => r.similarity >= minThreshold);

  // For picker searches: apply a color hard-filter when BiRefNet detected a specific
  // chromatic color. Skip when BLACK is detected — it often misidentifies dark-toned
  // items (e.g. brown shoes with dark soles), and CLIP handles black items correctly anyway.
  if (productType && dominantColor && dominantColor !== 'BLACK') {
    const colorFiltered = results.filter(r => productMatchesColorFamily(dominantColor, r.dominantColor, r.color));
    if (colorFiltered.length > 0) results = colorFiltered;
  }

  // fetchLimit may have pulled in a wider candidate pool than requested (see above) —
  // trim back down to what the caller asked for.
  results = results.slice(0, limit);

  logSearch(req, { queryType: 'IMAGE', resultCount: results.length, detectedColor: dominantColor, detectedType: productType ?? null });
  res.json({ results, dominantColor });
};
