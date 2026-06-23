import { Link } from "react-router-dom";
import { ImageOff, Star } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import type { Product } from "../../types/product";
import { mainImage, bestImageUrl } from "../../types/product";
import { colorDisplay } from "../../lib/colorMap";

interface ProductCardProps {
  product: Product;
  matchPercentage?: number;
  source?: "BROWSE" | "SEARCH_RESULT" | "SIMILAR";
  searchQuery?: string;
  showStatus?: boolean;
}

export default function ProductCard({ product, matchPercentage, source = "BROWSE", searchQuery, showStatus = false }: ProductCardProps) {
  const { t, lang } = useLang();
  const displayName = lang === "en" && product.attributes?.nameEn
    ? String(product.attributes.nameEn)
    : product.name;

  return (
    <Link
      to={`/products/${product.id}`}
      state={{ source, searchQuery }}
      className="group block cursor-pointer"
    >
      <article className="bg-[#1c1c1c] rounded-xl border border-white/5 hover:border-[#e9c176]/30 transition-all duration-300 shadow-xl flex flex-col overflow-hidden">

        {/* Image — edge-to-edge, no side padding */}
        <div className="relative aspect-[3/4] bg-[#111111] overflow-hidden flex-shrink-0">
          {(() => {
            const img = mainImage(product);
            const url = img ? bestImageUrl(img) : null;
            return url ? (
              <>
                <img
                  src={url}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                {/* Gradient fades image naturally into dark card background */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#1c1c1c] to-transparent pointer-events-none" />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20">
                <ImageOff size={28} />
                <span className="text-xs text-white/30">{t("product.noImage")}</span>
              </div>
            );
          })()}

          {/* AI Match badge — search results only */}
          {matchPercentage !== undefined && (
            <div className="absolute top-3 end-3">
              <span className="gold-shimmer flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-on-tertiary-fixed shadow-lg">
                <Star size={10} />
                {matchPercentage}%
              </span>
            </div>
          )}
        </div>

        {/* Text area — padded */}
        <div className="p-4 flex flex-col flex-1 justify-between gap-3">
          <div>
            {/* Type label — gold micro-text */}
            <p className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-[#e9c176]/70 mb-1.5">
              {t(`type.${product.type}`)}
            </p>

            {/* Product name */}
            <h3 className="font-headline text-base font-bold text-white/90 group-hover:text-white transition-colors leading-snug line-clamp-2">
              {displayName}
            </h3>

            {/* Color */}
            <p className="text-xs text-white/35 font-light mt-0.5">{colorDisplay(product.color, lang)}</p>
          </div>

          {/* Status — subtle dot indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              product.status === "OUT_OF_STOCK" ? "bg-red-500/60" : "bg-emerald-400/80"
            }`} />
            <span className={`text-[10px] font-medium tracking-wider uppercase ${
              product.status === "OUT_OF_STOCK" ? "text-red-400/55" : "text-emerald-400/65"
            }`}>
              {t(`status.${product.status.toLowerCase()}`)}
            </span>
          </div>
        </div>

      </article>
    </Link>
  );
}
