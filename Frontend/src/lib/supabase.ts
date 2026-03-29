import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Single shared Supabase client instance for the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
