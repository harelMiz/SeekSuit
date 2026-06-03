import { Layers } from "lucide-react";
import { useLang } from "../../context/LanguageContext";

export interface DetectedItem {
  type: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  cropDataUrl: string;
}

interface ItemPickerModalProps {
  items: DetectedItem[];
  onSelect: (item: DetectedItem | "all") => void;
}

export default function ItemPickerModal({ items, onSelect }: ItemPickerModalProps) {
  const { t } = useLang();

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers size={16} className="text-on-tertiary-container flex-shrink-0" />
        <p className="text-sm font-semibold text-on-surface">{t("search.multipleFound")}</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {items.map((item) => (
          <button
            key={item.type}
            onClick={() => onSelect(item)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-20 h-24 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-on-tertiary-container transition-colors bg-surface-container">
              <img
                src={item.cropDataUrl}
                alt={item.label}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant group-hover:text-on-surface transition-colors">
              {t(`type.${item.type}`)}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect("all")}
        className="w-full py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant rounded-xl hover:border-on-tertiary-container hover:text-on-surface transition-colors"
      >
        {t("search.searchAll")}
      </button>
    </div>
  );
}
