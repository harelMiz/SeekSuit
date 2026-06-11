import { Link, useLocation } from "react-router-dom";
import { Lock, Camera } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import type { Language } from "../../context/LanguageContext";

export default function Navbar() {
  const { t, lang, setLang } = useLang();
  const location = useLocation();

  const links = [
    { to: "/shop", label: t("nav.shop") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];


  const otherLang: Language = lang === "he" ? "en" : "he";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-widest text-primary">
            SEEKSUIT
          </span>
          <span className="text-[10px] text-on-surface-variant tracking-wide">
            {t("nav.brandSubtitle")}
          </span>
        </Link>

        {/* Center nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm transition-colors pb-0.5 ${
                location.pathname === link.to
                  ? "text-primary font-semibold border-b border-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: language toggle + admin lock */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={() => setLang(otherLang)}
            className="text-xs text-on-surface-variant hover:text-primary transition-colors border border-outline-variant hover:border-primary px-2.5 py-1 rounded"
          >
            {otherLang === "en" ? "EN" : "עב"}
          </button>

          {/* Visual search — camera icon */}
          <Link
            to="/search"
            title={t("nav.search")}
            className={`hidden md:flex items-center justify-center w-8 h-8 transition-colors ${
              location.pathname === "/search"
                ? "text-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <Camera size={16} />
          </Link>

          {/* Admin login — icon button */}
          <Link
            to="/admin/login"
            title={t("nav.adminLogin")}
            className="hidden md:flex items-center justify-center w-8 h-8 text-on-surface-variant hover:text-primary transition-colors"
          >
            <Lock size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
