import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Upload, LogOut, Sun, Moon } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import type { Language } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin", label: "admin.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/inventory", label: "admin.inventory", icon: Package, exact: false },
  { to: "/admin/uploads", label: "admin.uploads", icon: Upload, exact: false },
];

// Admin layout: dark sidebar + main content area with sticky top bar
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useLang();
  const otherLang: Language = lang === "he" ? "en" : "he";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [isDark, setIsDark] = useState(() =>
    localStorage.getItem("seeksuit_admin_theme") !== "light"
  );

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("seeksuit_admin_theme", next ? "dark" : "light");
  }

  async function handleLogout() {
    await signOut();
    navigate("/admin/login");
  }

  function isActive(to: string, exact: boolean) {
    return exact ? location.pathname === to : location.pathname.startsWith(to);
  }

  const pageTitle = (() => {
    if (location.pathname === "/admin") return t("admin.dashboard");
    if (location.pathname.startsWith("/admin/inventory")) return t("admin.inventory");
    if (location.pathname.startsWith("/admin/uploads")) return t("admin.uploads");
    return "Admin";
  })();

  return (
    <div className="min-h-screen flex">
      {/* ── Dark Sidebar ── */}
      <aside className="w-64 fixed left-0 top-0 h-screen bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between z-50">
        {/* Top: brand */}
        <div>
          <div className="px-8 py-7 border-b border-neutral-800">
            <img src="/logo.svg" alt="SeekSuit" className="h-8 w-auto" />
            <div className="text-[10px] tracking-widest uppercase text-neutral-500 mt-1.5">
              אופנת ג׳נודי
            </div>
          </div>

          {/* Nav links */}
          <nav className="p-4 space-y-1 mt-2">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
              const active = isActive(to, exact);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    active
                      ? "text-amber-200 bg-neutral-800/50 border-r-2 border-amber-200"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/30"
                  }`}
                >
                  <Icon size={16} />
                  {t(label)}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: logout */}
        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition-colors"
          >
            <LogOut size={15} />
            {t("admin.logout")}
          </button>
        </div>
      </aside>

      {/* ── Main area (dark/light theme via CSS variable overrides) ── */}
      <div className={`ml-64 flex-1 min-h-screen flex flex-col ${isDark ? "admin-dark" : ""}`}>
        {/* Sticky top bar — uses surface variables so it adapts to theme */}
        <header className="bg-surface sticky top-0 z-40 px-12 py-4 border-b-2 border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1 h-7 rounded-full bg-gradient-to-b from-tertiary-fixed to-tertiary-fixed-dim" />
            <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLang(otherLang)}
              className="w-9 h-9 rounded-lg border border-outline-variant flex items-center justify-center text-xs font-bold text-secondary hover:text-on-surface hover:border-on-surface/40 transition-colors"
            >
              {otherLang === "en" ? "EN" : "עב"}
            </button>

            {/* Dark/light toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="w-9 h-9 rounded-lg border border-outline-variant flex items-center justify-center text-secondary hover:text-on-surface hover:border-on-surface/40 transition-colors"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-surface p-10">{children}</main>
      </div>
    </div>
  );
}
