import api from "./api";
import { supabase } from "../lib/supabase";

async function adminHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface InsightBilingual {
  type: "warning" | "opportunity" | "info";
  title: { he: string; en: string };
  body: { he: string; en: string };
}

export interface DashboardStats {
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  byType: Record<string, { total: number; inStock: number; outOfStock: number }>;
  missingImages: number;
  totalMissingProcessedImages: number;
  searchesToday: number;
  uploadsTotal: number;
  uploadsProcessed: number;
  uploadsProcessing: number;
  uploadsUnprocessed: number;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function fetchStats(): Promise<DashboardStats> {
  const headers = await adminHeaders();
  const { data } = await api.get<DashboardStats>("/insights/stats", { headers });
  return data;
}

export async function fetchAutoInsights(): Promise<InsightBilingual[]> {
  const headers = await adminHeaders();
  const { data } = await api.get<{ insights: InsightBilingual[] }>("/insights/auto", { headers });
  return data.insights;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  lang: "he" | "en",
): Promise<{ response: string; history: ChatMessage[] }> {
  const headers = await adminHeaders();
  const { data } = await api.post("/insights/chat", { message, history, lang }, { headers });
  return data;
}

export interface SearchLogEntry {
  id: string;
  query: string | null;
  queryType: "TEXT" | "IMAGE" | "DETECT";
  resultCount: number;
  detectedColor: string | null;
  detectedType: string | null;
  createdAt: string;
}

export async function fetchSearchHistory(days = 7): Promise<SearchLogEntry[]> {
  const headers = await adminHeaders();
  const params = new URLSearchParams({ limit: "2000", days: String(days) });
  const { data } = await api.get<SearchLogEntry[]>(`/analytics/searches?${params}`, { headers });
  return data;
}

export interface TopProduct {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  score: number;
}

export async function fetchTopProducts(limit = 8, days = 30): Promise<TopProduct[]> {
  const headers = await adminHeaders();
  const { data } = await api.get<TopProduct[]>(`/analytics/top-products?limit=${limit}&days=${days}`, { headers });
  return data;
}

export async function recordProductView(
  productId: string,
  source: "BROWSE" | "SEARCH_RESULT" | "SIMILAR",
  searchQuery?: string,
): Promise<void> {
  await api.post("/analytics/view", { productId, source, searchQuery });
}
