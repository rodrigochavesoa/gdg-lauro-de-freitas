import { HOMOLOG_HOSTNAME, homologSupabaseHostnameError, loopbackOriginError } from "./measure-target.mjs";

const SAFE_CORRELATION = /^[a-f0-9]{12}$/;
const SAFE_ACTION = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_ROUTE = /^\/[a-z0-9/_:-]{0,80}$/;
const SAFE_CLASS = /^[a-z][a-z0-9_]{0,63}$/;
const OPS_EVENTS = new Set(["ops.login", "ops.search", "ops.application", "ops.ingestion", "ops.rpc"]);
const OPS_OUTCOMES = new Set(["success", "failure", "blocked", "rate_limited"]);
const SETTLE_MS = 5_000;
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

/** Allowlist do contrato de `buildOpsEvent`. Valor fora do contrato descarta o evento. */
export function opsEventFromConsole(value) {
  if (!value || typeof value !== "object") return null;
  if (!OPS_EVENTS.has(value.event_name)) return null;
  if (!SAFE_CORRELATION.test(String(value.correlation_id || ""))) return null;
  const route = value.route === "unknown" || SAFE_ROUTE.test(value.route) ? value.route : "";
  const action = SAFE_ACTION.test(value.action) ? value.action : "";
  const outcome = OPS_OUTCOMES.has(value.outcome) ? value.outcome : "";
  const errorClass = SAFE_CLASS.test(value.error_class) ? value.error_class : "";
  if (!route || !action || !outcome || !errorClass) return null;
  return {
    event_name: value.event_name,
    route,
    action,
    outcome,
    error_class: errorClass,
    correlation_id: value.correlation_id,
  };
}

export function unsettledRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.status == null)
    .map((row) => ({ path: String(row.path || ""), settled: false }));
}

export async function waitForQuiet(isBusy, timeoutMs = SETTLE_MS) {
  const deadline = Date.now() + timeoutMs;
  while (isBusy() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function drainPromises(pending) {
  await Promise.all([...pending]);
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
  const pendingConsole = new Set();
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
      let task;
      task = arg.jsonValue().then((value) => {
        const event = opsEventFromConsole(value);
        if (event) buckets.opsEvents.push(event);
      }).catch(() => {}).finally(() => pendingConsole.delete(task));
      pendingConsole.add(task);
    }
  };
  page.on("request", onRequest);
  page.on("requestfailed", onFailed);
  page.on("console", onConsole);
  const foreignError = () => buckets.foreign[0] || "";
  foreignError.drain = () => drainPromises(pendingConsole);
  return foreignError;
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
