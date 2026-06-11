import { MapPin, Phone, Clock } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";

const HOURS = [
  { dayKey: "about.sun", time: "10:00–19:00" },
  { dayKey: "about.mon", time: "10:00–19:00" },
  { dayKey: "about.tue", time: "10:00–19:00" },
  { dayKey: "about.wed", time: "10:00–19:00" },
  { dayKey: "about.thu", time: "10:00–19:00" },
  { dayKey: "about.fri", time: "10:00–14:30" },
  { dayKey: "about.sat", time: null }, // closed
];

export default function AboutPage() {
  const { t } = useLang();

  return (
    <Layout>
      <div className="bg-surface min-h-screen">

        {/* ── Asymmetric Hero ── */}
        <section className="max-w-7xl mx-auto px-6 pt-28 pb-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-on-tertiary-container mb-4">
              {t("about.tagline")}
            </p>
            <h1 className="font-headline text-5xl md:text-6xl font-black text-on-surface leading-[1.05] mb-6">
              {t("about.title")}
            </h1>
            <p className="text-base text-secondary leading-relaxed max-w-lg">
              {t("about.description")}
            </p>
          </div>

          {/* Image placeholder */}
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-300 to-zinc-400 overflow-hidden" />
        </section>

        {/* ── Bento Grid ── */}
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Story card */}
            <div className="bg-surface-container-low rounded-2xl p-10">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-on-tertiary-container mb-4">
                {t("about.story.tag")}
              </p>
              <h2 className="font-headline text-3xl font-bold text-on-surface leading-snug mb-4">
                {t("about.story.title")}
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                {t("about.story.body")}
              </p>
            </div>

            {/* Promise card */}
            <div className="bg-primary-container rounded-2xl p-10">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-tertiary-fixed mb-4">
                {t("about.promise.tag")}
              </p>
              <h2 className="font-headline text-3xl font-bold text-white leading-snug mb-4">
                {t("about.promise.title")}
              </h2>
              <p className="text-sm text-white/70 leading-relaxed">
                {t("about.promise.body")}
              </p>
            </div>
          </div>
        </section>

        {/* ── Contact & Hours ── */}
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Card 1: Visit */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-10">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-on-tertiary-container mb-6">
                {t("about.visit.tag")}
              </p>
              <h2 className="font-headline text-2xl font-bold text-on-surface mb-8">
                {t("about.visit.title")}
              </h2>

              <div className="space-y-5 mb-10">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-on-tertiary-container" />
                  </div>
                  <div>
                    <p className="text-xs text-secondary mb-0.5">{t("about.address")}</p>
                    <p className="text-sm font-semibold text-on-surface">{t("about.addressLine1")}</p>
                    <p className="text-sm text-on-surface">{t("about.addressLine2")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-on-tertiary-container" />
                  </div>
                  <div>
                    <p className="text-xs text-secondary mb-0.5">{t("about.phone")}</p>
                    <a
                      href="tel:036887788"
                      className="text-sm font-semibold text-on-surface hover:text-on-tertiary-container transition-colors"
                    >
                      03-688-7788
                    </a>
                  </div>
                </div>
              </div>

              <a
                href="tel:036887788"
                className="gold-shimmer inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-on-tertiary-fixed hover:opacity-90 transition-opacity"
              >
                <Phone size={14} />
                {t("about.bookAppointment")}
              </a>
            </div>

            {/* Card 2: Operating Hours */}
            <div className="bg-surface-container-low rounded-2xl p-10">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-on-tertiary-container mb-6">
                {t("about.hours.tag")}
              </p>
              <div className="flex items-center gap-3 mb-8">
                <Clock size={18} className="text-on-tertiary-container" />
                <h2 className="font-headline text-2xl font-bold text-on-surface">
                  {t("about.hours")}
                </h2>
              </div>

              <div className="space-y-0">
                {HOURS.map(({ dayKey, time }, idx) => (
                  <div
                    key={dayKey}
                    className={`flex justify-between py-3 text-sm ${
                      idx < HOURS.length - 1 ? "border-b border-outline-variant" : ""
                    }`}
                  >
                    <span className="text-on-surface-variant">{t(dayKey)}</span>
                    <span className={time ? "text-on-surface font-medium" : "text-outline"}>
                      {time ?? t("about.closed")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
