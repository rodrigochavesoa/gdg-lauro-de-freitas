/**
 * Destinos aceitos pelos scripts de medição local. Não entra no CI.
 *
 * Exceção de fronteira, de propósito: o hostname de homolog fica neste
 * módulo como allowlist fail-closed. Não é segredo. Sem ele, um Vite local
 * com VITE_SUPABASE_URL trocado enviaria senha ou sessão de teste a outro
 * projeto. Configuração de squad continua em docs-local/. Não substituir
 * por um destino livre.
 */

export const HOMOLOG_HOSTNAME = "pcdfxnfhgdmzmcmlhxuv.supabase.co";
export const MEASURE_RUNS_MAX = 20;

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

/** Erro vazio significa a mesma origem (protocolo, host e porta) e BASE_URL em loopback. */
export function loopbackOriginError(pageUrl, baseUrl) {
  const baseError = loopbackBaseUrlError(baseUrl);
  if (baseError) return baseError;
  const page = parsedUrl(pageUrl);
  const base = parsedUrl(baseUrl);
  if (!page || !base) return "A página aberta não é uma URL.";
  if (page.origin !== base.origin) return "A página aberta não está na origem exata de BASE_URL.";
  return "";
}

/** A página só pode gravar a sessão quando location.origin é a origem exata de BASE_URL. */
export function documentMayStoreSession(locationOrigin, expectedOrigin) {
  return loopbackOriginError(locationOrigin, expectedOrigin) === "";
}

/** Vazio ou ausente usa o default. Outro valor: inteiro seguro de 1 até MEASURE_RUNS_MAX. */
export function measureRunsError(raw) {
  if (raw == null || String(raw).trim() === "") return "";
  const text = String(raw).trim();
  if (!/^[1-9]\d*$/.test(text)) return "MEASURE_RUNS precisa ser um inteiro positivo.";
  const value = Number(text);
  if (!Number.isSafeInteger(value) || String(value) !== text || value > MEASURE_RUNS_MAX) {
    return `MEASURE_RUNS precisa ser um inteiro de 1 a ${MEASURE_RUNS_MAX}.`;
  }
  return "";
}

export function measurePreflightError({ supabaseUrl, baseUrl, measureRuns: rawRuns }) {
  return homologSupabaseHostnameError(supabaseUrl || "")
    || loopbackBaseUrlError(baseUrl)
    || measureRunsError(rawRuns);
}

export function measureRuns(raw, fallback = 5) {
  const error = measureRunsError(raw);
  if (error) return 0;
  if (raw == null || String(raw).trim() === "") return fallback;
  return Number(String(raw).trim());
}

export function sampleCountError(values, expected, label) {
  const count = Array.isArray(values) ? values.length : 0;
  if (count !== expected) return `${label}: esperava ${expected} amostras e recebeu ${count}.`;
  return "";
}
