import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Upload, Settings, HelpCircle, LogOut, Bell, Search } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/admin", label: "admin.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/inventory", label: "admin.inventory", icon: Package, exact: false },
  { to: "/admin/uploads", label: "admin.uploads", icon: Upload, exact: false },
];

const BOTTOM_ITEMS = [
  { to: "#", label: "Settings", icon: Settings },
  { to: "#", label: "Support", icon: HelpCircle },
];

// Admin layout: dark sidebar + main content area with sticky top bar
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate("/admin/login");
  }

  function isActive(to: string, exact: boolean) {
    return exact ? location.pathname === to : location.pathname.startsWith(to);
  }

  // Derive page title from path
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
          <Link to="/admin" className="block px-8 py-7 border-b border-neutral-800">
            <div className="font-headline italic text-xl text-white">
              The Atelier
            </div>
            <div className="text-[10px] tracking-widest uppercase text-neutral-500 mt-0.5">
              Admin Console
            </div>
          </Link>

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

        {/* Bottom: settings + logout */}
        <div className="p-4 border-t border-neutral-800 space-y-1">
          {BOTTOM_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/30 transition-colors"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition-colors mt-3"
          >
            <LogOut size={15} />
            {t("admin.logout")}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="ml-64 flex-1 min-h-screen flex flex-col">
        {/* Sticky top bar */}
        <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-40 px-12 py-5 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            {pageTitle}
          </h2>

          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2">
              <Search size={14} className="text-secondary" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent text-sm text-on-surface placeholder-secondary outline-none w-40"
              />
            </div>

            {/* Bell */}
            <button className="w-9 h-9 rounded-lg border border-outline-variant flex items-center justify-center text-secondary hover:text-primary transition-colors">
              <Bell size={16} />
            </button>

            {/* Account avatar */}
            <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center">
              <span className="text-xs font-bold text-on-primary">A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-surface p-10">{children}</main>
      </div>
    </div>
  );
}
