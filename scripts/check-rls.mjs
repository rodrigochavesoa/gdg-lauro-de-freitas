/**
 * Verifica RLS, curadoria V1 (S4-01), candidatura V1 (S6-01), F-019, F-023, MVP-021, MVP-003, MVP-005, MVP-022, SEC-STAFF-MFA-02, MVP-013 (Fase A/B) e SEC-STAFF-APPLY-01.
 * Lê .env.local, docs-local/*-test-user.md e docs-local/staff-mfa-totp-secrets.md. Nunca imprime senhas nem secrets TOTP.
 * pwsh: pnpm test:rls
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { findForbiddenLogFields } from "../src/lib/privacy-redaction.js";
import { generateTotp } from "./totp.mjs";
import {
  SOURCE_KINDS,
  buildIngestionFingerprint,
  registerJobIngestion,
} from "../src/features/ingest/source-contract.js";
import { processJobIngestion } from "../src/features/ingest/ingest-api.js";

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

function loadTestUser(filename, envPrefix) {
  const file = resolve(process.cwd(), `docs-local/${filename}`);
  const fromFile = existsSync(file)
    ? {
        email: readFileSync(file, "utf8").match(/E-mail:\s*(\S+)/i)?.[1],
        password: readFileSync(file, "utf8").match(/Senha:\s*(\S+)/i)?.[1],
      }
    : {};
  return {
    email: process.env[`${envPrefix}_EMAIL`] || fromFile.email,
    password: process.env[`${envPrefix}_PASSWORD`] || fromFile.password,
  };
}

const env = { ...loadLocalEnv(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const testUsers = {
  admin: loadTestUser("admin-test-user.md", "ADMIN_TEST"),
  curator: loadTestUser("curator-test-user.md", "CURATOR_TEST"),
  curator2: loadTestUser("curator2-test-user.md", "CURATOR2_TEST"),
  curator3: loadTestUser("curator3-test-user.md", "CURATOR3_TEST"),
  moderator: loadTestUser("moderator-test-user.md", "MODERATOR_TEST"),
  candidate: loadTestUser("candidate-test-user.md", "CANDIDATE_TEST"),
};

function parseTotpSecretsFile() {
  const file = resolve(process.cwd(), "docs-local/staff-mfa-totp-secrets.md");
  const map = {};
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*(admin|curator2|curator3|curator|moderator)\s*\|[^|]*\|\s*([^|]+)\|/i,
    );
    if (!match) continue;
    const secret = match[2].trim().replace(/`/g, "").replace(/\s+/g, "");
    if (!secret || /colar|placeholder|^_+$/i.test(secret)) continue;
    map[match[1].toLowerCase()] = secret;
  }
  return map;
}

const totpFile = parseTotpSecretsFile();
const totpSecrets = {
  admin: env.ADMIN_TEST_TOTP_SECRET || totpFile.admin,
  curator: env.CURATOR_TEST_TOTP_SECRET || totpFile.curator,
  curator2: env.CURATOR2_TEST_TOTP_SECRET || totpFile.curator2,
  curator3: env.CURATOR3_TEST_TOTP_SECRET || totpFile.curator3,
  moderator: env.MODERATOR_TEST_TOTP_SECRET || totpFile.moderator,
};

function hasCreds(user) {
  return Boolean(user?.email && user?.password);
}

const SEED_COMPANY = "a1a1a1a1-0001-4000-8000-000000000001";
const RUBRIC = "R1-empresa-identificavel";
const SEED_APPROVED_A = "b2b2b2b2-0003-4000-8000-000000000003";
const SEED_APPROVED_B = "b2b2b2b2-0004-4000-8000-000000000004";
const SEED_PENDING = "b2b2b2b2-0005-4000-8000-000000000005";

if (!url || !key) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(
      "FALHA: test:rls no CI exige secrets VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY).",
    );
    process.exit(1);
  }
  console.log("test:rls ignorado: preencha VITE_SUPABASE_URL e a chave publishable/anon em .env.local.");
  process.exit(0);
}

const anon = createClient(url, key);
const failures = [];
const skipped = [];
const skippedRequired = new Set();

function skipRequired(scenario, message) {
  skippedRequired.add(scenario);
  skip(`cenário ${scenario}: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`FALHA: ${message}`);
  } else {
    console.log(`OK: ${message}`);
  }
}

function skip(message) {
  skipped.push(message);
  console.log(`IGNORADO: ${message}`);
}

function errorText(error) {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" ");
}

/** PostgREST/Postgres recusou EXECUTE (PGRST202 / 42501), não só RAISE interno. */
function isExecuteDenied(error) {
  return /could not find the function|permission denied|42501|PGRST202|schema cache/i.test(errorText(error));
}

/** Schema fora da lista exposta pelo PostgREST (PGRST106). */
function isPostgrestSchemaHidden(error, schema) {
  const text = errorText(error);
  if (error?.code !== "PGRST106" && !/invalid schema/i.test(text)) return false;
  const exposed = String(error?.hint ?? "").match(/exposed:\s*(.+)/i)?.[1] ?? "";
  const list = exposed.split(",").map((item) => item.trim()).filter(Boolean);
  if (list.length > 0) return !list.includes(schema);
  return new RegExp(`invalid schema:\\s*${schema}\\b`, "i").test(text);
}

function isTransientSupabaseError(error) {
  return /gateway timeout|502|503|504|522|524|ECONNRESET|fetch failed|Failed to fetch|NetworkError/i.test(errorText(error));
}

function isIngestionProbeTransient(error) {
  return (
    isTransientSupabaseError(error) ||
    /timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|unavailable|Failed to fetch|network/i.test(errorText(error))
  );
}

/** RLS/GRANT/JWT recusou a leitura; não inclui rede, timeout nem 5xx. */
function isIngestionReadDenied(error) {
  return /row-level security|42501|permission denied|PGRST301|JWT expired|not authenticated|PGRST103/i.test(
    errorText(error),
  );
}

function isTransientAuthError(error) {
  return /rate limit|too many requests|429|timeout|502|503|504|gateway|fetch failed|network/i.test(errorText(error));
}

async function queryWithRetry(queryFn, { attempts = 3, pauseMs = 2500 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await queryFn();
    if (!last?.error || !isTransientSupabaseError(last.error)) return last;
    if (attempt < attempts) {
      console.log(`AVISO: erro transitório (${errorText(last.error)}); tentativa ${attempt}/${attempts}…`);
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
  return last;
}

function serviceRoleKey() {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
}

function createServiceClient() {
  const secret = serviceRoleKey();
  if (!secret) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanupF019Probe(userId) {
  if (!userId) return;
  const svc = createServiceClient();
  if (!svc) {
    console.log(
      "AVISO: sem SUPABASE_SERVICE_ROLE_KEY — cleanup manual do probe por prefixo rls-f019- (Auth + profiles).",
    );
    return;
  }
  const { error: profileErr } = await svc.from("profiles").delete().eq("id", userId);
  if (profileErr) console.log(`AVISO: cleanup profiles probe: ${profileErr.message}`);
  const { error: delErr } = await svc.auth.admin.deleteUser(userId);
  if (delErr) {
    console.log(`AVISO: cleanup auth.admin.deleteUser: ${delErr.message}`);
    return;
  }
  console.log("OK: cleanup probe F-019 (auth + profiles)");
}

async function signIn(credentials) {
  const client = createClient(url, key);
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) return { client, error };
  return { client, user: data.user };
}

async function signInWithRetry(credentials, { attempts = 4, pauseMs = 2000, label = "usuário" } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await signIn(credentials);
    if (!last.error && last.user?.id) return last;
    if (!isTransientAuthError(last.error) || attempt === attempts) return last;
    console.log(`AVISO: login ${label} (${errorText(last.error) || "sem mensagem"}); tentativa ${attempt}/${attempts}…`);
    await new Promise((resolve) => setTimeout(resolve, pauseMs * attempt));
  }
  return last;
}

async function promoteSessionToAal2(client, totpSecret) {
  const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) return aalError;
  if (aal?.currentLevel === "aal2") return null;
  if (!totpSecret) {
    return { message: "TOTP secret ausente para promover AAL2" };
  }
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) return factorError;
  const totp = (factors?.totp ?? []).find((factor) => factor.status === "verified");
  if (!totp) {
    return { message: "conta staff sem fator TOTP verificado" };
  }
  let lastError = { message: "verify TOTP falhou" };
  for (const skewMs of [-60_000, -30_000, 0, 30_000, 60_000]) {
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId: totp.id,
    });
    if (challengeError) return challengeError;
    const code = generateTotp(totpSecret, { now: Date.now() + skewMs });
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.id,
      code,
    });
    if (!verifyError) {
      await client.auth.getSession();
      return null;
    }
    lastError = verifyError;
  }
  return lastError;
}

async function signInStaffAal2({ email, password, totpSecret }, options = {}) {
  const signed = await signInWithRetry({ email, password }, options);
  if (signed.error || !signed.user) return signed;
  const promoteError = await promoteSessionToAal2(signed.client, totpSecret);
  if (promoteError) {
    await signed.client.auth.signOut();
    return { client: null, error: promoteError };
  }
  return signed;
}

async function signInStaff(role, options = {}) {
  const user = testUsers[role];
  return signInStaffAal2(
    { email: user?.email, password: user?.password, totpSecret: totpSecrets[role] },
    { label: role, ...options },
  );
}

/** Evita crash quando AAL2 falha (ex.: TOTP desatualizado no CI); marca cenário como ignorado. */
async function signInStaffForScenario(scenario, role) {
  if (!hasCreds(testUsers[role])) {
    skipRequired(scenario, `falta credencial de ${role}`);
    return null;
  }
  if (!totpSecrets[role] && role !== "candidate") {
    skipRequired(scenario, `falta TOTP secret de ${role} (env ou docs-local/staff-mfa-totp-secrets.md)`);
    return null;
  }
  const { client, error } = await signInStaff(role);
  if (error || !client) {
    const detail = error?.message ?? "client null";
    if (/invalid totp/i.test(detail) && process.env.GITHUB_ACTIONS === "true") {
      console.error(
        `AVISO: sincronize ${role.toUpperCase()}_TEST_TOTP_SECRET no GitHub com o fator TOTP verificado em homolog (docs-local/staff-mfa-totp-secrets.md).`,
      );
    }
    skipRequired(scenario, `${role} não autenticou (${detail})`);
    return null;
  }
  return client;
}

function isStaffAal2Denied(error) {
  return /aal2 required|row-level security|42501|violat(es|ed) row-level security/i.test(
    errorText(error),
  );
}

function isRelationMissing(error) {
  return /could not find the table|schema cache|PGRST205|does not exist|42P01/i.test(errorText(error));
}

async function createPendingJob(client, marker) {
  return client
    .from("jobs")
    .insert({
      company_id: SEED_COMPANY,
      title: marker,
      description: "Vaga fictícia para teste RLS de curadoria.",
      level: "junior",
      work_model: "remote",
      status: "pending",
      requirements: { mandatory: [], desirable: [] },
    })
    .select("id,status")
    .single();
}

async function deleteJob(client, id) {
  if (id) await client.from("jobs").delete().eq("id", id);
}

async function rpcReview(client, jobId, decision, rubricCode = RUBRIC) {
  return client.rpc("submit_curation_review", {
    p_job_id: jobId,
    p_decision: decision,
    p_rubric_code: rubricCode,
    p_internal_comment: null,
  });
}

async function rpcApply(client, jobId) {
  const res = await client.rpc("apply_to_job", { p_job_id: jobId });
  if (res.error) return res;
  if (res.data && typeof res.data === "object" && typeof res.data.error === "string") {
    return { data: null, error: { message: res.data.error } };
  }
  return res;
}

async function rpcWithdraw(client, jobId) {
  return client.rpc("withdraw_application", { p_job_id: jobId });
}

