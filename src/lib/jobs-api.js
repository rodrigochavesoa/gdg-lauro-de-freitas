import { mapJob } from "./map-job.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";
import {
  mapLevelFiltersToDb,
  mapWorkModelFiltersToDb,
  SORT_OLDEST,
  SORT_RECENT,
  stackTermsForSearch,
} from "./filter-jobs.js";

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

const JOB_LIST_SELECT_SEARCH = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  status,
  approved_at,
  created_at,
  companies!inner ( name )
`;

export const CATALOG_CACHE_TTL_MS = 30_000;
export const CATALOG_PAGE_SIZE = 24;

const catalogCache = new Map();
const catalogInflight = new Map();

export function invalidateApprovedJobsCache() {
  catalogCache.clear();
  catalogInflight.clear();
}

function sortedCopy(values = []) {
  return [...values].map(String).sort();
}

export function catalogCacheKey({
  query = "",
  tech = [],
  level = [],
  workModel = [],
  sort = SORT_RECENT,
} = {}) {
  return JSON.stringify({
    q: String(query ?? "").trim().toLowerCase(),
    t: sortedCopy(tech),
    l: sortedCopy(level),
    w: sortedCopy(workModel),
    s: sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
  });
}

function cacheEntryFresh(entry) {
  if (!entry?.jobs) return false;
  if (Date.now() - entry.fetchedAt > CATALOG_CACHE_TTL_MS) return false;
  return true;
}

export function peekApprovedJobsPage(params) {
  const entry = catalogCache.get(catalogCacheKey(params));
  if (!cacheEntryFresh(entry)) return null;
  return { jobs: entry.jobs, count: entry.count, rows: entry.rows };
}

export function peekApprovedJobsCache(params) {
  return peekApprovedJobsPage(params)?.jobs ?? null;
}

/** UX-PERF-03 — job parcial das páginas já carregadas. Não substitui loadApprovedJob. */
export function findApprovedJobInCache(id) {
  if (id == null || id === "") return null;
  const needle = String(id);
  for (const entry of catalogCache.values()) {
    if (!cacheEntryFresh(entry)) continue;
    const job = entry.jobs.find((item) => String(item.id) === needle);
    if (job) return job;
  }
  return null;
}

function findApprovedJobRowInCache(id) {
  if (id == null || id === "") return null;
  const needle = String(id);
  for (const entry of catalogCache.values()) {
    if (!cacheEntryFresh(entry)) continue;
    const row = entry.rows.find((item) => String(item.id) === needle);
    if (row) return row;
  }
  return null;
}

function mergeUniqueById(existing, incoming) {
  const seen = new Set(existing.map((item) => String(item.id)));
  const extra = incoming.filter((item) => !seen.has(String(item.id)));
  return [...existing, ...extra];
}

export function quotePostgrestValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function buildCatalogSearchOr(query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return null;
  const pattern = `%${trimmed.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const quoted = quotePostgrestValue(pattern);
  const clauses = [`title.ilike.${quoted}`, `companies.name.ilike.${quoted}`];
  const stackTerms = stackTermsForSearch(trimmed);
  if (stackTerms.length > 0) {
    const encoded = stackTerms.map((term) => quotePostgrestValue(term)).join(",");
    clauses.push(`stack.ov.{${encoded}}`);
  }
  return clauses.join(",");
}

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

function normalizeCatalogOptions({
  forceRefresh = false,
  offset = 0,
  query = "",
  tech = [],
  level = [],
  workModel = [],
  sort = SORT_RECENT,
} = {}) {
  return {
    forceRefresh: Boolean(forceRefresh),
    offset: Math.max(0, Number(offset) || 0),
    query: String(query ?? "").trim(),
    tech: [...tech],
    level: [...level],
    workModel: [...workModel],
    sort: sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
  };
}

async function fetchApprovedJobsPage(client, options) {
  const searchOr = buildCatalogSearchOr(options.query);
  const select = searchOr ? JOB_LIST_SELECT_SEARCH : JOB_LIST_SELECT;
  const levelEnums = mapLevelFiltersToDb(options.level);
  const workModelEnums = mapWorkModelFiltersToDb(options.workModel);
  const ascending = options.sort === SORT_OLDEST;
  const from = options.offset;
  const to = options.offset + CATALOG_PAGE_SIZE - 1;

  let request = client
    .from("jobs")
    .select(select, { count: "exact" })
    .eq("status", "approved");

  if (options.tech.length > 0) {
    request = request.overlaps("stack", options.tech);
  }
  if (levelEnums.length > 0) {
    request = request.in("level", levelEnums);
  }
  if (workModelEnums.length > 0) {
    request = request.in("work_model", workModelEnums);
  }
  if (searchOr) {
    request = request.or(searchOr);
  }

  const { data, error, count } = await request
    .order("approved_at", { ascending })
    .order("id", { ascending })
    .range(from, to);

  if (error) throw error;
  return { rows: data ?? [], count: count ?? (data ?? []).length };
}

export async function loadApprovedJobs(options = {}) {
  const params = normalizeCatalogOptions(options);
  const key = catalogCacheKey(params);
  const inflightKey = `${key}:${params.offset}`;

  if (!params.forceRefresh && params.offset === 0) {
    const cached = peekApprovedJobsPage(params);
    if (cached) return { jobs: cached.jobs, count: cached.count };
    const inflight = catalogInflight.get(inflightKey);
    if (inflight) return inflight;
  } else if (!params.forceRefresh && params.offset > 0) {
    const inflight = catalogInflight.get(inflightKey);
    if (inflight) return inflight;
  }

  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const request = (async () => {
    const { rows, count } = await fetchApprovedJobsPage(client, params);
    const jobs = rows.map(mapJob);
    const previous = params.offset > 0 && !params.forceRefresh ? catalogCache.get(key) : null;
    const mergedRows = previous?.rows ? mergeUniqueById(previous.rows, rows) : rows;
    const mergedJobs = previous?.jobs ? mergeUniqueById(previous.jobs, jobs) : jobs;
    catalogCache.set(key, {
      jobs: mergedJobs,
      rows: mergedRows,
      count,
      fetchedAt: Date.now(),
    });
    return { jobs: mergedJobs, count };
  })();

  catalogInflight.set(inflightKey, request);
  try {
    return await request;
  } finally {
    if (catalogInflight.get(inflightKey) === request) {
      catalogInflight.delete(inflightKey);
    }
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
