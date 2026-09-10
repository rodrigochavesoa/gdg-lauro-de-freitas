import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";

const APPLICATION_SELECT = "id,job_id,candidate_id,status,snapshot,created_at,updated_at";

const APPLICATION_LIST_SELECT = `${APPLICATION_SELECT}, jobs ( title, companies ( name ) )`;

export const APPLICATION_STATUS_COPY = {
  submitted: { label: "Enviada", title: "Candidatura enviada!", body: "Boa sorte — a empresa receberá seu perfil." },
  reviewing: { label: "Em análise", title: "Candidatura em análise", body: "A empresa já pode estar revisando seu perfil." },
  accepted: { label: "Aceita", title: "Candidatura aceita", body: "A empresa registrou aceite desta candidatura." },
  rejected: { label: "Encerrada", title: "Candidatura encerrada", body: "Esta candidatura não segue no processo." },
  withdrawn: { label: "Retirada", title: "Candidatura retirada", body: "Você retirou esta candidatura. Não é possível reenviar no V1." },
};

const STABLE_CODES = [
  "authentication required",
  "profile incomplete",
  "job is not approved",
  "job not found",
  "already applied",
  "rate limit exceeded",
  "cannot withdraw application",
  "application not found",
];

const UX_BY_CODE = {
  "authentication required": "Entre para se candidatar.",
  "profile incomplete": "Complete seu perfil para se candidatar.",
  "job is not approved": "Esta vaga não está disponível para candidatura.",
  "job not found": "Esta vaga não está disponível para candidatura.",
  "already applied": "Você já se candidatou a esta vaga.",
  "rate limit exceeded": "Muitas tentativas. Aguarde um minuto para se candidatar de novo.",
  "cannot withdraw application": "Não é possível retirar esta candidatura.",
  "application not found": "Candidatura não encontrada.",
};

async function resolveCandidateId(client, userId) {
  if (userId) return userId;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) return null;
  return userData.user.id;
}

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

export function getApplyErrorCode(error) {
  const raw = [
    typeof error === "string" ? error : "",
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return STABLE_CODES.find((code) => raw.includes(code)) ?? "unknown";
}

export function createApplyError(error) {
  const code = getApplyErrorCode(error);
  const mapped = new Error(UX_BY_CODE[code] || error?.message || "Não foi possível concluir a candidatura.");
  mapped.code = code;
  if (code === "rate limit exceeded") mapped.status = 429;
  return mapped;
}

export function canWithdrawStatus(status) {
  return status === "submitted" || status === "reviewing";
}

export function applicationStatusLabel(status) {
  return APPLICATION_STATUS_COPY[status]?.label ?? status ?? "";
}

export function formatApplicationDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export const MY_APPLICATIONS_CACHE_TTL_MS = 30_000;

const myApplicationsCache = new Map();
const myApplicationsInflight = new Map();

function parseLoadMyApplicationsOptions(userIdOrOptions) {
  if (userIdOrOptions && typeof userIdOrOptions === "object" && !Array.isArray(userIdOrOptions)) {
    return {
      userId: userIdOrOptions.userId,
      forceRefresh: Boolean(userIdOrOptions.forceRefresh),
    };
  }
  return { userId: userIdOrOptions, forceRefresh: false };
}

export function invalidateMyApplicationsCache(userId) {
  if (userId) {
    myApplicationsCache.delete(userId);
    myApplicationsInflight.delete(userId);
    return;
  }
  myApplicationsCache.clear();
  myApplicationsInflight.clear();
}

export function peekMyApplicationsCache(userId) {
  if (!userId) return null;
  const entry = myApplicationsCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > MY_APPLICATIONS_CACHE_TTL_MS) return null;
  return entry.data;
}

export function parseApplication(row) {
  if (!row || typeof row !== "object") return null;
  const job = row.jobs && !Array.isArray(row.jobs) ? row.jobs : null;
  const company = job?.companies && !Array.isArray(job.companies) ? job.companies : null;
  return {
    id: row.id ?? null,
    jobId: row.job_id ?? row.jobId ?? null,
    candidateId: row.candidate_id ?? row.candidateId ?? null,
    status: row.status ?? null,
    snapshot: row.snapshot ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    jobTitle: job?.title ?? null,
    companyName: company?.name ?? null,
  };
}

export async function applyToJob(jobId) {
  if (!jobId) throw new Error("Vaga não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("apply_to_job", { p_job_id: jobId });
  if (error) throw createApplyError(error);
  if (data && typeof data === "object" && typeof data.error === "string") {
    throw createApplyError({ message: data.error });
  }
  const parsed = parseApplication(data);
  invalidateMyApplicationsCache(parsed?.candidateId);
  return parsed;
}

export async function withdrawApplication(jobId) {
  if (!jobId) throw new Error("Vaga não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("withdraw_application", { p_job_id: jobId });
  if (error) throw createApplyError(error);
  const parsed = parseApplication(data);
  invalidateMyApplicationsCache(parsed?.candidateId);
  return parsed;
}

export async function loadMyApplication(jobId, userId) {
  if (!jobId) return null;
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const candidateId = await resolveCandidateId(client, userId);
  if (!candidateId) return null;
  const { data, error } = await client
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (error) throw createApplyError(error);
  return parseApplication(data);
}

export async function loadMyApplications(userIdOrOptions) {
  const { userId, forceRefresh } = parseLoadMyApplicationsOptions(userIdOrOptions);
  const client = getSupabaseBrowserClient();
  if (!client) return [];
  const candidateId = userId ?? (await resolveCandidateId(client, userId));
  if (!candidateId) return [];

  if (!forceRefresh) {
    const cached = peekMyApplicationsCache(candidateId);
    if (cached) return cached;
    const inflight = myApplicationsInflight.get(candidateId);
    if (inflight) return inflight;
  }

  const request = (async () => {
    const { data, error } = await client
      .from("applications")
      .select(APPLICATION_LIST_SELECT)
      .eq("candidate_id", candidateId)
      .order("updated_at", { ascending: false });
    if (error) throw createApplyError(error);
    const rows = (data ?? []).map(parseApplication).filter(Boolean);
    myApplicationsCache.set(candidateId, { data: rows, fetchedAt: Date.now() });
    return rows;
  })();

  myApplicationsInflight.set(candidateId, request);
  try {
    return await request;
  } finally {
    if (myApplicationsInflight.get(candidateId) === request) {
      myApplicationsInflight.delete(candidateId);
    }
  }
}
