/** Destinos aceitos pelos scripts de medição local. Não entra no CI. */

export const HOMOLOG_HOSTNAME = "pcdfxnfhgdmzmcmlhxuv.supabase.co";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function parsedUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Erro vazio significa hostname https exato, sem usuário na URL. */
export function homologSupabaseHostnameError(raw) {
  const url = parsedUrl(raw);
  if (!url) return "VITE_SUPABASE_URL não é uma URL.";
  if (url.username || url.password) return "VITE_SUPABASE_URL não pode trazer usuário ou senha.";
  if (url.protocol !== "https:") return "VITE_SUPABASE_URL precisa ser https.";
  if (url.hostname !== HOMOLOG_HOSTNAME) return "VITE_SUPABASE_URL precisa ser o hostname exato de homolog.";
  return "";
}

/** Erro vazio significa http(s) em loopback, sem usuário na URL. */
export function loopbackBaseUrlError(raw) {
  const url = parsedUrl(raw);
  if (!url) return "BASE_URL não é uma URL.";
  if (url.username || url.password) return "BASE_URL não pode trazer usuário ou senha.";
  if (url.protocol !== "http:" && url.protocol !== "https:") return "BASE_URL precisa ser http ou https.";
  if (!LOOPBACK_HOSTS.has(url.hostname)) return "BASE_URL precisa ser loopback (127.0.0.1, localhost ou ::1).";
  return "";
}

export function isLoopbackHostname(hostname) {
  return LOOPBACK_HOSTS.has(hostname);
}
