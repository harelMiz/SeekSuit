import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Info } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { fetchAutoInsights, type InsightBilingual } from "../../services/insights.service";

const TYPE_CONFIG = {
  warning: {
    icon: AlertTriangle,
    border: "border-error/40",
    bg: "bg-error/5",
    iconClass: "text-error",
  },
  opportunity: {
    icon: TrendingUp,
    border: "border-tertiary/40",
    bg: "bg-tertiary/5",
    iconClass: "text-tertiary",
  },
  info: {
    icon: Info,
    border: "border-primary/30",
    bg: "bg-primary/5",
    iconClass: "text-primary",
  },
};

const CACHE_KEY = "seeksuit_insights_cache";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function readCache(): { data: InsightBilingual[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.data && parsed?.ts) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCache(data: InsightBilingual[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
}

function formatAgo(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  return `${h}h ago`;
}

export default function InsightsPanel({ className = "col-span-12", narrow = false }: { className?: string; narrow?: boolean }) {
  const { t, lang } = useLang();
  const [insights, setInsights] = useState<InsightBilingual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTs, setCacheTs] = useState<number | null>(null);

  const load = (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setInsights(cached.data);
        setCacheTs(cached.ts);
        setError(null);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    fetchAutoInsights()
      .then(data => {
        setInsights(data);
        setError(null);
        setCacheTs(Date.now());
        writeCache(data);
      })
      .catch((err) => {
        const msg: string = err?.response?.data?.error ?? err?.message ?? t("insights.error");
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={`${className} bg-surface-container-low border border-outline-variant rounded-2xl p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <p className="text-sm font-bold text-on-surface">{t("insights.title")}</p>
          {cacheTs && !loading && !error && (
            <span className="text-xs text-secondary ml-1">· {formatAgo(cacheTs)}</span>
          )}
        </div>
        {!loading && (
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1.5 text-xs text-secondary hover:text-on-surface transition-colors"
          >
            <RefreshCw size={12} />
            {t("insights.retry")}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-6 text-secondary">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t("insights.loading")}</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="py-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-error font-semibold">{t("insights.error")}</p>
            <p className="text-xs text-secondary mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && (
        <div className={narrow ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"}>
          {insights.map((insight, i) => {
            const cfg = TYPE_CONFIG[insight.type];
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={`border rounded-xl p-4 ${cfg.border} ${cfg.bg}`}
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <Icon size={14} className={`mt-0.5 shrink-0 ${cfg.iconClass}`} />
                  <p className="text-sm font-semibold text-on-surface leading-snug">
                    {lang === "he" ? insight.title.he : insight.title.en}
                  </p>
                </div>
                <p className="text-xs text-secondary leading-relaxed pl-5">
                  {lang === "he" ? insight.body.he : insight.body.en}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
