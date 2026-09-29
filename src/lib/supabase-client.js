import { createClient } from "@supabase/supabase-js";

/**
 * Tipos do schema public de homolog. Regenerar com `pnpm types:database`.
 * `pnpm types:client` checa só este módulo. O restante do app continua JavaScript.
 * @typedef {import("./database.types").Database} Database
 */

/** @type {import("@supabase/supabase-js").SupabaseClient<Database> | null} */
let browserClient = null;

/**
 * @returns {import("@supabase/supabase-js").SupabaseClient<Database> | null}
 */
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

  browserClient = createDatabaseClient(url, key);
  return browserClient;
}

/**
 * @param {string} url
 * @param {string} key
 * @returns {import("@supabase/supabase-js").SupabaseClient<Database>}
 */
function createDatabaseClient(url, key) {
  const create = /** @type {typeof createClient<Database>} */ (createClient);
  return create(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
