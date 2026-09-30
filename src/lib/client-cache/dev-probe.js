import { getClientCacheStats } from "./stats.js";

/**
 * Só em dev. A medição local lê hit/miss e a URL compilada do Supabase.
 * Produção não instala o probe. Os contadores não incluem o conteúdo do cache.
 */
export function installClientCacheProbe(target = globalThis, options = {}) {
  const dev = options.dev ?? import.meta.env.DEV;
  if (!dev || !target) return;
  const supabaseUrl = options.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? "";
  Object.defineProperty(target, "__gdgMeasure", {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      cacheStats() {
        return getClientCacheStats();
      },
      supabaseUrl() {
        return supabaseUrl;
      },
    }),
  });
}
