import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { runObserved } from "../../lib/ops-observability.js";
import { mergeCurationQueue } from "./curation-queue.js";
import { validateCurationReview, validateUrgentPriority } from "./rubric.js";

const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

export const CURATION_QUEUE_PAGE_SIZE = 24;

const CURATION_LIST_FIELDS =
  "id,title,status,priority,curation_round,level,work_model,location,created_at,companies(name)";

const CURATION_DETAIL_FIELDS = "id,description,stack";

const CURATION_REVIEW_FIELDS =
  "job_id,curation_round,reviewer_id,decision,rubric_code,internal_comment,created_at";

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
  const { data: sessionData, error: sessionError } = await client.auth.getUser();
  if (sessionError) throw new Error(sessionError.message || "Falha na API do Supabase.");
  if (!sessionData?.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", sessionData.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message || "Falha na API do Supabase.");
  if (!STAFF_ROLES.has(data?.role)) return null;
  return { ...data, email: sessionData.user.email };
}

export async function signInCuration(email, password) {
  return runObserved({ flow: "login", action: "staff_password", route: "/admin" }, async () => {
    const client = clientOrThrow();
    const { error } = await client.auth.signInWithPassword({ email, password });
    throwIfError(error);
    const profile = await loadCurationProfile();
    if (!profile) {
      await client.auth.signOut();
      throw new Error("Esta conta não tem permissão de curadoria.");
    }
    return profile;
  });
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
const curationDetailCache = new Map();
const curationDetailInflight = new Map();

function normalizePage(page) {
  const n = Number.parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function normalizePageSize(pageSize) {
  const n = Number.parseInt(pageSize, 10);
  if (!Number.isFinite(n) || n <= 0) return CURATION_QUEUE_PAGE_SIZE;
  return Math.min(n, CURATION_QUEUE_PAGE_SIZE);
}

function queueCacheKey({ scope, page, pageSize }) {
  return `${scope}:${page}:${pageSize}`;
}

export function invalidateCurationQueueCache() {
  curationQueueCache.clear();
  curationQueueInflight.clear();
  curationDetailCache.clear();
  curationDetailInflight.clear();
}

export function peekCurationQueueCache({
  scope = "pending",
  page = 1,
  pageSize = CURATION_QUEUE_PAGE_SIZE,
} = {}) {
  const entry = curationQueueCache.get(
    queueCacheKey({ scope, page: normalizePage(page), pageSize: normalizePageSize(pageSize) }),
  );
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CURATION_QUEUE_CACHE_TTL_MS) return null;
  return entry.data;
}

function sliceCurationPage(rows, pageSize) {
  const hasNext = rows.length > pageSize;
  return { rows: hasNext ? rows.slice(0, pageSize) : rows, hasNext };
}

async function fetchPendingPage(client, page, pageSize) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const pending = await client
    .from("jobs")
    .select(CURATION_LIST_FIELDS)
    .eq("status", "pending")
    .order("priority", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  throwIfError(pending.error);

  const sliced = sliceCurationPage(pending.data ?? [], pageSize);
  let moderationIds = [];
  if (sliced.rows.length > 0) {
    const moderation = await client
      .from("jobs_needing_moderation")
      .select("id")
      .in(
        "id",
        sliced.rows.map((row) => row.id),
      );
    throwIfError(moderation.error);
    moderationIds = (moderation.data ?? []).map((row) => row.id);
  }

  return {
    queue: mergeCurationQueue(sliced.rows, moderationIds),
    rejected: [],
    page,
    pageSize,
    hasNext: sliced.hasNext,
  };
}

async function fetchRejectedPage(client, page, pageSize) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize;
  const rejected = await client
    .from("jobs")
    .select(CURATION_LIST_FIELDS)
    .eq("status", "rejected")
    .order("rejected_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);
  throwIfError(rejected.error);
  const sliced = sliceCurationPage(rejected.data ?? [], pageSize);
  return {
    queue: [],
    rejected: sliced.rows,
    page,
    pageSize,
    hasNext: sliced.hasNext,
  };
}

async function fetchCurationQueue({ scope = "pending", page = 1, pageSize = CURATION_QUEUE_PAGE_SIZE } = {}) {
  const client = clientOrThrow();
  if (scope === "rejected") return fetchRejectedPage(client, page, pageSize);
  return fetchPendingPage(client, page, pageSize);
}

export async function loadCurationQueue({
  scope = "pending",
  page = 1,
  pageSize = CURATION_QUEUE_PAGE_SIZE,
  forceRefresh = false,
} = {}) {
  const params = {
    scope: scope === "rejected" ? "rejected" : "pending",
    page: normalizePage(page),
    pageSize: normalizePageSize(pageSize),
  };
  const key = queueCacheKey(params);
  if (!forceRefresh) {
    const cached = peekCurationQueueCache(params);
    if (cached) return cached;
    const inflight = curationQueueInflight.get(key);
    if (inflight) return inflight;
  }

  const request = fetchCurationQueue(params);
  curationQueueInflight.set(key, request);
  try {
    const data = await request;
    curationQueueCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } finally {
    if (curationQueueInflight.get(key) === request) curationQueueInflight.delete(key);
  }
}

async function fetchCurationJobDetail(jobId) {
  const client = clientOrThrow();
  const [job, reviews] = await Promise.all([
    client.from("jobs").select(CURATION_DETAIL_FIELDS).eq("id", jobId).maybeSingle(),
    client
      .from("job_curation_reviews")
      .select(CURATION_REVIEW_FIELDS)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
  ]);
  throwIfError(job.error);
  throwIfError(reviews.error);
  return {
    id: jobId,
    description: job.data?.description ?? "",
    stack: job.data?.stack ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function loadCurationJobDetail(jobId, { forceRefresh = false } = {}) {
  if (!jobId) throw new Error("Vaga para detalhe não informada.");
  if (!forceRefresh) {
    const cached = curationDetailCache.get(jobId);
    if (cached && Date.now() - cached.fetchedAt <= CURATION_QUEUE_CACHE_TTL_MS) return cached.data;
    const inflight = curationDetailInflight.get(jobId);
    if (inflight) return inflight;
  }

  const request = fetchCurationJobDetail(jobId);
  curationDetailInflight.set(jobId, request);
  try {
    const data = await request;
    curationDetailCache.set(jobId, { data, fetchedAt: Date.now() });
    return data;
  } finally {
    if (curationDetailInflight.get(jobId) === request) curationDetailInflight.delete(jobId);
  }
}

export async function submitCurationReview({ jobId, decision, rubricCode, internalComment }) {
  return runObserved({ flow: "rpc", action: "submit_curation_review", route: "/admin/curadoria" }, async () => {
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
  });
}

export async function resubmitJobForCuration(jobId) {
  return runObserved({ flow: "rpc", action: "resubmit_job_for_curation", route: "/admin/curadoria" }, async () => {
    if (!jobId) throw new Error("Vaga para reenvio não informada.");
    const client = clientOrThrow();
    const { data, error } = await client.rpc("resubmit_job_for_curation", { p_job_id: jobId });
    throwIfError(error);
    invalidateCurationQueueCache();
    return data;
  });
}

export async function setJobCurationPriority(jobId, priority, reason) {
  return runObserved({ flow: "rpc", action: "set_job_curation_priority", route: "/admin/curadoria" }, async () => {
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
  });
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
