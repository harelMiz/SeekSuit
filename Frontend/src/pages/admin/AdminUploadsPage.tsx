import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, X, Check, Loader2, Sparkles, Star, ChevronRight, RefreshCw } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  uploadBulkImages,
  getUnassignedImages,
  assignImagesToProduct,
  processAllImages,
  deleteProductImage,
} from "../../services/product.service";
import type { ProductImage, ProductType, ProductStatus, CreateProductInput } from "../../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

type UploadStatus = "idle" | "uploading" | "done" | "error";
type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

interface ImageState {
  image: ProductImage;
  jobStatus?: JobStatus;
}

const INITIAL_FORM: CreateProductInput = {
  name: "",
  sku: "",
  type: "JACKET",
  color: "",
  status: "IN_STOCK",
};

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export default function AdminUploadsPage() {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All unassigned images in the grid
  const [imageStates, setImageStates] = useState<ImageState[]>([]);
  // IDs currently selected for assignment
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Upload progress
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Assignment panel
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateProductInput>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Drag-over state for drop zone
  const [dragging, setDragging] = useState(false);

  // Load unassigned images on mount
  useEffect(() => {
    loadUnassigned();
  }, []);

  // Poll job statuses every 3s when any image is processing
  useEffect(() => {
    const hasActive = imageStates.some(
      (s) => s.jobStatus === "PENDING" || s.jobStatus === "PROCESSING"
    );
    if (!hasActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs`);
        const jobs: { id: string; status: JobStatus; image: { id: string; processedUrl?: string } }[] = await res.json();
        setImageStates((prev) =>
          prev.map((s) => {
            const job = jobs.find((j) => j.image?.id === s.image.id);
            if (!job) return s;
            // If job finished, refresh the processedUrl on the image
            if (job.status === "DONE") {
              return {
                ...s,
                jobStatus: "DONE",
                image: { ...s.image, processedUrl: job.image?.processedUrl ?? s.image.processedUrl },
              };
            }
            return { ...s, jobStatus: job.status };
          })
        );
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [imageStates]);

  async function loadUnassigned() {
    const images = await getUnassignedImages();
    setImageStates(images.map((image) => ({ image })));
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setUploadStatus("uploading");
    setUploadProgress(0);

    try {
      // Upload in batches of 5 to avoid overwhelming the server
      const BATCH = 5;
      const newImages: ProductImage[] = [];
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const uploaded = await uploadBulkImages(batch);
        newImages.push(...uploaded);
        setUploadProgress(Math.round(((i + batch.length) / files.length) * 100));
      }

      // Add to grid and immediately trigger AI processing for all new images
      const newStates: ImageState[] = newImages.map((image) => ({ image, jobStatus: "PENDING" as JobStatus }));
      setImageStates((prev) => [...newStates, ...prev]);

      // Fire AI jobs for each new image
      for (const img of newImages) {
        fetch(`${API_BASE}/api/jobs/image/${img.id}`, { method: "POST" }).catch(() => {});
      }

      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    handleFiles(files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    handleFiles(files);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(imageStates.map((s) => s.image.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleRemoveImage(imageId: string) {
    await deleteProductImage(imageId);
    setImageStates((prev) => prev.filter((s) => s.image.id !== imageId));
    setSelected((prev) => { const n = new Set(prev); n.delete(imageId); return n; });
  }

  async function handleRetry(imageId: string) {
    setImageStates((prev) =>
      prev.map((s) => s.image.id === imageId ? { ...s, jobStatus: "PENDING" } : s)
    );
    await fetch(`${API_BASE}/api/jobs/image/${imageId}`, { method: "POST" }).catch(() => {});
  }

  function openAssignForm() {
    if (!selected.size) return;
    setForm(INITIAL_FORM);
    setSaveError("");
    setShowForm(true);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await assignImagesToProduct(Array.from(selected), form);
      // Remove assigned images from grid
      setImageStates((prev) => prev.filter((s) => !selected.has(s.image.id)));
      setSelected(new Set());
      setShowForm(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? t("admin.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-2.5 text-sm text-on-surface placeholder-secondary outline-none transition-colors";
  const selectClass =
    "w-full bg-surface-container-low border border-outline-variant hover:border-outline focus:border-primary rounded-lg px-3 py-2 text-sm text-on-surface outline-none transition-colors cursor-pointer";

  return (
    <AdminLayout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="block w-10 h-px bg-gradient-to-r from-tertiary-fixed-dim to-tertiary-fixed" />
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-on-tertiary-container">
              AI Processing
            </p>
          </div>
          <h1 className="font-headline text-4xl font-bold text-on-surface">
            Bulk{" "}
            <span className="italic text-on-tertiary-container">Uploads</span>
          </h1>
        </div>

        {/* Action bar — shown when images are selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-secondary">{selected.size} selected</span>
            <button
              onClick={clearSelection}
              className="text-sm text-secondary hover:text-primary border border-outline-variant px-3 py-2 rounded-xl transition-colors"
            >
              Clear
            </button>
            <button
              onClick={openAssignForm}
              className="flex items-center gap-2 text-sm font-semibold gold-shimmer text-on-tertiary-fixed px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <ChevronRight size={15} />
              Create product from {selected.size} image{selected.size > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>

      {/* ── Drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 text-center cursor-pointer transition-colors mb-8 ${
          dragging
            ? "border-on-tertiary-container bg-tertiary-fixed/10"
            : "border-outline-variant hover:border-outline bg-surface-container-low"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileInputChange}
        />

        {uploadStatus === "uploading" ? (
          <>
            <Loader2 size={28} className="text-on-tertiary-container animate-spin" />
            <p className="text-sm font-semibold text-on-surface">
              Uploading... {uploadProgress}%
            </p>
            <div className="w-48 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-on-tertiary-container transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center">
              <Upload size={22} className="text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">
                Drop images here or click to browse
              </p>
              <p className="text-xs text-secondary mt-1">
                JPG, PNG, WEBP — upload as many as you like
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-on-tertiary-container bg-tertiary-fixed/20 border border-tertiary-fixed-dim/30 px-4 py-2 rounded-full">
              <Sparkles size={12} />
              AI background removal starts automatically
            </div>
          </>
        )}
      </div>

      {/* ── Image grid ── */}
      {imageStates.length > 0 && (
        <div>
          {/* Grid header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold tracking-widest uppercase text-secondary">
              {imageStates.length} image{imageStates.length !== 1 ? "s" : ""} awaiting assignment
            </p>
            <button
              onClick={selected.size === imageStates.length ? clearSelection : selectAll}
              className="text-xs text-on-tertiary-container font-semibold hover:opacity-70 transition-opacity"
            >
              {selected.size === imageStates.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {imageStates.map(({ image, jobStatus }) => {
              const url = image.processedUrl ?? image.rawUrl;
              const isSelected = selected.has(image.id);
              const isProcessing = jobStatus === "PENDING" || jobStatus === "PROCESSING";
              const isFailed = jobStatus === "FAILED";

              return (
                <div
                  key={image.id}
                  onClick={() => toggleSelect(image.id)}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? "ring-2 ring-on-tertiary-container ring-offset-2"
                      : "hover:opacity-90"
                  }`}
                >
                  {/* Image */}
                  {url ? (
                    <img
                      src={url}
                      alt="upload"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-high" />
                  )}

                  {/* Processing overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Loader2 size={18} className="text-white animate-spin" />
                    </div>
                  )}

                  {/* AI done badge */}
                  {jobStatus === "DONE" && (
                    <div className="absolute top-1.5 left-1.5 bg-emerald-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Sparkles size={8} />
                      AI
                    </div>
                  )}

                  {/* Failed — retry + delete buttons */}
                  {isFailed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
                      <span className="text-white text-[9px] font-bold bg-red-500/80 px-1.5 py-0.5 rounded">
                        Failed
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRetry(image.id); }}
                        className="flex items-center gap-1 text-[10px] font-semibold bg-white/20 hover:bg-white/40 text-white px-2 py-1 rounded-lg transition-colors"
                      >
                        <RefreshCw size={9} />
                        Retry
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                        className="flex items-center gap-1 text-[10px] font-semibold bg-white/20 hover:bg-red-500/60 text-white px-2 py-1 rounded-lg transition-colors"
                      >
                        <X size={9} />
                        Delete
                      </button>
                    </div>
                  )}

                  {/* Selected checkmark */}
                  {isSelected && !isFailed && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-on-tertiary-container text-surface flex items-center justify-center">
                      <Check size={11} />
                    </div>
                  )}

                  {/* Delete button on hover — non-failed, non-selected images */}
                  {!isSelected && !isFailed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {imageStates.length === 0 && uploadStatus !== "uploading" && (
        <div className="text-center py-20 text-secondary text-sm">
          No images waiting for assignment. Upload some above.
        </div>
      )}

      {/* ── Assignment panel (slide-in from right) ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && setShowForm(false)}
          />

          {/* Panel */}
          <div className="w-96 bg-surface h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="px-8 py-7 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline text-xl font-bold text-on-surface">
                New Product
              </h2>
              <button
                onClick={() => !saving && setShowForm(false)}
                className="p-1.5 rounded-lg text-secondary hover:text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Selected images preview */}
            <div className="px-8 py-4 border-b border-outline-variant">
              <p className="text-[10px] text-secondary uppercase tracking-widest mb-3">
                {selected.size} image{selected.size > 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2 flex-wrap">
                {imageStates
                  .filter((s) => selected.has(s.image.id))
                  .map(({ image }, idx) => {
                    const url = image.processedUrl ?? image.rawUrl;
                    return (
                      <div key={image.id} className="relative w-12 h-16 rounded-lg overflow-hidden bg-surface-container">
                        {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                        {idx === 0 && (
                          <div className="absolute bottom-0 inset-x-0 bg-amber-400/80 flex items-center justify-center py-0.5">
                            <Star size={8} className="text-amber-900" fill="currentColor" />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <p className="text-[10px] text-outline mt-2">First image will be set as main</p>
            </div>

            {/* Form */}
            <form onSubmit={handleAssign} className="flex-1 px-8 py-6 space-y-6">
              <div>
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                  {t("admin.productName")}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                  {t("admin.productSku")}
                </label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-secondary uppercase tracking-widest mb-2">
                    {t("admin.productType")}
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProductType }))}
                    className={selectClass}
                  >
                    {PRODUCT_TYPES.map((type) => (
                      <option key={type} value={type}>{t(`type.${type}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                    {t("admin.productColor")}
                  </label>
                  <input
                    type="text"
                    required
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-secondary uppercase tracking-widest mb-2">
                  {t("admin.productStatus")}
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProductStatus }))}
                  className={selectClass}
                >
                  <option value="IN_STOCK">{t("status.in_stock")}</option>
                  <option value="OUT_OF_STOCK">{t("status.out_of_stock")}</option>
                </select>
              </div>

              {saveError && <p className="text-sm text-error">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 gold-shimmer disabled:opacity-50 font-semibold py-3 rounded-xl text-sm text-on-tertiary-fixed hover:opacity-90 transition-opacity"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    "Create Product"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="px-4 py-3 border border-outline-variant text-on-surface-variant hover:border-outline text-sm rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
