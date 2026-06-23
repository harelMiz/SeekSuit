import { useState, useEffect, useRef } from "react";
import { Save, Check, Upload, ImageIcon } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useLang } from "../../context/LanguageContext";
import { he as heBase } from "../../locales/he";
import { en as enBase } from "../../locales/en";
import api from "../../services/api";

const TABS: { id: string; labelHe: string; labelEn: string; keys: string[] }[] = [
  {
    id: "home",
    labelHe: "בית",
    labelEn: "Home",
    keys: [
      "home.headline", "home.taglineSub", "home.premiumBadge", "home.browseCatalog",
      "home.searchPlaceholder", "home.imageDropTitle", "home.imageDropSub", "home.orImageSearch",
      "home.bentoSectionTitle", "home.bento.collectionTag", "home.bento.collectionTitle",
      "home.bento.craftTag", "home.bento.craftTitle", "home.bento.craftBody",
      "home.bento.accessories", "home.experience.tag", "home.experience.title",
      "home.experience.badge1", "home.experience.badge2",
    ],
  },
  {
    id: "shop",
    labelHe: "קטלוג",
    labelEn: "Catalog",
    keys: [
      "nav.brandSubtitle",
      "shop.title", "shop.subtitle", "shop.filters", "shop.type", "shop.color",
      "shop.status", "shop.clearFilters", "shop.noProducts", "shop.loadMore",
      "product.backToShop", "product.visitStore", "product.noImage",
      "product.readyToShip", "product.similar", "product.similarNote",
      "status.out_of_stock",
    ],
  },
  {
    id: "about",
    labelHe: "אודות",
    labelEn: "About",
    keys: [
      "about.tagline", "about.title", "about.description",
      "about.story.tag", "about.story.title", "about.story.body",
      "about.promise.tag", "about.promise.title", "about.promise.body",
      "about.visit.tag", "about.visit.title",
      "about.hours.tag", "about.hours", "about.address",
      "about.addressLine1", "about.addressLine2",
      "about.phone", "about.bookAppointment", "about.closed",
    ],
  },
  {
    id: "contact",
    labelHe: "צור קשר",
    labelEn: "Contact",
    keys: [
      "contact.tagline", "contact.heroTitle", "contact.subtitle", "contact.title",
      "contact.name", "contact.phone", "contact.email", "contact.message",
      "contact.messagePlaceholder", "contact.send", "contact.sendWhatsapp",
      "contact.sent", "contact.sentNote", "contact.atelierTag",
      "contact.addressLabel", "contact.phoneLabel", "contact.emailLabel",
      "contact.hoursLabel", "contact.hoursSummary", "contact.hoursFri",
    ],
  },
  {
    id: "gallery",
    labelHe: "גלריה",
    labelEn: "Gallery",
    keys: ["gallery.title", "gallery.tagline", "gallery.subtitle", "gallery.empty"],
  },
];

