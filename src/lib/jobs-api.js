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

/** UX-PERF-04 — only fields missing from JOB_LIST_SELECT / list mapJob. */
export const JOB_DETAIL_HEAVY_SELECT = `
  id,
  description,
  requirements,
  companies ( description )
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

let approvedJobsCache = { jobs: null, rows: null, fetchedAt: 0 };
let approvedJobsInflight = null;

export function invalidateApprovedJobsCache() {
  approvedJobsCache = { jobs: null, rows: null, fetchedAt: 0 };
  approvedJobsInflight = null;
}

function isCacheFresh() {
  if (!approvedJobsCache.jobs) return false;
  if (Date.now() - approvedJobsCache.fetchedAt > CATALOG_CACHE_TTL_MS) return false;
  return true;
}

export function peekApprovedJobsCache() {
  if (!isCacheFresh()) return null;
  return approvedJobsCache.jobs;
}

function peekApprovedJobRowsCache() {
  if (!isCacheFresh()) return null;
  return approvedJobsCache.rows;
}

/** UX-PERF-03 — job parcial da lista (sem description/requirements). Não substitui loadApprovedJob. */
export function findApprovedJobInCache(id) {
  const jobs = peekApprovedJobsCache();
  if (!jobs || id == null || id === "") return null;
  return jobs.find((job) => String(job.id) === String(id)) ?? null;
}

function findApprovedJobRowInCache(id) {
  const rows = peekApprovedJobRowsCache();
  if (!rows || id == null || id === "") return null;
  return rows.find((row) => String(row.id) === String(id)) ?? null;
}

/** Merge list row + heavy detail fields before mapJob (testável). */
export function mergeJobDetailRows(listRow, heavyRow) {
  if (!listRow) return heavyRow ?? null;
  if (!heavyRow) return listRow;
  return {
    ...listRow,
    description: heavyRow.description,
    requirements: heavyRow.requirements,
    companies: {
      ...(listRow.companies ?? {}),
      ...(heavyRow.companies ?? {}),
    },
  };
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

    const rows = data ?? [];
    const jobs = rows.map(mapJob);
    approvedJobsCache = { jobs, rows, fetchedAt: Date.now() };
    return jobs;
  })();

  approvedJobsInflight = request;
  try {
    return await request;
  } finally {
    if (approvedJobsInflight === request) approvedJobsInflight = null;
  }
}

export async function loadApprovedJobHeavyFields(id) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const { data, error } = await client
    .from("jobs")
    .select(JOB_DETAIL_HEAVY_SELECT)
    .eq("status", "approved")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function loadApprovedJob(id) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const cachedRow = findApprovedJobRowInCache(id);
  if (cachedRow) {
    const heavy = await loadApprovedJobHeavyFields(id);
    if (!heavy) return null;
    return mapJob(mergeJobDetailRows(cachedRow, heavy));
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
