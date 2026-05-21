import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, ImageOff, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, X, Sparkles, Loader2 } from "lucide-react";
import axios from "axios";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProducts, deleteProduct, processAllImages } from "../../services/product.service";
import type { Product, ProductType, ProductStatus } from "../../types/product";
import { mainImage, bestImageUrl } from "../../types/product";

// Number of rows shown per page
const PAGE_SIZE = 10;

type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
type SortField = "name" | "sku" | "createdAt";
type SortDir = "asc" | "desc";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export default function AdminInventoryPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  // Map of productId → current job status (only for jobs triggered this session)
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatus>>({});
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterType, setFilterType] = useState<ProductType | "">("");
  const [filterColor, setFilterColor] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProductStatus | "">("");
  const [openDropdown, setOpenDropdown] = useState<"type" | "color" | "status" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
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

  // Close filter dropdowns when clicking outside the bar
  useEffect(() => {
    if (!openDropdown) return;
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openDropdown]);

  // Keep ref in sync with state so the setInterval closure never reads stale values
  useEffect(() => {
    jobStatusesRef.current = jobStatuses;
  }, [jobStatuses]);

  // On mount, resume polling for any jobs that were started before navigating away
  useEffect(() => {
    axios
      .get<{ id: string; status: JobStatus; image: { productId: string } }[]>(`${API_BASE}/api/jobs`)
      .then(({ data }) => {
        const active: Record<string, JobStatus> = {};
        for (const job of data) {
          const pid = job.image?.productId;
          if (!pid || (job.status !== "PENDING" && job.status !== "PROCESSING")) continue;
          active[pid] = active[pid] === "PROCESSING" || job.status === "PROCESSING" ? "PROCESSING" : "PENDING";
        }
        if (Object.keys(active).length > 0) setJobStatuses(active);
      })
      .catch(() => {});
  }, []);

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
          const current = jobStatusesRef.current;

          // Group job statuses by productId — only track products we started
          const jobsByProduct = new Map<string, JobStatus[]>();
          for (const job of data) {
            const pid = job.image?.productId;
            if (!pid || current[pid] === undefined) continue;
            if (!jobsByProduct.has(pid)) jobsByProduct.set(pid, []);
            jobsByProduct.get(pid)!.push(job.status);
          }

          const next = { ...current };
          let reloadNeeded = false;

          for (const [pid, statuses] of jobsByProduct) {
            const wasActive = current[pid] === "PENDING" || current[pid] === "PROCESSING";
            const anyActive = statuses.some((s) => s === "PENDING" || s === "PROCESSING");
            const allFinished = statuses.every((s) => s === "DONE" || s === "FAILED");

            next[pid] = anyActive
              ? statuses.includes("PROCESSING") ? "PROCESSING" : "PENDING"
              : statuses.every((s) => s === "DONE") ? "DONE" : "FAILED";

            // Reload only once ALL images of a product are done — not after each one
            if (wasActive && allFinished) reloadNeeded = true;
          }

          const changed = Object.keys(next).some((pid) => next[pid] !== current[pid]);
          if (changed) setJobStatuses(next);
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

  // Unique type and color values derived from loaded products
  const availableTypes = useMemo(
    () => [...new Set(products.map((p) => p.type))].sort(),
    [products]
  );
  const availableColors = useMemo(
    () => [...new Set(products.map((p) => p.color).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [products]
  );

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

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

  // Filter → sort → paginate
  const filtered = products.filter((p) => {
    if (filterType && p.type !== filterType) return false;
    if (filterColor && p.color.toLowerCase() !== filterColor.toLowerCase()) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "name":      cmp = a.name.localeCompare(b.name, "he"); break;
      case "sku":       cmp = a.sku.localeCompare(b.sku); break;
      case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });
  const activeFilters = [filterType, filterColor, filterStatus].filter(Boolean).length;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      ) : sorted.length === 0 ? (
        <div className="mt-8 bg-surface-container-low p-1 rounded-2xl overflow-hidden">
          {/* Sort + filter bars still shown even when empty */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-outline-variant/60">
            <span className="text-[10px] text-secondary uppercase tracking-widest mr-2">Sort</span>
          </div>
          <div className="flex items-center justify-center h-32 text-secondary text-sm">
            No products match the current filters.{" "}
            <button
              onClick={() => { setFilterType(""); setFilterColor(""); setFilterStatus(""); }}
              className="ml-1 text-on-tertiary-container font-semibold hover:opacity-70 transition-opacity"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 bg-surface-container-low p-1 rounded-2xl overflow-hidden">
          {/* Unified sort + filter bar */}
          <div ref={barRef} className="flex items-center gap-1 px-4 py-2.5 border-b border-outline-variant/60 flex-wrap">

            {/* Sort toggle buttons: Name / SKU / Date Added */}
            {([
              { field: "name"      as SortField, label: "Name" },
              { field: "sku"       as SortField, label: "SKU" },
              { field: "createdAt" as SortField, label: "Date Added" },
            ]).map(({ field, label }) => (
              <button
                key={field}
                onClick={() => { toggleSort(field); setPage(1); }}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  sortBy === field
                    ? "bg-on-tertiary-container/15 text-on-tertiary-container"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {label}
                {sortBy === field
                  ? sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  : <ArrowUpDown size={11} className="opacity-25" />}
              </button>
            ))}

            {/* Separator */}
            <span className="w-px h-4 bg-outline-variant/60 mx-1 self-center" />

            {/* Type dropdown filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "type" ? null : "type")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  filterType || openDropdown === "type"
                    ? "bg-on-tertiary-container/15 text-on-tertiary-container"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {filterType ? t(`type.${filterType}`) : "Type"}
                <ChevronDown size={11} className={`transition-transform duration-150 ${openDropdown === "type" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "type" && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-surface border border-outline-variant rounded-xl shadow-xl py-1 min-w-[130px]">
                  <button
                    onClick={() => { setFilterType(""); setOpenDropdown(null); setPage(1); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${!filterType ? "text-on-surface font-semibold" : "text-secondary"}`}
                  >
                    All types
                  </button>
                  {availableTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => { setFilterType(type); setOpenDropdown(null); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${filterType === type ? "text-on-tertiary-container font-semibold" : "text-on-surface-variant"}`}
                    >
                      {t(`type.${type}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color dropdown filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "color" ? null : "color")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  filterColor || openDropdown === "color"
                    ? "bg-on-tertiary-container/15 text-on-tertiary-container"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {filterColor || "Color"}
                <ChevronDown size={11} className={`transition-transform duration-150 ${openDropdown === "color" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "color" && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-surface border border-outline-variant rounded-xl shadow-xl py-1 min-w-[120px] max-h-56 overflow-y-auto">
                  <button
                    onClick={() => { setFilterColor(""); setOpenDropdown(null); setPage(1); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${!filterColor ? "text-on-surface font-semibold" : "text-secondary"}`}
                  >
                    All colors
                  </button>
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => { setFilterColor(color); setOpenDropdown(null); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${filterColor === color ? "text-on-tertiary-container font-semibold" : "text-on-surface-variant"}`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status dropdown filter */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus || openDropdown === "status"
                    ? "bg-on-tertiary-container/15 text-on-tertiary-container"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {filterStatus ? t(`status.${filterStatus.toLowerCase()}`) : "Status"}
                <ChevronDown size={11} className={`transition-transform duration-150 ${openDropdown === "status" ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === "status" && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-surface border border-outline-variant rounded-xl shadow-xl py-1 min-w-[130px]">
                  <button
                    onClick={() => { setFilterStatus(""); setOpenDropdown(null); setPage(1); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${!filterStatus ? "text-on-surface font-semibold" : "text-secondary"}`}
                  >
                    All statuses
                  </button>
                  {(["IN_STOCK", "OUT_OF_STOCK"] as ProductStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setFilterStatus(s); setOpenDropdown(null); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-container-high rounded-lg ${filterStatus === s ? "text-on-tertiary-container font-semibold" : "text-on-surface-variant"}`}
                    >
                      {t(`status.${s.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear active filters */}
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterType(""); setFilterColor(""); setFilterStatus(""); setPage(1); }}
                className="flex items-center gap-1 text-xs font-semibold text-error hover:opacity-70 transition-opacity ml-1 px-2 py-1.5 rounded-lg"
              >
                <X size={11} />
                Clear ({activeFilters})
              </button>
            )}
          </div>

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
                      const mainIdx = images.findIndex((i) => i.isMain);
                      return (
                        <div className="relative w-16 h-20">
                          <div className="w-16 h-20 bg-surface-variant rounded-lg overflow-hidden">
                            {url ? (
                              <img
                                src={url}
                                alt={product.name}
                                onClick={() => setPreview({ urls, name: product.name, idx: mainIdx >= 0 ? mainIdx : 0 })}
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
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, sorted.length)}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}{activeFilters > 0 ? ` (filtered from ${products.length})` : ""} items
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
