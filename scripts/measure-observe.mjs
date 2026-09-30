import { HOMOLOG_HOSTNAME, homologSupabaseHostnameError, loopbackOriginError } from "./measure-target.mjs";

const SAFE_CORRELATION = /^[a-f0-9]{12}$/;
const CACHE_NAMES = new Set([
  "catalog",
  "applications",
  "privacy",
  "avatar-signed-url",
  "curation-queue",
  "curation-detail",
]);

export function safeFailureText(raw) {
  const match = String(raw || "").match(/net::ERR_[A-Z0-9_]+/);
  return match ? match[0] : "failed";
}

export function restPathFromUrl(raw) {
  try {
    const url = new URL(raw);
    if (!url.pathname.includes("/rest/v1/") && !url.pathname.includes("/auth/v1/")) return "";
    return url.pathname.replace(/^.*\/(?:rest|auth)\/v1\//, "");
  } catch {
    return "";
  }
}

export function supabaseHostError(raw) {
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    return "";
  }
  if (!host.endsWith(".supabase.co")) return "";
  if (host === HOMOLOG_HOSTNAME) return "";
  return "A página chamou um projeto Supabase que não é o de homolog.";
}

/** Só campos já redigidos pelo ops.*. Correlação fora do formato é descartada. */
export function opsEventFromConsole(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.event_name !== "string" || !value.event_name.startsWith("ops.")) return null;
  if (!SAFE_CORRELATION.test(String(value.correlation_id || ""))) return null;
  return {
    event_name: value.event_name,
    route: typeof value.route === "string" ? value.route : "",
    action: typeof value.action === "string" ? value.action : "",
    outcome: typeof value.outcome === "string" ? value.outcome : "",
    error_class: typeof value.error_class === "string" ? value.error_class : "",
    correlation_id: value.correlation_id,
  };
}

export function sanitizeCacheStats(stats) {
  if (!stats || typeof stats !== "object") return null;
  const out = {};
  for (const [name, row] of Object.entries(stats)) {
    if (!CACHE_NAMES.has(name)) continue;
    const hit = Number(row?.hit);
    const miss = Number(row?.miss);
    if (!Number.isInteger(hit) || !Number.isInteger(miss)) continue;
    out[name] = { hit, miss };
  }
  return out;
}

export function cacheDelta(before, after) {
  const left = sanitizeCacheStats(before) || {};
  const right = sanitizeCacheStats(after) || {};
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  const delta = {};
  for (const name of names) {
    const hit = (right[name]?.hit || 0) - (left[name]?.hit || 0);
    const miss = (right[name]?.miss || 0) - (left[name]?.miss || 0);
    if (hit || miss) delta[name] = { hit, miss };
  }
  return delta;
}

export function probeBackendError(probe) {
  if (!probe) return "A página em execução não expõe o probe de medição (pnpm dev).";
  return homologSupabaseHostnameError(probe.supabaseUrl || "");
}

/** Devolve só o erro de backend e os contadores. A URL compilada não sai daqui. */
export async function readLiveProbe(page) {
  const raw = await page.evaluate(() => {
    const probe = globalThis.__gdgMeasure;
    if (!probe) return null;
    return {
      supabaseUrl: typeof probe.supabaseUrl === "function" ? String(probe.supabaseUrl()) : "",
      cache: typeof probe.cacheStats === "function" ? probe.cacheStats() : null,
    };
  });
  if (!raw) return { backendError: probeBackendError(null), cache: null };
  return {
    backendError: probeBackendError(raw),
    cache: sanitizeCacheStats(raw.cache),
  };
}

export function attachObservers(page, buckets) {
  const onRequest = (request) => {
    const error = supabaseHostError(request.url());
    if (error) buckets.foreign.push(error);
  };
  const onFailed = (request) => {
    const path = restPathFromUrl(request.url());
    if (!path) return;
    buckets.networkErrors.push({ path, error: safeFailureText(request.failure()?.errorText) });
  };
  const onConsole = (message) => {
    for (const arg of message.args()) {
      arg.jsonValue().then((value) => {
        const event = opsEventFromConsole(value);
        if (event) buckets.opsEvents.push(event);
      }).catch(() => {});
    }
  };
  page.on("request", onRequest);
  page.on("requestfailed", onFailed);
  page.on("console", onConsole);
  return () => buckets.foreign[0] || "";
}

export async function livePageError(page, baseUrl) {
  const originError = loopbackOriginError(page.url(), baseUrl);
  if (originError) return originError;
  try {
    await page.waitForFunction(() => globalThis.__gdgMeasure, { timeout: 30_000 });
  } catch {
    return probeBackendError(null);
  }
  const live = await readLiveProbe(page);
  return live.backendError;
}
