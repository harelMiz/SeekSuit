import axios from "axios";
import { supabase } from "../lib/supabase";

// Axios instance — all requests go through the Vite dev proxy (/api → localhost:5000)
// In production, replace baseURL with the deployed backend URL
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach Supabase session token on every request so admin endpoints can verify the caller
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, force a sign-out and redirect to login so stale sessions are cleared
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401 && window.location.pathname.startsWith("/admin")) {
      await supabase.auth.signOut();
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  },
);

export default api;
