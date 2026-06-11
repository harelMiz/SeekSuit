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
}

export default function ProductCard({ product, matchPercentage, source = "BROWSE", searchQuery }: ProductCardProps) {
  const { t, lang } = useLang();
  const displayName = lang === "en" && product.attributes?.nameEn
    ? String(product.attributes.nameEn)
    : product.name;

  return (
    <Link
      to={`/products/${product.id}`}
      state={{ source, searchQuery }}
      className="group block"
    >
      {/* Image container */}
      <article>
        <div className="relative aspect-[3/4] bg-surface-container-low overflow-hidden rounded-xl mb-4">
          {(() => {
            const img = mainImage(product);
            const url = img ? bestImageUrl(img) : null;
            return url ? (
              <img
                src={url}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              /* No-image placeholder */
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-outline-variant">
                <ImageOff size={28} />
                <span className="text-xs text-secondary">{t("product.noImage")}</span>
              </div>
            );
          })()}

          {/* Badges — top right stack */}
          <div className="absolute top-3 end-3 flex flex-col gap-2 items-end">
            {/* Status badge */}
            <span
              className={`bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border border-outline-variant ${
                product.status === "OUT_OF_STOCK" ? "text-error" : "text-on-surface"
              }`}
            >
              {t(`status.${product.status}`)}
            </span>

            {/* AI Match badge — shown in search results */}
            {matchPercentage !== undefined && (
              <span className="gold-shimmer flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-on-tertiary-fixed">
                <Star size={10} />
                {matchPercentage}%
              </span>
            )}
          </div>
        </div>

        {/* Product info below image */}
        <div>
          {/* Type label */}
          <p className="text-[10px] font-extrabold tracking-[0.15em] uppercase text-on-tertiary-container mb-1">
            {t(`type.${product.type}`)}
          </p>

          {/* Product name */}
          <h3 className="font-headline text-lg font-bold text-on-surface group-hover:text-secondary transition-colors leading-snug line-clamp-2">
            {displayName}
          </h3>

          {/* Color */}
          <p className="text-sm text-on-surface-variant font-light mt-0.5">{colorDisplay(product.color, lang)}</p>
        </div>
      </article>
    </Link>
  );
}
