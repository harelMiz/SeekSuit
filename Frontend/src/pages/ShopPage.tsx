import { useState, useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import ProductCard from "../components/ui/ProductCard";
import { getProducts } from "../services/product.service";
import type { Product, ProductType, ProductStatus } from "../types/product";

const PRODUCT_TYPES: ProductType[] = ["JACKET", "PANTS", "SHIRT", "VEST", "SHOES", "TIE", "BOW_TIE", "BELT"];

// Status filter options
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

  // Active filters
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
      <div className="bg-surface min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-20">

          {/* Page header */}
          <div className="mb-10">
            <h1 className="font-headline text-5xl font-black text-on-surface">
              {t("shop.title")}
            </h1>
            <p className="text-on-surface-variant mt-2 text-base">
              Discover our curated menswear collection
            </p>
          </div>

          <div className="flex gap-12">
            {/* ── Filter sidebar ── */}
            <aside className="w-44 shrink-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={13} className="text-on-surface-variant" />
                  <span className="text-xs font-bold tracking-widest uppercase text-on-surface">
                    {t("shop.filters")}
                  </span>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    <X size={11} />
                    {t("shop.clearFilters")}
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-outline-variant mb-6" />

              {/* Type filter */}
              <div className="mb-8">
                <p className="text-[10px] text-secondary uppercase tracking-widest mb-3">
                  {t("shop.type")}
                </p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setTypeFilter("")}
                    className={`block w-full text-start text-sm py-1.5 transition-colors ${
                      typeFilter === ""
                        ? "font-bold text-primary"
                        : "text-secondary hover:text-primary"
                    }`}
                  >
                    {t("shop.allTypes")}
                  </button>
                  {PRODUCT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`block w-full text-start text-sm py-1.5 transition-colors ${
                        typeFilter === type
                          ? "font-bold text-primary"
                          : "text-secondary hover:text-primary"
                      }`}
                    >
                      {t(`type.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-outline-variant mb-6" />

              {/* Status / Availability filter */}
              <div>
                <p className="text-[10px] text-secondary uppercase tracking-widest mb-3">
                  {t("shop.status")}
                </p>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(({ value, labelKey }) => (
                    <button
                      key={labelKey}
                      onClick={() => setStatusFilter(value)}
                      className="flex items-center gap-3 w-full text-start"
                    >
                      {/* Custom square checkbox */}
                      <span
                        className={`w-4 h-4 shrink-0 border rounded-sm flex items-center justify-center transition-colors ${
                          statusFilter === value
                            ? "bg-primary border-primary"
                            : "border-outline-variant bg-surface-container-lowest"
                        }`}
                      >
                        {statusFilter === value && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
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
                      <span
                        className={`text-sm transition-colors ${
                          statusFilter === value
                            ? "text-primary font-semibold"
                            : "text-secondary"
                        }`}
                      >
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
                <div className="flex items-center justify-center h-64 text-secondary">
                  {t("shop.loading")}
                </div>
              )}
              {error && (
                <div className="flex items-center justify-center h-64 text-error">
                  {t("shop.error")}
                </div>
              )}
              {!loading && !error && products.length === 0 && (
                <div className="flex items-center justify-center h-64 text-secondary">
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
