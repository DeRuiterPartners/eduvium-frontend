import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://oazvudqzhdwjbqwphstv.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9henZ1ZHF6aGR3amJxd3Boc3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDYwMDYsImV4cCI6MjA3NjU4MjAwNn0.nFjDz8k6tNRErTgUXnQpVsbyxwr06UqzE6PUbstFLEo";

if (!supabaseAnonKey) {
  console.error("VITE_SUPABASE_ANON_KEY is not set. Supabase Auth will not work properly.");
  throw new Error("VITE_SUPABASE_ANON_KEY is required");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