async function assertStaffCannotApplyOrWithdraw(client, role) {
  const apply = await rpcApply(client, SEED_APPROVED_A);
  assert(Boolean(apply.error), `${role} AAL2 não aplica via RPC`);
  assert(
    /staff cannot apply/i.test(errorText(apply.error)),
    `apply ${role} recusado (${errorText(apply.error) || "sem mensagem"})`,
  );
  const withdraw = await rpcWithdraw(client, SEED_APPROVED_A);
  assert(Boolean(withdraw.error), `${role} AAL2 não retira via RPC`);
  assert(
    /staff cannot withdraw/i.test(errorText(withdraw.error)),
    `withdraw ${role} recusado (${errorText(withdraw.error) || "sem mensagem"})`,
  );
}

async function deleteApplication(admin, jobId, candidateId) {
  if (!jobId || !candidateId) return;
  await admin.from("applications").delete().eq("job_id", jobId).eq("candidate_id", candidateId);
}

async function deleteApplyRequestLog(admin, userId) {
  if (!userId) return;
  await admin.from("apply_request_log").delete().eq("user_id", userId);
}

function d01Preferences(current) {
  const prefs = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  return {
    ...prefs,
    experience_level: "junior",
    work_model: "remote",
    location: "Brasil · Remoto",
  };
}

async function ensureD01Profile(client, userId) {
  const current = await client
    .from("profiles")
    .select("full_name,skills,preferences,bio")
    .eq("id", userId)
    .maybeSingle();
  const row = current.data ?? {};
  const payload = {
    full_name: String(row.full_name ?? "").trim() || "Candidato Homolog",
    skills: Array.isArray(row.skills) && row.skills.some((item) => String(item).trim())
      ? row.skills
      : ["JavaScript"],
    preferences: d01Preferences(row.preferences),
    updated_at: new Date().toISOString(),
  };
  const saved = await client.from("profiles").update(payload).eq("id", userId).select("full_name,skills,preferences,bio").single();
  return { previous: row, current: saved.data };
}

/** Cenário 1 — anon só approved; sem fila nem pareceres. */
async function scenario1_anon() {
  const jobs = await queryWithRetry(() => anon.from("jobs").select("id,title,status"));
  assert(!jobs.error, `anon lê jobs sem erro (${jobs.error?.message ?? "ok"})`);
  const rows = jobs.data ?? [];
  assert(rows.length > 0, "visitante vê ao menos uma vaga");
  assert(rows.every((row) => row.status === "approved"), "visitante só recebe approved");

  const pendingProbe = await queryWithRetry(() => anon.from("jobs").select("id").eq("status", "pending"));
  assert((pendingProbe.data ?? []).length === 0, "anon não filtra pending");

  const reviews = await queryWithRetry(() => anon.from("job_curation_reviews").select("id"));
  assert((reviews.data ?? []).length === 0, "anon não lê pareceres");

  const queue = await queryWithRetry(() => anon.from("jobs_needing_moderation").select("id"));
  assert((queue.data ?? []).length === 0, "anon não lê fila needs_moderation");

  const rpc = await anon.rpc("submit_curation_review", {
    p_job_id: "b2b2b2b2-0005-4000-8000-000000000005",
    p_decision: "approve",
    p_rubric_code: RUBRIC,
  });
  assert(Boolean(rpc.error), "anon não chama RPC de parecer");
  assert(isExecuteDenied(rpc.error), `anon sem EXECUTE em submit_curation_review (${errorText(rpc.error) || "sem mensagem"})`);

  const profiles = await queryWithRetry(() => anon.from("profiles").select("id"));
  assert(!profiles.error, `anon lê profiles sem erro de API (${profiles.error?.message ?? "ok"})`);
  assert((profiles.data ?? []).length === 0, "anon não lê perfis");

  const applications = await queryWithRetry(() => anon.from("applications").select("id"));
  assert(!applications.error, `anon lê applications sem erro de API (${applications.error?.message ?? "ok"})`);
  assert((applications.data ?? []).length === 0, "anon não lê candidaturas");
}

/** Cenário 2 — candidato não cura, prioridade nem status. */
async function scenario2_candidate() {
  if (!hasCreds(testUsers.candidate)) {
    skip("candidato: docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
    return;
  }
  const { client, user, error } = await signIn(testUsers.candidate);
  assert(!error, `candidato autentica (${error?.message ?? "ok"}`);
  if (error) return;

  const pending = await queryWithRetry(() => client.from("jobs").select("id,status").eq("status", "pending"));
  assert((pending.data ?? []).length === 0, "candidato não vê pending");

  const reviews = await queryWithRetry(() => client.from("job_curation_reviews").select("id"));
  assert((reviews.data ?? []).length === 0, "candidato não lê pareceres");

  const profiles = await queryWithRetry(() => client.from("profiles").select("id"));
  assert(!profiles.error, `candidato lê profiles sem erro de API (${profiles.error?.message ?? "ok"})`);
  assert(
    (profiles.data ?? []).every((row) => row.id === user?.id),
    "candidato não lê perfil de terceiros",
  );

  const applications = await queryWithRetry(() => client.from("applications").select("candidate_id"));
  assert(!applications.error, `candidato lê applications sem erro de API (${applications.error?.message ?? "ok"})`);
  assert(
    (applications.data ?? []).every((row) => row.candidate_id === user?.id),
    "candidato não lê candidatura de terceiros",
  );

  const rpc = await rpcReview(client, "b2b2b2b2-0005-4000-8000-000000000005", "approve");
  assert(Boolean(rpc.error), "candidato não registra parecer via RPC");

  const priority = await client.rpc("set_job_curation_priority", {
    p_job_id: "b2b2b2b2-0005-4000-8000-000000000005",
    p_priority: "urgent",
    p_reason: "tentativa",
  });
  assert(Boolean(priority.error), "candidato não define prioridade");

  const statusHack = await client
    .from("jobs")
    .update({ status: "approved" })
    .eq("id", "b2b2b2b2-0005-4000-8000-000000000005")
    .select("id");
  assert(Boolean(statusHack.error) || (statusHack.data ?? []).length === 0, "candidato não altera status");

  await client.auth.signOut();
}

/** Cenários 3–8 exigem admin + curadores configurados. */
async function scenario3_curatorSingleReview() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.curator)) {
    skipRequired(3, "faltam admin e/ou curator em docs-local");
    return null;
  }
  const { client: admin, error: adminErr } = await signInStaff("admin");
  assert(!adminErr, `admin autentica (${adminErr?.message ?? "ok"}`);
  if (adminErr) return null;

  const marker = `RLS curator once ${Date.now()}`;
  const created = await createPendingJob(admin, marker);
  assert(!created.error && created.data?.id, "admin cria vaga pending para curadoria");
  const jobId = created.data?.id;

  const { client: curator, error: curErr } = await signInStaff("curator");
  assert(!curErr, `curador autentica (${curErr?.message ?? "ok"}`);
  if (curErr || !jobId) {
    await deleteJob(admin, jobId);
    await admin.auth.signOut();
    return null;
  }

  const first = await rpcReview(curator, jobId, "approve");
  assert(!first.error, "curador registra primeiro parecer");
  const dup = await rpcReview(curator, jobId, "approve");
  assert(Boolean(dup.error), "curador não duplica parecer na rodada");

  await curator.auth.signOut();
  await deleteJob(admin, jobId);
  await admin.auth.signOut();
  return { adminCredentials: testUsers.admin };
}

/** Cenário 4 — autoavaliação e duplicidade na RPC. */
async function scenario4_selfReviewAndDuplicate() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.curator)) {
    skipRequired(4, "faltam admin e/ou curator em docs-local");
    return;
  }
  const { client: admin, error: adminErr } = await signInStaff("admin");
  if (adminErr) {
    skipRequired(4, `admin não autenticou (${adminErr.message})`);
    return;
  }

  const marker = `RLS self-review ${Date.now()}`;
  const created = await createPendingJob(admin, marker);
  const jobId = created.data?.id;
  assert(jobId, "vaga criada para teste de autoavaliação");

  const detail = await admin.from("jobs").select("submitted_by").eq("id", jobId).maybeSingle();
  assert(Boolean(detail.data?.submitted_by), "vaga autenticada preenche submitted_by (migration 0005)");
  if (detail.data?.submitted_by) {
    const self = await rpcReview(admin, jobId, "approve");
    assert(Boolean(self.error), "admin não autoavalia vaga própria");
  }

  const { client: curator } = await signInStaff("curator");
  const ok = await rpcReview(curator, jobId, "approve");
  assert(!ok.error, "curador avalia vaga de outro autor");
  const dup = await rpcReview(curator, jobId, "reject");
  assert(Boolean(dup.error), "duplicidade recusada na RPC");

  await curator.auth.signOut();
  await deleteJob(admin, jobId);
  await admin.auth.signOut();
}

/** Cenário 5 — quórum 2×approve e 2×reject. */
async function scenario5_quorum() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.curator) || !hasCreds(testUsers.curator2)) {
    skipRequired(5, "faltam admin + curator + curator2");
    return;
  }
  const admin = await signInStaffForScenario(5, "admin");
  if (!admin) return;

  const approveMarker = `RLS quorum approve ${Date.now()}`;
  const rejectMarker = `RLS quorum reject ${Date.now()}`;
  const jobA = await createPendingJob(admin, approveMarker);
  const jobR = await createPendingJob(admin, rejectMarker);

  const c1 = await signInStaffForScenario(5, "curator");
  const c2 = await signInStaffForScenario(5, "curator2");
  if (!c1 || !c2) {
    await deleteJob(admin, jobA.data?.id);
    await deleteJob(admin, jobR.data?.id);
    await admin.auth.signOut();
    return;
  }

  await rpcReview(c1, jobA.data.id, "approve");
  const approved = await rpcReview(c2, jobA.data.id, "approve");
  assert(!approved.error, "segunda aprovação via RPC");
  const jobAState = await admin.from("jobs").select("status").eq("id", jobA.data.id).single();
  assert(jobAState.data?.status === "approved", "2 approve → approved");

  await rpcReview(c1, jobR.data.id, "reject");
  const rejected = await rpcReview(c2, jobR.data.id, "reject");
  assert(!rejected.error, "segunda rejeição via RPC");
  const jobRState = await admin.from("jobs").select("status").eq("id", jobR.data.id).single();
  assert(jobRState.data?.status === "rejected", "2 reject → rejected");

  await c1.auth.signOut();
  await c2.auth.signOut();
  await deleteJob(admin, jobA.data.id);
  await deleteJob(admin, jobR.data.id);
  await admin.auth.signOut();
}

