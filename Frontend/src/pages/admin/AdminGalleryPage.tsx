import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useLang } from "../../context/LanguageContext";
import api from "../../services/api";
import { Trash2, Upload, Image, GripVertical } from "lucide-react";

interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
  order: number;
}

export default function AdminGalleryPage() {
  const { t } = useLang();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [caption, setCaption] = useState("");
  const [dropZoneActive, setDropZoneActive] = useState(false);

  // Drag-to-reorder state
  const draggedIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadImages(); }, []);

  async function loadImages() {
    try {
      const res = await api.get<GalleryImage[]>("/gallery");
      setImages(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleFiles(files: File[]) {
    if (uploading || !files.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    try {
      if (files.length === 1) {
        // Single upload — supports caption
        const form = new FormData();
        form.append("image", files[0]);
        if (caption.trim()) form.append("caption", caption.trim());
        const res = await api.post<GalleryImage>("/gallery/upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setImages((prev) => [...prev, res.data]);
      } else {
        // Bulk upload
        const form = new FormData();
        files.forEach((f) => form.append("images", f));
        if (caption.trim()) form.append("caption", caption.trim());
        const res = await api.post<GalleryImage[]>("/gallery/upload-bulk", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setImages((prev) => [...prev, ...res.data]);
      }
      setCaption("");
    } catch {
      alert(t("admin.customerGallery.uploadError"));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.customerGallery.deleteConfirm"))) return;
    try {
      await api.delete(`/gallery/${id}`);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert(t("admin.customerGallery.deleteError"));
    }
  }

  // ── Drag-to-reorder handlers ─────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, idx: number) {
    draggedIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }

  function onDropCard(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = draggedIdx.current;
    setDragOverIdx(null);
    draggedIdx.current = null;
    if (from === null || from === idx) return;

    const next = [...images];
    const [removed] = next.splice(from, 1);
    next.splice(idx, 0, removed);
    setImages(next);
    api.put("/gallery/reorder", { order: next.map((i) => i.id) }).catch(() => {
      setImages(images);
    });
  }

  function onDragEnd() {
    draggedIdx.current = null;
    setDragOverIdx(null);
  }

  // ── Dropzone (for uploading new files) ───────────────────────────────────

  function onDropZone(e: React.DragEvent) {
    e.preventDefault();
    setDropZoneActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /^image\/(jpeg|png|webp)/i.test(f.type)
    );
    if (files.length) handleFiles(files);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
    e.target.value = "";
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">

        {/* ── Upload panel ── */}
        <div className="bg-surface-variant/30 rounded-2xl border border-outline-variant p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("admin.customerGallery.captionPlaceholder")}
              className="flex-1 bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Upload size={15} />
              {uploading
                ? uploadProgress
                  ? `${t("admin.customerGallery.uploading")} ${uploadProgress.done}/${uploadProgress.total}`
                  : t("admin.customerGallery.uploading")
                : t("admin.customerGallery.upload")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFileInputChange}
              className="hidden"
            />
          </div>

          {/* Drop zone for new uploads */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDropZoneActive(true); }}
            onDragLeave={() => setDropZoneActive(false)}
            onDrop={onDropZone}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dropZoneActive
                ? "border-primary bg-primary/10"
                : "border-outline-variant hover:border-primary/50"
            }`}
          >
            <Image size={24} className="mx-auto mb-2 text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant">
              {t("admin.customerGallery.dropHint")}
            </p>
            <p className="text-xs text-on-surface-variant/60 mt-1">JPG, PNG, WEBP</p>
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <p className="text-center text-on-surface-variant py-12">{t("common.loading")}</p>
        ) : images.length === 0 ? (
          <p className="text-center text-on-surface-variant py-12">
            {t("admin.customerGallery.empty")}
          </p>
        ) : (
          <>
            <p className="text-xs text-on-surface-variant mb-4">
              {t("admin.customerGallery.reorderHint")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={(e) => onDropCard(e, idx)}
                  onDragEnd={onDragEnd}
                  className={`relative group rounded-2xl overflow-hidden border transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
                    dragOverIdx === idx && draggedIdx.current !== idx
                      ? "border-primary ring-2 ring-primary scale-[1.03]"
                      : "border-outline-variant"
                  } ${draggedIdx.current === idx ? "opacity-40" : "opacity-100"}`}
                >
                  <img
                    src={img.url}
                    alt={img.caption ?? ""}
                    className="w-full aspect-[3/4] object-cover pointer-events-none"
                    draggable={false}
                  />

                  {img.caption && (
                    <div className="px-3 py-2 bg-surface border-t border-outline-variant">
                      <p className="text-xs text-on-surface-variant truncate">{img.caption}</p>
                    </div>
                  )}

                  {/* Order badge */}
                  <div className="absolute top-2 start-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white text-xs font-bold pointer-events-none">
                    {idx + 1}
                  </div>

                  {/* Drag handle (top right) */}
                  <div className="absolute top-2 end-2 p-1 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <GripVertical size={14} className="text-white" />
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                    title="Delete"
                    className="absolute bottom-2 end-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
