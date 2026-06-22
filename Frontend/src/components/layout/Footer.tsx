import { Link } from "react-router-dom";
import { MapPin, Phone } from "lucide-react";
import { useLang } from "../../context/LanguageContext";

export default function Footer() {
  const { t } = useLang();

  return (
    <footer className="bg-surface-container-low border-t border-outline-variant mt-20">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-2 gap-12">

        {/* Column 1: Brand */}
        <div>
          <img src="/logo.svg" alt="Jenudi Fashion" className="h-8 w-auto mb-1" />
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

      </div>

      {/* Bottom bar */}
      <div className="border-t border-outline-variant py-4 text-center text-xs text-secondary">
        © {new Date().getFullYear()} {t("footer.copyrightBrand")}
      </div>
    </footer>
  );
}