/** Cenário 6 — empate 1×1 → pending + needs_moderation. */
async function scenario6_tie() {
  const reviewerB = testUsers.curator2;
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.curator) || !hasCreds(reviewerB)) {
    skipRequired(6, "faltam admin + curator + curator2");
    return;
  }

  const admin = await signInStaffForScenario(6, "admin");
  if (!admin) return;
  const marker = `RLS tie ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const c1 = await signInStaffForScenario(6, "curator");
  const c2 = await signInStaffForScenario(6, "curator2");
  if (!c1 || !c2) {
    await deleteJob(admin, jobId);
    await admin.auth.signOut();
    return;
  }

  await rpcReview(c1, jobId, "approve");
  await rpcReview(c2, jobId, "reject");

  const state = await admin.from("jobs").select("status").eq("id", jobId).single();
  assert(state.data?.status === "pending", "empate mantém pending");

  const mod = await admin.from("jobs_needing_moderation").select("id").eq("id", jobId);
  assert((mod.data ?? []).length === 1, "empate aparece em jobs_needing_moderation");

  await c1.auth.signOut();
  await c2.auth.signOut();
  await deleteJob(admin, jobId);
  await admin.auth.signOut();
}

/** Cenário 7 — moderador resolve empate; curador comum não. */
async function scenario7_moderation() {
  if (
    !hasCreds(testUsers.admin) ||
    !hasCreds(testUsers.curator) ||
    !hasCreds(testUsers.curator2) ||
    !hasCreds(testUsers.curator3) ||
    !hasCreds(testUsers.moderator)
  ) {
    skipRequired(7, "faltam admin + curator + curator2 + curator3 + moderator");
    return;
  }

  const admin = await signInStaffForScenario(7, "admin");
  if (!admin) return;
  const marker = `RLS moderation ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const curator = await signInStaffForScenario(7, "curator");
  const curator2 = await signInStaffForScenario(7, "curator2");
  const curator3 = await signInStaffForScenario(7, "curator3");
  const moderator = await signInStaffForScenario(7, "moderator");
  if (!curator || !curator2 || !curator3 || !moderator) {
    await deleteJob(admin, jobId);
    await admin.auth.signOut();
    return;
  }

  await rpcReview(curator, jobId, "approve");
  await rpcReview(curator2, jobId, "reject");

  const blocked = await rpcReview(curator3, jobId, "approve");
  assert(Boolean(blocked.error), "curador comum não resolve empate");
  assert(
    /moderation required|not authorized/i.test(blocked.error?.message ?? ""),
    "empate retorna erro de moderação",
  );

  const resolved = await rpcReview(moderator, jobId, "approve");
  assert(!resolved.error, `moderador resolve empate (${resolved.error?.message ?? "ok"})`);
  const state = await moderator.from("jobs").select("status").eq("id", jobId).single();
  assert(state.data?.status === "approved", "decisão de moderação aplica approved");

  await curator.auth.signOut();
  await curator2.auth.signOut();
  await curator3.auth.signOut();
  await moderator.auth.signOut();
  await deleteJob(admin, jobId);
  await admin.auth.signOut();
}

/** Cenário 8 — reenvio incrementa rodada; histórico consultável. */
async function scenario8_resubmit() {
  const reviewerB = testUsers.curator2;
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.curator) || !hasCreds(reviewerB)) {
    skipRequired(8, "faltam admin + curator + curator2");
    return;
  }

  const admin = await signInStaffForScenario(8, "admin");
  if (!admin) return;
  const marker = `RLS resubmit ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const c1 = await signInStaffForScenario(8, "curator");
  const c2 = await signInStaffForScenario(8, "curator2");
  if (!c1 || !c2) {
    await deleteJob(admin, jobId);
    await admin.auth.signOut();
    return;
  }
  await rpcReview(c1, jobId, "reject");
  await rpcReview(c2, jobId, "reject");

  const resubmit = await admin.rpc("resubmit_job_for_curation", { p_job_id: jobId });
  assert(!resubmit.error, "admin reenvia vaga rejected");
  const roundAfter = resubmit.data?.curation_round;
  assert(roundAfter != null && roundAfter >= 2, "reenvio incrementa curation_round");

  const history = await admin
    .from("job_curation_reviews")
    .select("curation_round")
    .eq("job_id", jobId);
  assert(!history.error, `histórico de pareceres legível (${history.error?.message ?? "ok"})`);
  assert((history.data ?? []).length >= 2, "pareceres da rodada anterior permanecem");

  await c1.auth.signOut();
  await c2.auth.signOut();
  await deleteJob(admin, jobId);
  await admin.auth.signOut();
}

/** Cenário 9 — prioridade urgent exige motivo e admin. */
async function scenario9_priority() {
  if (!hasCreds(testUsers.admin)) {
    skipRequired(9, "falta admin-test-user");
    return;
  }
  const admin = await signInStaffForScenario(9, "admin");
  if (!admin) return;
  const marker = `RLS priority ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const noReason = await admin.rpc("set_job_curation_priority", {
    p_job_id: jobId,
    p_priority: "urgent",
    p_reason: "",
  });
  if (noReason.error?.message?.includes("Could not find the function")) {
    skipRequired(9, "RPC set_job_curation_priority não aplicada no ambiente");
    await deleteJob(admin, jobId);
    await admin.auth.signOut();
    return;
  }
  assert(Boolean(noReason.error), "urgent sem motivo recusado");

  const ok = await admin.rpc("set_job_curation_priority", {
    p_job_id: jobId,
    p_priority: "urgent",
    p_reason: "SLA interno de teste",
  });
  assert(!ok.error, "admin define urgent com motivo");

  if (testUsers.curator.email && testUsers.curator.password) {
    const { client: curator } = await signInStaff("curator");
    const denied = await curator.rpc("set_job_curation_priority", {
      p_job_id: jobId,
      p_priority: "urgent",
      p_reason: "tentativa curador",
    });
    assert(Boolean(denied.error), "não-admin não define prioridade");
    await curator.auth.signOut();
  }

  await deleteJob(admin, jobId);
  await admin.auth.signOut();
}

/** Cenário 10 — apply: D-01 + approved + snapshot + UNIQUE. */
async function scenario10_applyHappy() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.candidate)) {
    skipRequired(10, "faltam admin e/ou candidate em docs-local");
    return;
  }
  const { client: admin, error: adminErr } = await signInStaff("admin");
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  assert(!adminErr && !candErr && user?.id, `admin e candidato autenticam (${adminErr?.message || candErr?.message || "ok"})`);
  if (adminErr || candErr || !user?.id) return;

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplyRequestLog(admin, user.id);
  const { previous, current } = await ensureD01Profile(candidate, user.id);

  const first = await rpcApply(candidate, SEED_APPROVED_A);
  if (first.error?.message?.includes("Could not find the function")) {
    skipRequired(10, "RPC apply_to_job não aplicada no ambiente");
    await candidate.auth.signOut();
    await admin.auth.signOut();
    return;
  }
  assert(!first.error, `candidato aplica em vaga approved (${first.error?.message ?? "ok"})`);
  assert(first.data?.status === "submitted", "apply cria status submitted");
  assert(first.data?.candidate_id === user.id, "candidate_id é auth.uid()");
  assert(first.data?.snapshot?.full_name && first.data?.snapshot?.email, "snapshot D-08 tem nome e e-mail");
  assert(Array.isArray(first.data?.snapshot?.skills), "snapshot inclui skills");
  assert(first.data?.snapshot?.preferences?.experience_level, "snapshot inclui preferences");

  const stableName = String(current?.full_name || previous.full_name || "Candidato").trim() || "Candidato";
  const renamed = `${stableName} ${Date.now()}`;
  await candidate
    .from("profiles")
    .update({ full_name: renamed, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  const frozen = await candidate
    .from("applications")
    .select("snapshot")
    .eq("job_id", SEED_APPROVED_A)
    .eq("candidate_id", user.id)
    .single();
  assert(frozen.data?.snapshot?.full_name !== renamed, "snapshot não muda após editar perfil");
  // Não restaurar `previous`: um run anterior pode ter deixado skills/prefs incompletos.
  await ensureD01Profile(candidate, user.id);

  const dup = await rpcApply(candidate, SEED_APPROVED_A);
  const dupMsg = [dup.error?.message, dup.error?.details, dup.error?.hint].filter(Boolean).join(" ");
  assert(Boolean(dup.error), "segunda candidatura no mesmo par falha");
  assert(/already applied/i.test(dupMsg), `duplicata retorna already applied (${dupMsg || "sem mensagem"})`);

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await candidate.auth.signOut();
  await admin.auth.signOut();
}

/** Cenário 11 — apply recusado: anon, D-01 incompleto, vaga pending, INSERT direto, staff (admin/curator/moderator). */
async function scenario11_applyBlocked() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.candidate)) {
    skipRequired(11, "faltam admin e/ou candidate em docs-local");
    return;
  }

  const anonApply = await anon.rpc("apply_to_job", { p_job_id: SEED_APPROVED_A });
  assert(Boolean(anonApply.error), "anon não chama RPC de apply");

  const { client: admin, error: adminErr } = await signInStaff("admin");
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  if (adminErr || candErr || !user?.id) {
    skipRequired(11, "admin ou candidato não autenticou");
    return;
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
  await deleteApplyRequestLog(admin, user.id);
  await ensureD01Profile(candidate, user.id);

  const pending = await rpcApply(candidate, SEED_PENDING);
  assert(Boolean(pending.error), "candidato não aplica em vaga pending");
  assert(/not approved/i.test(pending.error?.message ?? ""), "pending retorna job is not approved");

  await candidate
    .from("profiles")
    .update({ skills: [], updated_at: new Date().toISOString() })
    .eq("id", user.id);
  const incomplete = await rpcApply(candidate, SEED_APPROVED_A);
  assert(Boolean(incomplete.error), "perfil D-01 incompleto é recusado");
  assert(/profile incomplete/i.test(incomplete.error?.message ?? ""), "incompleto retorna profile incomplete");
  await ensureD01Profile(candidate, user.id);

  const direct = await candidate.from("applications").insert({
    job_id: SEED_APPROVED_A,
    candidate_id: user.id,
    status: "submitted",
    snapshot: { forged: true },
  }).select("id");
  assert(Boolean(direct.error) || (direct.data ?? []).length === 0, "candidato não faz INSERT direto");

  await assertStaffCannotApplyOrWithdraw(admin, "admin");
  for (const role of ["curator", "moderator"]) {
    if (!hasCreds(testUsers[role]) || !totpSecrets[role]) {
      skipRequired(11, `falta ${role} AAL2 em docs-local`);
      continue;
    }
    const { client: staff, error: staffErr } = await signInStaff(role);
    assert(!staffErr, `${role} AAL2 autentica para apply (${staffErr?.message ?? "ok"})`);
    if (staffErr || !staff) continue;
    try {
      await assertStaffCannotApplyOrWithdraw(staff, role);
    } finally {
      await staff.auth.signOut();
    }
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
  await candidate.auth.signOut();
  await admin.auth.signOut();
}

/** Cenário 12 — withdraw D-09: submitted|reviewing em vaga approved; demais recusados. */
async function scenario12_withdraw() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.candidate)) {
    skipRequired(12, "faltam admin e/ou candidate em docs-local");
    return;
  }
  const { client: admin, error: adminErr } = await signInStaff("admin");
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  if (adminErr || candErr || !user?.id) {
    skipRequired(12, "admin ou candidato não autenticou");
    return;
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_APPROVED_B, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
  await deleteApplyRequestLog(admin, user.id);
  await ensureD01Profile(candidate, user.id);

  const applied = await rpcApply(candidate, SEED_APPROVED_A);
  assert(!applied.error, "apply para teste de withdraw");
  const withdrawn = await rpcWithdraw(candidate, SEED_APPROVED_A);
  assert(!withdrawn.error && withdrawn.data?.status === "withdrawn", "submitted → withdrawn");

  const again = await rpcWithdraw(candidate, SEED_APPROVED_A);
  assert(Boolean(again.error), "withdrawn não reabre nem retira de novo");
  const reapply = await rpcApply(candidate, SEED_APPROVED_A);
  assert(Boolean(reapply.error), "withdrawn não permite reenviar o mesmo par");

  const reviewing = await rpcApply(candidate, SEED_APPROVED_B);
  assert(!reviewing.error, "segunda vaga para reviewing");
  const setReview = await admin
    .from("applications")
    .update({ status: "reviewing" })
    .eq("job_id", SEED_APPROVED_B)
    .eq("candidate_id", user.id)
    .select("status");
  assert(setReview.data?.[0]?.status === "reviewing", "admin marca reviewing");
  const withdrawReview = await rpcWithdraw(candidate, SEED_APPROVED_B);
  assert(!withdrawReview.error && withdrawReview.data?.status === "withdrawn", "reviewing → withdrawn");

  await deleteApplication(admin, SEED_APPROVED_B, user.id);
  const accepted = await rpcApply(candidate, SEED_APPROVED_B);
  assert(!accepted.error, "vaga B para accepted");
  await admin
    .from("applications")
    .update({ status: "accepted" })
    .eq("job_id", SEED_APPROVED_B)
    .eq("candidate_id", user.id);
  const withdrawAccepted = await rpcWithdraw(candidate, SEED_APPROVED_B);
  assert(Boolean(withdrawAccepted.error), "accepted não retira");

  const planted = await admin.from("applications").insert({
    job_id: SEED_PENDING,
    candidate_id: user.id,
    status: "submitted",
    snapshot: { planted: true },
  }).select("id");
  assert(!planted.error && planted.data?.[0]?.id, "admin planta candidatura em pending");
  const withdrawPendingJob = await rpcWithdraw(candidate, SEED_PENDING);
  assert(Boolean(withdrawPendingJob.error), "não retira se a vaga não está approved");
  assert(/not approved/i.test(withdrawPendingJob.error?.message ?? ""), "pending no withdraw retorna job is not approved");

  const statusHack = await candidate
    .from("applications")
    .update({ status: "submitted" })
    .eq("job_id", SEED_APPROVED_A)
    .eq("candidate_id", user.id)
    .select("id");
  assert(Boolean(statusHack.error) || (statusHack.data ?? []).length === 0, "candidato não atualiza status direto");

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_APPROVED_B, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
  await candidate.auth.signOut();
  await admin.auth.signOut();
}

