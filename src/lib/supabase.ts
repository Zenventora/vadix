import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://zcqncbdfurhlnspzziyd.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ymLV5njVvbll5eL9J_HP8g_7AfElGhz";

// This client targets VADIX's own Supabase project. The shared ZenVentora
// account session is issued by a different Supabase project, so forwarding that
// JWT here causes PostgREST PGRST301 (JWT signing key mismatch). Keep this
// project client on its own publishable/anonymous key; cross-project account
// identity must be handled by a trusted server endpoint, not a foreign JWT.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// GitHub/GitLab OAuth is deliberately isolated from the product database client.
// Its provider session is used only to obtain a Git provider access token.
export const gitSupabase = createClient(supabaseUrl, supabasePublishableKey);
