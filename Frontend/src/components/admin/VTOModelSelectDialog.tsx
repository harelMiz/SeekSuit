import { useState, useEffect } from "react";
import { X, Users, Loader2, CheckSquare, Square, ImageOff } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { listVTOModelFolders, type VTOModelFolder } from "../../services/vtoModels.service";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedModels: string[]) => void;
}

export default function VTOModelSelectDialog({ open, onClose, onConfirm }: Props) {
  const { t } = useLang();
  const [folders, setFolders]   = useState<VTOModelFolder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listVTOModelFolders()
      .then((data) => {
        setFolders(data);
        // Default: all selected
        setSelected(new Set(data.map((f) => f.name)));
      })
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const allSelected = folders.length > 0 && selected.size === folders.length;

  function toggleFolder(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(folders.map((f) => f.name)));
    }
  }

  function handleConfirm() {
    onConfirm([...selected]);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-surface rounded-2xl border border-outline-variant shadow-2xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="relative overflow-hidden px-6 py-5 border-b border-outline-variant shrink-0 rounded-t-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-zinc-800" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_0%_50%,_rgba(212,175,55,0.12),_transparent)]" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/20 border border-tertiary-fixed/30 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-tertiary-fixed" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t("admin.vto.selectModels.title")}</p>
                  <p className="text-xs text-white/50">{t("admin.vto.selectModels.subtitle")}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-on-surface-variant text-sm">
                <Loader2 size={16} className="animate-spin" />
                {t("admin.vto.selectModels.loading")}
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant text-sm text-center">
                <ImageOff size={32} className="opacity-30" />
                {t("admin.vto.selectModels.noModels")}
              </div>
            ) : (
              <div className="space-y-2">
                {folders.map((folder) => {
                  const checked = selected.has(folder.name);
                  const thumb = folder.photos[0]?.url;
                  return (
                    <button
                      key={folder.name}
                      onClick={() => toggleFolder(folder.name)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer text-left ${
                        checked
                          ? "border-tertiary-fixed/40 bg-tertiary-fixed/10"
                          : "border-outline-variant bg-surface-variant/30 hover:bg-surface-variant/60"
                      }`}
                    >
                      {/* Checkbox icon */}
                      <div className={`shrink-0 ${checked ? "text-tertiary-fixed" : "text-on-surface-variant"}`}>
                        {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>

                      {/* Thumbnail */}
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={folder.name}
                          className="w-10 aspect-[3/4] rounded-lg object-cover shrink-0 border border-outline-variant"
                        />
                      ) : (
                        <div className="w-10 aspect-[3/4] rounded-lg border border-outline-variant bg-surface-variant flex items-center justify-center shrink-0">
                          <ImageOff size={12} className="text-on-surface-variant opacity-50" />
                        </div>
                      )}

                      {/* Name + count */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{folder.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {folder.photos.length} {t("admin.vto.selectModels.photos")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && folders.length > 0 && (
            <div className="px-4 py-4 border-t border-outline-variant shrink-0 flex items-center justify-between gap-3">
              <button
                onClick={toggleAll}
                className="text-xs text-on-surface-variant hover:text-on-surface underline cursor-pointer transition-colors"
              >
                {allSelected ? t("admin.vto.selectModels.deselectAll") : t("admin.vto.selectModels.selectAll")}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold gold-shimmer text-on-tertiary-fixed hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                >
                  {t("admin.vto.selectModels.confirm")} ({selected.size})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
