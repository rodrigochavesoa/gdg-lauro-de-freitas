import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";

const APPLICATION_SELECT = "id,job_id,candidate_id,status,snapshot,created_at,updated_at";

const STABLE_CODES = [
  "authentication required",
  "profile incomplete",
  "job is not approved",
  "job not found",
  "already applied",
  "cannot withdraw application",
  "application not found",
];

const UX_BY_CODE = {
  "authentication required": "Entre para se candidatar.",
  "profile incomplete": "Complete seu perfil para se candidatar.",
  "job is not approved": "Esta vaga não está disponível para candidatura.",
  "job not found": "Esta vaga não está disponível para candidatura.",
  "already applied": "Você já se candidatou a esta vaga.",
  "cannot withdraw application": "Não é possível retirar esta candidatura.",
  "application not found": "Candidatura não encontrada.",
};

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
  return mapped;
}

export function canWithdrawStatus(status) {
  return status === "submitted" || status === "reviewing";
}

export function parseApplication(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id ?? null,
    jobId: row.job_id ?? row.jobId ?? null,
    candidateId: row.candidate_id ?? row.candidateId ?? null,
    status: row.status ?? null,
    snapshot: row.snapshot ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export async function applyToJob(jobId) {
  if (!jobId) throw new Error("Vaga não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("apply_to_job", { p_job_id: jobId });
  if (error) throw createApplyError(error);
  return parseApplication(data);
}

export async function withdrawApplication(jobId) {
  if (!jobId) throw new Error("Vaga não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("withdraw_application", { p_job_id: jobId });
  if (error) throw createApplyError(error);
  return parseApplication(data);
}

export async function loadMyApplication(jobId) {
  if (!jobId) return null;
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) return null;
  const { data, error } = await client
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("job_id", jobId)
    .eq("candidate_id", userData.user.id)
    .maybeSingle();
  if (error) throw createApplyError(error);
  return parseApplication(data);
}
