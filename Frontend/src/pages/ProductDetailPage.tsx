import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, ImageOff, Sparkles } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import { getProduct, deleteProduct } from "../services/product.service";
import type { Product } from "../types/product";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLang();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(t("product.deleteConfirm"))) return;
    await deleteProduct(product.id);
    navigate("/shop");
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] text-secondary">
          {t("common.loading")}
        </div>
      </Layout>
    );
  }

  if (notFound || !product) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-secondary">
          <p>{t("product.notFound")}</p>
          <Link
            to="/shop"
            className="text-on-tertiary-container hover:text-primary text-sm transition-colors"
          >
            {t("product.backToShop")}
          </Link>
        </div>
      </Layout>
    );
  }

  const imageUrl = product.processedImageUrl ?? product.rawImageUrl;
  // Check if product has material info in attributes
  const material =
    product.attributes && typeof product.attributes.material === "string"
      ? product.attributes.material
      : null;

  return (
    <Layout>
      <div className="bg-surface min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-20">

          {/* Back link */}
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary mb-10 transition-colors"
          >
            <ArrowLeft size={14} />
            {t("product.backToShop")}
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
            {/* ── Left: Image ── */}
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface-container">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-outline-variant">
                  <ImageOff size={48} />
                  <span className="text-sm text-secondary">{t("product.noImage")}</span>
                </div>
              )}
            </div>

            {/* ── Right: Details ── */}
            <div className="flex flex-col">
              {/* Type label */}
              <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-on-tertiary-container mb-3">
                {t(`type.${product.type}`)}
              </p>

              {/* Product name */}
              <h1 className="font-headline text-5xl font-black leading-[1.1] text-on-surface mb-8">
                {product.name}
              </h1>

              {/* Attributes row — horizontal with dividers */}
              <div className="flex items-stretch gap-0 mb-8 border border-outline-variant rounded-xl overflow-hidden">
                {[
                  { label: t("product.color"), value: product.color },
                  { label: t("product.sku"), value: product.sku },
                  {
                    label: t("product.status"),
                    value: (
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            product.status === "in_stock"
                              ? "bg-emerald-500"
                              : "bg-outline"
                          }`}
                        />
                        {product.status === "in_stock"
                          ? "Ready to Ship"
                          : t("status.out_of_stock")}
                      </span>
                    ),
                  },
                ].map(({ label, value }, idx) => (
                  <div
                    key={label}
                    className={`flex-1 flex flex-col items-center justify-center py-4 px-3 ${
                      idx < 2 ? "border-e border-outline-variant" : ""
                    }`}
                  >
                    <span className="text-[10px] text-secondary uppercase tracking-widest mb-1">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-on-surface text-center">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Atelier Badge — shows if material info is available */}
              {material && (
                <div className="flex items-center gap-3 mb-8 bg-surface-container-low border border-outline-variant rounded-xl p-4">
                  <span className="text-on-tertiary-container text-xs font-bold tracking-widest uppercase">
                    Atelier
                  </span>
                  <span className="text-sm text-on-surface-variant">{material}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-auto">
                <Link
                  to={`/admin/inventory/${product.id}/edit`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary font-semibold text-sm rounded-xl transition-opacity hover:opacity-80"
                >
                  <Pencil size={14} />
                  {t("product.edit")}
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-3 border border-outline-variant text-on-surface-variant hover:border-error hover:text-error text-sm rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  {t("product.delete")}
                </button>
              </div>
            </div>
          </div>

          {/* ── Similar Items — placeholder for AI search (Step 7) ── */}
          <div className="mt-20 pt-12 border-t border-outline-variant">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={16} className="text-on-tertiary-container" />
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {t("product.similar")}
              </h2>
            </div>

            {/* 4-card placeholder grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="aspect-[3/4] rounded-xl bg-surface-container-low grayscale hover:grayscale-0 transition-all duration-500"
                />
              ))}
            </div>
            <p className="text-sm text-secondary mt-4">{t("product.similarNote")}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
