import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, Users, ImageOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useLang } from "../../context/LanguageContext";
import { listVTOModels, uploadVTOModel, deleteVTOModel, type VTOModel } from "../../services/vtoModels.service";

export default function AdminVTOModelsPage() {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [models, setModels]         = useState<VTOModel[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setModels(await listVTOModels());
    } catch {
      setError(t("admin.vtoModels.loadError"));
    } finally {
      setLoading(false);
    }
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: VTOModel[] = [];
      for (const file of Array.from(files)) {
        const model = await uploadVTOModel(file);
        uploaded.push(model);
      }
      setModels((prev) => [...prev, ...uploaded]);
      flash(t("admin.vtoModels.uploadSuccess").replace("{count}", String(uploaded.length)));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t("admin.vtoModels.uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(name: string) {
    if (!window.confirm(t("admin.vtoModels.deleteConfirm").replace("{name}", name))) return;
    setDeletingKey(name);
    setError(null);
    try {
      await deleteVTOModel(name);
      setModels((prev) => prev.filter((m) => m.name !== name));
      flash(t("admin.vtoModels.deleteSuccess"));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t("admin.vtoModels.deleteError"));
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Users size={20} className="text-tertiary-fixed" />
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              {t("admin.vtoModels.title")}
            </h1>
          </div>
          <p className="text-sm text-on-surface-variant ml-8">
            {t("admin.vtoModels.subtitle")}
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold gold-shimmer text-on-tertiary-fixed hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? t("admin.vtoModels.uploading") : t("admin.vtoModels.upload")}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle2 size={15} />
          {success}
        </div>
      )}

      {/* Drop zone + grid */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`min-h-[200px] rounded-2xl border-2 border-dashed transition-colors ${dragOver ? "border-tertiary-fixed bg-tertiary-fixed/5" : "border-outline-variant"}`}
      >
        {loading ? (
          <div className="flex items-center justify-center h-48 text-on-surface-variant text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            {t("common.loading")}
          </div>
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-on-surface-variant">
            <ImageOff size={32} className="opacity-30" />
            <p className="text-sm">{t("admin.vtoModels.empty")}</p>
            <p className="text-xs opacity-60">{t("admin.vtoModels.dropHint")}</p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {models.map((model) => (
              <ModelCard
                key={model.name}
                model={model}
                deleting={deletingKey === model.name}
                onDelete={() => handleDelete(model.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drag-over overlay hint */}
      {dragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="px-8 py-4 rounded-2xl bg-neutral-900/90 border-2 border-tertiary-fixed text-tertiary-fixed font-semibold text-lg shadow-2xl">
            {t("admin.vtoModels.dropRelease")}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function ModelCard({ model, deleting, onDelete }: { model: VTOModel; deleting: boolean; onDelete: () => void }) {
  const stem = model.name.replace(/\.[^.]+$/, "").replace(/_\d+$/, "");

  return (
    <div className="group relative rounded-xl overflow-hidden border border-outline-variant bg-surface-variant aspect-[3/4]">
      <img src={model.url} alt={stem} className="absolute inset-0 w-full h-full object-cover" />

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-200" />

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={deleting}
        title="Delete"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white cursor-pointer disabled:opacity-50"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>

      {/* Name tag */}
      <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-[11px] font-medium truncate">{stem}</p>
      </div>
    </div>
  );
}
