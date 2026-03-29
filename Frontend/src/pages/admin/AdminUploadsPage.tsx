import { Upload, CheckSquare, CloudOff } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";

// AI processing steps shown on the upload card
const PROCESSING_STEPS = [
  "Background Removal",
  "Lighting Enhancement",
  "Auto-Centering",
  "Color Correction",
];

export default function AdminUploadsPage() {
  const { t } = useLang();

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-1">
            AI Processing
          </p>
          <h1 className="font-headline text-3xl font-bold text-on-surface">
            {t("admin.uploadTitle")}
          </h1>
          <p className="text-sm text-secondary mt-1">{t("admin.uploadSub")}</p>
        </div>
        <div className="flex gap-3">
          <button
            disabled
            className="text-sm text-secondary border border-outline-variant px-4 py-2.5 rounded-xl cursor-not-allowed opacity-50"
          >
            {t("admin.reviewAll")}
          </button>
          <button
            disabled
            className="text-sm gold-shimmer text-on-tertiary-fixed px-4 py-2.5 rounded-xl cursor-not-allowed opacity-50"
          >
            {t("admin.publishCatalog")}
          </button>
        </div>
      </div>

      {/* Drop zone — disabled, will be enabled in Step 6 */}
      <div className="bg-surface-container-low border-2 border-dashed border-outline-variant rounded-2xl p-20 flex flex-col items-center gap-5 text-center mb-8 opacity-60 cursor-not-allowed">
        {/* Upload icon circle */}
        <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
          <Upload size={26} className="text-secondary" />
        </div>
        <p className="text-base font-semibold text-on-surface">{t("admin.dropZone")}</p>

        {/* Processing step pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-1">
          {PROCESSING_STEPS.map((step) => (
            <span
              key={step}
              className="flex items-center gap-1.5 text-xs text-secondary bg-surface-container border border-outline-variant px-3 py-1.5 rounded-full"
            >
              <CheckSquare size={11} className="text-outline" />
              {step}
            </span>
          ))}
        </div>

        {/* Coming soon badge */}
        <div className="mt-2 flex items-center gap-2 text-xs text-on-tertiary-container bg-tertiary-fixed/20 border border-tertiary-fixed-dim/30 px-5 py-2.5 rounded-full">
          <CloudOff size={13} />
          {t("admin.uploadComingSoon")}
        </div>
      </div>

      {/* Processing queue (empty state) */}
      <div>
        <h2 className="text-xs font-bold tracking-widest uppercase text-secondary mb-4">
          {t("admin.processingQueue")}
        </h2>
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-10 flex items-center justify-center text-secondary text-sm">
          {t("admin.uploadComingSoon")}
        </div>
      </div>
    </AdminLayout>
  );
}
