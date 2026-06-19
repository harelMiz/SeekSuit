import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Pencil, Upload, Users, ImageOff,
  Loader2, AlertCircle, CheckCircle2, Check, X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useLang } from "../../context/LanguageContext";
import {
  listVTOModelFolders, uploadVTOModelPhoto,
  deleteVTOModelFolder, deleteVTOModelPhoto, renameVTOModelFolder,
  type VTOModelFolder, type VTOModelPhoto,
} from "../../services/vtoModels.service";

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitizeFolderName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
}

// ── sub-components ────────────────────────────────────────────────────────────

function PhotoThumb({
  photo,
  onDelete,
  onView,
}: {
  photo: VTOModelPhoto;
  onDelete: () => void;
  onView: (url: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div
      className="group/thumb relative w-20 aspect-[3/4] rounded-xl overflow-hidden border border-outline-variant cursor-zoom-in"
      onClick={() => onView(photo.url)}
    >
      <img src={photo.url} alt={photo.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 transition-colors" />
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-1 right-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity p-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white cursor-pointer"
      >
        {deleting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
      </button>
    </div>
  );
}

function PhotoGrid({
  folder,
  onUpload,
  onDelete,
  onView,
}: {
  folder: VTOModelFolder;
  onUpload: (folder: string, files: FileList) => void;
  onDelete: (folder: string, photo: string) => void;
  onView: (url: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {folder.photos.map((p) => (
        <PhotoThumb
          key={p.name}
          photo={p}
          onDelete={() => onDelete(folder.name, p.name)}
          onView={onView}
        />
      ))}

      {/* Upload tile */}
      <button
        onClick={() => ref.current?.click()}
        title="Add photo"
        className="w-20 aspect-[3/4] rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant hover:border-tertiary-fixed hover:text-tertiary-fixed transition-colors cursor-pointer"
      >
        <Plus size={20} />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onUpload(folder.name, e.target.files)}
      />
    </div>
  );
}

function ModelCard({
  folder,
  onUpload,
  onPhotoDelete,
  onRename,
  onDelete,
  onView,
}: {
  folder: VTOModelFolder;
  onUpload: (folder: string, files: FileList) => void;
  onPhotoDelete: (folder: string, photo: string) => void;
  onRename: (folder: string, newName: string) => Promise<void>;
  onDelete: (folder: string) => void;
  onView: (url: string) => void;
}) {
  const { t } = useLang();
  const [editing, setEditing]     = useState(false);
  const [nameVal, setNameVal]     = useState(folder.name);
  const [renaming, setRenaming]   = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setNameVal(folder.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function confirmRename() {
    const safe = sanitizeFolderName(nameVal);
    if (!safe || safe === folder.name) { setEditing(false); return; }
    setRenaming(true);
    await onRename(folder.name, safe);
    setRenaming(false);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(t("admin.vtoModels.deleteFolderConfirm").replace("{name}", folder.name))) return;
    setDeleting(true);
    onDelete(folder.name);
  }

  return (
    <div className="group/card rounded-2xl border border-outline-variant bg-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={inputRef}
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-surface-variant border border-outline-variant rounded-lg px-2 py-1 text-sm text-on-surface focus:outline-none focus:border-tertiary-fixed"
            />
            <button onClick={confirmRename} disabled={renaming} className="p-1.5 rounded-lg bg-tertiary-fixed/20 text-tertiary-fixed hover:bg-tertiary-fixed/30 cursor-pointer">
              {renaming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant cursor-pointer">
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">{folder.name}</span>
              <button onClick={startEdit} className="p-1 rounded text-on-surface-variant hover:text-on-surface cursor-pointer opacity-0 group-hover/card:opacity-100 transition-opacity">
                <Pencil size={12} />
              </button>
            </div>
            <span className="text-xs text-on-surface-variant">{folder.photos.length} {t("admin.vtoModels.photos")}</span>
          </>
        )}

        {!editing && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>

      <PhotoGrid folder={folder} onUpload={onUpload} onDelete={onPhotoDelete} onView={onView} />
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AdminVTOModelsPage() {
  const { t } = useLang();

  const [folders, setFolders]   = useState<VTOModelFolder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const [newName, setNewName]   = useState("");
  const [creating, setCreating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setFolders(await listVTOModelFolders()); }
    catch { setError(t("admin.vtoModels.loadError")); }
    finally { setLoading(false); }
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleUpload(folderName: string, files: FileList) {
    setError(null);
    const uploaded: VTOModelPhoto[] = [];
    for (const file of Array.from(files)) {
      try {
        const photo = await uploadVTOModelPhoto(folderName, file);
        uploaded.push(photo);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? t("admin.vtoModels.uploadError"));
      }
    }
    if (uploaded.length) {
      setFolders(prev => prev.map(f =>
        f.name === folderName ? { ...f, photos: [...f.photos, ...uploaded] } : f
      ));
      flash(t("admin.vtoModels.uploadSuccess").replace("{count}", String(uploaded.length)));
    }
  }

  async function handlePhotoDelete(folderName: string, photoName: string) {
    setError(null);
    try {
      await deleteVTOModelPhoto(folderName, photoName);
      setFolders(prev => prev.map(f =>
        f.name === folderName ? { ...f, photos: f.photos.filter(p => p.name !== photoName) } : f
      ));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t("admin.vtoModels.deleteError"));
    }
  }

  async function handleRename(oldName: string, newNameVal: string) {
    setError(null);
    try {
      await renameVTOModelFolder(oldName, newNameVal);
      setFolders(prev => prev.map(f => f.name === oldName ? { ...f, name: newNameVal } : f));
      flash(t("admin.vtoModels.renameSuccess"));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t("admin.vtoModels.renameError"));
    }
  }

  async function handleDeleteFolder(folderName: string) {
    setError(null);
    try {
      await deleteVTOModelFolder(folderName);
      setFolders(prev => prev.filter(f => f.name !== folderName));
      flash(t("admin.vtoModels.deleteSuccess"));
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t("admin.vtoModels.deleteError"));
    }
  }

  async function handleCreateFolder() {
    const safe = sanitizeFolderName(newName);
    if (!safe) return;
    if (folders.some(f => f.name === safe)) {
      setError(t("admin.vtoModels.folderExists"));
      return;
    }
    setCreating(true);
    setFolders(prev => [...prev, { name: safe, photos: [] }]);
    setNewName("");
    setCreating(false);
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-tertiary-fixed" />
          <div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">{t("admin.vtoModels.title")}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{t("admin.vtoModels.subtitle")}</p>
          </div>
        </div>

        {/* New model input */}
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder={t("admin.vtoModels.newFolderPlaceholder")}
            className="bg-surface-variant border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-tertiary-fixed w-40"
          />
          <button
            onClick={handleCreateFolder}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold gold-shimmer text-on-tertiary-fixed hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t("admin.vtoModels.addModel")}
          </button>
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle size={15} />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle2 size={15} />{success}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-on-surface-variant text-sm py-20 justify-center">
          <Loader2 size={16} className="animate-spin" />{t("common.loading")}
        </div>
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
          <ImageOff size={36} className="opacity-30" />
          <p className="text-sm">{t("admin.vtoModels.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <ModelCard
              key={folder.name}
              folder={folder}
              onUpload={handleUpload}
              onPhotoDelete={handlePhotoDelete}
              onRename={handleRename}
              onDelete={handleDeleteFolder}
              onView={setLightboxUrl}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="model photo"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AdminLayout>
  );
}
