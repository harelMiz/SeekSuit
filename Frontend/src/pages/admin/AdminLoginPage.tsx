import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Shield, ArrowLeft } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const REMEMBER_KEY = "seeksuit_admin_email";
const LOCKOUT_KEY = "seeksuit_login_lockout";

function getLockState(): { attempts: number; lockedUntil: number } {
  try {
    const s = sessionStorage.getItem(LOCKOUT_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { attempts: 0, lockedUntil: 0 };
}

function saveLockState(s: { attempts: number; lockedUntil: number }) {
  sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(s));
}

export default function AdminLoginPage() {
  const { t } = useLang();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? "");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [lockState, setLockState] = useState(getLockState);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && session) navigate("/admin", { replace: true });
  }, [session, loading, navigate]);

  // Countdown when locked
  useEffect(() => {
    if (lockState.lockedUntil <= Date.now()) return;
    setSecondsLeft(Math.ceil((lockState.lockedUntil - Date.now()) / 1000));
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockState.lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(interval);
        const reset = { attempts: 0, lockedUntil: 0 };
        setLockState(reset);
        saveLockState(reset);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockState.lockedUntil]);

  const isLocked = lockState.lockedUntil > Date.now();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    setError(null);
    setSubmitting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (authError) {
      const newAttempts = lockState.attempts + 1;
      const newLockedUntil = newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0;
      const newState = { attempts: newAttempts, lockedUntil: newLockedUntil };
      setLockState(newState);
      saveLockState(newState);
      if (newLockedUntil > 0) {
        setError("יותר מדי ניסיונות. הטופס נחסם ל-5 דקות.");
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(`${t("admin.loginError")} (${remaining} ניסיון${remaining === 1 ? "" : "ות"} נותר${remaining === 1 ? "" : "ו"})`);
      }
      return;
    }

    const reset = { attempts: 0, lockedUntil: 0 };
    setLockState(reset);
    saveLockState(reset);

    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    navigate("/admin");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setForgotLoading(false);
    setForgotSent(true);
  }

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    <div className="min-h-screen flex" style={{ direction: "ltr" }}>

      {/* ── Editorial panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] px-16 py-12 relative overflow-hidden bg-neutral-950">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
        <div className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full bg-amber-800/10 blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full bg-amber-900/8 blur-[110px]" />

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

        <div className="relative z-10 flex items-center gap-2 text-xs text-outline">
          <Shield size={12} className="text-amber-400/50" />
          {t("admin.secureNote")}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center bg-neutral-950 px-8 py-12"
        dir="rtl"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 28px, rgba(255,255,255,0.025) 28px, rgba(255,255,255,0.025) 29px)",
        }}
      >
        <div className="lg:hidden text-center mb-10">
          <div className="font-headline text-4xl font-bold text-white">JENUDI</div>
          <div className="text-xs text-secondary tracking-wide mt-1">אופנת ג׳נודי</div>
        </div>

        <div className="w-full max-w-sm">

          {showForgot ? (
            /* ── Forgot password flow ── */
            <div>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); }}
                className="flex items-center gap-1.5 text-xs text-secondary hover:text-white transition-colors mb-6 cursor-pointer"
              >
                <ArrowLeft size={13} />
                חזרה להתחברות
              </button>

              <div className="mb-8">
                <h1 className="font-headline text-3xl font-bold text-white mb-2">
                  איפוס סיסמה
                </h1>
                <p className="text-sm text-secondary">
                  {forgotSent
                    ? "קישור לאיפוס נשלח למייל שלך. לחץ עליו להגדרת סיסמה חדשה."
                    : "הכנס את כתובת המייל שלך ונשלח לך קישור לאיפוס."}
                </p>
              </div>

              {!forgotSent && (
                <form onSubmit={handleForgot} className="space-y-6">
                  <div>
                    <label className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                      כתובת מייל
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={inputClass}
                      autoComplete="email"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="gold-shimmer w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-on-tertiary-fixed transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? "שולח..." : "שלח קישור לאיפוס"}
                  </button>
                </form>
              )}

              {forgotSent && (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full gold-shimmer flex items-center justify-center mx-auto mb-4">
                    <Shield size={20} className="text-on-tertiary-fixed" />
                  </div>
                  <p className="text-xs text-secondary">
                    לא קיבלת? בדוק את תיקיית הספאם.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ── Login form ── */
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="block w-10 h-[1.5px] bg-gradient-to-r from-tertiary-fixed to-tertiary-fixed-dim" />
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-on-tertiary-container">
                    {t("admin.loginSub")}
                  </p>
                </div>
                <h1 className="font-headline font-bold text-white leading-[1.05]">
                  <span className="text-5xl">{t("admin.loginTitle")}</span>
                </h1>
                <div className="mt-3 w-16 h-[2px] bg-gradient-to-r from-tertiary-fixed-dim to-tertiary-fixed" />
              </div>

              <div className="w-12 h-12 rounded-xl gold-shimmer flex items-center justify-center mb-8">
                <Lock size={20} className="text-on-tertiary-fixed" />
              </div>

              {isLocked ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-400 font-semibold mb-2">הטופס נחסם</p>
                  <p className="text-xs text-secondary">
                    יותר מדי ניסיונות כושלים. נסה שוב בעוד{" "}
                    <span className="text-white font-mono font-bold">
                      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                    </span>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="login-email" className="block text-[10px] text-secondary uppercase tracking-widest mb-1">
                      {t("admin.username")}
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      autoComplete="email"
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
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-secondary">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="accent-primary"
                      />
                      {t("admin.rememberMe")}
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotSent(false); }}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      {t("admin.forgotPassword")}
                    </button>
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 text-center">{error}</p>
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
              )}
            </>
          )}

          <div className="text-center mt-6">
            <Link
              to="/"
              className="text-xs text-secondary hover:text-white transition-colors"
            >
              {t("admin.backToWebsite")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
