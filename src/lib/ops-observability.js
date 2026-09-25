/**
 * MVP-014 — evento operacional mínimo.
 * Sai só no console estruturado. Não grava telemetria no banco e não substitui a auditoria MVP-005.
 */

export const OPS_FLOWS = Object.freeze(["login", "search", "application", "ingestion", "rpc"]);

export const OPS_OUTCOMES = Object.freeze(["success", "failure", "blocked", "rate_limited"]);

export const OPS_ENVIRONMENTS = Object.freeze(["local", "homolog", "ci", "preview"]);

const FLOW_EVENT = Object.freeze({
  login: "ops.login",
  search: "ops.search",
  application: "ops.application",
  ingestion: "ops.ingestion",
  rpc: "ops.rpc",
});

const OUTCOME_SET = new Set(OPS_OUTCOMES);
const ENVIRONMENT_SET = new Set(OPS_ENVIRONMENTS);

const SAFE_ACTION = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_ROUTE = /^\/[a-z0-9/_:-]{0,80}$/;
const SAFE_CLASS = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_SHA = /^[0-9a-f]{7}$/;
const SAFE_CORRELATION = /^[a-f0-9]{12}$/;

const APPLY_BLOCKED = Object.freeze({
  "authentication required": "apply_auth_required",
  "profile incomplete": "apply_profile_incomplete",
  "job is not approved": "apply_job_unavailable",
  "job not found": "apply_job_unavailable",
  "already applied": "apply_duplicate",
  "cannot withdraw application": "apply_withdraw_blocked",
  "application not found": "apply_not_found",
  "staff cannot apply": "apply_staff_blocked",
  "staff cannot withdraw": "apply_staff_blocked",
});

function errorText(error) {
  return [
    error?.code,
    error?.status,
    error?.message,
    error?.details,
    error?.hint,
    error?.cause?.code,
    error?.cause?.message,
  ]
    .filter((part) => part != null && part !== "")
    .join(" ")
    .toLowerCase();
}

function isRateLimited(error) {
  const text = errorText(error);
  return (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("muitas tentativas") ||
    text.includes("429")
  );
}

function isClientUnconfigured(error) {
  const text = errorText(error);
  return text.includes("não configuradas") || text.includes("cliente de ingestão ausente") || text.includes("cliente ausente");
}

function isAuthForbidden(error) {
  const text = errorText(error);
  return (
    text.includes("não é administradora") ||
    text.includes("não tem permissão") ||
    text.includes("permission denied") ||
    text.includes("42501") ||
    text.includes("not authorized")
  );
}

function isAuthInvalid(error) {
  const text = errorText(error);
  return text.includes("invalid login") || text.includes("invalid_credentials") || text.includes("invalid grant") || text.includes("email not confirmed");
}

function isPrivilegedBlocked(error) {
  const text = errorText(error);
  return text.includes("aal2") || text.includes("authenticator assurance") || text.includes("segundo fator") || text.includes("insufficient");
}

function isUnavailable(error) {
  const text = errorText(error);
  return (
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("timeout") ||
    text.includes("schema cache") ||
    text.includes("502") ||
    text.includes("503") ||
    text.includes("504") ||
    text.includes("could not find the function") ||
    text.includes("could not find the table")
  );
}

function isConflict(error) {
  const text = errorText(error);
  return text.includes("23505") || text.includes("duplicate key") || text.includes("fingerprint");
}

function isIngestExpired(error) {
  const text = errorText(error);
  return text.includes("expired") || text.includes("expirad");
}

function isIngestDuplicate(error) {
  const text = errorText(error);
  return isConflict(error) || text.includes("duplicate_010");
}

function isIngestInvalid(error) {
  const text = errorText(error);
  return text.includes("payload") || text.includes("locator") || text.includes("inválid") || text.includes("invalid") || text.includes("vazio") || text.includes("excede");
}

export function resolveOpsEnvironment(env = {}) {
  const mode = String(env?.MODE ?? "");
  if (mode === "test" || env?.VITEST) return "ci";
  const explicit = String(env?.VITE_OPS_ENVIRONMENT ?? "").trim().toLowerCase();
  if (ENVIRONMENT_SET.has(explicit)) return explicit;
  const vercel = String(env?.VITE_VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel === "preview") return "preview";
  return "local";
}

export function resolveReleaseSha(env = {}) {
  const raw = String(env?.VITE_RELEASE_SHA ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(raw)) return null;
  return raw.slice(0, 7);
}

/**
 * VERCEL_ENV é a fonte do gate. Preview também é build de produção do Vite,
 * então import.meta.env.PROD não decide. Conflito com VITE_VERCEL_ENV falha o build.
 */
export function authoritativeVercelEnv(vercelEnv, viteVercelEnv) {
  const authoritative = String(vercelEnv ?? "").trim().toLowerCase();
  const override = String(viteVercelEnv ?? "").trim().toLowerCase();
  if (!authoritative) return "";
  if (authoritative !== "production" && authoritative !== "preview" && authoritative !== "development") {
    throw new Error(`VERCEL_ENV inválido: ${authoritative}`);
  }
  if (override && override !== authoritative) {
    throw new Error(`VITE_VERCEL_ENV=${override} conflita com VERCEL_ENV=${authoritative}. Remova VITE_VERCEL_ENV.`);
  }
  if (authoritative === "development") return "";
  return authoritative;
}

/** Produção não emite. Vitest também não, salvo VITE_OPS_EMIT=true no teste que prova o evento. */
export function opsEmissionEnabled(env = import.meta.env) {
  if (String(env?.VITE_VERCEL_ENV ?? "").trim().toLowerCase() === "production") return false;
  const testMode = String(env?.MODE ?? "") === "test" || Boolean(env?.VITEST);
  if (testMode && String(env?.VITE_OPS_EMIT ?? "") !== "true") return false;
  return true;
}

