import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://zcqncbdfurhlnspzziyd.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ymLV5njVvbll5eL9J_HP8g_7AfElGhz";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  accessToken: async () => window.ZenVentoraAccount?.getAccessToken() || null,
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// GitHub/GitLab OAuth is deliberately isolated from the product database client.
// Its provider session is used only to obtain a Git provider access token.
export const gitSupabase = createClient(supabaseUrl, supabasePublishableKey);