const IMAGE_KEYS: { key: string; labelHe: string; labelEn: string }[] = [
  { key: "image.hero-bg",           labelHe: "תמונת הירו (עמוד בית)",      labelEn: "Hero image (Home page)" },
  { key: "image.bento-collection",  labelHe: "בנטו — אוסף (עמוד בית)",    labelEn: "Bento — collection (Home page)" },
  { key: "image.bento-accessories", labelHe: "בנטו — אביזרים (עמוד בית)", labelEn: "Bento — accessories (Home page)" },
  { key: "image.experience-1",      labelHe: "חוויה — תמונה 1 (עמוד בית)", labelEn: "Experience — image 1 (Home page)" },
  { key: "image.experience-2",      labelHe: "חוויה — תמונה 2 (עמוד בית)", labelEn: "Experience — image 2 (Home page)" },
  { key: "image.about-owner",       labelHe: "תמונת הבעלים (עמוד אודות)",  labelEn: "Owner photo (About page)" },
  { key: "image.store-pic",         labelHe: "תמונת החנות (צור קשר)",      labelEn: "Store photo (Contact page)" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

function ContentRow({
  contentKey,
  overrides,
  onSave,
}: {
  contentKey: string;
  overrides: Record<string, { he: string; en: string }>;
  onSave: (key: string, he: string, en: string) => Promise<void>;
}) {
  const { t } = useLang();
  const saved = overrides[contentKey];
  const defaultHe = heBase[contentKey] ?? "";
  const defaultEn = enBase[contentKey] ?? "";

  const [heVal, setHeVal] = useState(saved?.he ?? defaultHe);
  const [enVal, setEnVal] = useState(saved?.en ?? defaultEn);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    setHeVal(saved?.he ?? defaultHe);
    setEnVal(saved?.en ?? defaultEn);
  }, [saved, defaultHe, defaultEn]);

  const isDirty = heVal !== (saved?.he ?? defaultHe) || enVal !== (saved?.en ?? defaultEn);

  async function handleSave() {
    setSaveState("saving");
    try {
      await onSave(contentKey, heVal, enVal);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  return (
    <div className="grid grid-cols-[220px_1fr_1fr_100px] gap-3 items-start py-3 border-b border-outline-variant/30 last:border-0">
      <p className="pt-1 text-xs font-mono text-on-surface-variant/60 break-all">{contentKey}</p>

      <textarea
        dir="rtl"
        value={heVal}
        onChange={(e) => setHeVal(e.target.value)}
        rows={2}
        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-y focus:outline-none focus:border-primary/60 transition-colors"
      />

      <textarea
        dir="ltr"
        value={enVal}
        onChange={(e) => setEnVal(e.target.value)}
        rows={2}
        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-y focus:outline-none focus:border-primary/60 transition-colors"
      />

      <button
        onClick={handleSave}
        disabled={saveState === "saving" || !isDirty}
        className="mt-0.5 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {saveState === "saved" ? <Check size={12} /> : <Save size={12} />}
        {saveState === "saving" ? t("admin.content.saving") : saveState === "saved" ? t("admin.content.saved") : t("admin.content.save")}
      </button>
    </div>
  );
}

function ImageRow({
  imgKey,
  labelHe,
  labelEn,
  overrides,
  onUpload,
}: {
  imgKey: string;
  labelHe: string;
  labelEn: string;
  overrides: Record<string, { he: string; en: string }>;
  onUpload: (key: string, file: File) => Promise<void>;
}) {
  const { lang, t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const currentUrl = overrides[imgKey]?.he ?? heBase[imgKey] ?? "";
  const label = lang === "he" ? labelHe : labelEn;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(imgKey, file);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  return (
    <div className="flex items-center gap-4 py-4 border-b border-outline-variant/30 last:border-0">
      {/* Preview */}
      <div className="w-32 h-20 rounded-xl overflow-hidden border border-outline-variant bg-surface shrink-0 flex items-center justify-center">
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={24} className="text-on-surface-variant/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface">{label}</p>
        <p className="text-xs font-mono text-on-surface-variant/50 mt-0.5">{imgKey}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {done ? <Check size={14} /> : uploading ? <Upload size={14} className="animate-pulse" /> : <Upload size={14} />}
          {done ? t("admin.content.uploaded") : uploading ? t("admin.content.uploading") : t("admin.content.replaceImage")}
        </button>
      </div>
    </div>
  );
}

export default function AdminContentPage() {
  const { t, lang, setOverride } = useLang();
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [overrides, setOverrides] = useState<Record<string, { he: string; en: string }>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<Record<string, { he: string; en: string }>>("/content")
      .then((res) => setOverrides(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(key: string, he: string, en: string) {
    await api.put("/content", { key, he, en });
    setOverrides((prev) => ({ ...prev, [key]: { he, en } }));
    setOverride(key, he, en);
  }

  async function handleImageReset(key: string) {
    await api.delete(`/content/${encodeURIComponent(key)}`);
    setOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setOverride(key, heBase[key] ?? "", heBase[key] ?? "");
  }

  async function handleImageUpload(key: string, file: File) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", key);
    const res = await api.post<{ url: string }>("/content/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = res.data.url;
    setOverrides((prev) => ({ ...prev, [key]: { he: url, en: url } }));
    setOverride(key, url, url);
  }

  const currentTab = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
  const isImagesTab = activeTab === "images";

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-on-surface-variant mb-6">
          {t("admin.content.subtitle")}
        </p>

        <div className="flex gap-1 mb-6 border-b border-outline-variant">
          {[...TABS, { id: "images", labelHe: "תמונות", labelEn: "Images" }].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {lang === "he" ? tab.labelHe : tab.labelEn}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">{t("common.loading")}</p>
        ) : isImagesTab ? (
          <div className="bg-surface-container rounded-2xl px-4">
            {IMAGE_KEYS.map(({ key, labelHe, labelEn }) => (
              <ImageRow
                key={key}
                imgKey={key}
                labelHe={labelHe}
                labelEn={labelEn}
                overrides={overrides}
                onUpload={handleImageUpload}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[220px_1fr_1fr_100px] gap-3 mb-2">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t("admin.content.colKey")}</p>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t("admin.content.colHe")}</p>
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t("admin.content.colEn")}</p>
              <div />
            </div>

            <div className="bg-surface-container rounded-2xl px-4">
              {currentTab.keys.map((key) => (
                <ContentRow
                  key={key}
                  contentKey={key}
                  overrides={overrides}
                  onSave={handleSave}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
