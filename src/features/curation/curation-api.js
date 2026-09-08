import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { mergeCurationQueue } from "./curation-queue.js";
import { validateCurationReview, validateUrgentPriority } from "./rubric.js";

const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

const JOB_FIELDS =
  "id,title,status,priority,priority_reason,curation_round,submitted_by,description,stack,level,work_model,location,created_at,rejected_at,companies(name)";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message || "Falha na API do Supabase.");
  }
}

export async function loadCurationProfile() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data: sessionData } = await client.auth.getUser();
  if (!sessionData?.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", sessionData.user.id)
    .maybeSingle();
  if (error || !STAFF_ROLES.has(data?.role)) return null;
  return { ...data, email: sessionData.user.email };
}

export async function signInCuration(email, password) {
  const client = clientOrThrow();
  const { error } = await client.auth.signInWithPassword({ email, password });
  throwIfError(error);
  const profile = await loadCurationProfile();
  if (!profile) {
    await client.auth.signOut();
    throw new Error("Esta conta não tem permissão de curadoria.");
  }
  return profile;
}

export async function signOutCuration() {
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.signOut();
  }
}

export const CURATION_QUEUE_CACHE_TTL_MS = 30_000;

const curationQueueCache = new Map();
const curationQueueInflight = new Map();

function queueCacheKey(includeRejected) {
  return includeRejected ? "with-rejected" : "pending-only";
}

export function invalidateCurationQueueCache() {
  curationQueueCache.clear();
  curationQueueInflight.clear();
}

export function peekCurationQueueCache({ includeRejected = false } = {}) {
  const entry = curationQueueCache.get(queueCacheKey(includeRejected));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CURATION_QUEUE_CACHE_TTL_MS) return null;
  return entry.data;
}

async function fetchCurationQueue({ includeRejected = false } = {}) {
  const client = clientOrThrow();
  const pending = await client
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("status", "pending");
  throwIfError(pending.error);

  const pendingRows = pending.data ?? [];
  const pendingIds = pendingRows.map((row) => row.id);
  const reviewsQuery = pendingIds.length
    ? client
        .from("job_curation_reviews")
        .select("job_id,curation_round,reviewer_id,decision,rubric_code,created_at")
        .in("job_id", pendingIds)
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: [], error: null });
  const rejectedQuery = includeRejected
    ? client
        .from("jobs")
        .select(JOB_FIELDS)
        .eq("status", "rejected")
        .order("rejected_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [moderation, reviews, rejected] = await Promise.all([
    client.from("jobs_needing_moderation").select("id"),
    reviewsQuery,
    rejectedQuery,
  ]);
  throwIfError(moderation.error);
  throwIfError(reviews.error);
  throwIfError(rejected.error);

  const moderationIds = (moderation.data ?? []).map((row) => row.id);
  return {
    queue: mergeCurationQueue(pendingRows, moderationIds),
    rejected: rejected.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function loadCurationQueue({ includeRejected = false, forceRefresh = false } = {}) {
  const key = queueCacheKey(includeRejected);
  if (!forceRefresh) {
    const cached = peekCurationQueueCache({ includeRejected });
    if (cached) return cached;
    const inflight = curationQueueInflight.get(key);
    if (inflight) return inflight;
  }

  const request = fetchCurationQueue({ includeRejected });
  curationQueueInflight.set(key, request);
  try {
    const data = await request;
    curationQueueCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } finally {
    if (curationQueueInflight.get(key) === request) curationQueueInflight.delete(key);
  }
}

export async function submitCurationReview({ jobId, decision, rubricCode, internalComment }) {
  const errors = validateCurationReview({ decision, rubricCode });
  if (errors.length) throw new Error(errors[0]);
  const client = clientOrThrow();
  const { data, error } = await client.rpc("submit_curation_review", {
    p_job_id: jobId,
    p_decision: decision,
    p_rubric_code: rubricCode.trim(),
    p_internal_comment: String(internalComment ?? "").trim() || null,
  });
  throwIfError(error);
  invalidateCurationQueueCache();
  return data;
}

export async function resubmitJobForCuration(jobId) {
  if (!jobId) throw new Error("Vaga para reenvio não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("resubmit_job_for_curation", { p_job_id: jobId });
  throwIfError(error);
  invalidateCurationQueueCache();
  return data;
}

export async function setJobCurationPriority(jobId, priority, reason) {
  if (priority !== "normal" && priority !== "urgent") {
    throw new Error("Prioridade inválida.");
  }
  if (priority === "urgent") {
    const reasonError = validateUrgentPriority(reason);
    if (reasonError) throw new Error(reasonError);
  }
  const client = clientOrThrow();
  const { data, error } = await client.rpc("set_job_curation_priority", {
    p_job_id: jobId,
    p_priority: priority,
    p_reason: priority === "urgent" ? String(reason).trim() : null,
  });
  throwIfError(error);
  invalidateCurationQueueCache();
  return data;
}

/** Realtime na tabela jobs; o chamador dá unsubscribe no unmount. */
export function subscribeCurationJobs(onChange) {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};
  const channel = client
    .channel("curation-jobs-queue")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "jobs" },
      () => {
        onChange();
      },
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
