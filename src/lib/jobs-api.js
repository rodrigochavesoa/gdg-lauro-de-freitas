import { normalizeCountryCode, normalizePlace, normalizeSalaryCents } from "./catalog-url.js";
import { mapJob } from "./map-job.js";
import { classifyOpsFailure, emitOpsEvent } from "./ops-observability.js";
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
  country_code,
  salary_min,
  salary_max,
  salary_currency,
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
  country_code,
  salary_min,
  salary_max,
  salary_currency,
  status,
  approved_at,
  created_at,
  companies ( name )
`;

/** Empty embed `co` + display embed — PostgREST OR across company needs co.not.is.null, not companies.name inside .or(). */
const JOB_LIST_SELECT_SEARCH = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  country_code,
  salary_min,
  salary_max,
  salary_currency,
  status,
  approved_at,
  created_at,
  co:companies(),
  companies ( name )
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
  country = "",
  place = "",
  salaryMin = null,
  salaryMax = null,
} = {}) {
  return JSON.stringify({
    q: String(query ?? "").trim().toLowerCase(),
    t: sortedCopy(tech),
    l: sortedCopy(level),
    w: sortedCopy(workModel),
    s: sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
    c: normalizeCountryCode(country),
    p: normalizePlace(place).toLowerCase(),
    smin: normalizeSalaryCents(salaryMin),
    smax: normalizeSalaryCents(salaryMax),
  });
}

/** País selecionado inclui vagas legadas com country_code null. */
export function buildCountryVisibilityOr(country) {
  const code = normalizeCountryCode(country);
  if (!code) return null;
  return `country_code.eq.${code},country_code.is.null`;
}

/**
 * Interseção de intervalos. Null no piso ou no teto é extremo aberto.
 * Ambos null na vaga passam qualquer filtro (legado "A combinar").
 */
export function buildSalaryVisibilityOr(salaryMin, salaryMax) {
  const min = normalizeSalaryCents(salaryMin);
  const max = normalizeSalaryCents(salaryMax);
  if (min == null && max == null) return null;
  if (min != null && max != null && min > max) return null;
  const parts = [];
  if (max != null) parts.push(`or(salary_min.is.null,salary_min.lte.${max})`);
  if (min != null) parts.push(`or(salary_max.is.null,salary_max.gte.${min})`);
  if (parts.length === 1) return parts[0].slice(3, -1);
  return `and(${parts.join(",")})`;
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

export function buildCatalogSearchPattern(query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return null;
  return `%${trimmed.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function formatStackOvTermForOr(term) {
  if (/^[A-Za-z0-9_]+$/.test(term)) return term;
  return quotePostgrestValue(term);
}

/** OR de título, stack e empresa (empresa via empty embed `co` + filter separado). */
export function buildCatalogSearchOr(query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return null;
  const pattern = buildCatalogSearchPattern(query);
  const quoted = quotePostgrestValue(pattern);
  const clauses = [`title.ilike.${quoted}`];
  const stackTerms = stackTermsForSearch(trimmed);
  if (stackTerms.length > 0) {
    const encoded = stackTerms.map(formatStackOvTermForOr).join(",");
    clauses.push(`stack.ov.{${encoded}}`);
  }
  clauses.push("co.not.is.null");
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
  country = "",
  place = "",
  salaryMin = null,
  salaryMax = null,
} = {}) {
  let min = normalizeSalaryCents(salaryMin);
  let max = normalizeSalaryCents(salaryMax);
  if (min != null && max != null && min > max) {
    min = null;
    max = null;
  }
  return {
    forceRefresh: Boolean(forceRefresh),
    offset: Math.max(0, Number(offset) || 0),
    query: String(query ?? "").trim(),
    tech: [...tech],
    level: [...level],
    workModel: [...workModel],
    sort: sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
    country: normalizeCountryCode(country),
    place: normalizePlace(place),
    salaryMin: min,
    salaryMax: max,
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
    const searchPattern = buildCatalogSearchPattern(options.query);
    request = request.filter("co.name", "ilike", searchPattern).or(searchOr);
  }
  const countryOr = buildCountryVisibilityOr(options.country);
  if (countryOr) request = request.or(countryOr);
  const salaryOr = buildSalaryVisibilityOr(options.salaryMin, options.salaryMax);
  if (salaryOr) request = request.or(salaryOr);
  const placePattern = buildCatalogSearchPattern(options.place);
  if (placePattern) request = request.ilike("location", placePattern);

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
    const error = new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
    emitOpsEvent({
      flow: "search",
      action: "catalog_search",
      route: "/vagas",
      ...classifyOpsFailure("search", error),
    });
    throw error;
  }

  const request = (async () => {
    let rows;
    let count;
    try {
      ({ rows, count } = await fetchApprovedJobsPage(client, params));
    } catch (error) {
      emitOpsEvent({
        flow: "search",
        action: "catalog_search",
        route: "/vagas",
        ...classifyOpsFailure("search", error),
      });
      throw error;
    }
    emitOpsEvent({
      flow: "search",
      action: "catalog_search",
      route: "/vagas",
      outcome: "success",
      error_class: "none",
    });
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
