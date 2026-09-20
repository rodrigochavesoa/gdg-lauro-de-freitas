import { formatStaffPrivilegedApiError } from "../auth/staff-mfa.js";
import { buildCatalogSearchPattern, quotePostgrestValue } from "../../lib/jobs-api.js";
import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";

export const ADMIN_JOB_PAGE_SIZE = 24;
export const ADMIN_JOB_STATUSES = ["pending", "approved", "rejected"];
export const ADMIN_JOB_SORT_RECENT = "recent";
export const ADMIN_JOB_SORT_OLDEST = "oldest";

const ADMIN_JOB_LIST_SELECT = "id,title,status,created_at,level,work_model,companies(name)";
const ADMIN_JOB_LIST_SELECT_SEARCH =
  "id,title,status,created_at,level,work_model,co:companies(),companies(name)";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (!error) return;
  throw new Error(
    formatStaffPrivilegedApiError(error.message) || error.message || "Falha ao carregar as vagas da área administrativa.",
  );
}

function normalizePage(page) {
  const n = Number.parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function normalizePageSize(pageSize) {
  const n = Number.parseInt(pageSize, 10);
  return Number.isFinite(n) && n > 0 ? n : ADMIN_JOB_PAGE_SIZE;
}

function normalizeStatus(status) {
  return ADMIN_JOB_STATUSES.includes(status) ? status : "pending";
}

function normalizeSort(sort) {
  return sort === ADMIN_JOB_SORT_OLDEST ? ADMIN_JOB_SORT_OLDEST : ADMIN_JOB_SORT_RECENT;
}

export function normalizeAdminJobPageParams({
  status,
  query,
  sort,
  page,
  pageSize,
} = {}) {
  return {
    status: normalizeStatus(status),
    query: String(query ?? "").trim(),
    sort: normalizeSort(sort),
    page: normalizePage(page),
    pageSize: normalizePageSize(pageSize),
  };
}

export function parseAdminJobListSearch(searchParams) {
  return normalizeAdminJobPageParams({
    status: searchParams.get("status"),
    query: searchParams.get("q"),
    sort: searchParams.get("sort"),
    page: searchParams.get("page"),
    pageSize: ADMIN_JOB_PAGE_SIZE,
  });
}

export function adminJobListSearchParams({ status, query, sort, page } = {}) {
  const normalized = normalizeAdminJobPageParams({ status, query, sort, page });
  const next = new URLSearchParams();
  if (normalized.status !== "pending") next.set("status", normalized.status);
  if (normalized.query) next.set("q", normalized.query);
  if (normalized.sort !== ADMIN_JOB_SORT_RECENT) next.set("sort", normalized.sort);
  if (normalized.page > 1) next.set("page", String(normalized.page));
  return next;
}

export const ADMIN_JOB_STATUS_FILTERS = [
  { id: "pending", label: "Pendentes" },
  { id: "approved", label: "Publicadas" },
  { id: "rejected", label: "Rejeitadas" },
];

export function adminJobListHeading(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "approved") return "Vagas publicadas";
  if (normalized === "rejected") return "Vagas rejeitadas";
  return "Aguardando curadoria";
}

export function adminJobEmptyCopy(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "approved") return "Nenhuma vaga publicada.";
  if (normalized === "rejected") return "Nenhuma vaga rejeitada.";
  return "Nenhuma vaga aguardando curadoria.";
}

export function countAdminJobActiveFilters({ status, sort } = {}) {
  const params = normalizeAdminJobPageParams({ status, sort });
  let count = 0;
  if (params.status !== "pending") count += 1;
  if (params.sort !== ADMIN_JOB_SORT_RECENT) count += 1;
  return count;
}

export function formatAdminJobTotalLabel(total, loaded) {
  if (total == null) return "";
  const noun = total === 1 ? "vaga" : "vagas";
  if (loaded != null && loaded < total) {
    return `Mostrando ${loaded} de ${total} ${noun}`;
  }
  return total === 1 ? "1 vaga" : `${total} vagas`;
}

function buildAdminJobSearchOr(query) {
  const pattern = buildCatalogSearchPattern(query);
  if (!pattern) return null;
  const quoted = quotePostgrestValue(pattern);
  return `title.ilike.${quoted},co.not.is.null`;
}

function mapAdminJobListItem(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    level: row.level,
    work_model: row.work_model,
    companies: row.companies ?? null,
  };
}

/**
 * Página enxuta para /admin/vagas.
 * Sem description, sem job_curation_reviews — o detalhe usa loadAdminJob(id).
 */
export async function loadAdminJobPage(options = {}) {
  const params = normalizeAdminJobPageParams(options);
  const searchOr = buildAdminJobSearchOr(params.query);
  const select = searchOr ? ADMIN_JOB_LIST_SELECT_SEARCH : ADMIN_JOB_LIST_SELECT;
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const ascending = params.sort === ADMIN_JOB_SORT_OLDEST;

  const client = clientOrThrow();
  let request = client
    .from("jobs")
    .select(select, { count: "exact" })
    .eq("status", params.status);

  if (searchOr) {
    request = request
      .filter("co.name", "ilike", buildCatalogSearchPattern(params.query))
      .or(searchOr);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending })
    .order("id", { ascending })
    .range(from, to);

  throwIfError(error);

  const items = (data ?? []).map(mapAdminJobListItem);
  const total = count ?? items.length;
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasNext: from + items.length < total,
  };
}
