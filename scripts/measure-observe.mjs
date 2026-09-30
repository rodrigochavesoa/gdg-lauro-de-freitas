import { HOMOLOG_HOSTNAME, homologSupabaseHostnameError, loopbackOriginError } from "./measure-target.mjs";

const SAFE_CORRELATION = /^[a-f0-9]{12}$/;
const OPS_EVENTS = new Set(["ops.login", "ops.search", "ops.application", "ops.ingestion", "ops.rpc"]);
const OPS_OUTCOMES = new Set(["success", "failure", "blocked", "rate_limited"]);
const OPS_ACTIONS = new Set([
  "unknown",
  "catalog_search",
  "staff_password",
  "session_hydrate",
  "google_oauth",
  "apply_to_job",
  "withdraw_application",
  "register_job_ingestion",
  "process_job_ingestion",
  "submit_curation_review",
  "resubmit_job_for_curation",
  "set_job_curation_priority",
]);
const OPS_ROUTES = new Set([
  "unknown",
  "/",
  "/vagas",
  "/eventos",
  "/eventos/devfest-lauro-de-freitas-2026",
  "/eventos/devopsdays-salvador-2026",
  "/newsletter",
  "/jobs/:id",
  "/minhas-candidaturas",
  "/preferencias",
  "/perfil",
  "/onboarding",
  "/login",
  "/admin",
  "/admin/curadoria",
  "/admin/ingestao",
  "/admin/vagas",
  "/admin/vagas/nova",
  "/admin/vagas/:id",
]);
const OPS_CLASSES = new Set([
  "none",
  "unknown",
  "rate_limited",
  "client_unconfigured",
  "apply_auth_required",
  "apply_profile_incomplete",
  "apply_job_unavailable",
  "apply_duplicate",
  "apply_withdraw_blocked",
  "apply_not_found",
  "apply_staff_blocked",
  "apply_unavailable",
  "auth_forbidden",
  "auth_invalid",
  "auth_unavailable",
  "search_unavailable",
  "search_rejected",
  "ingest_expired",
  "ingest_duplicate",
  "ingest_invalid",
  "ingest_unavailable",
  "ingest_materialize_failed",
  "rpc_forbidden",
  "rpc_conflict",
  "rpc_unavailable",
  "rpc_rejected",
]);
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

/** Lista fechada. Formato parecido com identificador técnico não entra. */
export function opsEventFromConsole(value) {
  if (!value || typeof value !== "object") return null;
  if (!OPS_EVENTS.has(value.event_name)) return null;
  if (!SAFE_CORRELATION.test(String(value.correlation_id || ""))) return null;
  if (!OPS_ROUTES.has(value.route)) return null;
  if (!OPS_ACTIONS.has(value.action)) return null;
  if (!OPS_OUTCOMES.has(value.outcome)) return null;
  if (!OPS_CLASSES.has(value.error_class)) return null;
  return {
    event_name: value.event_name,
    route: value.route,
    action: value.action,
    outcome: value.outcome,
    error_class: value.error_class,
    correlation_id: value.correlation_id,
  };
}

export function openRequestRow(path) {
  return { path: String(path || ""), settled: false, pending: "response" };
}

/** Pedido anterior à amostra não conta como captura incompleta desta linha. */
export function requestsOpenedDuring(inflight, before) {
  const opened = [];
  for (const request of inflight) {
    if (before?.has(request)) continue;
    opened.push(request);
  }
  return opened;
}

export function unsettledRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.status == null)
    .map((row) => openRequestRow(row.path));
}

/** Leituras que estouraram o prazo. Slot já descartado não entra de novo. */
export function expiredReadRows(slots, pending) {
  const rows = [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object" || slot.drop) continue;
    slot.drop = true;
    const row = { settled: false, pending };
    if (slot.path) row.path = String(slot.path);
    rows.push(row);
  }
  return rows;
}

export function createReadSample() {
  return {};
}

/** Só a amostra que abriu a leitura. Pendência já descartada fica de fora. */
export function sampleReads(tasks, sample) {
  if (!sample) return [];
  const owned = [];
  for (const task of tasks) {
    if (!task || task.sample !== sample) continue;
    if (task.slot?.drop) continue;
    owned.push(task);
  }
  return owned;
}

export async function drainSample(tasks, sample, timeoutMs = SETTLE_MS, pending = "body") {
  const owned = sampleReads(tasks, sample);
  const unsettled = [];
  const result = await drainPromises(owned, timeoutMs, () => {
    unsettled.push(...expiredReadRows(owned.map((task) => task.slot), pending));
  });
  return { timedOut: result.timedOut, unsettled };
}

export async function waitForQuiet(isBusy, timeoutMs = SETTLE_MS) {
  const deadline = Date.now() + timeoutMs;
  while (isBusy() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { timedOut: Boolean(isBusy()) };
}

export async function drainPromises(pending, timeoutMs = SETTLE_MS, onTimeout = () => {}) {
  const tasks = [...pending];
  if (tasks.length === 0) return { timedOut: false };
  let timedOut = false;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    Promise.all(tasks).then(finish, finish);
    setTimeout(() => {
      if (settled) return;
      timedOut = true;
      try {
        onTimeout();
      } finally {
        finish();
      }
    }, timeoutMs);
  });
  return { timedOut };
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
  const active = { sample: null };
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
      const slot = { drop: false, sample: active.sample };
      let task;
      task = arg.jsonValue().then((value) => {
        if (slot.drop) return;
        const event = opsEventFromConsole(value);
        if (event) buckets.opsEvents.push(event);
      }).catch(() => {}).finally(() => {
        pendingConsole.delete(task);
      });
      task.sample = slot.sample;
      task.slot = slot;
      pendingConsole.add(task);
    }
  };
  page.on("request", onRequest);
  page.on("requestfailed", onFailed);
  page.on("console", onConsole);
  const foreignError = () => buckets.foreign[0] || "";
  foreignError.beginSample = () => {
    active.sample = createReadSample();
    return active.sample;
  };
  foreignError.drain = () => drainSample(pendingConsole, active.sample, SETTLE_MS, "console");
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