/** Cenário 13 — F-019: candidato não eleva role (UPDATE grant + INSERT policy). */
async function scenario13_profileRoleEscalation() {
  if (!hasCreds(testUsers.candidate)) {
    skipRequired(13, "falta candidate em docs-local");
    return;
  }
  const { client, user, error } = await signIn(testUsers.candidate);
  assert(!error && user?.id, `candidato autentica (${error?.message ?? "ok"})`);
  if (error || !user?.id) return;

  const updateRole = await client
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id)
    .select("role");
  assert(
    Boolean(updateRole.error) || (updateRole.data ?? []).length === 0,
    "candidato não atualiza role para admin",
  );

  const insertAdmin = await client
    .from("profiles")
    .insert({ id: user.id, full_name: "Escalation", role: "admin" })
    .select("role");
  assert(Boolean(insertAdmin.error), "insert com role admin bloqueado (policy ou duplicate)");

  const svc = createServiceClient();
  // Hosted GoTrue rejeita RFC 2606 no signup público; SMTP built-in rate-limita domínios reais.
  // Probe de conta nova exige Admin API (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY).
  if (!svc) {
    skip(
      "cenário 13 probe F-019: SUPABASE_SERVICE_ROLE_KEY ausente (skip documentado; UPDATE/INSERT no candidato já executados)",
    );
    await client.auth.signOut();
    return;
  }

  const probeEmail = `rls-f019-${Date.now()}@example.com`;
  const probePass = `RlS-${Date.now()}-Aa1!`;
  let probeUserId = null;

  try {
    const created = await svc.auth.admin.createUser({
      email: probeEmail,
      password: probePass,
      email_confirm: true,
    });
    assert(
      !created.error && created.data.user?.id,
      created.error
        ? `cenário 13 signup: ${created.error.message}`
        : "cenário 13 signup: probe criado via Admin API",
    );
    if (created.error || !created.data.user?.id) return;
    probeUserId = created.data.user.id;

    const authed = createClient(url, key);
    const { error: signErr } = await authed.auth.signInWithPassword({
      email: probeEmail,
      password: probePass,
    });
    assert(!signErr, `cenário 13 login: ${signErr?.message ?? "ok"}`);
    if (signErr) return;

    const firstInsert = await authed
      .from("profiles")
      .insert({ id: probeUserId, full_name: "Attacker", role: "admin" })
      .select("role");
    assert(Boolean(firstInsert.error), "primeiro insert com role admin bloqueado pela policy");
    const readRole = await authed.from("profiles").select("role").eq("id", probeUserId).maybeSingle();
    assert(readRole.data?.role !== "admin", "role efetivo não é admin após tentativa");
    await authed.auth.signOut();
  } finally {
    await cleanupF019Probe(probeUserId);
    await client.auth.signOut();
  }
}

/** Cenário 14 — F-023: 6ª apply_to_job na janela 60s retorna rate limit exceeded. */
async function scenario14_applyRateLimit() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.candidate)) {
    skipRequired(14, "faltam admin e/ou candidate em docs-local");
    return;
  }
  const { client: admin, error: adminErr } = await signInStaff("admin");
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  if (adminErr || candErr || !user?.id) {
    skipRequired(14, "admin ou candidato não autenticou");
    return;
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplyRequestLog(admin, user.id);
  await ensureD01Profile(candidate, user.id);

  const results = [];
  for (let i = 0; i < 6; i += 1) {
    results.push(await rpcApply(candidate, SEED_APPROVED_A));
  }

  if (results[0].error?.message?.includes("Could not find the function")) {
    skipRequired(14, "RPC apply_to_job não aplicada no ambiente");
    await candidate.auth.signOut();
    await admin.auth.signOut();
    return;
  }

  assert(!results[0].error, `1ª apply ok (${results[0].error?.message ?? "ok"})`);
  for (let i = 1; i <= 4; i += 1) {
    const msg = [results[i].error?.message, results[i].error?.details].filter(Boolean).join(" ");
    assert(Boolean(results[i].error), `chamada ${i + 1} falha`);
    assert(/already applied/i.test(msg), `chamada ${i + 1} already applied (${msg || "sem mensagem"})`);
  }

  const sixthMsg = [results[5].error?.message, results[5].error?.details, results[5].error?.hint]
    .filter(Boolean)
    .join(" ");
  assert(Boolean(results[5].error), "6ª chamada falha");
  assert(/rate limit exceeded/i.test(sixthMsg), `6ª retorna rate limit exceeded (${sixthMsg || "sem mensagem"})`);
  assert(!/already applied/i.test(sixthMsg), "6ª não é só already applied");

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplyRequestLog(admin, user.id);
  await candidate.auth.signOut();
  await admin.auth.signOut();
}

/** Cenário 15 — MVP-021: EXECUTE revogado de PUBLIC/anon nas RPCs administrativas. */
async function scenario15_rpcExecuteHardening() {
  const seedPending = SEED_PENDING;
  const seedApproved = SEED_APPROVED_A;

  const anonSubmit = await anon.rpc("submit_curation_review", {
    p_job_id: seedPending,
    p_decision: "approve",
    p_rubric_code: RUBRIC,
  });
  assert(Boolean(anonSubmit.error) && isExecuteDenied(anonSubmit.error), "anon sem EXECUTE em submit_curation_review");

  const anonResubmit = await anon.rpc("resubmit_job_for_curation", { p_job_id: seedPending });
  assert(Boolean(anonResubmit.error) && isExecuteDenied(anonResubmit.error), "anon sem EXECUTE em resubmit_job_for_curation");

  const anonPriority = await anon.rpc("set_job_curation_priority", {
    p_job_id: seedPending,
    p_priority: "urgent",
    p_reason: "probe",
  });
  assert(Boolean(anonPriority.error) && isExecuteDenied(anonPriority.error), "anon sem EXECUTE em set_job_curation_priority");

  const anonTrigger = await anon.rpc("jobs_set_submitted_by");
  assert(Boolean(anonTrigger.error) && isExecuteDenied(anonTrigger.error), "anon não executa jobs_set_submitted_by via Data API");

  const anonApply = await anon.rpc("apply_to_job", { p_job_id: seedApproved });
  assert(Boolean(anonApply.error) && isExecuteDenied(anonApply.error), "anon sem EXECUTE em apply_to_job (revogação preservada)");

  const anonWithdraw = await anon.rpc("withdraw_application", { p_job_id: seedApproved });
  assert(Boolean(anonWithdraw.error) && isExecuteDenied(anonWithdraw.error), "anon sem EXECUTE em withdraw_application (revogação preservada)");

  if (!hasCreds(testUsers.candidate) || !hasCreds(testUsers.admin)) {
    skipRequired(15, "faltam admin e/ou candidate em docs-local");
    return;
  }

  const { client: candidate, error: candErr } = await signIn(testUsers.candidate);
  assert(!candErr, `candidato autentica (${candErr?.message ?? "ok"})`);
  if (candErr) return;

  const candTrigger = await candidate.rpc("jobs_set_submitted_by");
  assert(
    Boolean(candTrigger.error) && isExecuteDenied(candTrigger.error),
    "authenticated não executa jobs_set_submitted_by via Data API",
  );

  const candResubmit = await candidate.rpc("resubmit_job_for_curation", { p_job_id: seedPending });
  assert(Boolean(candResubmit.error), "candidato não reenvia curadoria");
  assert(
    !isExecuteDenied(candResubmit.error),
    `candidato autenticado ainda tem EXECUTE em resubmit (checagem interna de papel) (${errorText(candResubmit.error) || "sem mensagem"})`,
  );

  await candidate.auth.signOut();

  const { client: admin, error: adminErr } = await signInStaff("admin");
  assert(!adminErr, `admin autentica (${adminErr?.message ?? "ok"})`);
  if (adminErr) return;

  const marker = `RLS mvp-021 trigger ${Date.now()}`;
  const created = await createPendingJob(admin, marker);
  assert(!created.error && created.data?.id, "admin cria pending após revoke do trigger RPC");
  if (created.data?.id) {
    const detail = await admin.from("jobs").select("submitted_by").eq("id", created.data.id).maybeSingle();
    assert(Boolean(detail.data?.submitted_by), "trigger jobs_set_submitted_by continua preenchendo submitted_by");
    await deleteJob(admin, created.data.id);
  }
  await admin.auth.signOut();
}

