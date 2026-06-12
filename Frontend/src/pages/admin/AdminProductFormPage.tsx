import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ImagePlus, X, Star } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getProduct,
  createProduct,
  updateProduct,
  uploadRawImage,
  deleteProductImage,
  setMainImage,
} from "../../services/product.service";
import { COLOR_OPTIONS, colorDisplay } from "../../lib/colorMap";
import type { ProductType, ProductStatus, ProductImage } from "../../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];
const MAX_IMAGES = 5;

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const totalCount = savedImages.length + pendingImages.length;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const available = MAX_IMAGES - totalCount;
    const toAdd = files.slice(0, available);

    const newPending: PendingImage[] = toAdd.map((file, idx) => ({
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

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

      navigate("/admin/inventory");
    } catch {
      setError(t("admin.saveError"));
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
                {saving ? t("admin.saving") : t("admin.saveProduct")}
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

                  {totalCount < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-shrink-0 w-full h-[72px] rounded-lg border-2 border-dashed border-outline-variant hover:border-on-tertiary-container flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <ImagePlus size={16} className="text-secondary" />
                      <span className="text-[9px] text-secondary">{totalCount}/{MAX_IMAGES}</span>
                    </button>
                  )}
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
      </form>
    </AdminLayout>
  );
}
