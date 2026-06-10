import { useState, useEffect } from "react";
import { X, Search, Image, Clock } from "lucide-react";
import { fetchSearchHistory, type SearchLogEntry } from "../../services/insights.service";

interface SearchHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("he-IL");
}

function queryLabel(entry: SearchLogEntry): string {
  if (entry.queryType === "TEXT" && entry.query) return entry.query;
  if (entry.queryType === "IMAGE") {
    return entry.detectedColor ? `Image — ${entry.detectedColor}` : "Image search";
  }
  return "—";
}

const TYPE_COLOR: Record<string, string> = {
  TEXT: "text-primary bg-primary/10",
  IMAGE: "text-tertiary bg-tertiary/10",
};

export default function SearchHistoryModal({ open, onClose }: SearchHistoryModalProps) {
  const [logs, setLogs] = useState<SearchLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSearchHistory(100)
      .then(data => setLogs(data.filter(e => e.queryType !== "DETECT")))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open]);

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
                <p className="text-sm font-bold text-white">Search History</p>
                {!loading && (
                  <p className="text-xs text-white/50">
                    {textCount} text · {imageCount} image
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20 text-secondary text-sm">
              Loading...
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-secondary">
              <Search size={32} className="opacity-30" />
              <p className="text-sm">No searches yet</p>
            </div>
          )}

          {!loading && logs.map((entry) => {
            const Icon = entry.queryType === "IMAGE" ? Image : Search;
            const colorCls = TYPE_COLOR[entry.queryType] ?? TYPE_COLOR.TEXT;
            const noResults = entry.resultCount === 0;

            return (
              <div key={entry.id} className="flex items-center gap-4 px-6 py-4 border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors">
                {/* Type icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorCls}`}>
                  <Icon size={15} />
                </div>

                {/* Query */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {queryLabel(entry)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-semibold ${noResults ? "text-error" : "text-secondary"}`}>
                      {noResults ? "No results" : `${entry.resultCount} results`}
                    </span>
                    {entry.detectedColor && entry.queryType === "TEXT" && (
                      <span className="text-xs text-secondary">· {entry.detectedColor}</span>
                    )}
                  </div>
                </div>

                {/* Time */}
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
