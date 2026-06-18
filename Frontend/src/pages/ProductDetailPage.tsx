import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, ImageOff, Sparkles, Phone, ChevronDown } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import { getProduct, deleteProduct } from "../services/product.service";
import { recordProductView } from "../services/insights.service";
import api from "../services/api";
import type { Product, ProductImage, ProductType, ProductStatus } from "../types/product";
import { bestImageUrl } from "../types/product";
import { colorDisplay } from "../lib/colorMap";

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

function toProduct(r: SearchResult): Product {
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    type: r.type as ProductType,
    color: r.color ?? "",
    status: r.status as ProductStatus,
    attributes: r.attributes,
    images: [{
      id: `similar-${r.id}`,
      productId: r.id,
      rawUrl: null,
      processedUrl: r.processedUrl,
      isMain: true,
      order: 0,
      createdAt: "",
      updatedAt: "",
    }],
    createdAt: "",
    updatedAt: "",
  };
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLang();
  const { session } = useAuth();
  const isAdmin = session !== null;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [similarProducts, setSimilarProducts] = useState<SearchResult[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const similarRef = useRef<HTMLDivElement>(null);

  const [lensVisible, setLensVisible] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const LENS_SIZE = 210;
  const ZOOM = 3.8;

  const handleImageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    setLensPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => {
        setProduct(p);
        const sorted = [...p.images].filter((img) => img.isPublished).sort((a, b) => a.order - b.order);
        const mainIdx = sorted.findIndex((img) => img.isMain);
        setActiveIdx(mainIdx >= 0 ? mainIdx : 0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product?.id || isAdmin) return;
    const state = location.state as { source?: string; searchQuery?: string } | null;
    const source = (state?.source as "BROWSE" | "SEARCH_RESULT" | "SIMILAR") ?? "BROWSE";
    recordProductView(product.id, source, state?.searchQuery).catch(() => {});
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) return;
    setSimilarLoading(true);
    api.get<{ results: SearchResult[] }>(`/search/similar/${product.id}`, { params: { limit: 4 } })
      .then(({ data }) => setSimilarProducts(data.results))
      .catch(() => setSimilarProducts([]))
      .finally(() => setSimilarLoading(false));
  }, [product?.id]);

  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(t("product.deleteConfirm"))) return;
    await deleteProduct(product.id);
    navigate("/shop");
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh] bg-[#121212] text-zinc-500 text-sm">
          {t("common.loading")}
        </div>
      </Layout>
    );
  }

  if (notFound || !product) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#121212] gap-4 text-zinc-500">
          <p>{t("product.notFound")}</p>
          <Link to="/shop" className="text-[#e9c176] hover:text-white text-sm transition-colors">
            {t("product.backToShop")}
          </Link>
        </div>
      </Layout>
    );
  }

  const images = [...product.images].filter((img) => img.isPublished).sort((a, b) => a.order - b.order);
  const activeImage: ProductImage | undefined = images[activeIdx];
  const activeUrl = activeImage ? bestImageUrl(activeImage) : null;

  const material =
    product.attributes && typeof product.attributes.material === "string"
      ? product.attributes.material
      : null;

  const displayName = lang === "en" && product.attributes?.nameEn
    ? String(product.attributes.nameEn)
    : product.name;

  return (
    <Layout>
      <div className="bg-[#121212] text-white antialiased">

        {/* Hero — fills exactly one viewport height */}
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">

          {/* Back link */}
          <div className="max-w-7xl mx-auto w-full px-6 pt-8">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 hover:text-[#e9c176] transition-colors duration-300 cursor-pointer"
            >
              <ArrowLeft size={12} />
              {t("product.backToShop")}
            </Link>
          </div>

          {/* Hero: 12-col grid — flex-1 fills remaining height */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 max-w-7xl mx-auto w-full px-6 py-6">

          {/* ── LEFT: image gallery ── */}
          <div className="lg:col-span-5 lg:pe-12 w-full h-full min-h-0 overflow-hidden flex flex-col gap-3">

            {/* Main image — fills remaining height after thumbnails */}
            <div
              ref={imgContainerRef}
              className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
              onMouseEnter={() => setLensVisible(true)}
              onMouseLeave={() => setLensVisible(false)}
              onMouseMove={handleImageMouseMove}
              style={{ cursor: lensVisible ? "none" : "default" }}
            >
              {activeUrl ? (
                <>
                  <img src={activeUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40" />
                  <img
                    src={activeUrl}
                    alt={product.name}
                    className="relative z-10 w-full h-full object-contain transition-transform duration-700 ease-out"
                  />
                  {/* Magnifier lens */}
                  {lensVisible && (
                    <div
                      className="absolute z-30 rounded-full border-2 border-white/60 shadow-2xl pointer-events-none overflow-hidden"
                      style={{
                        width: LENS_SIZE,
                        height: LENS_SIZE,
                        left: lensPos.x - LENS_SIZE / 2,
                        top: lensPos.y - LENS_SIZE / 2,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundImage: `url(${activeUrl})`,
                          backgroundSize: `${ZOOM * 100}%`,
                          backgroundPosition: `${(lensPos.x / (imgContainerRef.current?.offsetWidth ?? 1)) * 100}% ${(lensPos.y / (imgContainerRef.current?.offsetHeight ?? 1)) * 100}%`,
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-600">
                  <ImageOff size={48} />
                  <span className="text-sm">{t("product.noImage")}</span>
                </div>
              )}
            </div>

            {/* Thumbnail strip — shrink-0 so it never overflows */}
            {images.length > 1 && (
              <div className="shrink-0 flex items-center gap-3 overflow-x-auto py-1">
                {images.map((img, idx) => {
                  const url = bestImageUrl(img);
                  return (
                    <button
                      key={img.id}
                      onClick={() => setActiveIdx(idx)}
                      className={`w-20 aspect-[4/5] rounded-xl overflow-hidden shrink-0 transition-all duration-300 cursor-pointer ${
                        idx === activeIdx
                          ? "border-2 border-[#e9c176] opacity-100"
                          : "border border-white/10 bg-[#1c1c1c] opacity-60 hover:opacity-100"
                      }`}
                    >
                      {url ? (
                        <div className="relative w-full h-full">
                          <img src={url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-70" />
                          <img src={url} alt={`view ${idx + 1}`} className="relative z-10 w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-[#1c1c1c] flex items-center justify-center">
                          <ImageOff size={12} className="text-zinc-600" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: product info (col-span-7) ── */}
          <div className="lg:col-span-7 w-full flex flex-col items-start gap-6">

            {/* Type tag */}
            <p className="text-xs uppercase tracking-widest text-[#e9c176] font-medium">
              {t(`type.${product.type}`)}
            </p>

            {/* Product name */}
            <h1 className="font-headline text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
              {displayName}
            </h1>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
              {/* Status */}
              <div className="flex items-center gap-2 text-white font-medium">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  product.status === "IN_STOCK"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                    : "bg-red-500/60"
                }`} />
                {product.status === "IN_STOCK" ? t("product.readyToShip") : t("status.out_of_stock")}
              </div>

              {/* Color */}
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">{t("product.color")}:</span>
                <span className="text-white">{colorDisplay(product.color, lang)}</span>
              </div>

              {/* SKU */}
              <span className="text-xs font-mono tracking-wider text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                SKU: {product.sku}
              </span>
            </div>

            {/* Material badge */}
            {material && (
              <div className="flex items-center gap-3 bg-[#1c1c1c] border border-white/5 rounded-xl px-4 py-3">
                <span className="text-[#e9c176] text-xs font-bold tracking-widest uppercase">Atelier</span>
                <span className="text-sm text-zinc-400">{material}</span>
              </div>
            )}

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />

            {/* CTA — non-admin: visit store button */}
            {!isAdmin && (
              <Link
                to="/contact"
                className="w-full gold-shimmer text-[#121212] text-sm font-semibold tracking-wider uppercase py-4 rounded-xl shadow-[0_4px_24px_rgba(233,193,118,0.2)] hover:shadow-[0_4px_32px_rgba(233,193,118,0.3)] hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone size={15} />
                {t("product.visitStore")}
              </Link>
            )}

            {/* Admin actions */}
            {isAdmin && (
              <div className="flex gap-3 w-full">
                <Link
                  to={`/admin/inventory/${product.id}/edit`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  <Pencil size={14} />
                  {t("product.edit")}
                </Link>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-3 border border-white/10 text-zinc-400 hover:border-red-500/50 hover:text-red-400 text-sm rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  {t("product.delete")}
                </button>
              </div>
            )}
          </div>
          </div>

          {/* Gold line + scroll button — pinned to bottom of hero */}
          <div className="shrink-0 flex flex-col items-center gap-3 pb-3">
            <div className="w-full max-w-7xl mx-auto px-6">
              <div className="h-px bg-gradient-to-r from-transparent via-[#e9c176]/40 to-transparent" />
            </div>
            <button
              onClick={() => similarRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="flex flex-col items-center gap-1.5 text-white/30 hover:text-[#e9c176] transition-colors duration-300 cursor-pointer animate-bounce-slow"
            >
              <span className="text-[10px] uppercase tracking-widest">{t("product.similar")}</span>
              <ChevronDown size={16} />
            </button>
          </div>

        </div>{/* end hero */}

        {/* Similar products */}
        <div ref={similarRef} className="max-w-7xl mx-auto px-6 pt-16 pb-24">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles size={15} className="text-[#e9c176]" />
            <h2 className="font-headline text-xl text-zinc-200 tracking-wide">
              {t("product.similar")}
            </h2>
          </div>

          {similarLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="aspect-[3/4] rounded-xl bg-[#1c1c1c] animate-pulse" />
              ))}
            </div>
          ) : similarProducts && similarProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
              {similarProducts.map((r) => (
                <ProductCard
                  key={r.id}
                  product={toProduct(r)}
                  matchPercentage={Math.round(r.similarity * 100)}
                  source="SIMILAR"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">{t("product.similarNote")}</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
