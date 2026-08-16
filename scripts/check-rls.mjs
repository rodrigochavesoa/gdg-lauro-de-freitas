/**
 * Verifica RLS: visitante (anon) só vê approved; admin autenticado vê pending+approved
 * e consegue INSERT; anon não cria vaga. Lê .env.local e docs-local/admin-test-user.md.
 * Nunca imprime senhas. pwsh: pnpm test:rls
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
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

function loadAdminTestUser() {
  const file = resolve(process.cwd(), "docs-local/admin-test-user.md");
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8");
  return {
    email: text.match(/E-mail:\s*(\S+)/i)?.[1],
    password: text.match(/Senha:\s*(\S+)/i)?.[1],
  };
}

const env = { ...loadLocalEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const adminUser = {
  email: env.ADMIN_TEST_EMAIL || loadAdminTestUser().email,
  password: env.ADMIN_TEST_PASSWORD || loadAdminTestUser().password,
};

if (!url || !key) {
  console.log("test:rls ignorado: preencha VITE_SUPABASE_URL e a chave publishable/anon em .env.local.");
  process.exit(0);
}

const anon = createClient(url, key);
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`FALHA: ${message}`);
  } else {
    console.log(`OK: ${message}`);
  }
}

const jobs = await anon.from("jobs").select("id,title,status");
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

const pendingProbe = await anon.from("jobs").select("id,title,status").eq("status", "pending");
assert(!pendingProbe.error, "consulta explícita de pending não quebra");
assert((pendingProbe.data ?? []).length === 0, "filtro pending retorna zero linhas para anon");

const profiles = await anon.from("profiles").select("id,full_name");
assert(!profiles.error || profiles.error.code === "PGRST301", "perfil não vaza para anon");
assert((profiles.data ?? []).length === 0, "anon não lista profiles");

const applications = await anon.from("applications").select("id,candidate_id");
assert(!applications.error || applications.error.code === "PGRST301", "candidatura não vaza para anon");
assert((applications.data ?? []).length === 0, "anon não lista applications");

const anonInsert = await anon.from("jobs").insert({
  company_id: "a1a1a1a1-0001-4000-8000-000000000001",
  title: "Vaga anônima (não deve persistir)",
  description: "Tentativa de INSERT sem sessão.",
  level: "junior",
  work_model: "remote",
  status: "pending",
});
assert(Boolean(anonInsert.error), "anon/candidato sem papel admin não cria vaga");

if (!adminUser.email || !adminUser.password) {
  console.log("cenário admin ignorado: docs-local/admin-test-user.md ou ADMIN_TEST_EMAIL/PASSWORD.");
} else {
  const admin = createClient(url, key);
  const signed = await admin.auth.signInWithPassword({
    email: adminUser.email,
    password: adminUser.password,
  });
  assert(!signed.error, `admin autentica (${signed.error?.message ?? "ok"})`);
  if (!signed.error) {
    const pendingAsAdmin = await admin.from("jobs").select("id,title,status").eq("status", "pending");
    assert(!pendingAsAdmin.error, "admin lê pending sem erro");
    assert((pendingAsAdmin.data ?? []).length > 0, "admin lista ao menos uma vaga pending");

    const approvedAsAdmin = await admin.from("jobs").select("id,status").eq("status", "approved");
    assert((approvedAsAdmin.data ?? []).length > 0, "admin também lista vagas approved");

    const marker = `RLS admin ${Date.now()}`;
    const created = await admin.from("jobs").insert({
      company_id: "a1a1a1a1-0001-4000-8000-000000000001",
      title: marker,
      description: "Vaga fictícia criada pelo teste RLS e removida em seguida.",
      level: "mid",
      work_model: "remote",
      status: "pending",
    }).select("id,status").single();
    assert(!created.error && created.data?.status === "pending", "admin cadastra vaga pending");
    if (created.data?.id) {
      const hidden = await anon.from("jobs").select("id").eq("id", created.data.id);
      assert((hidden.data ?? []).length === 0, "visitante não vê a vaga pending recém-criada");
      await admin.from("jobs").delete().eq("id", created.data.id);
    }
    await admin.auth.signOut();
  }
}

if (failures.length > 0) {
  console.error(`${failures.length} cenário(s) RLS falharam.`);
  process.exit(1);
}

console.log("RLS visitante (anon) + admin autenticado: ok.");
