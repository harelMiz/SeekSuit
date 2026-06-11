import { useState, useEffect } from "react";
import {
  Package, TrendingUp, Plus, ArrowRight, Clock, Search,
  ImageOff, Upload, Zap, Loader2, ChevronRight, Sparkles, ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import InsightsPanel from "../../components/admin/InsightsPanel";
import ChatSidebar from "../../components/admin/ChatSidebar";
import SearchHistoryModal from "../../components/admin/SearchHistoryModal";
import { fetchStats, fetchTopProducts, type DashboardStats, type TopProduct } from "../../services/insights.service";
import { getProducts, processAllUnprocessed } from "../../services/product.service";
import { mainImage, bestImageUrl } from "../../types/product";
import type { Product } from "../../types/product";

const RECENT_MOCK_DATA = [
  { num: 1, name: "Classic Wool Jacket", noteKey: "admin.addedToInventory", sku: "JKT-001" },
  { num: 2, name: "Slim Fit Trousers", noteKey: "admin.statusUpdated", sku: "PNT-004" },
  { num: 3, name: "Oxford Dress Shirt", noteKey: "admin.addedToInventory", sku: "SHT-012" },
  { num: 4, name: "Silk Vest", noteKey: "admin.inCatalogue", sku: "VST-007" },
  { num: 5, name: "Leather Belt", noteKey: "admin.inCatalogue", sku: "BLT-002" },
  { num: 6, name: "Slim Bow Tie", noteKey: "admin.inCatalogue", sku: "TIE-003" },
];

const BTN_PRIMARY   = "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold gold-shimmer text-on-tertiary-fixed hover:opacity-90 transition-opacity cursor-pointer w-full";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-outline-variant text-on-surface hover:border-primary hover:text-primary transition-colors cursor-pointer w-full";

function Sparkline() {
  return (
    <svg viewBox="0 0 300 64" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9c176" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e9c176" stopOpacity="0" />
        </linearGradient>
        <filter id="sparkGlow" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M0,58 C20,55 40,52 65,47 C90,42 110,38 140,31 C170,24 195,18 225,12 C255,7 275,4 300,2 L300,64 L0,64 Z" fill="url(#sparkGrad)" />
      <path d="M0,58 C20,55 40,52 65,47 C90,42 110,38 140,31 C170,24 195,18 225,12 C255,7 275,4 300,2" fill="none" stroke="#e9c176" strokeWidth="1.8" filter="url(#sparkGlow)" />
      <circle cx="300" cy="2" r="3" fill="#e9c176" filter="url(#sparkGlow)" />
    </svg>
  );
}

export default function AdminDashboardPage() {
  const { t } = useLang();
  const [products, setProducts]           = useState<Product[]>([]);
  const [topProducts, setTopProducts]     = useState<TopProduct[]>([]);
  const [topProductsLoaded, setTopProductsLoaded] = useState(false);
  const [stats, setStats]                 = useState<DashboardStats | null>(null);
  const [chatOpen, setChatOpen]           = useState(false);
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);
  const [processAllResult, setProcessAllResult]   = useState<string | null>(null);
  const [carouselOffset, setCarouselOffset] = useState(0);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => null);
    getProducts().then(setProducts).catch(() => null);
    fetchTopProducts(8)
      .then(data => { setTopProducts(data); setTopProductsLoaded(true); })
      .catch(() => setTopProductsLoaded(true));
  }, []);

  const inStockPct = stats && stats.totalProducts > 0
    ? Math.round((stats.inStock / stats.totalProducts) * 100) : 0;
  const donutDash = `${inStockPct * 2.387} 238.7`;

  async function handleProcessAll() {
    setProcessingAll(true);
    setProcessAllResult(null);
    try {
      const result = await processAllUnprocessed();
      setProcessAllResult(`${result.queued} ${t("admin.imagesQueued")}`);
      setTimeout(() => setProcessAllResult(null), 4000);
    } catch {
      setProcessAllResult(t("admin.failedToQueue"));
      setTimeout(() => setProcessAllResult(null), 4000);
    } finally {
      setProcessingAll(false);
    }
  }

  const productsWithImages = products.filter(p => { const img = mainImage(p); return img && bestImageUrl(img); });

  const carouselItems: { id: string; name: string; imageUrl: string }[] =
    topProducts.length > 0
      ? topProducts.map(p => ({ id: p.id, name: p.name, imageUrl: p.imageUrl }))
      : topProductsLoaded
        ? productsWithImages.slice(0, 8).map(p => {
            const img = mainImage(p);
            return { id: p.id, name: p.name, imageUrl: bestImageUrl(img!) ?? "" };
          }).filter(p => p.imageUrl)
        : [];

  const CAROUSEL_VISIBLE = 4;
  const canPrev = carouselOffset > 0;
  const canNext = carouselOffset + CAROUSEL_VISIBLE < carouselItems.length;

  const activityRows = products.length > 0
    ? products.slice(0, 6).map((p, i) => ({ num: i + 1, name: p.name, note: t("admin.inCatalogue"), sku: p.sku }))
    : RECENT_MOCK_DATA.map(m => ({ ...m, note: t(m.noteKey) }));

  return (
    <AdminLayout>
      <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
      <SearchHistoryModal open={searchHistoryOpen} onClose={() => setSearchHistoryOpen(false)} />

      <div className="flex flex-col gap-4">

        {/* ── Greeting ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-on-surface">{t("admin.greeting")}</h1>
            <p className="text-sm text-secondary mt-1">{t("admin.greetingSub")}</p>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-surface-container-high border border-outline-variant hover:border-primary/60 transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl gold-shimmer flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-on-tertiary-fixed" />
            </div>
            <div className="text-start">
              <p className="text-sm font-bold text-on-surface">{t("insights.chatOpen")}</p>
              <p className="text-xs text-secondary">{t("admin.aiBusinessAgent")}</p>
            </div>
            <ChevronRight size={14} className="text-secondary group-hover:text-primary transition-colors ml-1" />
          </button>
        </div>

        {/* ══ ROW 1 ══
            RTL visual order (right→left): Stock Status | Product Items | Searches/Upload/Missing
            JSX order (first=visual-right in RTL): Stock | Products | Searches            */}
        <div className="grid grid-cols-12 gap-4 items-stretch">

          {/* [visual RIGHT] col-4: Stock Status — fills card with justify-between */}
          <div className="col-span-12 md:col-span-4 bg-surface-container-low border border-outline-variant rounded-2xl p-6 flex flex-col justify-between">
            <p className="text-xs font-bold tracking-widest uppercase text-secondary">{t("admin.stockStatus")}</p>

            {/* Donut centred */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-36 h-36 mb-5">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="9" className="text-outline-variant" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#e9c176" strokeWidth="9"
                    strokeLinecap="round" strokeDasharray={donutDash} className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-headline text-3xl font-black text-on-surface leading-none">{inStockPct}%</p>
                  <p className="text-[9px] text-secondary mt-0.5">{t("admin.inStockPct")}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="font-headline text-4xl font-black text-on-surface">{stats?.inStock ?? "—"}</p>
                  <p className="text-xs text-secondary mt-1">{t("status.in_stock")}</p>
                </div>
                <div className="w-px h-10 bg-outline-variant" />
                <div className="text-center">
                  <p className={`font-headline text-4xl font-black ${stats?.outOfStock ? "text-error" : "text-on-surface"}`}>
                    {stats?.outOfStock ?? "—"}
                  </p>
                  <p className="text-xs text-secondary mt-1">{t("status.out_of_stock")}</p>
                </div>
              </div>
            </div>

            {/* Progress bar at bottom */}
            <div>
              <div className="h-1.5 rounded-full bg-outline-variant overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${inStockPct}%`, background: "#e9c176" }} />
              </div>
              <p className="text-xs text-secondary text-center">{t("admin.catalogueOfStock")} {inStockPct}%</p>
            </div>
          </div>

          {/* [visual MIDDLE] col-5: Product Items + Sparkline */}
          <div className="col-span-12 md:col-span-5 bg-surface-container-low border border-outline-variant rounded-2xl p-8 flex flex-col justify-between overflow-hidden">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-2">{t("admin.productItems")}</p>
              <p className="font-headline text-7xl font-black text-on-surface leading-none mb-3">{stats?.totalProducts ?? "—"}</p>
              <p className="text-sm text-secondary leading-relaxed max-w-xs">
                {t("admin.productItemsSub")}
              </p>
            </div>
            <div className="h-16 mt-5 -mx-2"><Sparkline /></div>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-on-tertiary-container">
              <TrendingUp size={12} /><span>{t("admin.collectionGrowing")}</span><ArrowRight size={11} />
            </div>
          </div>

          {/* [visual LEFT] col-3: Searches + Upload Queue + Missing Images */}
          <div className="col-span-12 md:col-span-3 flex flex-col gap-3">

            <button
              onClick={() => setSearchHistoryOpen(true)}
              className="flex-1 bg-surface-container-low border border-outline-variant rounded-2xl p-5 text-start hover:border-primary transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold tracking-widest uppercase text-secondary">{t("insights.searchesToday")}</p>
                <Search size={13} className="text-on-surface-variant group-hover:text-primary transition-colors" />
              </div>
              <p className="font-headline text-4xl font-black text-on-surface mb-1">{stats?.searchesToday ?? "—"}</p>
              <p className="text-xs text-secondary">{t("admin.searchesSub")}</p>
            </button>

            <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold tracking-widest uppercase text-secondary">{t("admin.uploadQueue")}</p>
                  <Upload size={13} className="text-on-surface-variant" />
                </div>
                <p className="font-headline text-4xl font-black text-on-surface mb-1">{stats != null ? stats.uploadsTotal : "—"}</p>
                <div className="space-y-1 mt-2 text-xs text-secondary">
                  <div className="flex justify-between">
                    <span>{t("admin.processed")}</span>
                    <span className="font-semibold text-on-surface">{stats?.uploadsProcessed ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("admin.processing")}</span>
                    <span className={`font-semibold ${stats?.uploadsProcessing ? "text-on-tertiary-container" : "text-on-surface"}`}>{stats?.uploadsProcessing ?? "—"}</span>
                  </div>
                </div>
              </div>
              <Link to="/admin/uploads" className={`${BTN_SECONDARY} mt-3`}>
                <Upload size={11} />{t("admin.viewUploads")}
              </Link>
            </div>

            <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold tracking-widest uppercase text-secondary">{t("insights.missingImages")}</p>
                  <ImageOff size={13} className="text-on-surface-variant" />
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className={`font-headline text-4xl font-black ${stats?.missingImages ? "text-error" : "text-on-surface"}`}>{stats?.missingImages ?? "—"}</p>
                  <span className="text-sm text-secondary">{t("admin.products")}</span>
                </div>
                <p className="text-xs text-secondary">
                  <span className={`font-bold ${stats?.totalMissingProcessedImages ? "text-error" : "text-on-surface"}`}>{stats?.totalMissingProcessedImages ?? "—"}</span>{" "}{t("admin.imagesMissing")}
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleProcessAll}
                  disabled={processingAll || !stats?.totalMissingProcessedImages}
                  className={`${BTN_PRIMARY} flex-1 disabled:opacity-40`}
                  style={{ fontSize: "12px", padding: "8px 10px" }}
                >
                  {processingAll ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                  {t("admin.processAll")}
                </button>
                <Link to="/admin/inventory?filter=missing-images" className={`${BTN_SECONDARY} flex-1`}>
                  {t("admin.viewProducts")}
                </Link>
              </div>
              {processAllResult && <p className="text-xs text-on-tertiary-container font-semibold text-center mt-2">{processAllResult}</p>}
            </div>

          </div>
        </div>

        {/* ══ ROW 2 ══
            RTL visual order: Quick Actions (left) | AI Insights (right, wide)
            JSX order (first=visual-right in RTL): Insights | Quick Actions              */}
        <div className="grid grid-cols-12 gap-4 items-stretch">

          {/* [visual RIGHT] col-9: AI Insights — min-h for taller row */}
          <InsightsPanel className="col-span-12 md:col-span-9" />

          {/* [visual LEFT] col-3: Quick Actions — same min-h */}
          <div className="col-span-12 md:col-span-3 bg-zinc-900 rounded-2xl p-6 flex flex-col justify-between min-h-[260px]">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-white/50 mb-1">{t("admin.quickActions")}</p>
              <p className="font-headline text-lg font-bold text-white leading-snug mb-2">{t("admin.quickActionsSub")}</p>
            </div>
            <div className="space-y-3">
              <Link to="/admin/inventory/new" className={BTN_PRIMARY}>
                <Plus size={14} />{t("admin.addProduct")}
              </Link>
              <Link to="/admin/inventory" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/25 hover:border-white/60 transition-colors cursor-pointer w-full">
                {t("admin.inventory")}<ArrowRight size={13} />
              </Link>
            </div>
          </div>

        </div>

        {/* ══ ROW 3: [col-6 Top Products] | [col-6 Recent Activity] — same JSX order ══
            In RTL: first item = visual right. Top Products on RIGHT, Activity on LEFT.
            If user wants them swapped after seeing, easy to flip.                        */}
        <div className="grid grid-cols-12 gap-4 items-stretch">

          {/* col-6: Recent Activity — visual RIGHT in RTL */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold text-on-surface">{t("admin.recentActivity")}</p>
              <div className="flex items-center gap-1.5 text-xs text-secondary">
                <Clock size={12} /><span>{t("admin.last24hrs")}</span>
              </div>
            </div>
            <div className="space-y-0">
              {activityRows.map((row, idx) => (
                <div key={row.sku ?? idx} className={`flex items-center gap-3 py-3 ${idx < activityRows.length - 1 ? "border-b border-outline-variant" : ""}`}>
                  <span className="text-xs text-secondary font-mono w-4 shrink-0">{row.num}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{row.name}</p>
                    <p className="text-xs text-secondary">{row.note}</p>
                  </div>
                  <p className="text-xs text-outline font-mono shrink-0">{row.sku}</p>
                </div>
              ))}
            </div>
          </div>

          {/* col-6: Top Products — visual LEFT in RTL */}
          <div className="col-span-12 md:col-span-6 bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-on-tertiary-container">{t("admin.trending")}</p>
                <h3 className="font-headline text-xl font-bold text-on-surface">{t("admin.topProducts")}</h3>
                <p className="text-xs text-secondary mt-0.5">{t("admin.topProductsSub")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCarouselOffset(o => Math.max(0, o - 1))} disabled={!canPrev}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center text-secondary hover:text-on-surface transition-colors disabled:opacity-30 cursor-pointer">
                  <ChevronLeft size={13} />
                </button>
                <button onClick={() => setCarouselOffset(o => Math.min(Math.max(0, carouselItems.length - CAROUSEL_VISIBLE), o + 1))} disabled={!canNext}
                  className="w-7 h-7 rounded-lg border border-outline-variant flex items-center justify-center text-secondary hover:text-on-surface transition-colors disabled:opacity-30 cursor-pointer">
                  <ChevronRight size={13} />
                </button>
                <Link to="/admin/inventory" className="text-xs text-secondary hover:text-primary transition-colors ml-1">{t("admin.viewAll")} →</Link>
              </div>
            </div>
            <div className="px-6 pb-6 flex-1">
              {!topProductsLoaded ? (
                <div className="flex gap-3 h-36">
                  {[1, 2, 3, 4].map(i => <div key={i} className="flex-1 rounded-xl bg-surface-container-high animate-pulse" />)}
                </div>
              ) : carouselItems.length > 0 ? (
                <div className="overflow-hidden">
                  <div className="flex gap-3 transition-transform duration-300" style={{ transform: `translateX(-${carouselOffset * 118}px)` }}>
                    {carouselItems.map(p => (
                      <Link key={p.id} to={`/products/${p.id}`} state={{ source: "BROWSE" }}
                        className="shrink-0 w-[106px] h-[140px] rounded-xl overflow-hidden border border-outline-variant hover:border-primary transition-colors group cursor-pointer relative">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Package size={16} className="text-white" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-36 flex items-center justify-center text-secondary text-sm">{t("admin.noProductsWithImages")}</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}
