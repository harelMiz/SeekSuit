import { useState } from "react";
import { X, Palette } from "lucide-react";
import { useColors } from "../../context/ColorContext";
import { useLang } from "../../context/LanguageContext";


interface AddColorModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (key: string) => void;
}

function toKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

export default function AddColorModal({ open, onClose, onAdded }: AddColorModalProps) {
  const { addCustomColor } = useColors();
  const { t } = useLang();
  const [labelEn, setLabelEn] = useState("");
  const [labelHe, setLabelHe] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const key = toKey(labelEn);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !labelHe || !labelEn) return;
    setSaving(true);
    setError("");
    try {
      const color = await addCustomColor({ key, labelHe, labelEn, hex: "#888888" });
      setLabelEn("");
      setLabelHe("");
      onAdded(color.key);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t("addColor.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-2 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-outline-variant shadow-2xl w-full max-w-sm">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-on-tertiary-container" />
              <span className="text-sm font-bold text-on-surface">{t("addColor.title")}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-secondary cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Hebrew label */}
            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">{t("addColor.labelHe")}</label>
              <input
                type="text"
                required
                placeholder={t("addColor.placeholderHe")}
                value={labelHe}
                onChange={(e) => setLabelHe(e.target.value)}
                dir="rtl"
                className={inputClass}
                autoComplete="off"
              />
            </div>

            {/* English name → auto key */}
            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">{t("addColor.labelEn")}</label>
              <input
                type="text"
                required
                placeholder={t("addColor.placeholderEn")}
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                className={inputClass}
                autoComplete="off"
              />
              {key && (
                <p className="text-[10px] text-secondary mt-1">
                  {t("addColor.keyPrefix")} <span className="font-mono text-on-tertiary-container">{key}</span>
                </p>
              )}
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !key || !labelHe || !labelEn}
                className="flex-1 gold-shimmer text-on-tertiary-fixed text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {saving ? t("addColor.saving") : t("addColor.submit")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-outline-variant text-on-surface-variant hover:text-on-surface text-sm rounded-xl transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
