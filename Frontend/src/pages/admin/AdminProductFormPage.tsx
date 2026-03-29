import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProduct, createProduct, updateProduct } from "../../services/product.service";
import type { ProductType, ProductStatus } from "../../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

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
  status: "in_stock",
};

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLang();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load existing product data when editing
  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => {
        setForm({ name: p.name, sku: p.sku, type: p.type, color: p.color, status: p.status });
      })
      .catch(() => setError(t("common.error")))
      .finally(() => setLoading(false));
  }, [id, t]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit && id) {
        await updateProduct(id, form);
      } else {
        await createProduct(form);
      }
      navigate("/admin/inventory");
    } catch {
      setError(t("admin.saveError"));
      setSaving(false);
    }
  }

  // Bottom-border-only input style
  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  // Select uses a different look (full border) to indicate it's a dropdown
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
        {/* Section heading in Noto Serif */}
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

          {/* Divider */}
          <div className="h-px bg-outline-variant" />

          {/* Type + Color row */}
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
            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.productColor")}
              </label>
              <input
                type="text"
                required
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className={inputClass}
              />
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
              <option value="in_stock">{t("status.in_stock")}</option>
              <option value="out_of_stock">{t("status.out_of_stock")}</option>
            </select>
          </div>

          {/* Image upload — disabled until cloud storage (Step 6) */}
          <div>
            <label className="block text-[10px] text-secondary uppercase tracking-widest mb-2">
              {t("admin.imageUpload")}
            </label>
            <div className="w-full bg-surface-container-low border-2 border-dashed border-outline-variant rounded-xl px-4 py-8 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
              <ImageOff size={24} className="text-secondary" />
              <span className="text-xs text-secondary">{t("admin.imageDisabled")}</span>
            </div>
          </div>

          {/* Error message */}
          {error && <p className="text-sm text-error">{error}</p>}

          {/* Action buttons */}
          <div className="flex gap-4 pt-2">
            {/* Submit — gold gradient */}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 gold-shimmer disabled:opacity-50 font-semibold py-3 rounded-xl text-sm text-on-tertiary-fixed transition-opacity hover:opacity-90"
            >
              {saving ? t("admin.saving") : t("admin.saveProduct")}
            </button>

            {/* Cancel — outlined */}
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
