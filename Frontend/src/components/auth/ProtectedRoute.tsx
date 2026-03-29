import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";

// Wraps admin routes — redirects to /admin/login if not authenticated
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  // While Supabase resolves the session, render nothing to avoid a flash
  if (loading) return null;

  // Not logged in → redirect to login page
  if (!session) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}
