import { normalizeCountryCode, normalizePlace, normalizeSalaryCents } from "./catalog-url.js";
import {
  JOB_DETAIL_HEAVY_SELECT,
  JOB_DETAIL_SELECT,
  JOB_LIST_SELECT,
  JOB_LIST_SELECT_SEARCH,
} from "./data-contracts/selects.js";
import { mapCatalogDetailRowToDto, mapCatalogHeavyRowToDto, mapCatalogListRowToDto } from "./data-contracts/map-row.js";
import { mapJob } from "./map-job.js";
import { createMemoryCache } from "./client-cache/store.js";
import { LIST_CACHE_TTL_MS } from "./client-cache/ttl.js";
import { classifyOpsFailure, emitOpsEvent } from "./ops-observability.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";
import {
  mapLevelFiltersToDb,
  mapWorkModelFiltersToDb,
  SORT_OLDEST,
  SORT_RECENT,
  stackTermsForSearch,
} from "./filter-jobs.js";

export { JOB_DETAIL_HEAVY_SELECT };

export const CATALOG_CACHE_TTL_MS = LIST_CACHE_TTL_MS;
export const CATALOG_PAGE_SIZE = 24;

const catalogCache = createMemoryCache({ ttlMs: CATALOG_CACHE_TTL_MS, name: "catalog" });

export function invalidateApprovedJobsCache() {
  catalogCache.clear();
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

/**
 * País ativo é igualdade. Null não corresponde: a vaga legada só aparece
 * quando o filtro de país está desligado.
 */
export function catalogCountryCode(country) {
  return normalizeCountryCode(country) || null;
}

/**
 * Interseção de intervalos. Null num extremo é aberto.
 * Ambos null ("A combinar") não atendem a faixa quando o filtro está ativo.
 */
export function buildSalaryVisibilityOr(salaryMin, salaryMax) {
  const min = normalizeSalaryCents(salaryMin);
  const max = normalizeSalaryCents(salaryMax);
  if (min == null && max == null) return null;
  if (min != null && max != null && min > max) return null;
  const parts = ["or(salary_min.not.is.null,salary_max.not.is.null)"];
  if (max != null) parts.push(`or(salary_min.is.null,salary_min.lte.${max})`);
  if (min != null) parts.push(`or(salary_max.is.null,salary_max.gte.${min})`);
  return `and(${parts.join(",")})`;
}

function cacheEntryFresh(data) {
  return Boolean(data?.jobs);
}

export function peekApprovedJobsPage(params) {
  const data = catalogCache.peek(catalogCacheKey(params));
  if (!cacheEntryFresh(data)) return null;
  return { jobs: data.jobs, count: data.count, rows: data.rows };
}

export function peekApprovedJobsCache(params) {
  return peekApprovedJobsPage(params)?.jobs ?? null;
}

/** UX-PERF-03 — job parcial das páginas já carregadas. Não substitui loadApprovedJob. */
export function findApprovedJobInCache(id) {
  if (id == null || id === "") return null;
  const needle = String(id);
  for (const data of catalogCache.freshValues()) {
    if (!cacheEntryFresh(data)) continue;
    const job = data.jobs.find((item) => String(item.id) === needle);
    if (job) return job;
  }
  return null;
}

function findApprovedJobRowInCache(id) {
  if (id == null || id === "") return null;
  const needle = String(id);
  for (const data of catalogCache.freshValues()) {
    if (!cacheEntryFresh(data)) continue;
    const row = data.rows.find((item) => String(item.id) === needle);
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
  const countryCode = catalogCountryCode(options.country);
  if (countryCode) request = request.eq("country_code", countryCode);
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
    const inflight = catalogCache.inflightGet(inflightKey);
    if (inflight) return inflight;
  } else if (!params.forceRefresh && params.offset > 0) {
    const inflight = catalogCache.inflightGet(inflightKey);
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

  if (params.forceRefresh) catalogCache.supersede(key);
  const writeEpoch = catalogCache.capture(key);

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
    const dtoRows = rows.map((row) => mapCatalogListRowToDto(row));
    const jobs = dtoRows.map((row) => mapJob(row));
    const previous = params.offset > 0 && !params.forceRefresh ? catalogCache.get(key) : null;
    const mergedRows = previous?.rows ? mergeUniqueById(previous.rows, dtoRows) : dtoRows;
    const mergedJobs = previous?.jobs ? mergeUniqueById(previous.jobs, jobs) : jobs;
    catalogCache.set(key, {
      jobs: mergedJobs,
      rows: mergedRows,
      count,
    }, writeEpoch);
    return { jobs: mergedJobs, count };
  })();

  catalogCache.inflightSet(inflightKey, request);
  try {
    return await request;
  } finally {
    catalogCache.inflightDelete(inflightKey, request);
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
  return data ? mapCatalogHeavyRowToDto(data) : null;
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
  return data ? mapJob(mapCatalogDetailRowToDto(data)) : null;
}
