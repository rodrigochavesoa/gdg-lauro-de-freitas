import { centsFromReaisInput, normalizeCountryCode, normalizeSalaryCents } from "./catalog-url.js";
import { runObserved } from "./ops-observability.js";
import { throwStaffApiError } from "./staff-api-errors.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";

export const LEVEL_TO_DB = {
  Estágio: "intern",
  Júnior: "junior",
  Pleno: "mid",
  Sênior: "senior",
};

export const MODEL_TO_DB = {
  Remoto: "remote",
  Híbrido: "hybrid",
  Presencial: "onsite",
};

export function parseStack(text) {
  return String(text ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Trim, colapsa espaços e lower — espelha `lower(btrim(title))` no índice único. */
export function normalizeJobTitle(title) {
  return String(title ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function findDuplicateJob(jobs, { companyId, title, excludeId } = {}) {
  if (!companyId) return null;
  const normalized = normalizeJobTitle(title);
  if (!normalized) return null;
  return (
    (jobs ?? []).find(
      (row) =>
        row.company_id === companyId &&
        row.id !== excludeId &&
        normalizeJobTitle(row.title) === normalized,
    ) ?? null
  );
}

function readSalaryBound(input, textKey, centsKey, label) {
  const source = input ?? {};
  if (Object.prototype.hasOwnProperty.call(source, textKey)) {
    const parsed = centsFromReaisInput(source[textKey]);
    if (parsed.error === "Informe o valor em reais.") return { error: `Informe o ${label} em reais.` };
    if (parsed.error) return { error: `${label}: ${parsed.error}` };
    return { cents: parsed.cents };
  }
  if (source[centsKey] == null || source[centsKey] === "") return { cents: null };
  const cents = normalizeSalaryCents(source[centsKey]);
  if (cents == null) return { error: `Informe o ${label} em centavos inteiros.` };
  return { cents };
}

/** Colunas estruturadas. País e faixa são opcionais; localidade não vira país. */
export function structuredJobColumns(input = {}) {
  const errors = [];
  const rawCountry = String(input.countryCode ?? input.country_code ?? "").trim();
  const country = rawCountry ? normalizeCountryCode(rawCountry) : "";
  if (rawCountry && !country) errors.push("País deve ser um código ISO de duas letras.");

  const min = readSalaryBound(input, "salaryMinText", "salaryMin", "salário mínimo");
  const max = readSalaryBound(input, "salaryMaxText", "salaryMax", "salário máximo");
  if (min.error) errors.push(min.error);
  if (max.error) errors.push(max.error);
  if (min.cents != null && max.cents != null && min.cents > max.cents) {
    errors.push("A faixa mínima não pode ser maior que a máxima.");
  }

  return {
    errors,
    columns: {
      country_code: country || null,
      salary_min: min.cents ?? null,
      salary_max: max.cents ?? null,
    },
  };
}

export function validateAdminJob(input = {}, { requireCompany = true } = {}) {
  const { title, description, companyId, newCompanyName, level, workModel } = input;
  const errors = [];
  if (!String(title ?? "").trim()) errors.push("Título é obrigatório.");
  if (!String(description ?? "").trim()) errors.push("Descrição é obrigatória.");
  if (requireCompany && !companyId && !String(newCompanyName ?? "").trim()) {
    errors.push("Selecione uma empresa ou informe o nome de uma empresa fictícia.");
  }
  if (!LEVEL_TO_DB[level]) errors.push("Nível é obrigatório.");
  if (!MODEL_TO_DB[workModel]) errors.push("Modelo de trabalho é obrigatório.");
  errors.push(...structuredJobColumns(input).errors);
  return errors;
}

const DUPLICATE_JOB_MESSAGE = "Já existe vaga com este título para esta empresa.";

function isUniqueViolation(error) {
  return error?.code === "23505" || /jobs_company_normalized_title|duplicate key/i.test(error?.message ?? "");
}

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (!error) return;
  if (isUniqueViolation(error)) {
    throw new Error(DUPLICATE_JOB_MESSAGE);
  }
  throwStaffApiError(error);
}

export async function signInAdmin(email, password) {
  return runObserved({ flow: "login", action: "staff_password", route: "/admin" }, async () => {
    const client = clientOrThrow();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    throwIfError(error);
    const isAdmin = await loadIsAdmin();
    if (!isAdmin) {
      await client.auth.signOut();
      throw new Error("Esta conta não é administradora.");
    }
    return data.user;
  });
}

export async function signOutAdmin() {
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function loadIsAdmin() {
  const client = getSupabaseBrowserClient();
  if (!client) return false;
  const { data: sessionData, error: sessionError } = await client.auth.getUser();
  if (sessionError) throwStaffApiError(sessionError);
  if (!sessionData?.user) return false;
  const { data, error } = await client.from("profiles").select("role").eq("id", sessionData.user.id).maybeSingle();
  if (error) throwStaffApiError(error);
  if (data?.role !== "admin") return false;
  return true;
}

/** Teto de cada busca de empresa. A página pede um a mais para saber se há resto. */
export const COMPANY_LIST_LIMIT = 100;

/**
 * Empresas do formulário de vaga, com busca e teto.
 * `truncated` avisa que há mais além desta página. `includeId` devolve a empresa
 * da vaga em edição mesmo quando ela fica fora do corte.
 * @returns {Promise<{ companies: {id: string, name: string}[], truncated: boolean }>}
 */
export async function loadCompanies({ query = "", includeId = "" } = {}) {
  const client = clientOrThrow();
  const term = String(query ?? "").trim();
  let request = client.from("companies").select("id,name").order("name", { ascending: true }).order("id", { ascending: true });
  if (term) request = request.ilike("name", `%${ilikeExact(term)}%`);
  const { data, error } = await request.limit(COMPANY_LIST_LIMIT + 1);
  throwIfError(error);
  const rows = data ?? [];
  const truncated = rows.length > COMPANY_LIST_LIMIT;
  const companies = truncated ? rows.slice(0, COMPANY_LIST_LIMIT) : [...rows];
  if (includeId && !companies.some((row) => row.id === includeId)) {
    const extra = await client.from("companies").select("id,name").eq("id", includeId).maybeSingle();
    throwIfError(extra.error);
    if (extra.data) companies.unshift(extra.data);
  }
  return { companies, truncated };
}

const ADMIN_JOB_SELECT =
  "id,title,status,company_id,level,work_model,location,country_code,salary_min,salary_max,description,stack,curation_round,rejected_at,companies(name),job_curation_reviews(decision,rubric_code,internal_comment,curation_round,created_at)";

/**
 * Fora da listagem staff. /admin/vagas usa loadAdminJobPage (pageSize, count exact, range).
 * Não baixa jobs. Mantida só para o mock das rotas não chamarem a lista legada.
 */
export async function loadAdminJobs() {
  throw new Error("loadAdminJobs saiu da listagem. Use loadAdminJobPage.");
}

export async function loadAdminJob(id) {
  if (!id) return null;
  const client = clientOrThrow();
  const { data, error } = await client.from("jobs").select(ADMIN_JOB_SELECT).eq("id", id).maybeSingle();
  throwIfError(error);
  return data ?? null;
}

function ilikeExact(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

const DUPLICATE_TITLE_PROBE_LIMIT = 5;

/**
 * Uma sonda por company_id + título (lower/btrim no índice único).
 * Não seleciona os jobs da empresa. O insert ainda rejeita 23505.
 */
async function assertNoDuplicateTitle(client, { companyId, title, excludeId }) {
  if (!companyId) return;
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return;
  let request = client
    .from("jobs")
    .select("id,title,company_id")
    .eq("company_id", companyId)
    .ilike("title", ilikeExact(trimmed));
  if (excludeId) request = request.neq("id", excludeId);
  const { data, error } = await request.limit(DUPLICATE_TITLE_PROBE_LIMIT);
  throwIfError(error);
  if (findDuplicateJob(data, { companyId, title, excludeId })) {
    throw new Error(DUPLICATE_JOB_MESSAGE);
  }
}

export async function createCompany({ name, description = "Empresa fictícia de homologação." }) {
  const client = clientOrThrow();
  const trimmed = String(name).trim();
  if (!trimmed) throw new Error("Nome da empresa é obrigatório.");
  const { data, error } = await client
    .from("companies")
    .insert({ name: trimmed, description, website: "https://example.invalid" })
    .select("id,name")
    .single();
  throwIfError(error);
  return data;
}

export async function createPendingJob(input) {
  const errors = validateAdminJob(input);
  if (errors.length) throw new Error(errors[0]);
  const client = clientOrThrow();
  let companyId = input.companyId;
  if (!companyId && input.newCompanyName) {
    const company = await createCompany({ name: input.newCompanyName });
    companyId = company.id;
  }
  await assertNoDuplicateTitle(client, { companyId, title: input.title });
  const { columns } = structuredJobColumns(input);
  const payload = {
    company_id: companyId,
    title: input.title.trim(),
    description: input.description.trim(),
    stack: parseStack(input.stackText),
    level: LEVEL_TO_DB[input.level],
    work_model: MODEL_TO_DB[input.workModel],
    location: String(input.location ?? "").trim() || null,
    country_code: columns.country_code,
    salary_min: columns.salary_min,
    salary_max: columns.salary_max,
    requirements: { mandatory: [], desirable: [] },
  };
  const { data, error } = await client.from("jobs").insert(payload).select("id,title,status").single();
  throwIfError(error);
  return data;
}

export async function updatePendingJob(id, input) {
  const errors = validateAdminJob(input, { requireCompany: false });
  if (errors.length) throw new Error(errors[0]);
  if (!id) throw new Error("Vaga para atualizar não informada.");
  const client = clientOrThrow();
  let companyId = input.companyId || "";
  if (!companyId) {
    const current = await client.from("jobs").select("company_id").eq("id", id).maybeSingle();
    throwIfError(current.error);
    companyId = current.data?.company_id ?? "";
  }
  await assertNoDuplicateTitle(client, { companyId, title: input.title, excludeId: id });
  const { columns } = structuredJobColumns(input);
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    stack: parseStack(input.stackText),
    level: LEVEL_TO_DB[input.level],
    work_model: MODEL_TO_DB[input.workModel],
    location: String(input.location ?? "").trim() || null,
    country_code: columns.country_code,
    salary_min: columns.salary_min,
    salary_max: columns.salary_max,
    updated_at: new Date().toISOString(),
  };
  if (input.companyId) payload.company_id = input.companyId;
  const { data, error } = await client
    .from("jobs")
    .update(payload)
    .eq("id", id)
    .select("id,title,status")
    .single();
  throwIfError(error);
  return data;
}
