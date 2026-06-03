import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from "react";

const SEARCH_STORAGE_KEY = "seeksuit_image_search";
import { Camera, UploadCloud, X, Search } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
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

// Adapt a flat search result to the Product shape ProductCard expects
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

export default function ImageSearchPage() {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    // Use data URL so it survives sessionStorage serialization
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
    setError(null);
    sessionStorage.removeItem(SEARCH_STORAGE_KEY);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const search = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const form = new FormData();
    form.append("file", selectedFile);

    try {
      const { data } = await api.post<{ results: SearchResult[] }>("/search/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      setResults(data.results);
      // Save state so back-navigation restores the results
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
    }
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
                {/* Preview + clear button */}
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-surface-container-low">
                  <img
                    src={previewUrl}
                    alt="Query"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-3 right-3 bg-surface/80 backdrop-blur-sm rounded-full p-1.5 text-on-surface hover:text-error transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search button */}
                <button
                  onClick={search}
                  disabled={loading}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      {t("search.searching")}
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      {t("search.searchBtn")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-error text-sm mb-8">{error}</p>
          )}

          {/* Results */}
          {results !== null && (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px flex-1 bg-outline-variant" />
                <p className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">
                  {results.length > 0
                    ? t("search.resultsFound").replace("{n}", String(results.length))
                    : t("search.noResults")}
                </p>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
                  {results.map((result) => (
                    <ProductCard
                      key={result.id}
                      product={toProduct(result)}
                      matchPercentage={Math.round(result.similarity * 100)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
