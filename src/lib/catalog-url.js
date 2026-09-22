import {
  CATALOG_LEVELS,
  CATALOG_TECHNOLOGIES,
  CATALOG_WORK_MODELS,
  SORT_OLDEST,
  SORT_RECENT,
} from "./filter-jobs.js";

/** Países oferecidos no filtro. Deep link aceita qualquer ISO alpha-2. */
export const CATALOG_COUNTRIES = [
  { code: "BR", label: "Brasil" },
  { code: "PT", label: "Portugal" },
  { code: "US", label: "Estados Unidos" },
  { code: "AR", label: "Argentina" },
  { code: "UY", label: "Uruguai" },
  { code: "ES", label: "Espanha" },
  { code: "MX", label: "México" },
  { code: "CL", label: "Chile" },
];

const SALARY_CENTS_MAX = 2_147_483_647;
const PLACE_MAX = 80;

const LIST_FIELDS = [
  ["tech", CATALOG_TECHNOLOGIES],
  ["level", CATALOG_LEVELS],
  ["workModel", CATALOG_WORK_MODELS],
];

function asSearchParams(searchParams) {
  if (searchParams instanceof URLSearchParams) return searchParams;
  return new URLSearchParams(searchParams ?? "");
}

export function normalizeCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

/** Centavos inteiros (int4). Vazio ou inválido → null. */
export function normalizeSalaryCents(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const cents = Number(raw);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > SALARY_CENTS_MAX) return null;
  return cents;
}

export function normalizePlace(value) {
  return String(value ?? "").trim().slice(0, PLACE_MAX);
}

function pickAllowed(params, key, allowed) {
  const values = params.getAll(key).filter((value) => allowed.includes(value));
  return [...new Set(values)];
}

export function parseCatalogSearch(searchParams) {
  const params = asSearchParams(searchParams);
  const lists = {};
  for (const [key, allowed] of LIST_FIELDS) {
    lists[key] = pickAllowed(params, key, allowed);
  }

  let salaryMin = normalizeSalaryCents(params.get("salaryMin"));
  let salaryMax = normalizeSalaryCents(params.get("salaryMax"));
  if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
    salaryMin = null;
    salaryMax = null;
  }

  return {
    query: String(params.get("query") ?? "").trim(),
    tech: lists.tech,
    level: lists.level,
    workModel: lists.workModel,
    sort: params.get("sort") === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
    country: normalizeCountryCode(params.get("country")),
    place: normalizePlace(params.get("place")),
    salaryMin,
    salaryMax,
  };
}

export function serializeCatalogSearch(filters = {}) {
  const parsed = {
    query: String(filters.query ?? "").trim(),
    tech: filters.tech ?? [],
    level: filters.level ?? [],
    workModel: filters.workModel ?? [],
    sort: filters.sort === SORT_OLDEST ? SORT_OLDEST : SORT_RECENT,
    country: normalizeCountryCode(filters.country),
    place: normalizePlace(filters.place),
    salaryMin: normalizeSalaryCents(filters.salaryMin),
    salaryMax: normalizeSalaryCents(filters.salaryMax),
  };
  if (parsed.salaryMin != null && parsed.salaryMax != null && parsed.salaryMin > parsed.salaryMax) {
    parsed.salaryMin = null;
    parsed.salaryMax = null;
  }

  const params = new URLSearchParams();
  if (parsed.query) params.set("query", parsed.query);
  for (const [key] of LIST_FIELDS) {
    for (const value of parsed[key]) params.append(key, value);
  }
  if (parsed.sort === SORT_OLDEST) params.set("sort", SORT_OLDEST);
  if (parsed.country) params.set("country", parsed.country);
  if (parsed.place) params.set("place", parsed.place);
  if (parsed.salaryMin != null) params.set("salaryMin", String(parsed.salaryMin));
  if (parsed.salaryMax != null) params.set("salaryMax", String(parsed.salaryMax));
  return params;
}

export function writeCatalogSearch(current, patch) {
  return serializeCatalogSearch({ ...parseCatalogSearch(current), ...patch });
}

/** Campo de reais (pt-BR) a partir de centavos da URL. */
export function reaisInputFromCents(cents) {
  if (cents == null) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100);
}

/** Interpreta reais digitados (8.000 ou 8000,50) como centavos. */
export function centsFromReaisInput(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { cents: null };
  const normalized = trimmed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { error: "Informe o valor em reais." };
  }
  const reais = Number(normalized);
  if (!Number.isFinite(reais) || reais < 0 || reais * 100 > SALARY_CENTS_MAX) {
    return { error: "Informe um valor até 20.000.000." };
  }
  return { cents: Math.round(reais * 100) };
}
