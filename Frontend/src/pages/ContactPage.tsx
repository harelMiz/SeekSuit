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
    // Open default email client with pre-filled content
    const subject = encodeURIComponent(`פנייה מאתר SeekSuit — ${name}`);
    const body = encodeURIComponent(`שם: ${name}\nאימייל: ${email}\n\n${message}`);
    window.location.href = `mailto:danieljenudi@gmail.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  // Bottom-border-only input style
  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    <Layout>
      <div className="bg-surface min-h-screen">

        {/* ── Asymmetric Hero ── */}
        <section className="max-w-7xl mx-auto px-6 pt-28 pb-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: heading */}
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase text-on-tertiary-container mb-4">
              Reach Out
            </p>
            <h1 className="font-headline text-5xl md:text-6xl font-black text-on-surface leading-[1.05]">
              Get in{" "}
              <em className="not-italic">Touch</em>
            </h1>
            <p className="text-base text-secondary leading-relaxed mt-4 max-w-sm">
              {t("contact.subtitle")}
            </p>
          </div>

          {/* Right: image placeholder */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-zinc-300 to-zinc-400 overflow-hidden" />
            {/* Floating gold card overlay */}
            <div className="absolute -bottom-4 -start-4 gold-shimmer rounded-xl px-5 py-4 shadow-lg">
              <p className="text-[10px] font-bold tracking-widest uppercase text-on-tertiary-fixed mb-0.5">
                Atelier
              </p>
              <p className="text-sm font-semibold text-on-tertiary-fixed">
                03-688-7788
              </p>
            </div>
          </div>
        </section>

        {/* ── Main content ── */}
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Info panel — 1/3 */}
            <div className="bg-surface-container-low rounded-2xl p-8 space-y-8">
              {/* Address */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={15} className="text-on-tertiary-container" />
                </div>
                <div>
                  <p className="text-[10px] text-secondary uppercase tracking-widest mb-1">Address</p>
                  <p className="text-sm font-medium text-on-surface leading-snug">
                    העליייה 11<br />תל אביב-יפו
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <Phone size={15} className="text-on-tertiary-container" />
                </div>
                <div>
                  <p className="text-[10px] text-secondary uppercase tracking-widest mb-1">Phone</p>
                  <a
                    href="tel:036887788"
                    className="text-sm font-medium text-on-surface hover:text-on-tertiary-container transition-colors"
                  >
                    03-688-7788
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <Mail size={15} className="text-on-tertiary-container" />
                </div>
                <div>
                  <p className="text-[10px] text-secondary uppercase tracking-widest mb-1">Email</p>
                  <a
                    href="mailto:danieljenudi@gmail.com"
                    className="text-sm font-medium text-on-surface hover:text-on-tertiary-container transition-colors break-all"
                  >
                    danieljenudi@gmail.com
                  </a>
                </div>
              </div>

              {/* Hours summary */}
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <Clock size={15} className="text-on-tertiary-container" />
                </div>
                <div>
                  <p className="text-[10px] text-secondary uppercase tracking-widest mb-1">Hours</p>
                  <p className="text-sm font-medium text-on-surface">Sun–Thu 10:00–19:00</p>
                  <p className="text-sm text-secondary">Fri 10:00–14:30</p>
                </div>
              </div>
            </div>

            {/* Form panel — 2/3 */}
            <div className="md:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-2xl p-10">
              {sent ? (
                /* Success state */
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                  <div className="w-16 h-16 rounded-full gold-shimmer flex items-center justify-center">
                    <CheckCircle size={28} className="text-on-tertiary-fixed" />
                  </div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface">
                    {t("contact.sent")}
                  </h2>
                  <p className="text-sm text-secondary max-w-xs leading-relaxed">
                    {t("contact.sentNote")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <h2 className="font-headline text-2xl font-bold text-on-surface mb-6">
                    {t("contact.title")}
                  </h2>

                  {/* Name */}
                  <div>
                    <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
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

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
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

                  {/* Message */}
                  <div>
                    <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                      {t("contact.message")}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("contact.messagePlaceholder")}
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  {/* Submit button — gold gradient + arrow */}
                  <button
                    type="submit"
                    className="gold-shimmer flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed transition-opacity hover:opacity-90"
                  >
                    {t("contact.send")}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
