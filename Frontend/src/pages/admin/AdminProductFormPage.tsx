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
import { COLOR_OPTIONS, colorLabel } from "../../lib/colorMap";
import type { ProductType, ProductStatus, ProductImage } from "../../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];
const MAX_IMAGES = 5;

interface FormState {
  name: string;
  sku: string;
  type: ProductType;
  color: string;
  status: ProductStatus;
}

const INITIAL_FORM: FormState = {
  name: "",
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
  const { t } = useLang();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [colorSearch, setColorSearch] = useState("");
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const filteredColors = COLOR_OPTIONS.filter((key) =>
    colorLabel(key).includes(colorSearch) || key.toLowerCase().includes(colorSearch.toLowerCase())
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
        setForm({ name: p.name, sku: p.sku, type: p.type, color: p.color, status: p.status });
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

      if (isEdit && productId) {
        await updateProduct(productId, form);
      } else {
        const product = await createProduct(form);
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
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

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

  return (
    <AdminLayout>
      <div className="max-w-xl">
        <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-2">
          {isEdit ? "Edit" : "New"} Product
        </p>
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-10">
          {isEdit ? t("admin.editProduct") : t("admin.addProduct")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Name */}
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

          {/* SKU */}
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

          <div className="h-px bg-outline-variant" />

          {/* Type + Color */}
          <div className="grid grid-cols-2 gap-6">
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
                  <option key={type} value={type}>
                    {t(`type.${type}`)}
                  </option>
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
                placeholder="חפש צבע..."
                value={colorSearch || colorLabel(form.color)}
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
                      onMouseDown={() => {
                        handleChange("color", key);
                        setColorSearch("");
                        setColorDropdownOpen(false);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-surface-container text-on-surface ${form.color === key ? "font-semibold text-primary" : ""}`}
                    >
                      {colorLabel(key)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Status */}
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

          {/* ── Images section ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] text-secondary uppercase tracking-widest">
                {t("admin.imageUpload")} ({totalCount}/{MAX_IMAGES})
              </label>
              {totalCount < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-on-tertiary-container font-semibold hover:opacity-70 transition-opacity"
                >
                  <ImagePlus size={14} />
                  Add image
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Image grid */}
            {totalCount > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {/* Saved images (from DB) */}
                {savedImages.map((img) => {
                  const displayUrl = img.processedUrl ?? img.rawUrl;
                  return (
                    <div key={img.id} className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant">
                      {displayUrl ? (
                        <img
                          src={displayUrl}
                          alt="product"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline-variant text-xs">
                          No preview
                        </div>
                      )}

                      {/* Main badge */}
                      {img.isMain && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400/90 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          <Star size={9} fill="currentColor" />
                          Main
                        </div>
                      )}

                      {/* Hover controls */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!img.isMain && (
                          <button
                            type="button"
                            onClick={() => setSavedMain(img.id)}
                            className="p-1.5 rounded-lg bg-amber-400/90 text-amber-900 hover:bg-amber-400 transition-colors"
                            title="Set as main"
                          >
                            <Star size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSaved(img.id)}
                          className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-red-500/80 transition-colors"
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Pending images (local preview) */}
                {pendingImages.map((img, idx) => (
                  <div key={idx} className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-surface-container-low border-2 border-dashed border-outline-variant">
                    <img
                      src={img.preview}
                      alt="pending upload"
                      className="w-full h-full object-cover"
                    />

                    {/* Main badge */}
                    {img.isMain && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400/90 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <Star size={9} fill="currentColor" />
                        Main
                      </div>
                    )}

                    {/* "Not uploaded" label */}
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[10px] text-center py-1">
                      Pending upload
                    </div>

                    {/* Hover controls */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {!img.isMain && (
                        <button
                          type="button"
                          onClick={() => setPendingMain(idx)}
                          className="p-1.5 rounded-lg bg-amber-400/90 text-amber-900 hover:bg-amber-400 transition-colors"
                          title="Set as main"
                        >
                          <Star size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-red-500/80 transition-colors"
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add slot — shown if under limit */}
                {totalCount < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center gap-2 transition-colors"
                  >
                    <ImagePlus size={20} className="text-secondary" />
                    <span className="text-[10px] text-secondary">Add</span>
                  </button>
                )}
              </div>
            ) : (
              /* Empty state — large drop zone */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-surface-container-low border-2 border-dashed border-outline-variant hover:border-primary rounded-xl px-4 py-8 flex flex-col items-center gap-2 transition-colors cursor-pointer"
              >
                <ImagePlus size={24} className="text-secondary" />
                <span className="text-xs text-secondary">{t("admin.imageUpload")}</span>
                <span className="text-[10px] text-outline">Up to {MAX_IMAGES} images — click the ★ to set main</span>
              </button>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-sm text-error">{error}</p>}

          {/* Action buttons */}
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
        </form>
      </div>
    </AdminLayout>
  );
}
