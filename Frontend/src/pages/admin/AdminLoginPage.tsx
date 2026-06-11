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

    // Successful login — navigate to dashboard
    navigate("/admin");
  }

  // Bottom-border-only input style for clean minimal look
  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">

      <div className="w-full max-w-sm">
        {/* Logo — italic serif */}
        <div className="text-center mb-10">
          <div className="font-headline italic text-3xl text-on-surface mb-1">
            {t("admin.loginBrand")}
          </div>
          <div className="text-xs text-secondary tracking-wide">{t("admin.portal")}</div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-10">
          {/* Card header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl gold-shimmer flex items-center justify-center mb-4">
              <Lock size={20} className="text-on-tertiary-fixed" />
            </div>
            <h1 className="font-headline text-2xl font-bold text-on-surface">
              {t("admin.loginTitle")}
            </h1>
            <p className="text-xs text-secondary mt-1 text-center">
              {t("admin.loginSub")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username / email */}
            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.username")}
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                {t("admin.password")}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Remember + forgot */}
            <div className="flex items-center justify-between text-xs text-secondary">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary" />
                {t("admin.rememberMe")}
              </label>
              <button type="button" className="hover:text-primary transition-colors">
                {t("admin.forgotPassword")}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs text-error text-center">{error}</p>
            )}

            {/* Submit — gold gradient */}
            <button
              type="submit"
              disabled={submitting}
              className="gold-shimmer w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Lock size={14} />
              {submitting ? t("common.loading") : t("admin.loginBtn")}
            </button>
          </form>

          {/* Auth note */}
          <p className="text-xs text-outline text-center mt-5">{t("admin.loginNote")}</p>
        </div>

        {/* Back to website */}
        <div className="text-center mt-5">
          <Link
            to="/"
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            {t("admin.backToWebsite")}
          </Link>
        </div>

        {/* Secure note */}
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-outline">
          <Shield size={12} />
          {t("admin.secureNote")}
        </div>
      </div>
    </div>
  );
}
