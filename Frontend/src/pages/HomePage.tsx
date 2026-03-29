import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Camera, ChevronDown } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";

export default function HomePage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [showAiNote, setShowAiNote] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    // AI text search is not yet implemented — navigate to shop for now
    navigate("/shop");
  }

  function handleImageSearch() {
    // AI image search is not yet implemented
    setShowAiNote(true);
    setTimeout(() => setShowAiNote(false), 3000);
  }

  return (
    <Layout>
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        {/* Background: dark gradient placeholder (no real images yet) */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
        {/* Subtle warm overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_30%_50%,_rgba(253,220,160,0.08),_transparent)]" />

        {/* Hero content — left-aligned */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 md:px-12 pt-24 pb-16">
          {/* Eyebrow */}
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-tertiary-fixed mb-6">
            Premium Menswear
          </p>

          {/* Headline — Noto Serif */}
          <h1 className="font-headline text-5xl md:text-7xl font-black leading-[1.05] text-white max-w-2xl mb-10">
            {t("home.headline")}
            <br />
            <em className="font-light text-4xl md:text-6xl text-white/80">
              The Bespoke Edge.
            </em>
          </h1>

          {/* Search bar — glassmorphism style */}
          <form onSubmit={handleSearch} className="relative w-full max-w-xl">
            <div className="flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden transition-colors focus-within:border-white/40">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t("home.searchPlaceholder")}
                className="flex-1 bg-transparent px-5 py-4 text-sm text-white placeholder-white/50 outline-none"
              />

              {/* Image search */}
              <button
                type="button"
                onClick={handleImageSearch}
                title={t("home.imageSearch")}
                className="p-4 text-white/60 hover:text-white transition-colors border-s border-white/20"
              >
                <Camera size={18} />
              </button>

              {/* Text search — gold */}
              <button
                type="submit"
                className="gold-shimmer px-5 py-4 text-on-tertiary-fixed font-semibold text-sm flex items-center gap-2 transition-opacity hover:opacity-90"
              >
                <Search size={16} />
              </button>
            </div>

            {/* AI coming-soon tooltip */}
            {showAiNote && (
              <div className="absolute -bottom-8 start-0 end-0 text-center text-xs text-tertiary-fixed">
                {t("home.aiComingSoon")}
              </div>
            )}
          </form>

          {/* Browse catalog CTA */}
          <div className="mt-16 flex flex-col items-start gap-2 text-white/50 animate-bounce-slow">
            <span className="text-sm tracking-wide">{t("home.browseCatalog")}</span>
            <ChevronDown size={20} />
          </div>
        </div>
      </section>

      {/* ── Bento Section ── */}
      <section className="bg-surface py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-12 gap-4 auto-rows-[260px]">

            {/* Large feature card — 8 cols, 2 rows */}
            <div className="col-span-12 md:col-span-8 row-span-2 relative rounded-2xl overflow-hidden bg-surface-container group">
              {/* Image placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-600 to-zinc-800" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              {/* Text */}
              <div className="absolute bottom-0 left-0 p-8">
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-tertiary-fixed mb-2">
                  Collection
                </p>
                <h2 className="font-headline text-3xl font-bold text-white">
                  קולקציית החורף
                </h2>
              </div>
            </div>

            {/* Top-right card — 4 cols, 1 row */}
            <div className="col-span-12 md:col-span-4 rounded-2xl bg-surface-container-highest p-8 flex flex-col justify-center">
              <p className="text-xs font-bold tracking-widest uppercase text-on-tertiary-container mb-3">
                Craftsmanship
              </p>
              <h3 className="font-headline text-2xl font-bold text-on-surface leading-snug">
                Bespoke Tailoring
              </h3>
              <p className="text-sm text-secondary mt-3 leading-relaxed">
                Every suit is measured, cut, and finished to your exact form.
              </p>
            </div>

            {/* Bottom-right card — 4 cols, 1 row: image placeholder */}
            <div className="col-span-12 md:col-span-4 rounded-2xl overflow-hidden bg-surface-container-high relative">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-400 to-zinc-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <p className="text-xs text-white/80 font-medium tracking-wide">Accessories</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Experience Section ── */}
      <section className="bg-surface-container-low py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

            {/* Left: text */}
            <div>
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-on-tertiary-container mb-4">
                חוויה
              </p>
              <h2 className="font-headline text-4xl font-bold text-on-surface leading-tight mb-6">
                החוויה של ג&#39;נודי
              </h2>
              <p className="text-base text-secondary leading-relaxed mb-8">
                {t("about.description")}
              </p>

              {/* Pill badges */}
              <div className="flex flex-wrap gap-3">
                <span className="bg-surface-container-highest text-on-surface-variant text-xs font-semibold px-4 py-2 rounded-full border border-outline-variant">
                  100% Wool Super 150s
                </span>
                <span className="bg-surface-container-highest text-on-surface-variant text-xs font-semibold px-4 py-2 rounded-full border border-outline-variant">
                  Custom Measurements
                </span>
              </div>
            </div>

            {/* Right: two image placeholders */}
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-zinc-300 to-zinc-400" />
              <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-zinc-400 to-zinc-500 mt-8" />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
