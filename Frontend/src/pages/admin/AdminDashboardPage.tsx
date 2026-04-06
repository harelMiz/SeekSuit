import { useState, useEffect } from "react";
import { Package, TrendingUp, Plus, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProducts } from "../../services/product.service";
import type { Product } from "../../types/product";

// Recent activity mock rows
const RECENT_MOCK = [
  { icon: "J", name: "Classic Wool Jacket", note: "Added to inventory", time: "2h ago", sku: "JKT-001" },
  { icon: "P", name: "Slim Fit Trousers", note: "Status updated", time: "5h ago", sku: "PNT-004" },
  { icon: "S", name: "Oxford Dress Shirt", note: "Added to inventory", time: "1d ago", sku: "SHT-012" },
];

export default function AdminDashboardPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [inStock, setInStock] = useState<number | null>(null);
  const [outOfStock, setOutOfStock] = useState<number | null>(null);

  useEffect(() => {
    getProducts()
      .then((p) => {
        setProducts(p);
        setTotalProducts(p.length);
        setInStock(p.filter((x) => x.status === "IN_STOCK").length);
        setOutOfStock(p.filter((x) => x.status === "OUT_OF_STOCK").length);
      })
      .catch(() => null);
  }, []);

  // Calculate in-stock percentage for the gold progress bar
  const inStockPct =
    totalProducts && inStock != null
      ? Math.round((inStock / totalProducts) * 100)
      : 0;

  return (
    <AdminLayout>
      <div>
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="font-headline text-3xl font-bold text-on-surface">
            {t("admin.greeting")}
          </h1>
          <p className="text-sm text-secondary mt-1">{t("admin.greetingSub")}</p>
        </div>

        {/* ── 12-col bento grid ── */}
        <div className="grid grid-cols-12 gap-4 mb-10">

          {/* Main stat card — 6 cols */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-low border border-outline-variant rounded-2xl p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-1">
                  {t("admin.totalProducts")}
                </p>
                <p className="font-headline text-6xl font-black text-on-surface">
                  {totalProducts ?? "—"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
                <Package size={18} className="text-on-surface-variant" />
              </div>
            </div>
            <p className="text-sm text-secondary leading-relaxed">
              Total items in the product catalogue, across all categories and statuses.
            </p>
            <div className="flex items-center gap-2 mt-4 text-xs text-on-tertiary-container">
              <TrendingUp size={13} />
              <span>Collection growing</span>
            </div>
          </div>

          {/* In Stock card — 3 cols */}
          <div className="col-span-12 md:col-span-3 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
            <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-2">
              In Stock
            </p>
            <p className="font-headline text-4xl font-black text-on-surface mb-4">
              {inStock ?? "—"}
            </p>
            {/* Gold progress bar */}
            <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full gold-shimmer rounded-full transition-all duration-700"
                style={{ width: `${inStockPct}%` }}
              />
            </div>
            <p className="text-xs text-secondary mt-2">{inStockPct}% of catalogue</p>
          </div>

          {/* Out of Stock card — 3 cols */}
          <div className="col-span-12 md:col-span-3 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
            <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-2">
              Out of Stock
            </p>
            <p className="font-headline text-4xl font-black text-on-surface mb-4">
              {outOfStock ?? "—"}
            </p>
            <p className="text-xs text-error font-semibold">Requires Attention</p>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Items unavailable for display
            </p>
          </div>

          {/* Quick Actions card — full row, or 3 cols on large */}
          <div className="col-span-12 md:col-span-3 bg-primary rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/60 mb-2">
                Quick Actions
              </p>
              <p className="font-headline text-lg font-bold text-white leading-snug mb-6">
                Manage your catalogue
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/admin/inventory/new"
                className="gold-shimmer w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-on-tertiary-fixed hover:opacity-90 transition-opacity"
              >
                <Plus size={15} />
                {t("admin.addProduct")}
              </Link>
              <Link
                to="/admin/inventory"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white border border-white/30 hover:border-white/60 transition-colors"
              >
                {t("admin.inventory")}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Activity list — 8 cols */}
          <div className="col-span-12 md:col-span-8 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-bold text-on-surface">Recent Activity</p>
              <div className="flex items-center gap-1 text-xs text-secondary">
                <Clock size={12} />
                <span>Last 24 hours</span>
              </div>
            </div>

            <div className="space-y-0">
              {/* Show last 3 real products if available, else show mock data */}
              {products.length > 0
                ? products.slice(0, 3).map((product, idx) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-4 py-4 ${
                        idx < 2 ? "border-b border-outline-variant" : ""
                      }`}
                    >
                      {/* Icon square */}
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-on-surface-variant">
                          {product.type.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-secondary">In catalogue</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs text-secondary">—</p>
                        <p className="text-xs text-outline font-mono">{product.sku}</p>
                      </div>
                    </div>
                  ))
                : RECENT_MOCK.map((row, idx) => (
                    <div
                      key={row.sku}
                      className={`flex items-center gap-4 py-4 ${
                        idx < RECENT_MOCK.length - 1 ? "border-b border-outline-variant" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-on-surface-variant">
                          {row.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {row.name}
                        </p>
                        <p className="text-xs text-secondary">{row.note}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs text-secondary">{row.time}</p>
                        <p className="text-xs text-outline font-mono">{row.sku}</p>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          {/* Editorial panel — 4 cols */}
          <div className="col-span-12 md:col-span-4 bg-surface-container rounded-2xl overflow-hidden relative">
            {/* Image placeholder */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-400 to-zinc-600" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              <p className="text-xs font-bold tracking-widest uppercase text-tertiary-fixed mb-2">
                Analytics
              </p>
              <h3 className="font-headline text-xl font-bold text-white">
                Fabric Analytics
              </h3>
              <p className="text-xs text-white/60 mt-1">
                AI insights — coming in Step 7
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
