import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ImagePlus, X, Star, Wand2, Loader2, RefreshCw, Zap } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getProduct,
  createProduct,
  updateProduct,
  uploadRawImage,
  deleteProductImage,
  setMainImage,
  triggerVTO,
  getVTOStatus,
  getProductVTOJobs,
  publishVTOImages,
  deleteVTOResult,
  processAllImages,
} from "../../services/product.service";
import { COLOR_OPTIONS, colorDisplay } from "../../lib/colorMap";
import type { ProductType, ProductStatus, ProductImage, VTOJob } from "../../types/product";

const VTO_TYPES: ProductType[] = ["JACKET", "VEST"];

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

interface FormState {
  name: string;
  nameEn: string;
  sku: string;
  type: ProductType;
  color: string;
  status: ProductStatus;
}

const INITIAL_FORM: FormState = {
  name: "",
  nameEn: "",
  sku: "",
  type: "JACKET",
  color: "",
  status: "IN_STOCK",
};

// A pending image (selected locally, not yet uploaded)
interface PendingImage {
  file: File;
  preview: string;
  isMain: boolean;
}

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError]           = useState("");

  const [colorSearch, setColorSearch] = useState("");
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const filteredColors = COLOR_OPTIONS.filter((key) =>
    colorDisplay(key, lang).toLowerCase().includes(colorSearch.toLowerCase()) ||
    key.toLowerCase().includes(colorSearch.toLowerCase())
  );

  // Images already saved in the DB (edit mode)
  const [savedImages, setSavedImages] = useState<ProductImage[]>([]);
  // Images selected locally, not yet uploaded
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background processing state — persisted in sessionStorage so refresh doesn't show button again
  const [processing, setProcessing]           = useState(false);
  const [processingQueued, setProcessingQueued] = useState(() =>
    Boolean(sessionStorage.getItem(`processing-${id ?? 'new'}`))
  );

  // VTO state
  const [vtoJob, setVtoJob]               = useState<VTOJob | null>(null);
  const [vtoTriggering, setVtoTriggering] = useState(false);
  const [vtoPublishing, setVtoPublishing] = useState(false);
  const [vtoPublishDone, setVtoPublishDone] = useState(false);
  // Click-to-order: modelKeys in user-selected display order (index 0 = main)
  const [vtoOrder, setVtoOrder]           = useState<string[]>([]);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const processPoller  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close color dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load existing product data when editing
  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => {
        setForm({
          name: p.name,
          nameEn: (p.attributes?.nameEn as string) ?? "",
          sku: p.sku,
          type: p.type,
          color: p.color,
          status: p.status,
        });
        setSavedImages(p.images.sort((a, b) => a.order - b.order));
      })
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [id, t]);

  // Load existing VTO jobs when editing a JACKET or VEST
  useEffect(() => {
    if (!id) return;
    getProductVTOJobs(id).then((jobs) => {
      const latest = jobs[0] ?? null;
      setVtoJob(latest);
    }).catch(() => {});
  }, [id]);

  // Poll active VTO jobs until terminal state
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await getVTOStatus(jobId);
        setVtoJob(updated);
        if (updated.status === 'DONE' || updated.status === 'FAILED') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch (_) {}
    }, 5000);
  }, []);

  useEffect(() => {
    if (vtoJob && (vtoJob.status === 'PENDING' || vtoJob.status === 'RUNNING')) {
      startPolling(vtoJob.id);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [vtoJob?.id, vtoJob?.status, startPolling]);

  // Poll saved images after background processing until all have processedUrl
  const startProcessPoll = useCallback((productId: string) => {
    if (processPoller.current) clearInterval(processPoller.current);
    processPoller.current = setInterval(async () => {
      try {
        const p = await getProduct(productId);
        const imgs = p.images.sort((a, b) => a.order - b.order);
        setSavedImages(imgs);
        if (imgs.length > 0 && imgs.every((img) => img.processedUrl)) {
          clearInterval(processPoller.current!);
          processPoller.current = null;
          sessionStorage.removeItem(`processing-${productId}`);
          setProcessingQueued(false);
        }
      } catch {}
    }, 4000);
  }, []);

  // Resume polling after page refresh if processing was in progress
  useEffect(() => {
    if (id && processingQueued) startProcessPoll(id);
    return () => { if (processPoller.current) clearInterval(processPoller.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reset ordering state when the active VTO job changes (new job or regenerate)
  useEffect(() => {
    setVtoOrder([]);
    setVtoPublishDone(false);
  }, [vtoJob?.id]);

  const totalCount = savedImages.length + pendingImages.length;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newPending: PendingImage[] = files.map((file, idx) => ({
      file,
      preview: URL.createObjectURL(file),
      // First image becomes main if there are no images yet
      isMain: totalCount === 0 && idx === 0,
    }));

    setPendingImages((prev) => [...prev, ...newPending]);
    // Reset so same file can be selected again
    e.target.value = "";
  }

  function removePending(idx: number) {
    setPendingImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // If we removed the main, promote the first remaining
      if (prev[idx].isMain && next.length > 0 && !next.some((p) => p.isMain)) {
        next[0] = { ...next[0], isMain: true };
      }
      return next;
    });
  }

  function setPendingMain(idx: number) {
    setPendingImages((prev) =>
      prev.map((img, i) => ({ ...img, isMain: i === idx }))
    );
    // Demote all saved images from main
    setSavedImages((prev) => prev.map((img) => ({ ...img, isMain: false })));
  }

  async function removeSaved(imageId: string) {
    await deleteProductImage(imageId);
    setSavedImages((prev) => {
      const next = prev.filter((img) => img.id !== imageId);
      // If the deleted image was main, promote the first remaining
      const wasMain = prev.find((img) => img.id === imageId)?.isMain;
      if (wasMain && next.length > 0) next[0] = { ...next[0], isMain: true };
      return next;
    });
  }

  async function setSavedMain(imageId: string) {
    await setMainImage(imageId);
    setSavedImages((prev) =>
      prev.map((img) => ({ ...img, isMain: img.id === imageId }))
    );
    setPendingImages((prev) => prev.map((img) => ({ ...img, isMain: false })));
  }

  async function handleProcessImages() {
    if (!id) return;
    setProcessing(true);
    try {
      await processAllImages(id);
      sessionStorage.setItem(`processing-${id}`, '1');
      setProcessingQueued(true);
      startProcessPoll(id);
    } catch {
      // fail silently — user can retry
    } finally {
      setProcessing(false);
    }
  }

  async function handleTriggerVTO() {
    if (!id) return;
    // Use the main image that has been processed; fallback to first processed image
    const sourceImg =
      savedImages.find((img) => img.isMain && img.processedUrl) ??
      savedImages.find((img) => img.processedUrl);
    if (!sourceImg) return;
    setVtoTriggering(true);
    try {
      const job = await triggerVTO(id, sourceImg.id);
      setVtoJob(job);
    } finally {
      setVtoTriggering(false);
    }
  }

  function handleVTOImageClick(modelKey: string) {
    setVtoOrder((prev) =>
      prev.includes(modelKey)
        ? prev.filter((k) => k !== modelKey)
        : [...prev, modelKey]
    );
  }

  async function handleDeleteVTOResult(modelKey: string) {
    if (!vtoJob) return;
    const prevJob = vtoJob;
    // Optimistic update: remove from UI immediately
    setVtoJob({
      ...vtoJob,
      results: (vtoJob.results ?? []).filter((r) => r.modelKey !== modelKey),
    });
    setVtoOrder((prev) => prev.filter((k) => k !== modelKey));
    try {
      await deleteVTOResult(vtoJob.id, modelKey);
    } catch {
      // Restore on API failure
      setVtoJob(prevJob);
    }
  }

  async function handlePublishVTO() {
    if (!vtoJob || vtoOrder.length === 0) return;
    setVtoPublishing(true);
    try {
      await publishVTOImages(vtoJob.id, vtoOrder);
      // Refresh saved images from the server
      if (id) {
        const p = await getProduct(id);
        setSavedImages(p.images.sort((a, b) => a.order - b.order));
      }
      setVtoPublishDone(true);
    } finally {
      setVtoPublishing(false);
    }
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let productId = id;

      const { nameEn, ...baseForm } = form;
      const payload = { ...baseForm, attributes: nameEn ? { nameEn } : undefined };

      if (isEdit && productId) {
        await updateProduct(productId, payload);
      } else {
        const product = await createProduct(payload);
        productId = product.id;
      }

      // Determine if any pending image should be main considering saved images
      const hasSavedMain = savedImages.some((img) => img.isMain);

      // Upload all pending images
      for (let i = 0; i < pendingImages.length; i++) {
        const pending = pendingImages[i];
        // An image is main if explicitly marked, or if there's no saved main and it's the first
        const isMain = pending.isMain || (!hasSavedMain && i === 0 && !pendingImages.some((p, j) => j < i && p.isMain));
        const order = savedImages.length + i;
        await uploadRawImage(pending.file, productId!, isMain, order);
      }

      if (isEdit) {
        // Stay on page — refresh images and show success state
        setPendingImages([]);
        const p = await getProduct(productId!);
        setSavedImages(p.images.sort((a, b) => a.order - b.order));
        setSaveSuccess(true);
      } else {
        // Clear pending state before navigating — same component instance reused by React Router
        setPendingImages([]);
        navigate(`/admin/inventory/${productId}/edit`);
      }
    } catch {
      setError(t("admin.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-2 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  const selectClass =
    "w-full bg-surface-container-low border border-outline-variant hover:border-outline focus:border-primary rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none transition-colors cursor-pointer";

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-48 text-secondary">
          {t("common.loading")}
        </div>
      </AdminLayout>
    );
  }

  // Determine featured image for left panel
  const mainSaved = savedImages.find((img) => img.isMain);
  const mainPending = pendingImages.find((img) => img.isMain);
  const featuredUrl = mainSaved
    ? (mainSaved.processedUrl ?? mainSaved.rawUrl)
    : mainPending
    ? mainPending.preview
    : savedImages[0]
    ? (savedImages[0].processedUrl ?? savedImages[0].rawUrl)
    : pendingImages[0]?.preview ?? null;

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-14 h-[1.5px] bg-gradient-to-r from-tertiary-fixed to-tertiary-fixed-dim" />
              <p className="text-xs font-bold tracking-[0.22em] uppercase text-on-tertiary-container">
                {isEdit ? t("admin.editProductTitle") : t("admin.newProductTitle")}
              </p>
            </div>
            <h1 className="font-headline font-bold text-on-surface leading-[1.05]">
              <span className="text-5xl">{isEdit ? t("admin.productFormTitleEdit") : t("admin.productFormTitleNew")}</span>
              <br />
              <span className="text-6xl italic text-on-tertiary-container">
                {t("admin.productFormTitle1")}
              </span>
            </h1>
            <div className="mt-4 w-20 h-[2px] bg-gradient-to-r from-tertiary-fixed-dim to-tertiary-fixed" />
          </div>

        </div>

        {/* ── 2-column body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_44%] gap-8 items-start">

          {/* ── LEFT: Form fields (first in DOM = RIGHT in RTL) ── */}
          <div className="space-y-4">

            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.productName")}
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.productNameEn")}
              </label>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) => handleChange("nameEn", e.target.value)}
                placeholder={t("admin.productNameEnPlaceholder")}
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
                onChange={(e) => handleChange("sku", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-2">
                {t("admin.productType")}
              </label>
              <select
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value)}
                className={selectClass}
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>{t(`type.${type}`)}</option>
                ))}
              </select>
            </div>

            <div ref={colorRef} className="relative">
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.productColor")}
              </label>
              <input
                type="text"
                required
                placeholder={t("admin.colorSearchPlaceholder")}
                value={colorSearch || colorDisplay(form.color, lang)}
                onFocus={() => { setColorSearch(""); setColorDropdownOpen(true); }}
                onChange={(e) => { setColorSearch(e.target.value); setColorDropdownOpen(true); }}
                className={inputClass}
                autoComplete="off"
              />
              {colorDropdownOpen && filteredColors.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-surface-container-low border border-outline-variant rounded-lg shadow-lg text-sm">
                  {filteredColors.map((key) => (
                    <li
                      key={key}
                      onMouseDown={() => { handleChange("color", key); setColorSearch(""); setColorDropdownOpen(false); }}
                      className={`px-3 py-2 cursor-pointer hover:bg-surface-container text-on-surface ${form.color === key ? "font-semibold text-primary" : ""}`}
                    >
                      {colorDisplay(key, lang)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-2">
                {t("admin.productStatus")}
              </label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className={selectClass}
              >
                <option value="IN_STOCK">{t("status.in_stock")}</option>
                <option value="OUT_OF_STOCK">{t("status.out_of_stock")}</option>
              </select>
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 gold-shimmer disabled:opacity-50 font-semibold py-3 rounded-xl text-sm text-on-tertiary-fixed transition-opacity hover:opacity-90"
              >
                {saving ? t("admin.saving") : saveSuccess ? t("admin.saveSuccess") : isEdit ? t("admin.saveProduct") : t("admin.saveAndProcess")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/inventory")}
                className="px-6 py-3 border border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface text-sm rounded-xl transition-colors"
              >
                {t("admin.cancel")}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Image gallery (second in DOM = LEFT in RTL) ── */}
          <div className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant">

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {totalCount === 0 ? (
              /* Empty state: single full rectangle */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-4 bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors"
                style={{ minHeight: "500px" }}
              >
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center">
                  <ImagePlus size={28} className="text-secondary" />
                </div>
                <p className="text-sm font-semibold text-on-surface">{t("admin.imageUpload")}</p>
              </button>
            ) : (
              /* Side-by-side: thumbnail strip + featured image */
              <div className="flex h-[500px]">

                {/* Vertical thumbnail strip — first in DOM = RIGHT in RTL */}
                <div className="w-[150px] flex-shrink-0 border-e border-outline-variant flex flex-col gap-2 p-2 overflow-y-auto">

                  {savedImages.map((img) => {
                    const url = img.processedUrl ?? img.rawUrl;
                    const isProcessing = processingQueued && !img.processedUrl;
                    return (
                      <div key={img.id} className="relative flex-shrink-0 group">
                        <div
                          onClick={() => setSavedMain(img.id)}
                          className={`w-full h-[120px] rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                            img.isMain ? "border-on-tertiary-container" : "border-transparent hover:border-outline-variant"
                          }`}
                        >
                          {url ? (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-surface-container-high" />
                          )}
                          {isProcessing && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 size={20} className="animate-spin text-white" />
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSaved(img.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface border border-outline-variant text-secondary hover:bg-error hover:text-on-error hover:border-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          title={t("admin.removeImage")}
                        >
                          <X size={10} />
                        </button>
                        {img.isMain && (
                          <div className="absolute bottom-1 inset-x-0 flex justify-center">
                            <Star size={10} className="text-amber-400" fill="currentColor" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {pendingImages.map((img, idx) => (
                    <div key={idx} className="relative flex-shrink-0 group">
                      <div
                        onClick={() => setPendingMain(idx)}
                        className={`relative w-full h-[120px] rounded-lg overflow-hidden cursor-pointer border-2 border-dashed transition-colors ${
                          img.isMain ? "border-on-tertiary-container" : "border-outline-variant hover:border-outline"
                        }`}
                      >
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center py-0.5">
                          {t("admin.pendingUpload")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface border border-outline-variant text-secondary hover:bg-error hover:text-on-error hover:border-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={10} />
                      </button>
                      {img.isMain && (
                        <div className="absolute bottom-1 inset-x-0 flex justify-center">
                          <Star size={10} className="text-amber-400" fill="currentColor" />
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 w-full h-[72px] rounded-lg border-2 border-dashed border-outline-variant hover:border-on-tertiary-container flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <ImagePlus size={16} className="text-secondary" />
                    <span className="text-[9px] text-secondary">{totalCount}</span>
                  </button>
                </div>

                {/* Featured image — fills remaining space, LEFT in RTL */}
                <div className="flex-1 relative bg-surface-container overflow-hidden">
                  {/* Blurred fill — hides letterbox bars */}
                  <img
                    src={featuredUrl!}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                  />
                  {/* Sharp main image — no cropping */}
                  <img
                    src={featuredUrl!}
                    alt="product"
                    className="relative z-10 w-full h-full object-contain"
                  />
                  <div className="absolute z-20 top-3 left-3 flex items-center gap-1.5 bg-amber-400/90 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <Star size={10} fill="currentColor" />
                    {t("admin.mainImage")}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* ── Unified processing + VTO section (edit mode only) ── */}
        {isEdit && (
          <div className="mt-8 border border-outline-variant rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant bg-surface-container-low">
              <Zap size={16} className="text-on-tertiary-container" />
              <span className="text-sm font-semibold text-on-surface">{t("admin.processing.sectionTitle")}</span>
            </div>

            <div className="p-6 space-y-8">

              {/* ── Background removal ── */}
              {savedImages.some((img) => !img.processedUrl) && (
                <div className="space-y-3">
                  <p className="text-xs text-secondary">{t("admin.processing.unprocessedHint")}</p>
                  {processingQueued ? (
                    <div className="flex items-center gap-2 text-xs text-on-tertiary-container font-semibold">
                      <Loader2 size={12} className="animate-spin" />
                      {t("admin.processBackgroundsQueued")}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleProcessImages}
                      disabled={processing}
                      className="flex items-center gap-2 border border-on-tertiary-container text-on-tertiary-container text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {processing ? (
                        <><Loader2 size={14} className="animate-spin" /> {t("admin.processingBackgrounds")}</>
                      ) : (
                        <><Wand2 size={14} /> {t("admin.processBackgrounds")}</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* ── VTO (JACKET / VEST only) ── */}
              {VTO_TYPES.includes(form.type) && (
                <div className="space-y-6">

                  <div className="flex items-center gap-2">
                    <Wand2 size={14} className="text-on-tertiary-container" />
                    <span className="text-xs font-semibold text-on-tertiary-container uppercase tracking-widest">
                      {t("admin.vto.sectionTitle")}
                    </span>
                  </div>

                  {/* Trigger / regenerate button */}
                  {savedImages.some((img) => img.processedUrl) ? (
                    <div className="space-y-2">
                      {(!vtoJob || vtoJob.status === 'FAILED') && (
                        <>
                          <button
                            type="button"
                            onClick={handleTriggerVTO}
                            disabled={vtoTriggering}
                            className="flex items-center gap-2 gold-shimmer text-on-tertiary-fixed text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            {vtoTriggering ? (
                              <><Loader2 size={14} className="animate-spin" /> {t("common.loading")}</>
                            ) : (
                              <><Wand2 size={14} /> {t("admin.vto.triggerBtn")}</>
                            )}
                          </button>
                          {vtoJob?.status === 'FAILED' && (
                            <p className="text-xs text-error">{vtoJob.errorMsg ?? t("admin.vto.failed")}</p>
                          )}
                        </>
                      )}

                      {(vtoJob?.status === 'PENDING' || vtoJob?.status === 'RUNNING') && (
                        <div className="flex items-center gap-3 text-sm text-secondary">
                          <Loader2 size={16} className="animate-spin text-on-tertiary-container" />
                          {t("admin.vto.running")}
                        </div>
                      )}

                      {vtoJob?.status === 'DONE' && (
                        <button
                          type="button"
                          onClick={handleTriggerVTO}
                          disabled={vtoTriggering}
                          className="flex items-center gap-2 border border-outline-variant text-on-surface-variant text-xs font-semibold px-4 py-2 rounded-xl transition-colors hover:border-outline hover:text-on-surface disabled:opacity-40"
                        >
                          {vtoTriggering ? (
                            <><Loader2 size={12} className="animate-spin" /> {t("common.loading")}</>
                          ) : (
                            <><RefreshCw size={12} /> {t("admin.vto.regenerateBtn")}</>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-secondary">{t("admin.vto.needProcessed")}</p>
                  )}

                  {/* Step 3: results grid with click-to-order UX */}
                  {vtoJob?.status === 'DONE' && vtoJob.results && vtoJob.results.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-xs text-secondary">{t("admin.vto.orderHint")}</p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {vtoJob.results.map((r) => {
                          const orderPos = vtoOrder.indexOf(r.modelKey);
                          const isSelected = orderPos !== -1;
                          return (
                            <div key={r.modelKey} className="relative group">
                              <div
                                onClick={() => handleVTOImageClick(r.modelKey)}
                                className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer aspect-[3/4] ${
                                  isSelected
                                    ? "border-on-tertiary-container"
                                    : "border-outline-variant opacity-60 hover:opacity-80"
                                }`}
                              >
                                <img src={r.url} alt={r.modelKey} className="w-full h-full object-cover" />

                                {/* Order badge */}
                                {isSelected && (
                                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-on-tertiary-container text-surface text-[11px] font-bold flex items-center justify-center">
                                    {orderPos + 1}
                                  </div>
                                )}

                                {/* Main label on first selected */}
                                {orderPos === 0 && (
                                  <div className="absolute bottom-0 inset-x-0 bg-amber-500/80 text-white text-[9px] font-bold text-center py-1">
                                    <Star size={8} className="inline me-0.5" fill="currentColor" />
                                    {t("admin.mainImage")}
                                  </div>
                                )}
                              </div>

                              {/* X button: delete VTO result from Supabase */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDeleteVTOResult(r.modelKey); }}
                                title={t("admin.vto.deleteResult")}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-outline-variant text-secondary hover:bg-error hover:text-on-error hover:border-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {vtoPublishDone ? (
                        <p className="text-xs text-on-tertiary-container font-semibold">{t("admin.vto.publishDone")}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePublishVTO}
                          disabled={vtoPublishing || vtoOrder.length === 0}
                          className="flex items-center gap-2 gold-shimmer text-on-tertiary-fixed text-sm font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {vtoPublishing ? (
                            <><Loader2 size={14} className="animate-spin" /> {t("common.loading")}</>
                          ) : (
                            t("admin.vto.publishBtn")
                          )}
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}

      </form>
    </AdminLayout>
  );
}
