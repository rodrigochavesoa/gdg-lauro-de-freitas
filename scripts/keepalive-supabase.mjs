/**
 * Leitura mínima nos projetos Free (homolog e prod) para atrasar o pause.
 * Secrets próprios no GitHub (não reutilizar homolog-rls). Não imprime URL, chave nem body.
 *
 * pwsh: pnpm keepalive:supabase
 */
import { OFFICIAL_HOMOLOG_PROJECT_REF, OFFICIAL_PROD_PROJECT_REF } from "./prod-migrations.mjs";

export const KEEPALIVE_REST_PATH = "/rest/v1/jobs?select=id&limit=1";

export const KEEPALIVE_TARGETS = {
  homolog: {
    envUrl: "HOMOLOG_SUPABASE_URL",
    envKey: "HOMOLOG_SUPABASE_PUBLISHABLE_KEY",
    hostname: `${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co`,
  },
  prod: {
    envUrl: "PROD_SUPABASE_URL",
    envKey: "PROD_SUPABASE_PUBLISHABLE_KEY",
    hostname: `${OFFICIAL_PROD_PROJECT_REF}.supabase.co`,
  },
};

const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isLegacyAnonJwt(key) {
  return JWT_RE.test(String(key || "").trim());
}

function jwtRole(key) {
  try {
    const payload = String(key).trim().split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
  } catch {
    return "";
  }
}

/** Recusa secret/service_role. Vazio = chave aceitável para REST público. */
export function privilegedKeyError(key) {
  const text = String(key || "").trim();
  if (!text) return "chave ausente.";
  if (text.startsWith("sb_secret_")) return "chave secret recusada.";
  if (isLegacyAnonJwt(text) && jwtRole(text) === "service_role") return "chave service_role recusada.";
  return "";
}

export function targetUrlError(raw, hostname) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "URL inválida.";
  }
  if (url.username || url.password) return "URL não pode trazer usuário ou senha.";
  if (url.protocol !== "https:") return "URL precisa ser https.";
  if (url.hostname !== hostname) return "URL fora da allowlist.";
  if (url.port) return "URL não pode trazer porta.";
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    return "URL precisa ser a origem do projeto.";
  }
  return "";
}

/**
 * sb_publishable_ só em `apikey`. Bearer só para JWT anon legado.
 * @see https://supabase.com/docs/guides/getting-started/api-keys
 */
export function restHeaders(key) {
  const error = privilegedKeyError(key);
  if (error) throw new Error(error);
  const apikey = String(key).trim();
  const headers = { apikey, Accept: "application/json" };
  if (isLegacyAnonJwt(apikey)) headers.Authorization = `Bearer ${apikey}`;
  return headers;
}

export function formatKeepaliveLog(result) {
  const name = result?.name === "prod" ? "prod" : "homolog";
  const status = Number(result?.status);
  if (!result?.ok && (!Number.isInteger(status) || status <= 0)) return `keepalive ${name} error`;
  return `keepalive ${name} ${status}`;
}

export async function pingTarget({ name, url, key, fetchImpl = fetch, timeoutMs = 20000 }) {
  const spec = KEEPALIVE_TARGETS[name];
  if (!spec || targetUrlError(url, spec.hostname) || privilegedKeyError(key)) {
    return { name, ok: false, status: 0 };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${new URL(url).origin}${KEEPALIVE_REST_PATH}`, {
      method: "GET",
      headers: restHeaders(key),
      signal: controller.signal,
    });
    const status = Number(response.status) || 0;
    return { name, ok: status >= 200 && status < 300, status };
  } catch {
    return { name, ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function runKeepalive(env = process.env, fetchImpl = fetch) {
  const results = [];
  for (const name of ["homolog", "prod"]) {
    const spec = KEEPALIVE_TARGETS[name];
    const result = await pingTarget({
      name,
      url: env[spec.envUrl],
      key: env[spec.envKey],
      fetchImpl,
    });
    console.log(formatKeepaliveLog(result));
    results.push(result);
  }
  return results;
}

const invokedDirectly = process.argv[1]?.replaceAll("\\", "/").endsWith("keepalive-supabase.mjs");
if (invokedDirectly) {
  const results = await runKeepalive();
  if (results.some((item) => !item.ok)) process.exit(1);
}
