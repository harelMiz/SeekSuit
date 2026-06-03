import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from "react";

const SEARCH_STORAGE_KEY = "seeksuit_image_search";
const INITIAL_VISIBLE = 8;

import { ArrowLeft, Camera, UploadCloud, X, Search } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import ItemPickerModal, { type DetectedItem } from "../components/ui/ItemPickerModal";
import api from "../services/api";
import type { Product, ProductType, ProductStatus } from "../types/product";

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
    images: [
      {
        id: `search-${r.id}`,
        productId: r.id,
        rawUrl: null,
        processedUrl: r.processedUrl,
        isMain: true,
        order: 0,
        createdAt: "",
        updatedAt: "",
      },
    ],
    createdAt: "",
    updatedAt: "",
  };
}

// Convert a data URL or base64 string to a File for multipart upload
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export default function ImageSearchPage() {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string>("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [error, setError] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[] | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Restore search state when navigating back from a product page
  useEffect(() => {
    const saved = sessionStorage.getItem(SEARCH_STORAGE_KEY);
    if (!saved) return;
    try {
      const { previewDataUrl, results: savedResults } = JSON.parse(saved) as {
        previewDataUrl: string;
        results: SearchResult[];
      };
      setPreviewUrl(previewDataUrl);
      setResults(savedResults);
    } catch {
      sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSelectedFile(file);
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setDetectedItems(null);
    setShowPicker(false);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setDetectedItems(null);
    setShowPicker(false);
    setError(null);
    sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Run similarity search with a given file (full image or cropped item).
  // Pass productType to restrict results to that type (used when user picks a specific item).
  const runSearch = async (file: File, productType?: string) => {
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setLoading(true);
    setLoadingMsg(t("search.searching"));
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const { data } = await api.post<{ results: SearchResult[] }>("/search/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { limit: 20, ...(productType ? { productType } : {}) },
        timeout: 60000,
      });
      setResults(data.results);
      if (previewUrl) {
        sessionStorage.setItem(
          SEARCH_STORAGE_KEY,
          JSON.stringify({ previewDataUrl: previewUrl, results: data.results })
        );
      }
    } catch {
      setError(t("search.error"));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Run a separate search per detected item crop and merge results by product ID.
  // Used when the user picks "search all items" from the item picker.
  const runMultiSearch = async (items: DetectedItem[]) => {
    setResults(null);
    setVisibleCount(INITIAL_VISIBLE);
    setLoading(true);
    setLoadingMsg(t("search.searching"));
    setError(null);

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
      if (previewUrl) {
        sessionStorage.setItem(
          SEARCH_STORAGE_KEY,
          JSON.stringify({ previewDataUrl: previewUrl, results: merged })
        );
      }
    } catch {
      setError(t("search.error"));
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // Detect items first; if multiple found, show picker; if single/none, search directly
  const search = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setLoadingMsg(t("search.detecting"));
    setError(null);
    setDetectedItems(null);
    setShowPicker(false);

    const form = new FormData();
    form.append("file", selectedFile);

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
    await runSearch(selectedFile);
  };

  const handlePickerSelect = async (item: DetectedItem | "all") => {
    setShowPicker(false);
    if (item === "all") {
      await runMultiSearch(detectedItems!);
      return;
    }
    const croppedFile = await dataUrlToFile(item.cropDataUrl, `crop_${item.type}.jpg`);
    await runSearch(croppedFile, item.type);
  };

  return (
    <Layout>
      <div className="bg-surface min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-20">

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <Camera size={22} className="text-primary" />
              <h1 className="font-headline text-5xl font-black text-on-surface">
                {t("search.title")}
              </h1>
            </div>
            <p className="text-on-surface-variant mt-2 text-base">
              {t("search.subtitle")}
            </p>
          </div>

          {/* Upload area */}
          <div className="max-w-xl mb-12">
            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant hover:border-primary hover:bg-surface-container-low"
                }`}
              >
                <UploadCloud size={36} className="text-on-surface-variant" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-on-surface">{t("search.dropZone")}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{t("search.dropZoneSub")}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onInputChange}
                />
              </div>
            ) : (
              <div className="relative">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-surface-container-low">
                  <img src={previewUrl} alt="Query" className="w-full h-full object-contain" />
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 bg-surface/80 backdrop-blur-sm rounded-full p-1.5 text-on-surface hover:text-error transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Item picker (shown after detection, hidden once user picks) */}
                {detectedItems && showPicker && !loading && (
                  <div className="mt-4">
                    <ItemPickerModal items={detectedItems} onSelect={handlePickerSelect} />
                  </div>
                )}

                {/* Search button (hidden while picker is showing or items were detected) */}
                {!detectedItems && (
                  <button
                    onClick={search}
                    disabled={loading}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        {loadingMsg || t("search.searching")}
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        {t("search.searchBtn")}
                      </>
                    )}
                  </button>
                )}

                {/* Loading overlay while search runs after picker selection */}
                {loading && detectedItems !== null && !showPicker && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-on-surface-variant py-2">
                    <span className="w-4 h-4 border-2 border-outline border-t-on-surface-variant rounded-full animate-spin" />
                    {loadingMsg}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-error text-sm mb-8">{error}</p>}

          {/* Results */}
          {results !== null && (
            <div>
              {detectedItems && !showPicker && (
                <button
                  onClick={() => { setShowPicker(true); setResults(null); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft size={13} />
                  {t("search.backToPicker")}
                </button>
              )}
              <div className="flex items-center gap-3 mb-8">
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
                        matchPercentage={Math.round(result.similarity * 100)}
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
          )}

        </div>
      </div>
    </Layout>
  );
}
