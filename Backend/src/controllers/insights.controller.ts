import { Request, Response } from 'express';
import * as insightsTools from '../services/insights.tools';
import { getAutoInsights, chatWithAgent } from '../services/insights.service';

// GET /api/insights/stats
// Fast DB-only stats — no LLM, used for the stats cards row.
export const getStats = async (_req: Request, res: Response) => {
  const [overview, imageCoverage, searchTrends, uploadsStatus] = await Promise.all([
    insightsTools.getInventoryOverview(),
    insightsTools.getImageCoverage(),
    insightsTools.getSearchTrends(1), // today only for the "searches today" card
    insightsTools.getUploadsStatus(),
  ]);

  res.json({
    totalProducts: overview.total,
    outOfStock: overview.outOfStock,
    inStock: overview.inStock,
    byType: overview.byType,
    missingImages: imageCoverage.withoutImages,
    totalMissingProcessedImages: imageCoverage.totalMissingProcessedImages,
    searchesToday: searchTrends.totalTextSearches + searchTrends.totalImageSearches,
    uploadsTotal: uploadsStatus.total,
    uploadsProcessed: uploadsStatus.processed,
    uploadsProcessing: uploadsStatus.processing,
    uploadsUnprocessed: uploadsStatus.unprocessed,
  });
};

function classifyLLMError(err: unknown): { status: number; error: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
    return { status: 429, error: 'Gemini quota exceeded. Check your API key at ai.google.dev.' };
  }
  if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')) {
    return { status: 503, error: 'שרת ה-AI עמוס כעת. אנא נסה שוב במועד מאוחר יותר.' };
  }
  if (msg.includes('API_KEY') || msg.includes('403') || msg.includes('401')) {
    return { status: 401, error: 'Gemini API key is invalid. Get a key from ai.google.dev.' };
  }
  return { status: 500, error: msg };
}

// GET /api/insights/auto
// LLM-generated insights in bilingual JSON format.
export const getInsights = async (_req: Request, res: Response) => {
  try {
    const insights = await getAutoInsights();
    res.json({ insights });
  } catch (err) {
    const { status, error } = classifyLLMError(err);
    res.status(status).json({ error });
  }
};

// POST /api/insights/chat  { message: string, history: [], lang: 'he' | 'en' }
export const chat = async (req: Request, res: Response) => {
  const { message, history = [], lang = 'he' } = req.body as {
    message?: string;
    history?: { role: 'user' | 'model'; text: string }[];
    lang?: 'he' | 'en';
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const response = await chatWithAgent(message.trim(), history, lang);
    const updatedHistory = [
      ...history,
      { role: 'user' as const, text: message.trim() },
      { role: 'model' as const, text: response },
    ];
    res.json({ response, history: updatedHistory });
  } catch (err) {
    const { status, error } = classifyLLMError(err);
    res.status(status).json({ error });
  }
};
