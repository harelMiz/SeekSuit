import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, ImageOff, Sparkles } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/layout/Layout";
import { getProduct, deleteProduct } from "../services/product.service";
import type { Product, ProductImage } from "../types/product";
import { bestImageUrl, mainImage } from "../types/product";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLang();
  const { session } = useAuth();
  const isAdmin = session !== null;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Index of the image currently shown in the large viewer
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => {
        setProduct(p);
        const sorted = [...p.images].sort((a, b) => a.order - b.order);
        const mainIdx = sorted.findIndex((img) => img.isMain);
        setActiveIdx(mainIdx >= 0 ? mainIdx : 0);
      })
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

  const images = [...product.images].sort((a, b) => a.order - b.order);
  const activeImage: ProductImage | undefined = images[activeIdx];
  const activeUrl = activeImage ? bestImageUrl(activeImage) : null;

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
            {/* ── Left: Image gallery ── */}
            <div className="flex gap-3">
              {/* Thumbnail strip — only shown when there are multiple images */}
              {images.length > 1 && (
                <div className="flex flex-col gap-2 w-16 flex-shrink-0">
                  {images.map((img, idx) => {
                    const url = bestImageUrl(img);
                    return (
                      <button
                        key={img.id}
                        onClick={() => setActiveIdx(idx)}
                        className={`w-16 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                          idx === activeIdx
                            ? "border-on-tertiary-container"
                            : "border-transparent hover:border-outline-variant"
                        }`}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={`view ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
                            <ImageOff size={12} className="text-outline-variant" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main image viewer */}
              <div className="flex-1 aspect-[3/4] rounded-xl overflow-hidden bg-surface-container">
                {activeUrl ? (
                  <img
                    src={activeUrl}
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

              {/* Attributes row */}
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
                            product.status === "IN_STOCK"
                              ? "bg-emerald-500"
                              : "bg-outline"
                          }`}
                        />
                        {product.status === "IN_STOCK"
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

              {/* Atelier Badge */}
              {material && (
                <div className="flex items-center gap-3 mb-8 bg-surface-container-low border border-outline-variant rounded-xl p-4">
                  <span className="text-on-tertiary-container text-xs font-bold tracking-widest uppercase">
                    Atelier
                  </span>
                  <span className="text-sm text-on-surface-variant">{material}</span>
                </div>
              )}

              {/* Action buttons — admin only */}
              {isAdmin && (
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
              )}
            </div>
          </div>

          {/* Similar Items placeholder */}
          <div className="mt-20 pt-12 border-t border-outline-variant">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={16} className="text-on-tertiary-container" />
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {t("product.similar")}
              </h2>
            </div>
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