/** Cenário 16 — MVP-003: catálogo, escolhas próprias e gate pending_dpo. */
async function scenario16_privacyConsent() {
  if (!hasCreds(testUsers.candidate) || !hasCreds(testUsers.admin)) {
    skipRequired(16, "faltam admin e/ou candidate em docs-local");
    return;
  }

  const catalog = await anon
    .from("privacy_purposes")
    .select("purpose_code,version,classification,status,legal_basis_status,retention_status,text_status");
  if (catalog.error?.message?.includes("relation") || catalog.error?.message?.includes("schema cache")) {
    skipRequired(16, "migration MVP-003 não aplicada no ambiente");
    return;
  }
  assert(!catalog.error, `catálogo de privacidade acessível sem dados pessoais (${errorText(catalog.error) || "ok"})`);
  if (catalog.error) return;

  assert(catalog.data?.length === 10, "catálogo contém F-01 a F-10");
  assert(
    catalog.data?.every((row) => row.version === 1 && row.legal_basis_status === "pending_dpo" && row.retention_status === "pending_dpo"),
    "catálogo mantém versão 1 e estados pending_dpo",
  );
  const inactive = catalog.data?.find((row) => row.purpose_code === "F-05");
  assert(inactive?.status === "inactive", "newsletter permanece inativa");

  const anonChoice = await anon.rpc("record_privacy_event", {
    p_purpose_code: "F-06",
    p_event_type: "accepted",
    p_source: "preferences",
  });
  assert(Boolean(anonChoice.error) && isExecuteDenied(anonChoice.error), "anon não registra escolha de privacidade");

  const { client: candidate, user, error: candidateError } = await signInWithRetry(testUsers.candidate, { label: "candidato" });
  const { client: admin, error: adminError } = await signInStaff("admin");
  if (candidateError || adminError || !user?.id) {
    skipRequired(
      16,
      `admin ou candidato não autenticou (candidato: ${errorText(candidateError) || "ok"}; admin: ${errorText(adminError) || "ok"})`,
    );
    return;
  }

  const svc = createServiceClient();
  if (!svc) {
    skipRequired(16, "SUPABASE_SERVICE_ROLE_KEY ausente para cleanup do histórico de teste");
    await candidate.auth.signOut();
    await admin.auth.signOut();
    return;
  }

  await svc.from("privacy_consent_events").delete().eq("subject_id", user.id);
  try {
    const accepted = await candidate.rpc("record_privacy_event", {
      p_purpose_code: "F-06",
      p_event_type: "accepted",
      p_source: "preferences",
    });
    assert(!accepted.error, `candidato registra aceite de F-06 (${errorText(accepted.error) || "ok"})`);
    assert(accepted.data?.purpose_code === "F-06" && accepted.data?.purpose_version === 1, "aceite guarda código e versão");

    const gateBefore = await candidate.rpc("privacy_purpose_is_authorized", { p_purpose_code: "F-06" });
    assert(!gateBefore.error && gateBefore.data === false, "pending_dpo não autoriza tratamento opcional");

    const inactiveChoice = await candidate.rpc("record_privacy_event", {
      p_purpose_code: "F-05",
      p_event_type: "accepted",
      p_source: "preferences",
    });
    assert(Boolean(inactiveChoice.error), "finalidade inativa não aceita escolha");

    const ownEvents = await candidate
      .from("privacy_consent_events")
      .select("purpose_code,purpose_version,event_type,proof")
      .eq("purpose_code", "F-06");
    assert(!ownEvents.error && ownEvents.data?.length === 1, "candidato lê somente o próprio histórico");
    assert(!ownEvents.data?.[0]?.proof?.profile && !ownEvents.data?.[0]?.proof?.token, "prova não contém perfil ou token");

    const directInsert = await candidate.from("privacy_consent_events").insert({
      subject_id: user.id,
      purpose_code: "F-06",
      purpose_version: 1,
      event_type: "refused",
      source: "preferences",
    }).select("id");
    assert(
      Boolean(directInsert.error) || (directInsert.data ?? []).length === 0,
      "candidato não faz INSERT direto em privacy_consent_events",
    );

    const directUpdateOwn = await candidate
      .from("privacy_consent_events")
      .update({ event_type: "revoked" })
      .eq("subject_id", user.id)
      .eq("purpose_code", "F-06")
      .select("id");
    assert(
      Boolean(directUpdateOwn.error) || (directUpdateOwn.data ?? []).length === 0,
      "candidato não altera consentimento via UPDATE direto",
    );

    const directDeleteOwn = await candidate
      .from("privacy_consent_events")
      .delete()
      .eq("subject_id", user.id)
      .eq("purpose_code", "F-06")
      .select("id");
    assert(
      Boolean(directDeleteOwn.error) || (directDeleteOwn.data ?? []).length === 0,
      "candidato não apaga consentimento via DELETE direto",
    );

    const otherEvents = await admin
      .from("privacy_consent_events")
      .select("id")
      .eq("subject_id", user.id);
    assert(!otherEvents.error && (otherEvents.data ?? []).length === 0, "admin não lê consentimento de outro titular");

    const directUpdate = await admin
      .from("privacy_consent_events")
      .update({ event_type: "revoked" })
      .eq("subject_id", user.id)
      .select("id");
    assert(Boolean(directUpdate.error) || (directUpdate.data ?? []).length === 0, "admin não altera consentimento de outro titular");

    const revoked = await candidate.rpc("record_privacy_event", {
      p_purpose_code: "F-06",
      p_event_type: "revoked",
      p_source: "preferences",
    });
    assert(!revoked.error && revoked.data?.event_type === "revoked", "candidato revoga a própria escolha");

    const gateAfter = await candidate.rpc("privacy_purpose_is_authorized", { p_purpose_code: "F-06" });
    assert(!gateAfter.error && gateAfter.data === false, "revogação mantém o gate fechado");

    const history = await candidate
      .from("privacy_consent_events")
      .select("event_type,purpose_version")
      .eq("purpose_code", "F-06")
      .order("created_at", { ascending: true });
    assert(history.data?.map((row) => row.event_type).join(",") === "accepted,revoked", "histórico preserva aceite e revogação");
  } finally {
    await svc.from("privacy_consent_events").delete().eq("subject_id", user.id);
    await candidate.auth.signOut();
    await admin.auth.signOut();
  }
}

const AUDIT_SELECT =
  "id,event_type,occurred_at,actor_id,subject_id,purpose_code,resource_type,resource_id,result,metadata_minimal,retention_status";

function latestAudit(rows, eventType) {
  return (rows ?? [])
    .filter((row) => row.event_type === eventType)
    .sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at))[0];
}

function assertAuditMatrix(row, label) {
  assert(Boolean(row), `${label} gerou evento de auditoria`);
  if (!row) return;
  assert(Boolean(row.event_type), `${label} tem event_type`);
  assert(Boolean(row.occurred_at), `${label} tem occurred_at`);
  assert(Boolean(row.actor_id), `${label} tem actor_id`);
  assert(Boolean(row.subject_id), `${label} tem subject_id`);
  assert(/^F-\d{2}$/.test(row.purpose_code || ""), `${label} tem purpose_code`);
  assert(Boolean(row.resource_type), `${label} tem resource_type`);
  assert(["success", "blocked", "failed", "revoked"].includes(row.result), `${label} tem result da matriz`);
  assert(row.retention_status === "pending_dpo", `${label} retenção permanece pending_dpo`);
  const hits = findForbiddenLogFields(row);
  assert(hits.length === 0, `${label} sem campos proibidos da matriz §5.2 (${hits.join(", ") || "ok"})`);
}

