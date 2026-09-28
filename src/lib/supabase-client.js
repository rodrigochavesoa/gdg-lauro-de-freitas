import { createClient } from "@supabase/supabase-js";

/**
 * Tipos do schema public de homolog. Regenerar com `pnpm types:database`.
 * O aplicativo permanece JavaScript; este typedef não liga um compilador ao app.
 * @typedef {import("./database.types").Database} Database
 */

let browserClient;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}