export function createCorrelationId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  let hex = "";
  if (typeof randomUUID === "function") {
    try {
      hex = String(randomUUID()).replace(/-/g, "").toLowerCase();
    } catch {
      hex = "";
    }
  }
  if (!/^[0-9a-f]{12,}$/.test(hex)) {
    hex = `${Date.now().toString(16)}${Math.floor(Math.random() * 0xffff).toString(16)}`.padEnd(12, "0");
  }
  return hex.slice(0, 12);
}

export function technicalRoute(pathname) {
  const path = String(pathname ?? "").split("?")[0].split("#")[0];
  if (!path.startsWith("/")) return "unknown";
  const normalized = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id");
  return SAFE_ROUTE.test(normalized) ? normalized : "unknown";
}

export function classifyOpsFailure(flow, error) {
  if (isRateLimited(error)) return { outcome: "rate_limited", error_class: "rate_limited" };
  if (isClientUnconfigured(error)) return { outcome: "failure", error_class: "client_unconfigured" };

  if (flow === "application") {
    const blocked = APPLY_BLOCKED[error?.code];
    if (blocked) return { outcome: "blocked", error_class: blocked };
    return { outcome: "failure", error_class: "apply_unavailable" };
  }

  if (flow === "login") {
    if (isAuthForbidden(error) || isPrivilegedBlocked(error)) return { outcome: "blocked", error_class: "auth_forbidden" };
    if (isAuthInvalid(error)) return { outcome: "failure", error_class: "auth_invalid" };
    return { outcome: "failure", error_class: "auth_unavailable" };
  }

  if (flow === "search") {
    if (isUnavailable(error)) return { outcome: "failure", error_class: "search_unavailable" };
    return { outcome: "failure", error_class: "search_rejected" };
  }

  if (flow === "ingestion") {
    if (isIngestExpired(error)) return { outcome: "blocked", error_class: "ingest_expired" };
    if (isIngestDuplicate(error)) return { outcome: "blocked", error_class: "ingest_duplicate" };
    if (isIngestInvalid(error)) return { outcome: "failure", error_class: "ingest_invalid" };
    if (isUnavailable(error)) return { outcome: "failure", error_class: "ingest_unavailable" };
    return { outcome: "failure", error_class: "ingest_unavailable" };
  }

  if (flow === "rpc") {
    if (isAuthForbidden(error) || isPrivilegedBlocked(error)) return { outcome: "blocked", error_class: "rpc_forbidden" };
    if (isConflict(error)) return { outcome: "blocked", error_class: "rpc_conflict" };
    if (isUnavailable(error)) return { outcome: "failure", error_class: "rpc_unavailable" };
    return { outcome: "failure", error_class: "rpc_rejected" };
  }

  return { outcome: "failure", error_class: "unknown" };
}

export function classifyIngestionResult(row) {
  const outcome = String(row?.outcome ?? "");
  const code = String(row?.failure_code ?? "");
  if (outcome === "expired" || code === "expired") return { outcome: "blocked", error_class: "ingest_expired" };
  if (outcome === "duplicate_010" || code === "duplicate_010") return { outcome: "blocked", error_class: "ingest_duplicate" };
  if (code === "materialize_failed") return { outcome: "failure", error_class: "ingest_materialize_failed" };
  if (code === "payload_invalid" || outcome === "failed") return { outcome: "failure", error_class: "ingest_invalid" };
  return { outcome: "success", error_class: "none" };
}

export function buildOpsEvent(partial = {}, env = partial.env ?? import.meta.env) {
  const eventName = FLOW_EVENT[partial.flow];
  if (!eventName) return null;
  const outcome = OUTCOME_SET.has(partial.outcome) ? partial.outcome : "failure";
  const errorClass = SAFE_CLASS.test(partial.error_class ?? "") ? partial.error_class : "unknown";
  const action = SAFE_ACTION.test(partial.action ?? "") ? partial.action : "unknown";
  const route = SAFE_ROUTE.test(partial.route ?? "") ? partial.route : "unknown";
  const correlation = SAFE_CORRELATION.test(partial.correlation_id ?? "") ? partial.correlation_id : createCorrelationId();
  const release = resolveReleaseSha(env);
  return {
    event_name: eventName,
    environment: resolveOpsEnvironment(env),
    release_sha: SAFE_SHA.test(release ?? "") ? release : null,
    route,
    action,
    outcome,
    error_class: errorClass,
    correlation_id: correlation,
    occurred_at: new Date().toISOString(),
  };
}

export function emitOpsEvent(partial, sink = console) {
  const env = partial?.env ?? import.meta.env;
  if (!opsEmissionEnabled(env)) return null;
  const event = buildOpsEvent(partial, env);
  if (!event) return null;
  sink?.info?.(event);
  return event;
}

export async function runObserved(spec, fn) {
  const env = spec?.env ?? import.meta.env;
  if (!opsEmissionEnabled(env)) return fn();
  const correlationId = createCorrelationId();
  try {
    const result = await fn();
    const verdict = spec.classifyResult ? spec.classifyResult(result) : { outcome: "success", error_class: "none" };
    emitOpsEvent({ ...spec, correlation_id: correlationId, ...verdict, env }, spec.sink);
    return result;
  } catch (error) {
    emitOpsEvent({ ...spec, correlation_id: correlationId, ...classifyOpsFailure(spec.flow, error), env }, spec.sink);
    throw error;
  }
}
