import { createLLMProvider, ToolDefinition, ToolCall } from '../lib/llm';
import * as tools from './insights.tools';

export interface Insight {
  type: 'warning' | 'opportunity' | 'info';
  title: { he: string; en: string };
  body: { he: string; en: string };
}

// Tools for auto-insights — fixed set, no dynamic queries
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'getInventoryOverview',
    description: 'Returns total product count broken down by type and stock status.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'getStockDetails',
    description: 'Returns a list of out-of-stock products. Optionally filter by type.',
    parameters: {
      type: 'object',
      properties: { type: { type: 'string', description: 'Product type enum (JACKET, PANTS, etc.)' } },
      required: [],
    },
  },
  {
    name: 'getColorDistribution',
    description: 'Returns how many products exist per color, including out-of-stock counts.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'getImageCoverage',
    description: 'Returns how many products have processed images vs. missing images.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'getSearchTrends',
    description: 'Returns top searched queries, colors, and zero-result queries from the past N days.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Lookback window in days (default 30)' } },
      required: [],
    },
  },
  {
    name: 'getProductViewTrends',
    description: 'Returns most-viewed products by weighted score (search click = 3, browse = 1) over the past N days.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Lookback window in days (default 30)' } },
      required: [],
    },
  },
  {
    name: 'getStockGapFromSearch',
    description: 'Identifies colors and queries that users searched for frequently but found zero results — unmet demand.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Lookback window in days (default 30)' } },
      required: [],
    },
  },
];

// Additional tool available only in chat — allows arbitrary SELECT queries
const RUN_QUERY_TOOL: ToolDefinition = {
  name: 'runQuery',
  description: `Execute a custom read-only SQL SELECT query against the database. Use this ONLY when the specific tools above cannot answer the question. Always prefer the specific tools when they cover the question.

Available tables and key columns (PostgreSQL — use double-quoted names exactly as shown):
- "Product": id, name, sku, type (JACKET/PANTS/SHIRT/VEST/SHOES/TIE/BOW_TIE/BELT), color, status (IN_STOCK/OUT_OF_STOCK), "createdAt"
- "ProductImage": id, "productId", "rawUrl", "processedUrl", "isMain", "isFrontView", "order", "createdAt"
- "VTOJob": id, "productId", "sourceImageId", "runpodJobId", status (PENDING/RUNNING/DONE/FAILED), results (JSON array of {modelKey, url, selected}), "createdAt"
- "ProcessingJob": id, "productImageId", status (PENDING/PROCESSING/DONE/FAILED), "createdAt"
- "SearchLog": id, query, "queryType" (TEXT/IMAGE), "resultCount", "detectedColor", "createdAt"
- "ProductView": id, "productId", source (SEARCH_RESULT/BROWSE/SIMILAR), "createdAt"
- "GalleryImage": id, url, caption, "order", "createdAt"`,
  parameters: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'A valid PostgreSQL SELECT statement.' },
    },
    required: ['sql'],
  },
};

const CHAT_TOOL_DEFINITIONS: ToolDefinition[] = [...TOOL_DEFINITIONS, RUN_QUERY_TOOL];

async function handleToolCall(call: ToolCall): Promise<unknown> {
  const args = call.args as any;
  console.log(`[insights] tool called: ${call.name}`, args);
  switch (call.name) {
    case 'getInventoryOverview':    return tools.getInventoryOverview();
    case 'getStockDetails':         return tools.getStockDetails(args.type);
    case 'getColorDistribution':    return tools.getColorDistribution();
    case 'getImageCoverage':        return tools.getImageCoverage();
    case 'getSearchTrends':         return tools.getSearchTrends(args.days);
    case 'getProductViewTrends':    return tools.getProductViewTrends(args.days);
    case 'getStockGapFromSearch':   return tools.getStockGapFromSearch(args.days);
    case 'runQuery':                return tools.runReadOnlyQuery(args.sql as string);
    default: return { error: `Unknown tool: ${call.name}` };
  }
}

const AUTO_SYSTEM_PROMPT = `
You are a business analyst assistant for a suit and formal wear store.
You have tools to query inventory, search logs, and product view data.

Analyze the available data and return 3 to 6 actionable business insights.

Respond ONLY with a valid JSON array. No text before or after. Each element must have:
{
  "type": "warning" | "opportunity" | "info",
  "title": { "he": "<Hebrew title>", "en": "<English title>" },
  "body": { "he": "<Hebrew explanation 1-2 sentences>", "en": "<English explanation 1-2 sentences>" }
}

Examples of good insights:
- warning: High out-of-stock rate for a specific type
- opportunity: A color searched frequently but under-represented in inventory
- info: Most viewed product this month
- warning: Many products have no processed images

Be concise, specific, and actionable. Use actual numbers from the data.
`;

export async function getAutoInsights(): Promise<Insight[]> {
  const llm = createLLMProvider();
  const raw = await llm.runWithTools(
    AUTO_SYSTEM_PROMPT,
    'Analyze the store data and generate business insights.',
    TOOL_DEFINITIONS,
    handleToolCall,
  );

  // Extract JSON array from response (Gemini sometimes wraps in markdown)
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('LLM did not return a valid JSON array');
  return JSON.parse(match[0]) as Insight[];
}

export async function chatWithAgent(
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  lang: 'he' | 'en',
): Promise<string> {
  const langInstruction = lang === 'he'
    ? 'Always respond in Hebrew.'
    : 'Always respond in English.';

  const systemPrompt = `
You are a helpful business analyst assistant for a suit and formal wear store.
You have specific tools to query inventory, product views, and search trends.
You also have a runQuery tool for custom SQL SELECT queries.

Tool usage priority:
1. Always prefer the specific tools (getInventoryOverview, getStockDetails, getColorDistribution, getImageCoverage, getSearchTrends, getProductViewTrends, getStockGapFromSearch) when they can answer the question.
2. Only use runQuery if no specific tool covers the question.

Answer the store owner's questions clearly and concisely using the available data.
${langInstruction}
`;

  // Build conversation context into the user message
  const context = history.length > 0
    ? history.map(m => `${m.role === 'user' ? 'Owner' : 'Assistant'}: ${m.text}`).join('\n') + '\nOwner: ' + message
    : message;

  const llm = createLLMProvider();
  return llm.runWithTools(systemPrompt, context, CHAT_TOOL_DEFINITIONS, handleToolCall);
}
