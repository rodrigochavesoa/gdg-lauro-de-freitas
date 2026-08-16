/**
 * Verifica RLS como visitante (anon): só vagas approved; sem perfis/candidaturas.
 * Lê .env.local — nunca imprime chaves. Não rode no CI sem projeto de teste.
 *
 * pwsh: pnpm test:rls
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return {};
  }
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = { ...loadLocalEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("test:rls ignorado: preencha VITE_SUPABASE_URL e a chave publishable/anon em .env.local (canal seguro).");
  process.exit(0);
}

const client = createClient(url, key);
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`FALHA: ${message}`);
  } else {
    console.log(`OK: ${message}`);
  }
}

const jobs = await client.from("jobs").select("id,title,status");
assert(!jobs.error, `leitura de jobs como anon sem erro (${jobs.error?.message ?? "ok"})`);
const rows = jobs.data ?? [];
assert(rows.length > 0, "visitante vê ao menos uma vaga");
assert(
  rows.every((row) => row.status === "approved"),
  "visitante não recebe vaga pending/archived",
);
assert(
  !rows.some((row) => /PENDENTE/i.test(row.title ?? "")),
  "título da vaga pendente do seed não aparece no catálogo anônimo",
);

const pendingProbe = await client.from("jobs").select("id,title,status").eq("status", "pending");
assert(!pendingProbe.error, "consulta explícita de pending não quebra");
assert((pendingProbe.data ?? []).length === 0, "filtro pending retorna zero linhas para anon");

const profiles = await client.from("profiles").select("id,full_name");
assert(!profiles.error || profiles.error.code === "PGRST301", "perfil não vaza para anon");
assert((profiles.data ?? []).length === 0, "anon não lista profiles");

const applications = await client.from("applications").select("id,candidate_id");
assert(!applications.error || applications.error.code === "PGRST301", "candidatura não vaza para anon");
assert((applications.data ?? []).length === 0, "anon não lista applications");

if (failures.length > 0) {
  console.error(`${failures.length} cenário(s) RLS falharam.`);
  process.exit(1);
}

console.log("RLS visitante (anon): catálogo só com approved.");