/** Cenário 17 — MVP-005: trilha de auditoria, RLS e minimização. */
async function scenario17_privacyAudit() {
  if (!hasCreds(testUsers.candidate) || !hasCreds(testUsers.admin)) {
    skipRequired(17, "faltam admin e/ou candidate em docs-local");
    return;
  }

  const probe = await anon.from("privacy_audit_events").select("id").limit(1);
  if (probe.error?.message?.includes("relation") || probe.error?.message?.includes("schema cache")) {
    skipRequired(17, "migration MVP-005 não aplicada no ambiente");
    return;
  }

  const { client: candidate, user, error: candidateError } = await signInWithRetry(testUsers.candidate, { label: "candidato" });
  const { client: admin, error: adminError } = await signInStaff("admin");
  if (candidateError || adminError || !user?.id) {
    skipRequired(
      17,
      `admin ou candidato não autenticou (candidato: ${errorText(candidateError) || "ok"}; admin: ${errorText(adminError) || "ok"})`,
    );
    return;
  }

  const svc = createServiceClient();
  if (!svc) {
    skipRequired(17, "SUPABASE_SERVICE_ROLE_KEY ausente para cleanup da trilha de auditoria");
    await candidate.auth.signOut();
    await admin.auth.signOut();
    return;
  }

  const otherSubject = "00000000-0000-4000-8000-000000000017";
  const auditInsert = {
    event_type: "consent.notice",
    actor_id: user.id,
    subject_id: user.id,
    purpose_code: "F-01",
    resource_type: "probe",
    resource_id: "direct-write",
    result: "success",
    metadata_minimal: {},
  };

  await svc.from("applications").delete().eq("job_id", SEED_APPROVED_A).eq("candidate_id", user.id);
  await svc.from("apply_request_log").delete().eq("user_id", user.id);
  await svc.from("privacy_consent_events").delete().eq("subject_id", user.id);
  await svc.from("privacy_audit_events").delete().eq("subject_id", user.id);
  await svc.from("privacy_audit_events").delete().eq("subject_id", otherSubject);

  try {
    const anonRead = await anon.from("privacy_audit_events").select("id").limit(1);
    assert(Boolean(anonRead.error) || (anonRead.data ?? []).length === 0, "anon não lê a trilha de auditoria");

    const anonInsert = await anon.from("privacy_audit_events").insert(auditInsert).select("id");
    assert(Boolean(anonInsert.error) || (anonInsert.data ?? []).length === 0, "anon não faz INSERT direto em privacy_audit_events");

    const directInsert = await candidate.from("privacy_audit_events").insert(auditInsert).select("id");
    assert(
      Boolean(directInsert.error) || (directInsert.data ?? []).length === 0,
      "candidato não faz INSERT direto em privacy_audit_events",
    );

    const directRpc = await candidate.rpc("write_privacy_audit_event", {
      p_event_type: "consent.notice",
      p_purpose_code: "F-01",
      p_resource_type: "probe",
      p_resource_id: "rpc",
      p_result: "success",
      p_metadata: {},
      p_subject_id: user.id,
    });
    assert(Boolean(directRpc.error) && isExecuteDenied(directRpc.error), "candidato sem EXECUTE em write_privacy_audit_event");

    const granted = await candidate.rpc("record_privacy_event", {
      p_purpose_code: "F-06",
      p_event_type: "accepted",
      p_source: "preferences",
    });
    assert(!granted.error, `candidato registra aceite auditável (${errorText(granted.error) || "ok"})`);

    const revoked = await candidate.rpc("record_privacy_event", {
      p_purpose_code: "F-06",
      p_event_type: "revoked",
      p_source: "preferences",
    });
    assert(!revoked.error, `candidato revoga com efeito técnico (${errorText(revoked.error) || "ok"})`);

    await ensureD01Profile(candidate, user.id);
    const headlineMarker = `audit-min-${Date.now()}`;
    const profileUpdate = await candidate
      .from("profiles")
      .update({ headline: headlineMarker, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id")
      .single();
    assert(!profileUpdate.error, `candidato altera o próprio perfil (${errorText(profileUpdate.error) || "ok"})`);

    const applied = await rpcApply(candidate, SEED_APPROVED_A);
    assert(!applied.error, `candidato aplica com auditoria F-03 (${errorText(applied.error) || "ok"})`);
    const applicationId = applied.data?.id;

    const withdrawn = await rpcWithdraw(candidate, SEED_APPROVED_A);
    assert(!withdrawn.error, `candidato retira candidatura com auditoria (${errorText(withdrawn.error) || "ok"})`);

    const blocked = await candidate.rpc("request_purpose_access", {
      p_purpose_code: "F-06",
      p_event_type: "recommendation.requested",
    });
    assert(!blocked.error && blocked.data?.authorized === false && blocked.data?.result === "blocked", "F-06 sem autorização gera evento blocked");

    const own = await candidate
      .from("privacy_audit_events")
      .select(AUDIT_SELECT)
      .eq("subject_id", user.id)
      .order("occurred_at", { ascending: true });
    assert(!own.error, `candidato lê a própria trilha (${errorText(own.error) || "ok"})`);

    const consentGranted = latestAudit(own.data, "consent.granted");
    const consentRevoked = latestAudit(own.data, "consent.revoked");
    const profileUpdated = latestAudit(own.data, "profile.updated");
    const applicationCreated = latestAudit(own.data, "application.created");
    const applicationWithdrawn = latestAudit(own.data, "application.withdrawn");
    const recommendationBlocked = latestAudit(own.data, "recommendation.requested");

    assertAuditMatrix(consentGranted, "consentimento");
    assertAuditMatrix(consentRevoked, "revogação");
    assertAuditMatrix(profileUpdated, "perfil");
    assertAuditMatrix(applicationCreated, "candidatura");
    assertAuditMatrix(applicationWithdrawn, "retirada");
    assertAuditMatrix(recommendationBlocked, "finalidade bloqueada");

    assert(consentGranted?.actor_id === user.id && consentGranted?.purpose_code === "F-06", "aceite correlaciona ator, titular e F-06");
    assert(consentRevoked?.result === "revoked" && consentRevoked?.metadata_minimal?.effect === "blocked", "revogação registra efeito blocked sem dados profissionais");
    assert(
      Array.isArray(profileUpdated?.metadata_minimal?.fields) && profileUpdated.metadata_minimal.fields.includes("headline"),
      "perfil audita nomes de campos, não o conteúdo",
    );
    assert(!JSON.stringify(profileUpdated ?? {}).includes(headlineMarker), "auditoria de perfil não guarda headline/bio");
    assert(applicationCreated?.purpose_code === "F-03" && applicationCreated?.resource_id === applicationId, "apply audita F-03 no recurso da candidatura");
    assert(!applicationCreated?.metadata_minimal?.snapshot, "auditoria de apply não carrega snapshot D-08");
    assert(applicationWithdrawn?.event_type === "application.withdrawn" && applicationWithdrawn?.metadata_minimal?.effect === "blocked", "withdraw audita interrupção futura");
    assert(recommendationBlocked?.result === "blocked" && recommendationBlocked?.metadata_minimal?.reason === "purpose_not_authorized", "blocked sem autorização não expõe conteúdo profissional");
    assert(!JSON.stringify(recommendationBlocked ?? {}).match(/React|Salvador|senior|Gemini|prompt/i), "evento bloqueado não diferencia com conteúdo profissional");

    const planted = await svc.from("privacy_audit_events").insert({
      event_type: "consent.notice",
      actor_id: otherSubject,
      subject_id: otherSubject,
      purpose_code: "F-01",
      resource_type: "consent",
      resource_id: "isolation",
      result: "success",
      metadata_minimal: { source: "system" },
    }).select("id").single();
    assert(!planted.error && planted.data?.id, `service role planta evento de outro titular (${errorText(planted.error) || "ok"})`);

    const leaked = await candidate
      .from("privacy_audit_events")
      .select("id")
      .eq("subject_id", otherSubject);
    assert(!leaked.error && (leaked.data ?? []).length === 0, "candidato não lê auditoria de outro titular");

    const adminRead = await admin
      .from("privacy_audit_events")
      .select("id,event_type")
      .eq("subject_id", user.id);
    assert(!adminRead.error && (adminRead.data ?? []).length > 0, "admin lê a trilha por papel");

    const adminInsert = await admin.from("privacy_audit_events").insert(auditInsert).select("id");
    assert(Boolean(adminInsert.error) || (adminInsert.data ?? []).length === 0, "admin não faz INSERT direto em privacy_audit_events");

    const adminUpdate = await admin
      .from("privacy_audit_events")
      .update({ result: "failed" })
      .eq("subject_id", user.id)
      .select("id");
    assert(Boolean(adminUpdate.error) || (adminUpdate.data ?? []).length === 0, "admin não altera auditoria via UPDATE direto");
  } finally {
    await candidate.from("profiles").update({ headline: null, updated_at: new Date().toISOString() }).eq("id", user.id);
    await svc.from("applications").delete().eq("job_id", SEED_APPROVED_A).eq("candidate_id", user.id);
    await svc.from("apply_request_log").delete().eq("user_id", user.id);
    await svc.from("privacy_consent_events").delete().eq("subject_id", user.id);
    await svc.from("privacy_audit_events").delete().eq("subject_id", user.id);
    await svc.from("privacy_audit_events").delete().eq("subject_id", otherSubject);
    await candidate.auth.signOut();
    await admin.auth.signOut();
  }
}

const RLS_HELPER_RPCS = [
  "is_admin",
  "is_curator",
  "is_moderator",
  "can_review_curation",
  "jwt_aal2",
  "is_admin_aal2",
  "is_curator_aal2",
  "is_moderator_aal2",
  "can_review_curation_aal2",
];

/** Cenário 18 — MVP-022: helpers RLS fora da Data API. */
async function scenario18_rlsHelperRpcSurface() {
  const hidden = createClient(url, key, {
    db: { schema: "private" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const schemaProbe = await hidden.rpc("is_admin");
  assert(
    Boolean(schemaProbe.error) && isPostgrestSchemaHidden(schemaProbe.error, "private"),
    `schema private não está no PostgREST (${errorText(schemaProbe.error) || "sem mensagem"})`,
  );
  const exposedHint = String(schemaProbe.error?.hint ?? "");
  assert(
    /public/i.test(exposedHint) && !/\bprivate\b/i.test(exposedHint),
    `PostgREST expõe só schemas públicos (${exposedHint || errorText(schemaProbe.error) || "sem hint"})`,
  );

  for (const name of RLS_HELPER_RPCS) {
    const probe = await anon.rpc(name);
    assert(
      Boolean(probe.error) && isExecuteDenied(probe.error),
      `anon sem RPC REST ${name} (${errorText(probe.error) || "sem mensagem"})`,
    );
  }

  if (!hasCreds(testUsers.candidate)) {
    skipRequired(18, "falta candidate em docs-local");
    return;
  }

  const { client: candidate, error } = await signInWithRetry(testUsers.candidate, { label: "candidato" });
  if (error) {
    skipRequired(18, `candidato não autenticou (${errorText(error) || "ok"})`);
    return;
  }

  try {
    for (const name of RLS_HELPER_RPCS) {
      const probe = await candidate.rpc(name);
      assert(
        Boolean(probe.error) && isExecuteDenied(probe.error),
        `candidato sem RPC REST ${name} (${errorText(probe.error) || "sem mensagem"})`,
      );
    }
  } finally {
    await candidate.auth.signOut();
  }
}

/** Baseline admin legado (S2/S3). */
async function scenarioAdminBaseline() {
  if (!testUsers.admin.email || !testUsers.admin.password) {
    skip("admin baseline: docs-local/admin-test-user.md");
    return;
  }
  const { client: admin, error } = await signInStaff("admin");
  assert(!error, `admin autentica (${error?.message ?? "ok"}`);
  if (error) return;

  const pendingAsAdmin = await admin.from("jobs").select("id,status").eq("status", "pending");
  assert(!pendingAsAdmin.error, "admin lê pending");
  assert((pendingAsAdmin.data ?? []).length > 0, "admin lista pending");

  const marker = `RLS admin baseline ${Date.now()}`;
  const created = await createPendingJob(admin, marker);
  assert(!created.error && created.data?.status === "pending", "admin cadastra pending");
  if (created.data?.id) {
    const hidden = await anon.from("jobs").select("id").eq("id", created.data.id);
    assert((hidden.data ?? []).length === 0, "visitante não vê pending recém-criada");
    await deleteJob(admin, created.data.id);
  }

  const hijack = await admin
    .from("jobs")
    .insert({
      company_id: SEED_COMPANY,
      title: `RLS no approved ${Date.now()}`,
      description: "Vaga fictícia para teste RLS de insert pending.",
      level: "junior",
      work_model: "remote",
      status: "approved",
      requirements: { mandatory: [], desirable: [] },
    })
    .select("id,status")
    .single();
  assert(!hijack.error && hijack.data?.status === "pending", "admin insert não persiste approved");
  if (hijack.data?.id) await deleteJob(admin, hijack.data.id);

  const duplicate = await admin
    .from("jobs")
    .insert({
      company_id: SEED_COMPANY,
      title: "Pessoa Desenvolvedora Front-end",
      description: "Tentativa duplicada fictícia.",
      level: "junior",
      work_model: "remote",
      status: "pending",
      requirements: { mandatory: [], desirable: [] },
    })
    .select("id")
    .single();
  assert(Boolean(duplicate.error), "duplicidade company_id + título recusada");
  await admin.auth.signOut();
}

/** Cenário 19 — Storage avatars: `{userId}/{version}.jpg` na própria pasta; cruzado entre dois usuários.
 * Último login do harness: GoTrue pode responder `Request rate limit reached` se usar `signIn` cru. */
async function scenario19_avatarStorage() {
  if (!hasCreds(testUsers.candidate)) {
    skipRequired(19, "candidato: docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
    return;
  }
  const { client, user, error } = await signInWithRetry(testUsers.candidate, {
    attempts: 5,
    pauseMs: 4000,
    label: "candidato (avatars)",
  });
  assert(!error, `candidato autentica para avatars (${error?.message ?? "ok"})`);
  if (error || !user?.id) return;

  const probe = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const stamp = Date.now();
  const ownFile = `rls19-${stamp}-a.jpg`;
  const secondFile = `rls19-${stamp}-b.jpg`;
  const ownPath = `${user.id}/${ownFile}`;
  const secondPath = `${user.id}/${secondFile}`;
  const nestedPath = `${user.id}/nested/rls19.jpg`;
  const foreignPath = `00000000-0000-4000-8000-000000000099/rls19-${stamp}.jpg`;
  const ownNamePattern = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
  const own = await client.storage.from("avatars").upload(ownPath, probe, {
    upsert: false,
    contentType: "image/png",
    cacheControl: "3600",
  });
  if (own.error && /bucket|not found|404/i.test(errorText(own.error))) {
    skipRequired(19, "migration avatars_storage_homolog não aplicada no ambiente");
    await client.auth.signOut();
    return;
  }
  assert(!own.error, `candidato envia o próprio objeto versionado (${own.error?.message ?? "ok"})`);

  const second = await client.storage.from("avatars").upload(secondPath, probe, {
    upsert: false,
    contentType: "image/png",
    cacheControl: "3600",
  });
  assert(!second.error, `candidato envia segundo objeto versionado (${second.error?.message ?? "ok"})`);

  const nested = await client.storage.from("avatars").upload(nestedPath, probe, {
    upsert: false,
    contentType: "image/png",
  });
  assert(Boolean(nested.error), "candidato não envia objeto em subpasta");

  const signed = await client.storage.from("avatars").createSignedUrl(ownPath, 60);
  assert(Boolean(signed.data?.signedUrl), "candidato gera signed URL do próprio arquivo");

  const ownList = await client.storage.from("avatars").list(user.id);
  const listed = (ownList.data ?? []).map((row) => row.name);
  assert(
    Boolean(ownList.error) || listed.every((name) => ownNamePattern.test(name)),
    "candidato só lista arquivos da própria pasta",
  );
  assert(
    Boolean(ownList.error) || listed.includes(ownFile),
    "candidato lista o objeto versionado recém-enviado",
  );

  const foreign = await client.storage.from("avatars").upload(foreignPath, probe, {
    upsert: false,
    contentType: "image/png",
  });
  assert(Boolean(foreign.error), "candidato não envia avatar na pasta de terceiro");

  const anonList = await anon.storage.from("avatars").list(user.id);
  assert(
    Boolean(anonList.error) || (anonList.data ?? []).length === 0,
    "anon não lista arquivos de avatars",
  );

  const secondCreds = hasCreds(testUsers.curator) ? testUsers.curator : testUsers.admin;
  if (!hasCreds(secondCreds)) {
    skip("cenário 19 cruzado: faltam curator/admin");
  } else {
    const { client: other, error: otherErr } = await signInWithRetry(secondCreds, {
      attempts: 5,
      pauseMs: 4000,
      label: "segundo usuário (avatars)",
    });
    assert(!otherErr, `segundo usuário autentica para avatars (${otherErr?.message ?? "ok"})`);
    if (!otherErr) {
      const crossSigned = await other.storage.from("avatars").createSignedUrl(ownPath, 60);
      assert(
        Boolean(crossSigned.error) || !crossSigned.data?.signedUrl,
        "terceiro não assina avatar alheio",
      );
      const crossList = await other.storage.from("avatars").list(user.id);
      assert(
        Boolean(crossList.error) || (crossList.data ?? []).length === 0,
        "terceiro não lista pasta alheia",
      );
      const crossUp = await other.storage.from("avatars").upload(ownPath, probe, {
        upsert: true,
        contentType: "image/png",
      });
      assert(Boolean(crossUp.error), "terceiro não sobrescreve avatar alheio");
      const crossDel = await other.storage.from("avatars").remove([ownPath]);
      const still = await client.storage.from("avatars").createSignedUrl(ownPath, 60);
      assert(
        Boolean(still.data?.signedUrl),
        `delete cruzado não remove o avatar (${crossDel.error?.message || "ok"})`,
      );
      await other.auth.signOut();
    }
  }

  const removed = await client.storage.from("avatars").remove([ownPath, secondPath]);
  assert(!removed.error, `candidato remove os próprios probes (${removed.error?.message ?? "ok"})`);
  await client.auth.signOut();
}

async function assertPasswordOnlyNotAal2(role) {
  const { client, error } = await signInWithRetry(testUsers[role], {
    attempts: 5,
    pauseMs: 4000,
    label: `${role} (aal1)`,
  });
  assert(!error, `${role} autentica só com senha (${error?.message ?? "ok"})`);
  if (error) return null;
  const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  assert(!aalError, `${role} lê AAL (${errorText(aalError) || "ok"})`);
  assert(
    aal?.currentLevel === "aal1",
    `${role} sessão de controle do cenário 20 é AAL1 (atual: ${aal?.currentLevel ?? "ausente"})`,
  );
  if (aalError || aal?.currentLevel !== "aal1") {
    await client.auth.signOut();
    return null;
  }
  return client;
}

async function assertAal1CannotReview(role, jobId) {
  if (!hasCreds(testUsers[role])) {
    skipRequired(20, `falta ${role} em docs-local`);
    return;
  }
  const aal1 = await assertPasswordOnlyNotAal2(role);
  if (!aal1) return;
  try {
    const review = await rpcReview(aal1, jobId, "approve");
    assert(Boolean(review.error), `${role} AAL1 não submete curadoria`);
    assert(
      /aal2 required/i.test(errorText(review.error)),
      `curadoria AAL1 ${role} recusada (${errorText(review.error) || "sem mensagem"})`,
    );
  } finally {
    await aal1.auth.signOut();
  }
}

/** Cenário 20 — SEC-STAFF-MFA-02: senha só (AAL1) não muta staff; TOTP (AAL2) muta.
 * Enhanced MFA Security (15 min AAL1) do Dashboard não substitui este teste. */
async function scenario20_staffAal1Blocked() {
  if (!hasCreds(testUsers.admin)) {
    skipRequired(20, "falta admin em docs-local");
    return;
  }

  const aal1Admin = await assertPasswordOnlyNotAal2("admin");
  if (!aal1Admin) return;

  try {
    const marker = `RLS aal1 blocked ${Date.now()}`;
    const created = await createPendingJob(aal1Admin, marker);
    if (!created.error && created.data?.id) {
      await deleteJob(aal1Admin, created.data.id);
      assert(
        false,
        "AAL1 não insere vaga staff — aplique 20260917140000_staff_rls_aal2.sql só em homologação",
      );
      return;
    }
    assert(Boolean(created.error), "AAL1 não insere vaga staff");
    assert(
      isStaffAal2Denied(created.error),
      `insert AAL1 recusado por RLS/AAL2 (${errorText(created.error) || "sem mensagem"})`,
    );

    const review = await rpcReview(aal1Admin, SEED_PENDING, "approve");
    assert(Boolean(review.error), "AAL1 não submete curadoria");
    assert(
      /aal2 required/i.test(errorText(review.error)),
      `curadoria AAL1 recusada (${errorText(review.error) || "sem mensagem"})`,
    );
  } finally {
    await aal1Admin.auth.signOut();
  }

  if (!totpSecrets.admin) {
    skipRequired(20, "falta ADMIN_TEST_TOTP_SECRET ou chave em staff-mfa-totp-secrets.md");
    return;
  }

  const { client: aal2, error: aal2Error } = await signInStaff("admin");
  assert(!aal2Error, `admin AAL2 autentica (${aal2Error?.message ?? "ok"})`);
  if (aal2Error || !aal2) return;

  const probeMarker = `RLS aal1 staff probe ${Date.now()}`;
  const probe = await createPendingJob(aal2, probeMarker);
  assert(!probe.error && probe.data?.id, "AAL2 cadastra pending para prova negativa staff");
  if (probe.data?.id) {
    await assertAal1CannotReview("curator", probe.data.id);
    await assertAal1CannotReview("moderator", probe.data.id);
    await deleteJob(aal2, probe.data.id);
  }

  const okMarker = `RLS aal2 ok ${Date.now()}`;
  const createdAal2 = await createPendingJob(aal2, okMarker);
  assert(!createdAal2.error && createdAal2.data?.id, "AAL2 cadastra pending");
  if (createdAal2.data?.id) await deleteJob(aal2, createdAal2.data.id);
  await aal2.auth.signOut();
}

function ingestionFixturePayload(title) {
  return {
    title,
    company_name: "Empresa Fictícia Lab",
    description: "Vaga fictícia para teste RLS de ingestão.",
    level: "junior",
    work_model: "remote",
    location: "Brasil · Remoto",
    stack: ["JavaScript"],
  };
}

async function deleteIngestions(ids) {
  const svc = createServiceClient();
  if (!svc || ids.length === 0) return;
  const { error } = await svc.from("job_ingestions").delete().in("id", ids);
  if (error) console.log(`AVISO: cleanup job_ingestions: ${error.message}`);
}

async function assertCannotSeeIngestion(client, id, label) {
  const byId = await queryWithRetry(() => client.from("job_ingestions").select("id").eq("id", id));
  if (isIngestionProbeTransient(byId.error)) {
    assert(
      false,
      `${label} falhou por rede/timeout/indisponibilidade, não por RLS (${errorText(byId.error)})`,
    );
    return;
  }
  if (byId.error && !isIngestionReadDenied(byId.error)) {
    assert(false, `${label} erro inesperado ao ler ingestão (${errorText(byId.error)})`);
    return;
  }
  assert(
    Boolean(byId.error) || !(byId.data ?? []).some((row) => row.id === id),
    `${label} não lê a ingestão existente`,
  );
}

async function assertCanSeeIngestion(client, id, label) {
  const byId = await client.from("job_ingestions").select("id").eq("id", id);
  assert(!byId.error, `${label} lê ingestão sem erro (${byId.error?.message ?? "ok"})`);
  assert((byId.data ?? []).some((row) => row.id === id), `${label} AAL2 lê a ingestão existente`);
}

/** Cenário 21 — MVP-013: job_ingestions fora do catálogo; duplicata idempotente; RLS. */
async function scenario21_jobIngestions() {
  if (!hasCreds(testUsers.admin) || !totpSecrets.admin) {
    skipRequired(21, "falta admin AAL2 em docs-local");
    return;
  }
  if (!hasCreds(testUsers.candidate)) {
    skipRequired(21, "candidato: docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
    return;
  }
  if (!hasCreds(testUsers.curator) || !totpSecrets.curator) {
    skipRequired(21, "falta curator AAL2 em docs-local");
    return;
  }
  if (!hasCreds(testUsers.moderator) || !totpSecrets.moderator) {
    skipRequired(21, "falta moderator AAL2 em docs-local");
    return;
  }

  const { client: admin, error: adminErr } = await signInStaff("admin");
  assert(!adminErr, `admin AAL2 autentica para ingestão (${adminErr?.message ?? "ok"})`);
  if (adminErr || !admin) return;

  const probe = await queryWithRetry(() => admin.from("job_ingestions").select("id").limit(1));
  if (isRelationMissing(probe.error)) {
    skipRequired(21, "migration job_ingestions não aplicada no ambiente");
    await admin.auth.signOut();
    return;
  }

  const stamp = Date.now();
  const locator = `fixture:rls-s21-${stamp}`;
  const payload = ingestionFixturePayload(`RLS 013 ingest ${stamp}`);
  const createdIds = [];

  try {
    const first = await registerJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: `  ${locator.toUpperCase()}  `,
      payload,
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    assert(Boolean(first?.id) && first.idempotent === false, "admin AAL2 registra ingestão");
    if (first?.id) createdIds.push(first.id);
    assert(first.job_id == null, "ingestão Fase A não exige job_id");
    assert(first.normalized_locator === locator, "locator normalizado no INSERT (trim/lower)");

    await assertCannotSeeIngestion(anon, first.id, "anon");
    const anonRpc = await anon.rpc("register_job_ingestion", {
      p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      p_locator: locator,
      p_payload: payload,
    });
    assert(
      Boolean(anonRpc.error) &&
        (isExecuteDenied(anonRpc.error) || /aal2 required|42501|not authenticated/i.test(errorText(anonRpc.error))),
      `anon não registra ingestão (${errorText(anonRpc.error) || "sem mensagem"})`,
    );
    const pendingJobs = await queryWithRetry(() => anon.from("jobs").select("id,status"));
    assert(
      (pendingJobs.data ?? []).every((row) => row.status === "approved"),
      "catálogo público permanece só approved após contrato 013",
    );
    const publicJobs = await anon.from("jobs").select("id").eq("title", payload.title);
    assert((publicJobs.data ?? []).length === 0, "ingestão não publica vaga no catálogo");

    const { client: candidate, error: candidateErr } = await signInWithRetry(testUsers.candidate, {
      label: "candidato (ingest)",
    });
    assert(!candidateErr, `candidato autentica para ingestão (${candidateErr?.message ?? "ok"})`);
    if (!candidateErr && candidate) {
      try {
        await assertCannotSeeIngestion(candidate, first.id, "candidato");
        const candidateInsert = await candidate.from("job_ingestions").insert({
          source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
          normalized_locator: `fixture:rls-s21-candidate-${stamp}`,
          payload_hash: "a".repeat(64),
        });
        assert(Boolean(candidateInsert.error), "candidato não insere ingestão via tabela");
        const candidateRpc = await candidate.rpc("register_job_ingestion", {
          p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
          p_locator: `fixture:rls-s21-candidate-rpc-${stamp}`,
          p_payload: payload,
        });
        assert(Boolean(candidateRpc.error), "candidato não registra ingestão via RPC");
        assert(
          /aal2 required|42501|permission denied/i.test(errorText(candidateRpc.error)),
          `RPC ingestão candidato recusada (${errorText(candidateRpc.error) || "sem mensagem"})`,
        );
      } finally {
        await candidate.auth.signOut();
      }
    }

    const { client: curator, error: curatorErr } = await signInStaff("curator");
    assert(!curatorErr, `curator AAL2 autentica para ingestão (${curatorErr?.message ?? "ok"})`);
    if (!curatorErr && curator) {
      try {
        await assertCanSeeIngestion(curator, first.id, "curator");
      } finally {
        await curator.auth.signOut();
      }
    }

    const { client: moderator, error: moderatorErr } = await signInStaff("moderator");
    assert(!moderatorErr, `moderator AAL2 autentica para ingestão (${moderatorErr?.message ?? "ok"})`);
    if (!moderatorErr && moderator) {
      try {
        await assertCanSeeIngestion(moderator, first.id, "moderator");
      } finally {
        await moderator.auth.signOut();
      }
    }

    const aal1Admin = await assertPasswordOnlyNotAal2("admin");
    if (aal1Admin) {
      try {
        await assertCannotSeeIngestion(aal1Admin, first.id, "admin AAL1");
        const aal1Insert = await aal1Admin.from("job_ingestions").insert({
          source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
          normalized_locator: `fixture:rls-s21-aal1-${stamp}`,
          payload_hash: "b".repeat(64),
        });
        assert(Boolean(aal1Insert.error), "AAL1 não insere ingestão via tabela");
        assert(
          isStaffAal2Denied(aal1Insert.error) || /permission denied|42501/i.test(errorText(aal1Insert.error)),
          `insert ingestão AAL1 recusado (${errorText(aal1Insert.error) || "sem mensagem"})`,
        );
        const aal1Rpc = await aal1Admin.rpc("register_job_ingestion", {
          p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
          p_locator: `fixture:rls-s21-aal1-rpc-${stamp}`,
          p_payload: payload,
        });
        assert(Boolean(aal1Rpc.error), "AAL1 não registra ingestão via RPC");
        assert(
          isStaffAal2Denied(aal1Rpc.error),
          `RPC ingestão AAL1 recusada (${errorText(aal1Rpc.error) || "sem mensagem"})`,
        );
      } finally {
        await aal1Admin.auth.signOut();
      }
    }

    const repeat = await registerJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator,
      payload: { ...payload, stack: ["JavaScript"] },
    });
    assert(repeat.idempotent === true, "mesma fonte + mesmo payload é idempotente");
    assert(repeat.id === first.id, "duplicata 013 devolve a mesma linha");
    assert(repeat.expires_at != null, "reprocessamento não apaga o registro anterior");

    const distinctLocator = await registerJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: `${locator}-other`,
      payload,
    });
    assert(distinctLocator.idempotent === false && distinctLocator.id !== first.id, "locator distinto cria linha nova");
    if (distinctLocator?.id) createdIds.push(distinctLocator.id);

    const distinctPayload = await registerJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator,
      payload: { ...payload, title: `${payload.title} plenor` },
    });
    assert(distinctPayload.idempotent === false && distinctPayload.id !== first.id, "payload distinto cria linha nova");
    if (distinctPayload?.id) createdIds.push(distinctPayload.id);

    const fingerprint = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator,
      payload,
    });
    assert(
      fingerprint.payload_hash === first.payload_hash,
      "hash do banco coincide com o canônico de preview (cliente não persiste o digest)",
    );

    const staffRead = await admin.from("job_ingestions").select("id").in("id", createdIds);
    assert((staffRead.data ?? []).length === createdIds.length, "admin AAL2 lê as ingestões criadas");

    const approvedHijack = await admin
      .from("jobs")
      .insert({
        company_id: SEED_COMPANY,
        title: `RLS 013 no approved ${stamp}`,
        description: "Tentativa de publicação via cliente.",
        level: "junior",
        work_model: "remote",
        status: "approved",
        requirements: { mandatory: [], desirable: [] },
      })
      .select("id,status")
      .single();
    assert(
      !approvedHijack.error && approvedHijack.data?.status === "pending",
      "contrato 013 não altera o gatilho: cliente não persiste approved",
    );
    if (approvedHijack.data?.id) await deleteJob(admin, approvedHijack.data.id);
  } catch (error) {
    if (/could not find the function|PGRST202/i.test(error.message || "")) {
      skipRequired(21, "RPC register_job_ingestion não aplicada no ambiente");
    } else {
      assert(false, `fluxo 013 admin: ${error.message || error}`);
    }
  } finally {
    await deleteIngestions(createdIds);
    await admin.auth.signOut();
  }
}

