import { useState } from "react";
import { CheckCircle, MapPin, Phone, Mail, Clock, Send, Loader2 } from "lucide-react";

const WHATSAPP_NUMBER = "972545556484";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";
import api from "../services/api";

export default function ContactPage() {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/contact", { name, email, phone, message });
      setSent(true);
    } catch {
      setError(t("contact.sendError"));
    } finally {
      setLoading(false);
    }
  }

  function handleWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const lines = [`שם: ${name}`, `טלפון: ${phone}`];
    if (email) lines.push(`אימייל: ${email}`);
    lines.push(``, message);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
    setSent(true);
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-zinc-700 focus:border-[#e9c176] py-1.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors duration-200 cursor-text";

  return (
    <Layout>
      <div className="bg-[#121212] h-[calc(100vh-4rem)] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 h-full">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-full lg:items-stretch">

            {/* ── col-1: heading + form card + info card ── */}
            <div className="flex flex-col gap-3 lg:h-full overflow-hidden">

              {/* Heading */}
              <div className="shrink-0">
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#e9c176]/70 mb-1">
                  {t("contact.tagline")}
                </p>
                <h1 className="font-headline text-3xl md:text-4xl font-black text-white leading-tight mb-1">
                  {t("contact.heroTitle")}
                </h1>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {t("contact.subtitle")}
                </p>
              </div>

              {/* Form card */}
              <div className="flex-1 bg-[#1c1c1c] rounded-2xl px-5 py-3 border border-white/5 shadow-xl overflow-hidden">
                {sent ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="w-12 h-12 rounded-full gold-shimmer flex items-center justify-center">
                      <CheckCircle size={20} className="text-on-tertiary-fixed" />
                    </div>
                    <h2 className="font-headline text-lg font-bold text-white">{t("contact.sent")}</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t("contact.sentNote")}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2 h-full">
                    <h2 className="font-headline text-base font-bold text-white shrink-0">
                      {t("contact.title")}
                    </h2>

                    <div className="shrink-0">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">
                        {t("contact.name")} *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="shrink-0">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">
                        {t("contact.phone")} *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="shrink-0">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">
                        {t("contact.email")}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-visible">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-1 shrink-0 leading-none pt-0.5">
                        {t("contact.message")} *
                      </label>
                      <textarea
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t("contact.messagePlaceholder")}
                        className={`${inputClass} resize-none flex-1 min-h-0`}
                      />
                    </div>

                    {error && (
                      <p className="shrink-0 text-xs text-red-400">{error}</p>
                    )}

                    <div className="shrink-0 flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 gold-shimmer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed hover:opacity-90 transition-opacity shadow-[0_4px_20px_rgba(233,193,118,0.12)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {loading ? t("contact.sending") : t("contact.send")}
                      </button>
                      <button
                        type="button"
                        onClick={handleWhatsApp}
                        disabled={!name || !phone || !message}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {t("contact.sendWhatsapp")}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Info card */}
              <div className="flex-1 bg-[#1c1c1c] rounded-2xl px-5 py-4 border border-white/5 shadow-xl flex flex-col gap-3 overflow-hidden">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 shrink-0">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e9c176]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={11} className="text-[#e9c176]" />
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">{t("contact.addressLabel")}</p>
                      <p className="text-xs font-medium text-white leading-snug">
                        {t("about.addressLine1")}<br />{t("about.addressLine2")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e9c176]/10 flex items-center justify-center shrink-0">
                      <Phone size={11} className="text-[#e9c176]" />
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">{t("contact.phoneLabel")}</p>
                      <span className="text-xs font-medium text-white">03-688-7788</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e9c176]/10 flex items-center justify-center shrink-0">
                      <Mail size={11} className="text-[#e9c176]" />
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">{t("contact.emailLabel")}</p>
                      <span className="text-xs font-medium text-white break-all">danieljenudi@gmail.com</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e9c176]/10 flex items-center justify-center shrink-0">
                      <Clock size={11} className="text-[#e9c176]" />
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">{t("contact.hoursLabel")}</p>
                      <p className="text-xs font-medium text-white">{t("contact.hoursSummary")}</p>
                      <p className="text-xs text-zinc-500">{t("contact.hoursFri")}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 rounded-xl overflow-hidden border border-white/5 min-h-0">
                  <iframe
                    src="https://maps.google.com/maps?q=%D7%94%D7%A2%D7%9C%D7%99%D7%99%D7%94+11%2C+%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91&hl=iw&output=embed&z=16"
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Jenudi Fashion location"
                  />
                </div>
              </div>

            </div>

            {/* ── col-2: store photo ── */}
            <div className="relative rounded-2xl overflow-hidden bg-[#1c1c1c] border border-white/5 shadow-2xl lg:h-full min-h-[220px]">
              <img
                src={t("image.store-pic")}
                alt="Jenudi Fashion Store"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 start-5 gold-shimmer rounded-xl px-4 py-3 shadow-lg">
                <p className="text-[9px] font-bold tracking-widest uppercase text-on-tertiary-fixed mb-0.5">
                  {t("contact.atelierTag")}
                </p>
                <p className="text-sm font-semibold text-on-tertiary-fixed">03-688-7788</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
