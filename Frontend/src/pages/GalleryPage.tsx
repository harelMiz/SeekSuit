import { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useLang } from "../context/LanguageContext";
import api from "../services/api";

interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  order: number;
}

export default function GalleryPage() {
  const { t } = useLang();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<GalleryImage[]>("/gallery")
      .then((res) => setImages(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="bg-surface min-h-screen">

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-28 pb-16">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-on-tertiary-container mb-4">
            {t("gallery.tagline")}
          </p>
          <h1 className="font-headline text-5xl md:text-6xl font-black text-on-surface leading-[1.05] mb-4">
            {t("gallery.title")}
          </h1>
          <p className="text-lg text-on-surface-variant max-w-xl">
            {t("gallery.subtitle")}
          </p>
        </section>

        {/* Content */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          {loading && (
            <p className="text-center text-on-surface-variant py-16">
              {t("gallery.loading")}
            </p>
          )}

          {!loading && error && (
            <p className="text-center text-error py-16">{t("gallery.error")}</p>
          )}

          {!loading && !error && images.length === 0 && (
            <p className="text-center text-on-surface-variant py-16">
              {t("gallery.empty")}
            </p>
          )}

          {!loading && !error && images.length > 0 && (
            <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="relative break-inside-avoid group overflow-hidden rounded-2xl shadow-sm"
                >
                  <img
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  {img.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-white text-sm font-medium">{img.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}
