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
      {/* ── HERO — full-width editorial dark, text overlaid ── */}
      {/* When real photo is ready: add <img className="absolute inset-0 w-full h-full object-cover object-top" src="..." alt="..." /> inside the section */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-zinc-950">
        {/* Hero background image — replace gradient once real photo arrives */}
        <img
          src="/placeholders/hero-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {/* Dark overlay to maintain text readability over photo */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />
        {/* Warm amber glow on start side (where text lives) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_75%_45%,_rgba(220,185,120,0.12),_transparent)]" />
        {/* Subtle overlay to darken bottom for scroll indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950/60 to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-12 pt-24 pb-16">
          <div className="max-w-2xl">
            <p className="text-[9px] font-bold tracking-[0.45em] uppercase text-[#e9c176]/60 mb-10">
              {t("home.premiumBadge")}
            </p>

            <h1 className="font-headline text-5xl md:text-6xl xl:text-7xl font-black leading-[1.05] text-[#e9c176] mb-4">
              {t("home.headline")}
            </h1>
            <p className="font-headline text-xl md:text-2xl font-light italic text-white/50 mb-8">
              {t("home.taglineSub")}
            </p>

            {/* Gold rule */}
            <div className="w-10 h-[1.5px] bg-[#e9c176] mb-10" />

            {/* ── Search widget ── */}
            <div className="w-full max-w-xl">
              <form onSubmit={handleTextSearch}>
                <div className="flex items-center bg-white/8 backdrop-blur-sm border border-white/15 rounded-xl overflow-hidden focus-within:border-[#e9c176]/50 transition-colors">
                  <input
                    type="text"
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    placeholder={t("home.searchPlaceholder")}
                    disabled={loading}
                    className="flex-1 bg-transparent px-5 py-4 text-sm text-white placeholder-white/35 outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={loading || !textQuery.trim()}
                    className="gold-shimmer px-5 py-4 text-on-tertiary-fixed font-semibold text-sm flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    {loading && searchMode === "text" ? (
                      <span className="w-4 h-4 border-2 border-on-tertiary-fixed/30 border-t-on-tertiary-fixed rounded-full animate-spin" />
                    ) : (
                      <Search size={16} />
                    )}
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/12" />
                <span className="text-xs text-white/35 font-medium">{t("home.orImageSearch")}</span>
                <div className="h-px flex-1 bg-white/12" />
              </div>

              {!previewDataUrl ? (
                <div
                  onClick={() => !loading && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`border border-dashed rounded-xl p-8 min-h-40 flex flex-col items-center justify-center gap-3 transition-all ${
                    isDragging
                      ? "border-[#e9c176]/50 bg-white/8 cursor-copy"
                      : loading
                      ? "border-white/10 opacity-40 cursor-not-allowed"
                      : "border-white/20 hover:border-[#e9c176]/40 hover:bg-white/5 cursor-pointer"
                  }`}
                >
                  <Camera size={28} className="text-white/35" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-white/65">{t("home.imageDropTitle")}</p>
                    <p className="text-xs text-white/30 mt-1">{t("home.imageDropSub")}</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black/20">
                  {loading ? (
                    <div className="min-h-40 flex flex-col items-center justify-center gap-3 py-8">
                      <span className="w-6 h-6 border-2 border-white/20 border-t-[#e9c176] rounded-full animate-spin" />
                      <span className="text-sm text-white/45">{loadingMsg || t("search.searching")}</span>
                    </div>
                  ) : (
                    <img src={previewDataUrl} alt="Query" className="w-full max-h-64 object-contain" />
                  )}
                  {!loading && (
                    <button
                      onClick={clearSearch}
                      className="absolute top-3 end-3 bg-black/60 backdrop-blur-sm rounded-full p-2 text-white/60 hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              {detectedItems && showPicker && !loading && (
                <div className="mt-4">
                  <ItemPickerModal items={detectedItems} onSelect={handlePickerSelect} />
                </div>
              )}

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
          </div>

          <div className="mt-12 flex flex-col items-start gap-2 text-white/25 animate-bounce-slow">
            <span className="text-xs tracking-[0.3em] uppercase">{t("home.browseCatalog")}</span>
            <ChevronDown size={18} />
          </div>
        </div>
      </section>

      {/* ── Search Results ── */}
      {results !== null && (
        <section ref={resultsRef} className="bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => {
                  clearSearch();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              >
                <ArrowLeft size={13} />
                {t("search.newSearch")}
              </button>
              {detectedItems && !showPicker && (
                <>
                  <span className="text-outline-variant text-xs">|</span>
                  <button
                    onClick={() => {
                      setShowPicker(true);
                      setResults(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    {t("search.backToPicker")}
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 mb-12">
              <div className="h-px flex-1 bg-outline-variant" />
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-on-surface-variant whitespace-nowrap">
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
                      source="SEARCH_RESULT"
                      searchQuery={searchMode === "text" ? textQuery : undefined}
                    />
                  ))}
                </div>

                {visibleCount < results.length && (
                  <div className="mt-16 flex justify-center">
                    <button
                      onClick={() => setVisibleCount(results.length)}
                      className="px-10 py-3 border border-outline-variant text-[11px] font-bold text-on-surface-variant rounded-none hover:border-primary hover:text-primary transition-colors tracking-[0.2em] uppercase cursor-pointer"
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

      {/* ── Bento + Experience — hidden while results shown ── */}
      {!results && (
        <>
          {/* Editorial bento grid */}
          <section className="bg-[#181818] py-20">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              {/* Section title — gold text, left-aligned, editorial */}
              <h2 className="font-headline text-2xl md:text-3xl font-black text-white mb-10">
                {t("home.bentoSectionTitle")}
              </h2>

              <div className="grid grid-cols-12 gap-4 auto-rows-[260px]">
                {/* Large tile: Bespoke Tailoring */}
                <div className="col-span-12 md:col-span-8 row-span-2 relative overflow-hidden group cursor-pointer">
                  <img
                    src="/placeholders/bento-collection.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Removed opaque fallback — image now fills the tile */}
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: "repeating-linear-gradient(-45deg, white 0, white 1px, transparent 0, transparent 40px)" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {/* Corner accents — appear on hover */}
                  <div className="absolute top-5 start-5 w-8 h-8 border-t border-s border-[#e9c176]/0 group-hover:border-[#e9c176]/40 transition-all duration-500" />
                  <div className="absolute top-5 end-5 w-8 h-8 border-t border-e border-[#e9c176]/0 group-hover:border-[#e9c176]/40 transition-all duration-500" />
                  <div className="absolute bottom-0 start-0 p-8">
                    <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#e9c176]/70 mb-2">
                      {t("home.bento.collectionTag")}
                    </p>
                    <h2 className="font-headline text-3xl font-bold text-white">
                      {t("home.bento.collectionTitle")}
                    </h2>
                  </div>
                </div>

                {/* Text info tile */}
                <div className="col-span-12 md:col-span-4 bg-[#222222] p-8 flex flex-col justify-center border border-white/5">
                  <div className="w-6 h-[1.5px] bg-[#e9c176] mb-5" />
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#e9c176]/70 mb-3">
                    {t("home.bento.craftTag")}
                  </p>
                  <h3 className="font-headline text-2xl font-bold text-white leading-snug">
                    {t("home.bento.craftTitle")}
                  </h3>
                  <p className="text-sm text-white/50 mt-3 leading-relaxed">
                    {t("home.bento.craftBody")}
                  </p>
                </div>

                {/* Accessories tile */}
                <div className="col-span-12 md:col-span-4 relative overflow-hidden">
                  <img
                    src="/placeholders/bento-accessories.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Removed opaque fallback — image now fills the tile */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 start-5">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#e9c176]/70 font-medium">
                      {t("home.bento.accessories")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Atelier experience */}
          <section className="bg-[#141414] py-24">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div>
                  <div className="w-8 h-[1.5px] bg-[#e9c176] mb-6" />
                  <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#e9c176]/70 mb-4">
                    {t("home.experience.tag")}
                  </p>
                  <h2 className="font-headline text-4xl font-bold text-white leading-tight mb-6">
                    {t("home.experience.title")}
                  </h2>
                  <p className="text-base text-white/50 leading-relaxed mb-8">
                    {t("about.description")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="border border-white/15 text-white/60 text-xs font-semibold px-4 py-2 rounded-full">
                      {t("home.experience.badge1")}
                    </span>
                    <span className="border border-white/15 text-white/60 text-xs font-semibold px-4 py-2 rounded-full">
                      {t("home.experience.badge2")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <img
                      src="/placeholders/experience-1.png"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/15" />
                    <div className="absolute top-3 start-3 w-5 h-5 border-t border-s border-white/40" />
                    <div className="absolute bottom-3 end-3 w-5 h-5 border-b border-e border-white/40" />
                  </div>
                  <div className="aspect-[3/4] relative overflow-hidden mt-8">
                    <img
                      src="/placeholders/experience-2.png"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/15" />
                    <div className="absolute top-3 start-3 w-5 h-5 border-t border-s border-white/40" />
                    <div className="absolute bottom-3 end-3 w-5 h-5 border-b border-e border-white/40" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
