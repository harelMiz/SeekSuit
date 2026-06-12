import { useState, useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import { getProducts } from "../services/product.service";
import type { Product, ProductType, ProductStatus } from "../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

const STATUS_OPTIONS: Array<{ value: ProductStatus | ""; labelKey: string }> = [
  { value: "", labelKey: "shop.allStatuses" },
  { value: "IN_STOCK", labelKey: "status.in_stock" },
  { value: "OUT_OF_STOCK", labelKey: "status.out_of_stock" },
];

export default function ShopPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [typeFilter, setTypeFilter] = useState<ProductType | "">("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");

  useEffect(() => {
    setLoading(true);
    setError(false);
    getProducts({
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    })
      .then(setProducts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  function clearFilters() {
    setTypeFilter("");
    setStatusFilter("");
  }

  const hasActiveFilters = typeFilter !== "" || statusFilter !== "";

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
            {/* Gold rule — decorative */}
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

              {/* Gold-tipped divider */}
              <div className="h-px bg-gradient-to-r from-[#e9c176]/40 via-outline-variant to-transparent mb-6" />

              {/* Type filter */}
              <div className="mb-8">
                <p className="text-[9px] text-white/30 uppercase tracking-[0.25em] mb-3 font-bold">
                  {t("shop.type")}
                </p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setTypeFilter("")}
                    className={`flex items-center gap-2 w-full text-start text-sm py-1.5 transition-colors cursor-pointer ${
                      typeFilter === "" ? "font-bold text-[#e9c176]" : "text-white/40 hover:text-white/75"
                    }`}
                  >
                    {typeFilter === "" && <span className="w-1 h-1 rounded-full bg-[#e9c176] shrink-0" />}
                    {t("shop.allTypes")}
                  </button>
                  {PRODUCT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`flex items-center gap-2 w-full text-start text-sm py-1.5 transition-colors cursor-pointer ${
                        typeFilter === type ? "font-bold text-[#e9c176]" : "text-white/40 hover:text-white/75"
                      }`}
                    >
                      {typeFilter === type && <span className="w-1 h-1 rounded-full bg-[#e9c176] shrink-0" />}
                      {t(`type.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-outline-variant mb-6" />

              {/* Status filter */}
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
              {!loading && !error && products.length === 0 && (
                <div className="flex items-center justify-center h-64 text-secondary text-sm">
                  {t("shop.noProducts")}
                </div>
              )}
              {!loading && !error && products.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
