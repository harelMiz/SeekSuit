import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Moon, Sun } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import type { Language } from "../../context/LanguageContext";

export default function Navbar() {
  const { t, lang, setLang } = useLang();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem("seeksuit_theme");
    const dark = stored !== "light"; // dark by default
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      setHidden(current > lastScrollY.current && current > 80);
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("seeksuit_theme", next ? "dark" : "light");
  };

  const links = [
    { to: "/shop", label: t("nav.shop") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const otherLang: Language = lang === "he" ? "en" : "he";

  return (
    <header className={`fixed top-0 start-0 end-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex flex-col leading-none gap-0.5">
          <img src="/logo.svg" alt="Jenudi Fashion" className="h-8 w-auto" />
          <span className="text-[10px] text-on-surface-variant tracking-wide">{t("nav.brandSubtitle")}</span>
        </Link>

        {/* Center nav */}
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

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Language toggle */}
          <button
            onClick={() => setLang(otherLang)}
            className="text-xs text-on-surface-variant hover:text-primary transition-colors border border-outline-variant hover:border-primary px-2.5 py-1 rounded cursor-pointer"
          >
            {otherLang === "en" ? "EN" : "עב"}
          </button>

          {/* Dark / light mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>


          {/* Admin login */}
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
