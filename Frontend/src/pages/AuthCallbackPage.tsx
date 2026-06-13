import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabase";

// Handles Supabase auth redirects: password reset and invite acceptance.
// Supabase appends #access_token=...&type=recovery|invite to the redirect URL.
// The Supabase client auto-processes the hash on load and fires onAuthStateChange.
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase processes the URL hash automatically; we listen for the result.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Also check if there's already an active session from the hash
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות / Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("סיסמה חייבת להכיל לפחות 6 תווים / Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    navigate("/admin");
  };

  const inputClass =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary py-3 text-sm text-on-surface placeholder-secondary outline-none transition-colors";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center">
            <Lock size={20} className="text-primary" />
          </div>
        </div>

        <h1 className="font-headline text-2xl font-bold text-on-surface text-center mb-2">
          הגדרת סיסמה
        </h1>
        <p className="text-sm text-secondary text-center mb-8">
          Set your admin password
        </p>

        {!ready && (
          <p className="text-sm text-secondary text-center">מאמת זהות...</p>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                placeholder="סיסמה חדשה / New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="אימות סיסמה / Confirm password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            {error && (
              <p className="text-xs text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "שומר..." : "שמור סיסמה / Save Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
