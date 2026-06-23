import { useState, useEffect } from "react";
import { X, Search, Camera, Clock } from "lucide-react";
import { fetchSearchHistory, type SearchLogEntry } from "../../services/insights.service";
import { colorLabel } from "../../lib/colorMap";

interface SearchHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

const PERIODS: { label: string; days: number }[] = [
  { label: "יום", days: 1 },
  { label: "שבוע", days: 7 },
  { label: "חודש", days: 30 },
  { label: "6 חודשים", days: 180 },
  { label: "שנה", days: 365 },
  { label: "הכל", days: 0 },
];

const TYPE_LABELS: Record<string, string> = {
  JACKET: "ג'קט",
  PANTS: "מכנסיים",
  SHIRT: "חולצה",
  VEST: "וסט",
  SHOES: "נעליים",
  TIE: "עניבה",
  BOW_TIE: "פפיון",
  BELT: "חגורה",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  if (diffH < 24) return `לפני ${diffH} שע׳`;
  if (diffD < 7) return `לפני ${diffD} ימים`;
  return d.toLocaleDateString("he-IL");
}

function queryLabel(entry: SearchLogEntry): string {
  if (entry.queryType === "TEXT" && entry.query) return entry.query;
  if (entry.queryType === "IMAGE") {
    const parts: string[] = [];
    if (entry.detectedType) parts.push(TYPE_LABELS[entry.detectedType] ?? entry.detectedType);
    if (entry.detectedColor) parts.push(colorLabel(entry.detectedColor));
    return parts.length > 0 ? `חיפוש תמונה — ${parts.join(" / ")}` : "חיפוש תמונה";
  }
  return "—";
}

export default function SearchHistoryModal({ open, onClose }: SearchHistoryModalProps) {
  const [logs, setLogs] = useState<SearchLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError(null);
    fetchSearchHistory(days)
      .then(data => {
        console.log("[SearchHistory] fetched:", data.length, "entries, days:", days);
        setLogs(data.filter(e => e.queryType !== "DETECT"));
      })
      .catch((err) => {
        const msg = err?.response?.data?.error ?? err?.message ?? "Unknown error";
        console.error("[SearchHistory] fetch failed:", err?.response?.status, msg);
        setFetchError(`${err?.response?.status ?? "ERR"}: ${msg}`);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [open, days]);

  if (!open) return null;

  const textCount = logs.filter(e => e.queryType === "TEXT").length;
  const imageCount = logs.filter(e => e.queryType === "IMAGE").length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-surface border-l border-outline-variant z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5 border-b border-outline-variant shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-zinc-800" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_50%,_rgba(100,160,255,0.08),_transparent)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Search size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">היסטוריית חיפושים</p>
                {!loading && (
                  <p className="text-xs text-white/50">
                    {textCount} טקסט · {imageCount} תמונה
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="px-6 py-3 border-b border-outline-variant/50 shrink-0 flex items-center gap-2 flex-wrap">
          {PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                days === d
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "text-secondary hover:text-on-surface border border-transparent hover:border-outline-variant"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20 text-secondary text-sm">
              טוען...
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-400">
              <X size={32} className="opacity-50" />
              <p className="text-sm font-mono">{fetchError}</p>
            </div>
          )}

          {!loading && !fetchError && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-secondary">
              <Search size={32} className="opacity-30" />
              <p className="text-sm">אין חיפושים בתקופה זו</p>
            </div>
          )}

          {!loading && logs.map((entry) => {
            const isImage = entry.queryType === "IMAGE";
            const Icon = isImage ? Camera : Search;
            const iconCls = isImage
              ? "text-amber-400 bg-amber-400/10"
              : "text-blue-400 bg-blue-400/10";
            const noResults = entry.resultCount === 0;

            return (
              <div key={entry.id} className="flex items-center gap-4 px-6 py-4 border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
                  <Icon size={15} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {queryLabel(entry)}
                  </p>
                  <span className={`text-xs font-semibold ${noResults ? "text-error" : "text-secondary"}`}>
                    {noResults ? "אין תוצאות" : `${entry.resultCount} תוצאות`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-secondary shrink-0">
                  <Clock size={11} />
                  {formatTime(entry.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
