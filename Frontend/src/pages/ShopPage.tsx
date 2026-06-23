import { useState, useEffect, useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import { getProducts } from "../services/product.service";
import type { Product, ProductType, ProductStatus } from "../types/product";
import { BASE_COLORS, colorDisplay } from "../lib/colorMap";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

const PAGE_SIZE = 12;

const COLOR_SWATCHES: Record<string, string> = {
  BLACK: "#1a1a1a",
  WHITE: "#f0f0f0",
  BROWN: "#8B5E3C",
  RED: "#C0392B",
  GRAY: "#808080",
  SKY_BLUE: "#87CEEB",
  YELLOW: "#F4D03F",
  CREAM: "#F5E6C8",
  IVORY: "#FFFFF0",
  PURPLE: "#8E44AD",
  NAVY: "#1B3A6B",
  ORANGE: "#E67E22",
  GREEN: "#27AE60",
  OLIVE: "#808000",
  PINK: "#FF69B4",
  BURGUNDY: "#800020",
  TURQUOISE: "#40E0D0",
  BEIGE: "#F5F5DC",
};

const STATUS_OPTIONS: Array<{ value: ProductStatus | ""; labelKey: string }> = [
  { value: "", labelKey: "shop.allStatuses" },
  { value: "IN_STOCK", labelKey: "status.in_stock" },
  { value: "OUT_OF_STOCK", labelKey: "status.out_of_stock" },
];

export default function ShopPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const isAdmin = session !== null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [typeFilter, setTypeFilter] = useState<ProductType>("JACKET");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [colorFilter, setColorFilter] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setVisibleCount(PAGE_SIZE);
    getProducts({
      type: typeFilter,
      status: isAdmin ? (statusFilter || undefined) : "IN_STOCK",
    })
      .then(setProducts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter, isAdmin]);

  // Reset visible count when color filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [colorFilter]);

  const filteredProducts = useMemo(() => {
    if (!colorFilter) return products;
    return products.filter((p) => p.color.includes(colorFilter));
  }, [products, colorFilter]);

  function clearFilters() {
    setTypeFilter("JACKET");
    setStatusFilter("");
    setColorFilter("");
  }

  const hasActiveFilters =
    typeFilter !== "JACKET" || statusFilter !== "" || colorFilter !== "";

  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="bg-surface border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-on-tertiary-container mb-3">
                {t("nav.brandSubtitle")}
              </p>
              <h1 className="font-headline text-5xl font-black text-on-surface">
                {t("shop.title")}
              </h1>
              <p className="text-on-surface-variant mt-2 text-sm tracking-wide">
                {t("shop.subtitle")}
              </p>
            </div>
            <div className="hidden md:block w-20 h-[1.5px] bg-[#e9c176] mb-2 shrink-0" />
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="bg-surface min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex gap-12">

            {/* ── Filter sidebar ── */}
            <aside className="w-44 shrink-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={12} className="text-white/40" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/70">
                    {t("shop.filters")}
                  </span>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-[10px] text-white/35 hover:text-[#e9c176]/70 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    <X size={10} />
                    {t("shop.clearFilters")}
                  </button>
                )}
              </div>

              <div className="h-px bg-gradient-to-r from-[#e9c176]/40 via-outline-variant to-transparent mb-6" />

              {/* Type filter */}
              <div className="mb-8">
                <p className="text-[9px] text-white/30 uppercase tracking-[0.25em] mb-3 font-bold">
                  {t("shop.type")}
                </p>
                <div className="space-y-0.5">
                  {PRODUCT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`flex items-center gap-2 w-full text-start text-sm py-1.5 transition-colors cursor-pointer ${
                        typeFilter === type ? "font-bold text-[#e9c176]" : "text-white/40 hover:text-white/75"
                      }`}
                    >
                      {typeFilter === type && <span className="w-1 h-1 rounded-full bg-[#e9c176] shrink-0" />}
                      {t(`type.${type}_plural`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-outline-variant mb-6" />

              {/* Color filter */}
              <div className="mb-8">
                <p className="text-[9px] text-white/30 uppercase tracking-[0.25em] mb-3 font-bold">
                  {t("shop.color")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {BASE_COLORS.map((base) => {
                    const active = colorFilter === base;
                    return (
                      <button
                        key={base}
                        onClick={() => setColorFilter(active ? "" : base)}
                        title={colorDisplay(base, lang)}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                          active
                            ? "border-[#e9c176] scale-110"
                            : "border-white/10 hover:border-white/40"
                        }`}
                        style={{ backgroundColor: COLOR_SWATCHES[base] ?? "#555" }}
                      />
                    );
                  })}
                </div>
                {colorFilter && (
                  <p className="text-[10px] text-[#e9c176]/70 mt-2">
                    {colorDisplay(colorFilter, lang)}
                  </p>
                )}
              </div>

              {/* Status filter — admin only */}
              {isAdmin && (
                <>
                  <div className="h-px bg-outline-variant mb-6" />
                  <div>
                    <p className="text-[9px] text-white/30 uppercase tracking-[0.25em] mb-3 font-bold">
                      {t("shop.status")}
                    </p>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map(({ value, labelKey }) => (
                        <button
                          key={labelKey}
                          onClick={() => setStatusFilter(value)}
                          className="flex items-center gap-3 w-full text-start cursor-pointer"
                        >
                          <span
                            className={`w-3.5 h-3.5 shrink-0 border rounded-sm flex items-center justify-center transition-colors ${
                              statusFilter === value
                                ? "bg-[#e9c176]/15 border-[#e9c176]/50"
                                : "border-white/15 bg-transparent"
                            }`}
                          >
                            {statusFilter === value && (
                              <svg className="w-2 h-2 text-[#e9c176]" viewBox="0 0 10 10" fill="none">
                                <path
                                  d="M1.5 5L4 7.5L8.5 2.5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className={`text-sm transition-colors ${
                            statusFilter === value ? "text-[#e9c176] font-semibold" : "text-white/40"
                          }`}>
                            {t(labelKey)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </aside>

            {/* ── Product grid ── */}
            <div className="flex-1">
              {loading && (
                <div className="flex items-center justify-center h-64 text-secondary text-sm">
                  {t("shop.loading")}
                </div>
              )}
              {error && (
                <div className="flex items-center justify-center h-64 text-error text-sm">
                  {t("shop.error")}
                </div>
              )}
              {!loading && !error && filteredProducts.length === 0 && (
                <div className="flex items-center justify-center h-64 text-secondary text-sm">
                  {t("shop.noProducts")}
                </div>
              )}
              {!loading && !error && filteredProducts.length > 0 && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        showStatus={isAdmin}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="mt-16 flex justify-center">
                      <button
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="px-10 py-3 border border-outline-variant text-[11px] font-bold text-on-surface-variant rounded-none hover:border-[#e9c176] hover:text-[#e9c176] transition-colors tracking-[0.2em] uppercase cursor-pointer"
                      >
                        {t("shop.loadMore")} ({filteredProducts.length - visibleCount})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
