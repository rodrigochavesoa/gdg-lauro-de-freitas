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

export function validateAdminJob(
  { title, description, companyId, newCompanyName, level, workModel },
  { requireCompany = true } = {},
) {
  const errors = [];
  if (!String(title ?? "").trim()) errors.push("Título é obrigatório.");
  if (!String(description ?? "").trim()) errors.push("Descrição é obrigatória.");
  if (requireCompany && !companyId && !String(newCompanyName ?? "").trim()) {
    errors.push("Selecione uma empresa ou informe o nome de uma empresa fictícia.");
  }
  if (!LEVEL_TO_DB[level]) errors.push("Nível é obrigatório.");
  if (!MODEL_TO_DB[workModel]) errors.push("Modelo de trabalho é obrigatório.");
  return errors;
}

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

export async function signInAdmin(email, password) {
  const client = clientOrThrow();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  throwIfError(error);
  const isAdmin = await loadIsAdmin();
  if (!isAdmin) {
    await client.auth.signOut();
    throw new Error("Esta conta não é administradora.");
  }
  return data.user;
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
  const { data: sessionData } = await client.auth.getUser();
  if (!sessionData?.user) return false;
  const { data, error } = await client.from("profiles").select("role").eq("id", sessionData.user.id).maybeSingle();
  if (error || data?.role !== "admin") return false;
  return true;
}

export async function loadCompanies() {
  const client = clientOrThrow();
  const { data, error } = await client.from("companies").select("id,name").order("name");
  throwIfError(error);
  return data ?? [];
}

export async function loadAdminJobs() {
  const client = clientOrThrow();
  const { data, error } = await client
    .from("jobs")
    .select("id,title,status,company_id,level,work_model,location,description,stack,companies(name)")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data ?? [];
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
  const payload = {
    company_id: companyId,
    title: input.title.trim(),
    description: input.description.trim(),
    stack: parseStack(input.stackText),
    level: LEVEL_TO_DB[input.level],
    work_model: MODEL_TO_DB[input.workModel],
    location: String(input.location ?? "").trim() || null,
    status: "pending",
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
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    stack: parseStack(input.stackText),
    level: LEVEL_TO_DB[input.level],
    work_model: MODEL_TO_DB[input.workModel],
    location: String(input.location ?? "").trim() || null,
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