/** Cenário 22 — MVP-013 Fase B: processa fixture, retry idempotente, expiração fora do catálogo, falha redigida. */
async function scenario22_processJobIngestion() {
  if (!hasCreds(testUsers.admin) || !totpSecrets.admin) {
    skipRequired(22, "falta admin AAL2 em docs-local");
    return;
  }
  if (!hasCreds(testUsers.candidate)) {
    skipRequired(22, "candidato: docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
    return;
  }
  if (!hasCreds(testUsers.curator) || !totpSecrets.curator) {
    skipRequired(22, "falta curator AAL2 em docs-local");
    return;
  }

  const { client: admin, error: adminErr } = await signInStaff("admin");
  assert(!adminErr, `admin AAL2 autentica para processar ingestão (${adminErr?.message ?? "ok"})`);
  if (adminErr || !admin) return;

  const probe = await queryWithRetry(() => admin.from("job_ingestion_attempts").select("id").limit(1));
  if (isRelationMissing(probe.error)) {
    skipRequired(22, "migration job_ingestion_attempts não aplicada no ambiente");
    await admin.auth.signOut();
    return;
  }

  const stamp = Date.now();
  const locator = `fixture:rls-s22-${stamp}`;
  const payload = ingestionFixturePayload(`RLS 013 process ${stamp}`);
  const createdIds = [];
  const createdJobIds = [];
  const svc = createServiceClient();

  try {
    const first = await processJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator,
      payload,
    });
    assert(first.outcome === "materialized", `processa fixture (${first.outcome})`);
    assert(first.job?.status === "pending", "materializa só pending");
    assert(first.job?.id, "devolve job_id pending");
    if (first.ingestion?.id) createdIds.push(first.ingestion.id);
    if (first.job?.id) createdJobIds.push(first.job.id);

    const publicJob = await anon.from("jobs").select("id,status").eq("id", first.job.id);
    assert((publicJob.data ?? []).length === 0, "pending da ingestão não entra no catálogo público");

    const repeat = await processJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator,
      payload,
    });
    assert(repeat.outcome === "idempotent", "reprocessamento idempotente");
    assert(repeat.job?.id === first.job.id, "retry não duplica a vaga");

    const failed = await processJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: `${locator}-fail`,
      payload: { title: `RLS 013 fail ${stamp}`, company_name: "Empresa Fictícia Lab" },
    });
    assert(failed.outcome === "failed", "falha parcial fica registrada");
    assert(failed.failure_code === "payload_invalid", "código estável de payload");
    assert(!/@|token|secret/i.test(failed.failure_detail ?? ""), "falha redigida sem PII");
    assert(failed.job == null, "falha não publica vaga");
    if (failed.ingestion?.id) createdIds.push(failed.ingestion.id);

    const attempts = await admin
      .from("job_ingestion_attempts")
      .select("id,outcome,failure_detail")
      .eq("ingestion_id", failed.ingestion.id);
    assert((attempts.data ?? []).some((row) => row.outcome === "failed"), "admin lê tentativa falha");

    const { client: curator } = await signInStaff("curator");
    try {
      const curatorRead = await curator
        .from("job_ingestion_attempts")
        .select("id")
        .eq("ingestion_id", failed.ingestion.id);
      assert((curatorRead.data ?? []).length > 0, "curator AAL2 lê tentativas");
      const curatorProcess = await curator.rpc("process_job_ingestion", {
        p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
        p_locator: `${locator}-curator`,
        p_payload: payload,
      });
      assert(Boolean(curatorProcess.error), "curator não processa ingestão");
    } finally {
      await curator.auth.signOut();
    }

    const { client: candidate } = await signInWithRetry(testUsers.candidate, { label: "candidato (process)" });
    try {
      const candidateAttempts = await candidate.from("job_ingestion_attempts").select("id").eq("ingestion_id", failed.ingestion.id);
      assert(
        Boolean(candidateAttempts.error) || (candidateAttempts.data ?? []).length === 0,
        "candidato não lê tentativas",
      );
    } finally {
      await candidate?.auth.signOut();
    }

    if (svc) {
      const expiredInsert = await svc.from("job_ingestions").insert({
        source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
        normalized_locator: `fixture:rls-s22-expired-${stamp}`,
        payload_hash: "c".repeat(64),
        expires_at: "2020-01-01T00:00:00.000Z",
        job_id: SEED_APPROVED_A,
      }).select("id").single();
      if (expiredInsert.data?.id) createdIds.push(expiredInsert.data.id);
      assert(!expiredInsert.error, `service insere ingestão expirada de prova (${expiredInsert.error?.message ?? "ok"})`);
      const hidden = await anon.from("jobs").select("id").eq("id", SEED_APPROVED_A);
      assert((hidden.data ?? []).length === 0, "vaga com ingestão expirada some do catálogo público");
      if (expiredInsert.data?.id) {
        await deleteIngestions([expiredInsert.data.id]);
        const idx = createdIds.indexOf(expiredInsert.data.id);
        if (idx >= 0) createdIds.splice(idx, 1);
      }
      const restored = await anon.from("jobs").select("id").eq("id", SEED_APPROVED_A);
      assert((restored.data ?? []).length === 1, "remover ingestão expirada devolve a vaga ao catálogo");
    }

    const expiredProcess = await processJobIngestion(admin, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: `${locator}-expired`,
      payload,
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    assert(expiredProcess.outcome === "expired", "processo expirado não materializa");
    assert(expiredProcess.job == null, "expirado não cria vaga");
    if (expiredProcess.ingestion?.id) createdIds.push(expiredProcess.ingestion.id);
  } catch (error) {
    if (/could not find the function|PGRST202/i.test(error.message || "")) {
      skipRequired(22, "RPC process_job_ingestion não aplicada no ambiente");
    } else {
      assert(false, `fluxo 013 Fase B: ${error.message || error}`);
    }
  } finally {
    await deleteIngestions(createdIds);
    for (const jobId of createdJobIds) {
      await deleteJob(admin, jobId);
    }
    await admin.auth.signOut();
  }
}

