import { useState } from "react";
import { CheckCircle, MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import Layout from "../components/layout/Layout";

export default function ContactPage() {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`פנייה מאתר SeekSuit — ${name}`);
    const body = encodeURIComponent(`שם: ${name}\nאימייל: ${email}\n\n${message}`);
    window.location.href = `mailto:danieljenudi@gmail.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-zinc-700 focus:border-[#e9c176] py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors duration-200";

  return (
    <Layout>
      {/* Full viewport minus navbar (4rem = 64px), no overflow */}
      <div className="bg-[#121212] h-[calc(100vh-4rem)] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 h-full">

          {/* No dir override — natural grid direction:
              LTR: col-1 = LEFT (cards), col-2 = RIGHT (photo)
              RTL: col-1 = RIGHT (cards), col-2 = LEFT (photo)
              Both give: cards on reading-start side, photo on reading-end side */}
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

              {/* Form card — top */}
              <div className="flex-1 bg-[#1c1c1c] rounded-2xl px-5 py-4 border border-white/5 shadow-xl overflow-hidden">
                {sent ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="w-12 h-12 rounded-full gold-shimmer flex items-center justify-center">
                      <CheckCircle size={20} className="text-on-tertiary-fixed" />
                    </div>
                    <h2 className="font-headline text-lg font-bold text-white">{t("contact.sent")}</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">{t("contact.sentNote")}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
                    <h2 className="font-headline text-base font-bold text-white shrink-0">
                      {t("contact.title")}
                    </h2>
                    <div className="shrink-0">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5">
                        {t("contact.name")}
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
                        {t("contact.email")}
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="block text-[9px] text-zinc-500 uppercase tracking-widest mb-0.5 shrink-0">
                        {t("contact.message")}
                      </label>
                      <textarea
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t("contact.messagePlaceholder")}
                        className={`${inputClass} resize-none flex-1 min-h-0`}
                      />
                    </div>
                    <button
                      type="submit"
                      className="shrink-0 w-full gold-shimmer flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed hover:opacity-90 transition-opacity shadow-[0_4px_20px_rgba(233,193,118,0.12)] cursor-pointer"
                    >
                      {t("contact.send")}
                      <ArrowRight size={15} />
                    </button>
                  </form>
                )}
              </div>

              {/* Info card — bottom */}
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
                      <a href="tel:036887788" className="text-xs font-medium text-white hover:text-[#e9c176] transition-colors">
                        03-688-7788
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e9c176]/10 flex items-center justify-center shrink-0">
                      <Mail size={11} className="text-[#e9c176]" />
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest mb-0.5">{t("contact.emailLabel")}</p>
                      <a href="mailto:danieljenudi@gmail.com" className="text-xs font-medium text-white hover:text-[#e9c176] transition-colors break-all">
                        danieljenudi@gmail.com
                      </a>
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

            {/* ── col-2: store photo — h-full, never overflows ── */}
            <div className="relative rounded-2xl overflow-hidden bg-[#1c1c1c] border border-white/5 shadow-2xl lg:h-full min-h-[220px]">
              <img
                src="/placeholders/store-pic.png"
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
