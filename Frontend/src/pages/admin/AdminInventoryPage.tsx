import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, ImageOff, ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import axios from "axios";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProducts, deleteProduct, processAllImages } from "../../services/product.service";
import type { Product } from "../../types/product";
import { mainImage, bestImageUrl } from "../../types/product";

// Number of rows shown per page
const PAGE_SIZE = 10;

type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export default function AdminInventoryPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  // Map of productId → current job status (only for jobs triggered this session)
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatus>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref mirrors state so the setInterval closure always reads the latest statuses
  const jobStatusesRef = useRef<Record<string, JobStatus>>({});
  // Image lightbox: stores all images of the product + current index
  const [preview, setPreview] = useState<{ urls: string[]; name: string; idx: number } | null>(null);

  function loadProducts() {
    setLoading(true);
    getProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // Close lightbox on Escape, navigate with arrow keys
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
      if (e.key === "ArrowRight") setPreview((p) => p && p.urls.length > 1 ? { ...p, idx: (p.idx + 1) % p.urls.length } : p);
      if (e.key === "ArrowLeft")  setPreview((p) => p && p.urls.length > 1 ? { ...p, idx: (p.idx - 1 + p.urls.length) % p.urls.length } : p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preview]);

  // Keep ref in sync with state so the setInterval closure never reads stale values
  useEffect(() => {
    jobStatusesRef.current = jobStatuses;
  }, [jobStatuses]);

  // Poll /api/jobs every 3s while any job is active
  useEffect(() => {
    const hasActive = Object.values(jobStatuses).some(
      (s) => s === "PENDING" || s === "PROCESSING"
    );

    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const { data } = await axios.get<{ id: string; status: JobStatus; image: { productId: string } }[]>(
            `${API_BASE}/api/jobs`
          );
          // Read current statuses from ref — avoids stale closure
          const current = jobStatusesRef.current;
          const next = { ...current };
          let reloadNeeded = false;

          for (const job of data) {
            const pid = job.image?.productId;
            if (!pid || next[pid] === undefined) continue;
            // Job just finished — reload products so thumbnails update
            if (
              (current[pid] === "PENDING" || current[pid] === "PROCESSING") &&
              (job.status === "DONE" || job.status === "FAILED")
            ) {
              reloadNeeded = true;
            }
            next[pid] = job.status;
          }

          setJobStatuses(next);
          if (reloadNeeded) loadProducts();
        } catch {
          // Silently ignore polling errors
        }
      }, 3000);
    }

    if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (!hasActive && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobStatuses]);

  async function handleDelete(product: Product) {
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    await deleteProduct(product.id);
    loadProducts();
  }

  async function handleProcess(productId: string) {
    setJobStatuses((prev) => ({ ...prev, [productId]: "PENDING" }));
    try {
      await processAllImages(productId);
      setJobStatuses((prev) => ({ ...prev, [productId]: "PROCESSING" }));
    } catch {
      setJobStatuses((prev) => ({ ...prev, [productId]: "FAILED" }));
    }
  }

  // Pagination math
  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const paginated = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AdminLayout>
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-14 h-[1.5px] bg-gradient-to-r from-tertiary-fixed to-tertiary-fixed-dim" />
            <p className="text-xs font-bold tracking-[0.22em] uppercase text-on-tertiary-container">
              Stock Overview
            </p>
          </div>
          <h1 className="font-headline font-bold text-on-surface leading-[1.05]">
            <span className="text-5xl">Product</span>
            <br />
            <span className="text-6xl italic text-on-tertiary-container">Catalogue</span>
          </h1>
          <div className="mt-4 w-20 h-[2px] bg-gradient-to-r from-tertiary-fixed-dim to-tertiary-fixed" />
        </div>
        <Link
          to="/admin/inventory/new"
          className="gold-shimmer flex items-center gap-2 text-sm font-semibold text-on-tertiary-fixed px-5 py-3 rounded-xl transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
          {t("admin.addProduct")}
        </Link>
      </div>

      {/* Table area */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-secondary mt-8">
          {t("common.loading")}
        </div>
      ) : products.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-secondary mt-8">
          {t("shop.noProducts")}
        </div>
      ) : (
        <div className="mt-8 bg-surface-container-low p-1 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-start text-sm text-secondary uppercase tracking-widest px-5 py-5 font-semibold w-24">
                  Item
                </th>
                <th className="text-start text-sm text-secondary uppercase tracking-widest px-4 py-5 font-semibold">
                  Name
                </th>
                <th className="text-start text-sm text-secondary uppercase tracking-widest px-4 py-5 font-semibold hidden md:table-cell">
                  SKU / Type
                </th>
                <th className="text-start text-sm text-secondary uppercase tracking-widest px-4 py-5 font-semibold hidden md:table-cell">
                  Color
                </th>
                <th className="text-start text-sm text-secondary uppercase tracking-widest px-4 py-5 font-semibold">
                  Status
                </th>
                <th className="text-end px-5 py-5 w-24" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((product) => (
                <tr
                  key={product.id}
                  className="group border-b border-outline-variant/50 hover:bg-surface-container-high/30 transition-colors"
                >
                  {/* Thumbnail — click opens lightbox with all images */}
                  <td className="px-5 py-5">
                    {(() => {
                      const images = product.images.slice().sort((a, b) => a.order - b.order);
                      const img = mainImage(product);
                      const url = img ? bestImageUrl(img) : null;
                      const urls = images.map((i) => bestImageUrl(i)).filter(Boolean) as string[];
                      return (
                        <div className="relative w-16 h-20">
                          <div className="w-16 h-20 bg-surface-variant rounded-lg overflow-hidden">
                            {url ? (
                              <img
                                src={url}
                                alt={product.name}
                                onClick={() => setPreview({ urls, name: product.name, idx: 0 })}
                                className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageOff size={16} className="text-outline-variant" />
                              </div>
                            )}
                          </div>
                          {images.length > 1 && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-on-surface text-surface text-[9px] font-bold flex items-center justify-center">
                              {images.length}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-5 font-semibold text-xl text-on-surface">
                    {product.name}
                  </td>

                  {/* SKU / Type */}
                  <td className="px-4 py-5 hidden md:table-cell">
                    <p className="text-base font-mono text-secondary">{product.sku}</p>
                    <p className="text-base text-on-surface-variant mt-1">
                      {t(`type.${product.type}`)}
                    </p>
                  </td>

                  {/* Color */}
                  <td className="px-4 py-5 text-lg text-secondary hidden md:table-cell">
                    {product.color}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-5">
                    <span
                      className={`inline-flex items-center text-base font-semibold px-3 py-1.5 rounded-full ${
                        product.status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {t(`status.${product.status.toLowerCase()}`)}
                    </span>
                  </td>

                  {/* Actions — fade in on row hover */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* AI Process button — hidden once processed */}
                      {(() => {
                        const status = jobStatuses[product.id];
                        const isActive = status === "PENDING" || status === "PROCESSING";
                        const hasRaw = product.images.some((img) => img.rawUrl);
                        const allProcessed = product.images.length > 0 && product.images.every((img) => img.processedUrl);

                        if (allProcessed && !isActive) return null;

                        return (
                          <button
                            onClick={() => handleProcess(product.id)}
                            disabled={isActive || !hasRaw}
                            title={
                              !hasRaw
                                ? "No images to process"
                                : status === "FAILED"
                                ? "Failed — retry"
                                : `Process ${product.images.filter((i) => i.rawUrl && !i.processedUrl).length} image(s) with AI`
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              status === "FAILED"
                                ? "text-red-500 hover:bg-surface-container-high"
                                : isActive
                                ? "text-amber-500 cursor-not-allowed"
                                : "text-on-surface-variant hover:text-amber-500 hover:bg-surface-container-high"
                            }`}
                          >
                            {isActive ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                          </button>
                        );
                      })()}
                      <Link
                        to={`/admin/inventory/${product.id}/edit`}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant">
            <p className="text-xs text-secondary">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, products.length)}–{Math.min(page * PAGE_SIZE, products.length)} of {products.length} items
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container-high transition-colors"
              >
                <ChevronLeft size={13} />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container-high transition-colors"
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox overlay — supports multi-image navigation */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.urls[preview.idx]}
              alt={preview.name}
              className="max-w-full max-h-[85vh] object-contain"
            />

            {/* Bottom bar: name + counter */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-3 flex items-center justify-between">
              <p className="text-white text-sm font-semibold">{preview.name}</p>
              {preview.urls.length > 1 && (
                <p className="text-white/70 text-xs">{preview.idx + 1} / {preview.urls.length}</p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => setPreview(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              ✕
            </button>

            {/* Left / Right arrows — only when multiple images */}
            {preview.urls.length > 1 && (
              <>
                <button
                  onClick={() => setPreview((p) => p ? { ...p, idx: (p.idx - 1 + p.urls.length) % p.urls.length } : p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setPreview((p) => p ? { ...p, idx: (p.idx + 1) % p.urls.length } : p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
