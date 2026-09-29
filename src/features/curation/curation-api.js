import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import {
  mapCurationDetailRowToDto,
  mapCurationListRowToDto,
  mapCurationReviewRowToDto,
} from "../../lib/data-contracts/map-row.js";
import {
  CURATION_DETAIL_FIELDS,
  CURATION_LIST_FIELDS,
  CURATION_MODERATION_ID_SELECT,
  CURATION_REVIEW_FIELDS,
} from "../../lib/data-contracts/selects.js";
import { curationDetailCache, curationQueueCache } from "../../lib/client-cache/staff.js";
import { LIST_CACHE_TTL_MS } from "../../lib/client-cache/ttl.js";
import { invalidateApprovedJobsCache } from "../../lib/jobs-api.js";
import { runObserved } from "../../lib/ops-observability.js";
import { throwStaffApiError } from "../../lib/staff-api-errors.js";
import { mergeCurationQueue } from "./curation-queue.js";
import { validateCurationReview, validateUrgentPriority } from "./rubric.js";

const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

export const CURATION_QUEUE_PAGE_SIZE = 24;

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  throwStaffApiError(error);
}

export async function loadCurationProfile() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data: sessionData, error: sessionError } = await client.auth.getUser();
  if (sessionError) throwStaffApiError(sessionError);
  if (!sessionData?.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", sessionData.user.id)
    .maybeSingle();
  if (error) throwStaffApiError(error);
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

export const CURATION_QUEUE_CACHE_TTL_MS = LIST_CACHE_TTL_MS;

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

/** Limpa fila, inflight e detalhes. Fallback quando a mutação não informa a vaga. */
export function invalidateCurationQueueCache() {
  curationQueueCache.clear();
  curationDetailCache.clear();
}

/**
 * Invalida as páginas dos scopes e, se pedido, o detalhe da vaga.
 * Páginas inteiras do scope saem porque a posição da vaga na página não fica na chave.
 * Detalhes de outras vagas permanecem.
 */
export function invalidateCurationJobSurfaces(jobId, { scopes = ["pending", "rejected"], includeDetail = true } = {}) {
  for (const scope of scopes) {
    curationQueueCache.invalidatePrefix(`${scope}:`);
  }
  if (includeDetail && jobId) curationDetailCache.invalidateKey(String(jobId));
}

export function peekCurationQueueCache({
  scope = "pending",
  page = 1,
  pageSize = CURATION_QUEUE_PAGE_SIZE,
} = {}) {
  return curationQueueCache.peek(
    queueCacheKey({ scope, page: normalizePage(page), pageSize: normalizePageSize(pageSize) }),
  );
}

export function peekCurationJobDetail(jobId) {
  if (!jobId) return null;
  return curationDetailCache.peek(String(jobId));
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
      .select(CURATION_MODERATION_ID_SELECT)
      .in(
        "id",
        sliced.rows.map((row) => row.id),
      );
    throwIfError(moderation.error);
    moderationIds = (moderation.data ?? []).map((row) => row.id);
  }

  return {
    queue: mergeCurationQueue(sliced.rows.map(mapCurationListRowToDto), moderationIds),
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
    rejected: sliced.rows.map(mapCurationListRowToDto),
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
    const inflight = curationQueueCache.inflightGet(key);
    if (inflight) return inflight;
  }
  if (forceRefresh) curationQueueCache.supersede(key);
  const writeEpoch = curationQueueCache.capture(key);

  const request = fetchCurationQueue(params);
  curationQueueCache.inflightSet(key, request);
  try {
    const data = await request;
    curationQueueCache.set(key, data, writeEpoch);
    return data;
  } finally {
    curationQueueCache.inflightDelete(key, request);
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
  const detail = job.data ? mapCurationDetailRowToDto(job.data) : null;
  return {
    id: jobId,
    description: detail?.description ?? "",
    stack: detail?.stack ?? [],
    reviews: (reviews.data ?? []).map(mapCurationReviewRowToDto),
  };
}

export async function loadCurationJobDetail(jobId, { forceRefresh = false } = {}) {
  if (!jobId) throw new Error("Vaga para detalhe não informada.");
  if (!forceRefresh) {
    const cached = curationDetailCache.peek(jobId);
    if (cached) return cached;
    const inflight = curationDetailCache.inflightGet(jobId);
    if (inflight) return inflight;
  }
  if (forceRefresh) curationDetailCache.supersede(jobId);
  const writeEpoch = curationDetailCache.capture(jobId);

  const request = fetchCurationJobDetail(jobId);
  curationDetailCache.inflightSet(jobId, request);
  try {
    const data = await request;
    curationDetailCache.set(jobId, data, writeEpoch);
    return data;
  } finally {
    curationDetailCache.inflightDelete(jobId, request);
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
    invalidateCurationJobSurfaces(jobId);
    invalidateApprovedJobsCache();
    return data;
  });
}

export async function resubmitJobForCuration(jobId) {
  return runObserved({ flow: "rpc", action: "resubmit_job_for_curation", route: "/admin/curadoria" }, async () => {
    if (!jobId) throw new Error("Vaga para reenvio não informada.");
    const client = clientOrThrow();
    const { data, error } = await client.rpc("resubmit_job_for_curation", { p_job_id: jobId });
    throwIfError(error);
    invalidateCurationJobSurfaces(jobId);
    invalidateApprovedJobsCache();
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
    invalidateCurationJobSurfaces(jobId, { scopes: ["pending"], includeDetail: false });
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
      (payload) => {
        const jobId = payload?.new?.id ?? payload?.old?.id ?? null;
        if (jobId) invalidateCurationJobSurfaces(jobId);
        else invalidateCurationQueueCache();
        const nextStatus = payload?.new?.status;
        const previousStatus = payload?.old?.status;
        if (nextStatus === "approved" || previousStatus === "approved") {
          invalidateApprovedJobsCache();
        }
        onChange();
      },
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
