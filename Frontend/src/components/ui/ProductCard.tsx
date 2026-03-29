import { Link } from "react-router-dom";
import { ImageOff, Star } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import type { Product } from "../../types/product";

interface ProductCardProps {
  product: Product;
  matchPercentage?: number; // shown in AI search results (Step 7)
}

export default function ProductCard({ product, matchPercentage }: ProductCardProps) {
  const { t } = useLang();

  return (
    <Link
      to={`/products/${product.id}`}
      className="group block"
    >
      {/* Image container */}
      <article>
        <div className="relative aspect-[3/4] bg-surface-container-low overflow-hidden rounded-xl mb-4">
          {product.processedImageUrl ?? product.rawImageUrl ? (
            <img
              src={(product.processedImageUrl ?? product.rawImageUrl)!}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            /* No-image placeholder */
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-outline-variant">
              <ImageOff size={28} />
              <span className="text-xs text-secondary">{t("product.noImage")}</span>
            </div>
          )}

          {/* Badges — top right stack */}
          <div className="absolute top-3 end-3 flex flex-col gap-2 items-end">
            {/* Status badge */}
            <span
              className={`bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold tracking-wider border border-outline-variant ${
                product.status === "out_of_stock" ? "text-error" : "text-on-surface"
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
            {product.name}
          </h3>

          {/* Color */}
          <p className="text-sm text-on-surface-variant font-light mt-0.5">{product.color}</p>
        </div>
      </article>
    </Link>
  );
}
