import { mapJob } from "./map-job.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";

const JOB_DETAIL_SELECT = `
  id,
  title,
  description,
  requirements,
  stack,
  level,
  work_model,
  location,
  status,
  approved_at,
  created_at,
  companies ( name, description )
`;

const JOB_LIST_SELECT = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  status,
  approved_at,
  created_at,
  companies ( name )
`;

export const CATALOG_CACHE_TTL_MS = 30_000;

let approvedJobsCache = { jobs: null, fetchedAt: 0 };
let approvedJobsInflight = null;

export function invalidateApprovedJobsCache() {
  approvedJobsCache = { jobs: null, fetchedAt: 0 };
  approvedJobsInflight = null;
}

export function peekApprovedJobsCache() {
  if (!approvedJobsCache.jobs) return null;
  if (Date.now() - approvedJobsCache.fetchedAt > CATALOG_CACHE_TTL_MS) return null;
  return approvedJobsCache.jobs;
}

/** UX-PERF-03 — job parcial da lista (sem description/requirements). Não substitui loadApprovedJob. */
export function findApprovedJobInCache(id) {
  const jobs = peekApprovedJobsCache();
  if (!jobs || id == null || id === "") return null;
  return jobs.find((job) => String(job.id) === String(id)) ?? null;
}

export async function loadApprovedJobs({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = peekApprovedJobsCache();
    if (cached) return cached;
    if (approvedJobsInflight) return approvedJobsInflight;
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const request = (async () => {
    const { data, error } = await client
      .from("jobs")
      .select(JOB_LIST_SELECT)
      .eq("status", "approved")
      .order("approved_at", { ascending: false });

    if (error) {
      throw error;
    }

    const jobs = (data ?? []).map(mapJob);
    approvedJobsCache = { jobs, fetchedAt: Date.now() };
    return jobs;
  })();

  approvedJobsInflight = request;
  try {
    return await request;
  } finally {
    if (approvedJobsInflight === request) approvedJobsInflight = null;
  }
}

export async function loadApprovedJob(id) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const { data, error } = await client
    .from("jobs")
    .select(JOB_DETAIL_SELECT)
    .eq("status", "approved")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapJob(data) : null;
}
