import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Shield } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { supabase } from "../../lib/supabase";

export default function AdminLoginPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });

    setSubmitting(false);

    if (authError) {
      setError(t("admin.loginError"));
      return;
    }

    navigate("/admin");
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    // force LTR so editorial is always LEFT, form always RIGHT
    <div className="min-h-screen flex" style={{ direction: "ltr" }}>

      {/* ── Editorial panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] px-16 py-12 relative overflow-hidden bg-neutral-950">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
        <div className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full bg-amber-800/10 blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full bg-amber-900/8 blur-[110px]" />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="block w-10 h-[1.5px] bg-gradient-to-r from-amber-400 to-amber-600/50" />
            <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-amber-400/70">
              {t("admin.portal")}
            </p>
          </div>
          <div className="font-headline">
            <span className="block text-7xl font-bold tracking-tight text-white">JENUDI</span>
            <span className="block text-lg tracking-[0.18em] text-amber-400/60 mt-1">
              אופנת ג׳נודי
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <div className="w-14 h-[1px] bg-amber-400/30 mb-8" />
          <h2 className="font-headline leading-[1.05]">
            <span className="block text-4xl font-bold text-white/90">
              {t("admin.loginBrand")}
            </span>
            <span className="block text-5xl italic text-on-tertiary-container mt-1">
              {t("admin.portal")}
            </span>
          </h2>
          <p className="text-secondary text-sm mt-6 max-w-xs leading-relaxed">
            {t("admin.loginNote")}
          </p>
          <div className="w-24 h-[2px] bg-gradient-to-r from-amber-400/50 to-transparent mt-8" />
        </div>

        {/* Bottom */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-outline">
          <Shield size={12} className="text-amber-400/50" />
          {t("admin.secureNote")}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center bg-surface px-8 py-12"
        dir="rtl"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 28px, rgba(255,255,255,0.025) 28px, rgba(255,255,255,0.025) 29px)",
        }}
      >

        {/* Mobile brand */}
        <div className="lg:hidden text-center mb-10">
          <div className="font-headline text-4xl font-bold text-on-surface">JENUDI</div>
          <div className="text-xs text-secondary tracking-wide mt-1">אופנת ג׳נודי</div>
        </div>

        <div className="w-full max-w-sm">

          {/* Header — matches other admin pages */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-10 h-[1.5px] bg-gradient-to-r from-tertiary-fixed to-tertiary-fixed-dim" />
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-on-tertiary-container">
                {t("admin.loginSub")}
              </p>
            </div>
            <h1 className="font-headline font-bold text-on-surface leading-[1.05]">
              <span className="text-5xl">{t("admin.loginTitle")}</span>
            </h1>
            <div className="mt-3 w-16 h-[2px] bg-gradient-to-r from-tertiary-fixed-dim to-tertiary-fixed" />
          </div>

          {/* Lock badge */}
          <div className="w-12 h-12 rounded-xl gold-shimmer flex items-center justify-center mb-8">
            <Lock size={20} className="text-on-tertiary-fixed" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.username")}
              </label>
              <input
                id="login-email"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.password")}
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-secondary">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary" />
                {t("admin.rememberMe")}
              </label>
              <button type="button" className="hover:text-primary transition-colors cursor-pointer">
                {t("admin.forgotPassword")}
              </button>
            </div>

            {error && (
              <p className="text-xs text-error text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="gold-shimmer w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Lock size={14} />
              {submitting ? t("common.loading") : t("admin.loginBtn")}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link
              to="/"
              className="text-xs text-secondary hover:text-primary transition-colors"
            >
              {t("admin.backToWebsite")}
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
