import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { ArrowLeft, Search, Camera, ChevronDown, X } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import ItemPickerModal, { type DetectedItem } from "../components/ui/ItemPickerModal";
import api from "../services/api";
import type { Product, ProductType, ProductStatus } from "../types/product";

const HOME_SEARCH_KEY = "seeksuit_home_search";
const INITIAL_VISIBLE = 8;

interface SearchResult {
  id: string;
  name: string;
  sku: string;
  type: string;
  color: string | null;
  status: string;
  attributes: Record<string, unknown> | null;
  processedUrl: string;
  similarity: number;
}

function toProduct(r: SearchResult): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    type: r.type as ProductType,
    color: r.color ?? "",
    status: r.status as ProductStatus,
    attributes: r.attributes,
    images: [{
      id: `home-${r.id}`,
      productId: r.id,
      rawUrl: null,
      processedUrl: r.processedUrl,
      isMain: true,
      order: 0,
      createdAt: "",
      updatedAt: "",
    }],
    createdAt: "",
    updatedAt: "",
  };
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export default function HomePage() {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isNewSearchRef = useRef(false);

  const [textQuery, setTextQuery] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"text" | "image" | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[] | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // Pending file waiting for picker selection
  const pendingFileRef = useRef<File | null>(null);

  // Restore state when navigating back from a product page
  useEffect(() => {
    const saved = sessionStorage.getItem(HOME_SEARCH_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        previewDataUrl?: string;
        query?: string;
        mode?: "text" | "image";
        results: SearchResult[];
      };
      setPreviewDataUrl(parsed.previewDataUrl ?? null);
      if (parsed.query) setTextQuery(parsed.query);
      if (parsed.mode) setSearchMode(parsed.mode);
      setResults(parsed.results);
    } catch {
      sessionStorage.removeItem(HOME_SEARCH_KEY);
    }
  }, []);

  // Scroll to results only after a new search (not on back-navigation restore)
  useEffect(() => {
    if (results !== null && isNewSearchRef.current) {
      isNewSearchRef.current = false;
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [results]);

  function clearSearch() {
    setPreviewDataUrl(null);
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setError(null);
    setTextQuery("");
    setSearchMode(null);
    setDetectedItems(null);
    setShowPicker(false);
    pendingFileRef.current = null;
    sessionStorage.removeItem(HOME_SEARCH_KEY);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Execute image similarity search with a specific file (full image or crop).
  // Pass productType to restrict results to that type (used when user picks a specific item).
  const runImageSearch = useCallback(async (file: File, previewUrl: string, productType?: string) => {
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setLoading(true);
    setLoadingMsg(t("search.searching"));
    setSearchMode("image");
    isNewSearchRef.current = true;

    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post<{ results: SearchResult[] }>("/search/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { limit: 20, ...(productType ? { productType } : {}) },
        timeout: 60000,
      });
      setResults(data.results);
      sessionStorage.setItem(HOME_SEARCH_KEY, JSON.stringify({
        previewDataUrl: previewUrl,
        mode: "image",
        results: data.results,
      }));
    } catch {
      setError(t("search.error"));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }, [t]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError(null);
    setTextQuery("");
    setDetectedItems(null);
    setShowPicker(false);
    pendingFileRef.current = file;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewDataUrl(dataUrl);
      setResults(null);
      setVisibleCount(INITIAL_VISIBLE);
      setLoading(true);
      setLoadingMsg(t("search.detecting"));

      // Try multi-item detection first
      const form = new FormData();
      form.append("file", file);
      try {
        const { data } = await api.post<{ items: DetectedItem[]; multipleFound: boolean }>(
          "/search/detect",
          form,
          { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }
        );

        if (data.multipleFound && data.items.length > 1) {
          setDetectedItems(data.items);
          setShowPicker(true);
          setLoading(false);
          setLoadingMsg("");
          return;
        }
      } catch {
        // Detection failure is non-fatal — fall through to direct search
      }

      setLoading(false);
      await runImageSearch(file, dataUrl);
    };
    reader.readAsDataURL(file);
  }, [t, runImageSearch]);

  // Run a separate search per detected item crop and merge results by product ID.
  // Used when the user picks "search all items" from the item picker.
  const runMultiSearch = async (items: DetectedItem[], previewUrl: string) => {
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setLoading(true);
    setLoadingMsg(t("search.searching"));
    setSearchMode("image");
    isNewSearchRef.current = true;

    try {
      const searches = await Promise.all(
        items.map(async (item) => {
          const croppedFile = await dataUrlToFile(item.cropDataUrl, `crop_${item.type}.jpg`);
          const form = new FormData();
          form.append("file", croppedFile);
          try {
            const { data } = await api.post<{ results: SearchResult[] }>("/search/image", form, {
              headers: { "Content-Type": "multipart/form-data" },
              params: { limit: 10 },
              timeout: 60000,
            });
            return data.results;
          } catch {
            return [] as SearchResult[];
          }
        })
      );

      // Merge — keep the highest similarity score per product across all item searches
      const byId = new Map<string, SearchResult>();
      for (const batch of searches) {
        for (const r of batch) {
          const existing = byId.get(r.id);
          if (!existing || r.similarity > existing.similarity) byId.set(r.id, r);
        }
      }

      const merged = Array.from(byId.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 20);

      setResults(merged);
      sessionStorage.setItem(HOME_SEARCH_KEY, JSON.stringify({
        previewDataUrl: previewUrl,
        mode: "image",
        results: merged,
      }));
    } catch {
      setError(t("search.error"));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handlePickerSelect = async (item: DetectedItem | "all") => {
    const preview = previewDataUrl;
    setShowPicker(false);

    if (item === "all") {
      await runMultiSearch(detectedItems!, preview!);
      return;
    }
    const croppedFile = await dataUrlToFile(item.cropDataUrl, `crop_${item.type}.jpg`);
    await runImageSearch(croppedFile, preview!, item.type);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  async function handleTextSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = textQuery.trim();
    if (!q) return;

    setLoading(true);
    setLoadingMsg("");
    setError(null);
    setPreviewDataUrl(null);
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setSearchMode("text");
    isNewSearchRef.current = true;

    try {
      const { data } = await api.post<{ results: SearchResult[] }>("/search/text", { query: q }, {
        params: { limit: 20 },
        timeout: 60000,
      });
      setResults(data.results);
      sessionStorage.setItem(HOME_SEARCH_KEY, JSON.stringify({
        query: q,
        mode: "text",
        results: data.results,
      }));
    } catch {
      setError(t("search.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_30%_50%,_rgba(253,220,160,0.08),_transparent)]" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-12 pt-24 pb-16">
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-tertiary-fixed mb-6">
            Premium Menswear
          </p>

          <h1 className="font-headline text-5xl md:text-7xl font-black leading-[1.05] text-white max-w-2xl mb-10">
            {t("home.headline")}
            <br />
            <em className="font-light text-4xl md:text-6xl text-white/80">
              The Bespoke Edge.
            </em>
          </h1>

          {/* ── Search widget ── */}
          <div className="w-full max-w-3xl mx-auto">

            {/* Text search */}
            <form onSubmit={handleTextSearch}>
              <div className="flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden focus-within:border-white/40 transition-colors">
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  placeholder={t("home.searchPlaceholder")}
                  disabled={loading}
                  className="flex-1 bg-transparent px-5 py-4 text-sm text-white placeholder-white/50 outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !textQuery.trim()}
                  className="gold-shimmer px-5 py-4 text-on-tertiary-fixed font-semibold text-sm flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {loading && searchMode === "text" ? (
                    <span className="w-4 h-4 border-2 border-on-tertiary-fixed/30 border-t-on-tertiary-fixed rounded-full animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </button>
              </div>
            </form>

            {/* OR divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-white/20" />
              <span className="text-xs text-white/40 font-medium">{t("home.orImageSearch")}</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>

            {/* Image upload area */}
            {!previewDataUrl ? (
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-xl p-10 min-h-52 flex flex-col items-center justify-center gap-4 transition-all ${
                  isDragging
                    ? "border-tertiary-fixed/60 bg-white/10 cursor-copy"
                    : loading
                    ? "border-white/15 opacity-40 cursor-not-allowed"
                    : "border-white/25 hover:border-white/50 hover:bg-white/5 cursor-pointer"
                }`}
              >
                <Camera size={36} className="text-white/60" />
                <div className="text-center">
                  <p className="text-sm font-medium text-white/80">{t("home.imageDropTitle")}</p>
                  <p className="text-xs text-white/40 mt-1">{t("home.imageDropSub")}</p>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/20">
                {loading ? (
                  <div className="min-h-48 flex flex-col items-center justify-center gap-3 py-10">
                    <span className="w-7 h-7 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    <span className="text-sm text-white/60">{loadingMsg || t("search.searching")}</span>
                  </div>
                ) : (
                  <img src={previewDataUrl} alt="Query" className="w-full max-h-72 object-contain" />
                )}
                {!loading && (
                  <button
                    onClick={clearSearch}
                    className="absolute top-3 end-3 bg-black/60 backdrop-blur-sm rounded-full p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Item picker (shown below preview after detection, hidden once user picks) */}
            {detectedItems && showPicker && !loading && (
              <div className="mt-4">
                <ItemPickerModal items={detectedItems} onSelect={handlePickerSelect} />
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          <div className="mt-12 flex flex-col items-start gap-2 text-white/50 animate-bounce-slow">
            <span className="text-sm tracking-wide">{t("home.browseCatalog")}</span>
            <ChevronDown size={20} />
          </div>
        </div>
      </section>

      {/* ── Search Results ── */}
      {results !== null && (
        <section ref={resultsRef} className="bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            {detectedItems && !showPicker && (
              <div className="mb-6">
                <button
                  onClick={() => { setShowPicker(true); setResults(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  <ArrowLeft size={13} />
                  {t("search.backToPicker")}
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mb-10">
              <div className="h-px flex-1 bg-outline-variant" />
              <p className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
                {results.length > 0
                  ? t("search.resultsFound").replace("{n}", String(Math.min(visibleCount, results.length)))
                  : t("search.noResults")}
              </p>
              <div className="h-px flex-1 bg-outline-variant" />
            </div>

            {results.length > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
                  {results.slice(0, visibleCount).map((result) => (
                    <ProductCard
                      key={result.id}
                      product={toProduct(result)}
                      matchPercentage={
                        searchMode === "image"
                          ? Math.round(result.similarity * 100)
                          : Math.min(
                              Math.round(Math.sqrt(Math.max(result.similarity - 0.238, 0) / 0.072) * 100),
                              100
                            )
                      }
                    />
                  ))}
                </div>

                {visibleCount < results.length && (
                  <div className="mt-12 flex justify-center">
                    <button
                      onClick={() => setVisibleCount(results.length)}
                      className="px-8 py-3 border border-outline-variant text-sm font-semibold text-on-surface-variant rounded-xl hover:border-primary hover:text-primary transition-colors"
                    >
                      {t("search.showMore")} ({results.length - visibleCount})
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── Bento + Experience — hidden while results are shown ── */}
      {!results && (
        <>
          <section className="bg-surface py-20">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              <div className="grid grid-cols-12 gap-4 auto-rows-[260px]">
                <div className="col-span-12 md:col-span-8 row-span-2 relative rounded-2xl overflow-hidden bg-surface-container group">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-600 to-zinc-800" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-8">
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-tertiary-fixed mb-2">Collection</p>
                    <h2 className="font-headline text-3xl font-bold text-white">קולקציית החורף</h2>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-4 rounded-2xl bg-surface-container-highest p-8 flex flex-col justify-center">
                  <p className="text-xs font-bold tracking-widest uppercase text-on-tertiary-container mb-3">Craftsmanship</p>
                  <h3 className="font-headline text-2xl font-bold text-on-surface leading-snug">Bespoke Tailoring</h3>
                  <p className="text-sm text-secondary mt-3 leading-relaxed">Every suit is measured, cut, and finished to your exact form.</p>
                </div>
                <div className="col-span-12 md:col-span-4 rounded-2xl overflow-hidden bg-surface-container-high relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-400 to-zinc-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-4 left-5">
                    <p className="text-xs text-white/80 font-medium tracking-wide">Accessories</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low py-20">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-on-tertiary-container mb-4">חוויה</p>
                  <h2 className="font-headline text-4xl font-bold text-on-surface leading-tight mb-6">החוויה של ג&#39;נודי</h2>
                  <p className="text-base text-secondary leading-relaxed mb-8">{t("about.description")}</p>
                  <div className="flex flex-wrap gap-3">
                    <span className="bg-surface-container-highest text-on-surface-variant text-xs font-semibold px-4 py-2 rounded-full border border-outline-variant">100% Wool Super 150s</span>
                    <span className="bg-surface-container-highest text-on-surface-variant text-xs font-semibold px-4 py-2 rounded-full border border-outline-variant">Custom Measurements</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-zinc-300 to-zinc-400" />
                  <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-zinc-400 to-zinc-500 mt-8" />
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