console.log("=== Cenário 1: anon ===");
await scenario1_anon();

console.log("\n=== Cenário 2: candidato ===");
await scenario2_candidate();

console.log("\n=== Baseline admin (S3) ===");
await scenarioAdminBaseline();

console.log("\n=== Cenário 3: curador uma vez por rodada ===");
await scenario3_curatorSingleReview();

console.log("\n=== Cenário 4: autoavaliação e duplicidade ===");
await scenario4_selfReviewAndDuplicate();

console.log("\n=== Cenário 5: quórum 2×2 ===");
await scenario5_quorum();

console.log("\n=== Cenário 6: empate ===");
await scenario6_tie();

console.log("\n=== Cenário 7: moderação ===");
await scenario7_moderation();

console.log("\n=== Cenário 8: reenvio ===");
await scenario8_resubmit();

console.log("\n=== Cenário 9: prioridade ===");
await scenario9_priority();

console.log("\n=== Cenário 10: apply + snapshot ===");
await scenario10_applyHappy();

console.log("\n=== Cenário 11: apply recusado ===");
await scenario11_applyBlocked();

console.log("\n=== Cenário 12: withdraw D-09 ===");
await scenario12_withdraw();

console.log("\n=== Cenário 13: profile role escalation (F-019) ===");
await scenario13_profileRoleEscalation();

console.log("\n=== Cenário 14: apply rate limit (F-023) ===");
await scenario14_applyRateLimit();

console.log("\n=== Cenário 15: RPC EXECUTE hardening (MVP-021) ===");
await scenario15_rpcExecuteHardening();

console.log("\n=== Cenário 16: MVP-003 consentimento granular ===");
await scenario16_privacyConsent();

console.log("\n=== Cenário 17: MVP-005 auditoria e minimização ===");
await scenario17_privacyAudit();

console.log("\n=== Cenário 18: MVP-022 helpers RLS fora da Data API ===");
await scenario18_rlsHelperRpcSurface();

console.log("\n=== Cenário 19: Storage avatars (PERF-AVATAR-02) ===");
await scenario19_avatarStorage();

console.log("\n=== Cenário 20: SEC-STAFF-MFA-02 AAL1 bloqueado em mutação staff ===");
await scenario20_staffAal1Blocked();

console.log("\n=== Cenário 21: MVP-013 contrato de origem e fingerprint ===");
await scenario21_jobIngestions();

console.log("\n=== Cenário 22: MVP-013 Fase B processar ingestão ===");
await scenario22_processJobIngestion();

if (skippedRequired.size > 0) {
  for (const n of [...skippedRequired].sort()) {
    let band = "S4-01 exige execução real de 3–9";
    if (n >= 10 && n <= 12) band = "S6-01 exige execução real de 10–12";
    if (n === 13) band = "F-019 exige execução real do cenário 13";
    if (n === 14) band = "F-023 exige execução real do cenário 14";
    if (n === 15) band = "MVP-021 exige execução real do cenário 15";
    if (n === 16) band = "MVP-003 exige execução real do cenário 16";
    if (n === 17) band = "MVP-005 exige execução real do cenário 17";
    if (n === 18) band = "MVP-022 exige execução real do cenário 18";
    if (n === 19) band = "PERF-AVATAR-02 exige execução real do cenário 19";
    if (n === 20) band = "SEC-STAFF-MFA-02 exige execução real do cenário 20";
    if (n === 21) band = "MVP-013 exige execução real do cenário 21";
    if (n === 22) band = "MVP-013 Fase B exige execução real do cenário 22";
    failures.push(`cenário ${n} ignorado (${band})`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} cenário(s) falharam.`);
  process.exit(1);
}

console.log(
  `\nRLS curadoria + apply V1 + F-019 + F-023 + MVP-021 + MVP-003 + MVP-005 + MVP-022 + avatars + AAL2 + MVP-013: ok (${skipped.length} aviso(s) opcionais; cenários 3–22 executados).`,
);
