import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Clock } from "lucide-react";
import { useLang } from "../../context/LanguageContext";

// Store hours data
const HOURS = [
  { dayKey: "about.sun", time: "10:00–19:00" },
  { dayKey: "about.mon", time: "10:00–19:00" },
  { dayKey: "about.tue", time: "10:00–19:00" },
  { dayKey: "about.wed", time: "10:00–19:00" },
  { dayKey: "about.thu", time: "10:00–19:00" },
  { dayKey: "about.fri", time: "10:00–14:30" },
  { dayKey: "about.sat", time: null }, // closed
];

export default function Footer() {
  const { t } = useLang();
  const [email, setEmail] = useState("");

  function handleNewsletter(e: React.FormEvent) {
    e.preventDefault();
    // Newsletter subscription — placeholder for future integration
    setEmail("");
  }

  return (
    <footer className="bg-surface-container-low border-t border-outline-variant mt-20">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Column 1: Brand */}
        <div>
          <div className="text-xl font-black tracking-widest text-primary mb-1">
            SEEKSUIT
          </div>
          <div className="text-xs text-on-surface-variant mb-4">{t("nav.brandSubtitle")}</div>
          <p className="text-sm text-secondary leading-relaxed">
            {t("about.description")}
          </p>
        </div>

        {/* Column 2: Links — two sub-columns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Company links */}
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface mb-4">
              {t("footer.company")}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/about"
                  className="text-sm text-secondary hover:text-primary transition-colors"
                >
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-secondary hover:text-primary transition-colors"
                >
                  {t("nav.contact")}
                </Link>
              </li>
              <li>
                <Link
                  to="/shop"
                  className="text-sm text-secondary hover:text-primary transition-colors"
                >
                  {t("nav.shop")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support links */}
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface mb-4">
              {t("footer.support")}
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="#"
                  className="text-sm text-secondary hover:text-primary transition-colors"
                >
                  {t("footer.privacyPolicy")}
                </a>
              </li>
              <li>
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <MapPin size={13} className="shrink-0" />
                  <span>{t("footer.addressShort")}</span>
                </div>
              </li>
              <li>
                <a
                  href="tel:036887788"
                  className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
                >
                  <Phone size={13} className="shrink-0" />
                  03-688-7788
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Column 3: Newsletter */}
        <div>
          <h3 className="text-xs font-bold tracking-widest uppercase text-on-surface mb-2">
            {t("footer.joinAtelier")}
          </h3>
          <p className="text-sm text-secondary mb-5 leading-relaxed">
            {t("footer.joinSub")}
          </p>
          <form onSubmit={handleNewsletter} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-sm text-on-surface placeholder-secondary outline-none focus:border-outline transition-colors"
            />
            <button
              type="submit"
              className="gold-shimmer text-on-tertiary-fixed font-semibold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap transition-opacity hover:opacity-90"
            >
              {t("footer.join")}
            </button>
          </form>

          {/* Store hours summary */}
          <div className="mt-6 flex items-center gap-2 text-xs text-secondary">
            <Clock size={13} />
            <span>{t("footer.hoursSummary")}</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-outline-variant py-4 text-center text-xs text-secondary">
        © {new Date().getFullYear()} {t("footer.copyrightBrand")}
      </div>
    </footer>
  );
}
