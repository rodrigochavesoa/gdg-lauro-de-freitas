/**
 * Verifica RLS, curadoria V1 (S4-01) e candidatura V1 (S6-01).
 * Lê .env.local e docs-local/*-test-user.md. Nunca imprime senhas.
 * pwsh: pnpm test:rls
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

function hasCreds(user) {
  return Boolean(user?.email && user?.password);
}

const SEED_COMPANY = "a1a1a1a1-0001-4000-8000-000000000001";
const RUBRIC = "R1-empresa-identificavel";
const SEED_APPROVED_A = "b2b2b2b2-0003-4000-8000-000000000003";
const SEED_APPROVED_B = "b2b2b2b2-0004-4000-8000-000000000004";
const SEED_PENDING = "b2b2b2b2-0005-4000-8000-000000000005";

if (!url || !key) {
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
  return client.rpc("apply_to_job", { p_job_id: jobId });
}

async function rpcWithdraw(client, jobId) {
  return client.rpc("withdraw_application", { p_job_id: jobId });
}

async function deleteApplication(admin, jobId, candidateId) {
  if (!jobId || !candidateId) return;
  await admin.from("applications").delete().eq("job_id", jobId).eq("candidate_id", candidateId);
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
  const jobs = await anon.from("jobs").select("id,title,status");
  assert(!jobs.error, `anon lê jobs sem erro (${jobs.error?.message ?? "ok"})`);
  const rows = jobs.data ?? [];
  assert(rows.length > 0, "visitante vê ao menos uma vaga");
  assert(rows.every((row) => row.status === "approved"), "visitante só recebe approved");

  const pendingProbe = await anon.from("jobs").select("id").eq("status", "pending");
  assert((pendingProbe.data ?? []).length === 0, "anon não filtra pending");

  const reviews = await anon.from("job_curation_reviews").select("id");
  assert((reviews.data ?? []).length === 0, "anon não lê pareceres");

  const queue = await anon.from("jobs_needing_moderation").select("id");
  assert((queue.data ?? []).length === 0, "anon não lê fila needs_moderation");

  const rpc = await anon.rpc("submit_curation_review", {
    p_job_id: "b2b2b2b2-0005-4000-8000-000000000005",
    p_decision: "approve",
    p_rubric_code: RUBRIC,
  });
  assert(Boolean(rpc.error), "anon não chama RPC de parecer");
}

/** Cenário 2 — candidato não cura, prioridade nem status. */
async function scenario2_candidate() {
  if (!hasCreds(testUsers.candidate)) {
    skip("candidato: docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
    return;
  }
  const { client, error } = await signIn(testUsers.candidate);
  assert(!error, `candidato autentica (${error?.message ?? "ok"}`);
  if (error) return;

  const pending = await client.from("jobs").select("id,status").eq("status", "pending");
  assert((pending.data ?? []).length === 0, "candidato não vê pending");

  const reviews = await client.from("job_curation_reviews").select("id");
  assert((reviews.data ?? []).length === 0, "candidato não lê pareceres");

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
  const { client: admin, error: adminErr } = await signIn(testUsers.admin);
  assert(!adminErr, `admin autentica (${adminErr?.message ?? "ok"}`);
  if (adminErr) return null;

  const marker = `RLS curator once ${Date.now()}`;
  const created = await createPendingJob(admin, marker);
  assert(!created.error && created.data?.id, "admin cria vaga pending para curadoria");
  const jobId = created.data?.id;

  const { client: curator, error: curErr } = await signIn(testUsers.curator);
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
  const { client: admin, error: adminErr } = await signIn(testUsers.admin);
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

  const { client: curator } = await signIn(testUsers.curator);
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
  const curatorB = testUsers.curator2;

  const { client: admin } = await signIn(testUsers.admin);
  const approveMarker = `RLS quorum approve ${Date.now()}`;
  const rejectMarker = `RLS quorum reject ${Date.now()}`;
  const jobA = await createPendingJob(admin, approveMarker);
  const jobR = await createPendingJob(admin, rejectMarker);

  const { client: c1 } = await signIn(testUsers.curator);
  const { client: c2 } = await signIn(curatorB);

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

  const { client: admin } = await signIn(testUsers.admin);
  const marker = `RLS tie ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const { client: c1 } = await signIn(testUsers.curator);
  const { client: c2 } = await signIn(reviewerB);

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

  const { client: admin } = await signIn(testUsers.admin);
  const marker = `RLS moderation ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const { client: curator } = await signIn(testUsers.curator);
  const { client: curator2 } = await signIn(testUsers.curator2);
  const { client: curator3 } = await signIn(testUsers.curator3);
  const { client: moderator } = await signIn(testUsers.moderator);

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

  const { client: admin } = await signIn(testUsers.admin);
  const marker = `RLS resubmit ${Date.now()}`;
  const job = await createPendingJob(admin, marker);
  const jobId = job.data?.id;

  const { client: c1 } = await signIn(testUsers.curator);
  const { client: c2 } = await signIn(reviewerB);
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
  const { client: admin } = await signIn(testUsers.admin);
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
    const { client: curator } = await signIn(testUsers.curator);
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
  const { client: admin, error: adminErr } = await signIn(testUsers.admin);
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  assert(!adminErr && !candErr && user?.id, `admin e candidato autenticam (${adminErr?.message || candErr?.message || "ok"})`);
  if (adminErr || candErr || !user?.id) return;

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  const { previous } = await ensureD01Profile(candidate, user.id);

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

  const renamed = `${previous.full_name || "Candidato"} ${Date.now()}`;
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
  await candidate
    .from("profiles")
    .update({
      full_name: previous.full_name,
      skills: previous.skills,
      preferences: previous.preferences,
      bio: previous.bio,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const dup = await rpcApply(candidate, SEED_APPROVED_A);
  const dupMsg = [dup.error?.message, dup.error?.details, dup.error?.hint].filter(Boolean).join(" ");
  assert(Boolean(dup.error), "segunda candidatura no mesmo par falha");
  assert(/already applied/i.test(dupMsg), `duplicata retorna already applied (${dupMsg || "sem mensagem"})`);

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await candidate.auth.signOut();
  await admin.auth.signOut();
}

/** Cenário 11 — apply recusado: anon, D-01 incompleto, vaga pending, INSERT direto. */
async function scenario11_applyBlocked() {
  if (!hasCreds(testUsers.admin) || !hasCreds(testUsers.candidate)) {
    skipRequired(11, "faltam admin e/ou candidate em docs-local");
    return;
  }

  const anonApply = await anon.rpc("apply_to_job", { p_job_id: SEED_APPROVED_A });
  assert(Boolean(anonApply.error), "anon não chama RPC de apply");

  const { client: admin, error: adminErr } = await signIn(testUsers.admin);
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  if (adminErr || candErr || !user?.id) {
    skipRequired(11, "admin ou candidato não autenticou");
    return;
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
  const { previous } = await ensureD01Profile(candidate, user.id);

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
  await candidate
    .from("profiles")
    .update({
      full_name: previous.full_name,
      skills: previous.skills?.length ? previous.skills : ["JavaScript"],
      preferences: d01Preferences(previous.preferences),
      bio: previous.bio,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const direct = await candidate.from("applications").insert({
    job_id: SEED_APPROVED_A,
    candidate_id: user.id,
    status: "submitted",
    snapshot: { forged: true },
  }).select("id");
  assert(Boolean(direct.error) || (direct.data ?? []).length === 0, "candidato não faz INSERT direto");

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
  const { client: admin, error: adminErr } = await signIn(testUsers.admin);
  const { client: candidate, user, error: candErr } = await signIn(testUsers.candidate);
  if (adminErr || candErr || !user?.id) {
    skipRequired(12, "admin ou candidato não autenticou");
    return;
  }

  await deleteApplication(admin, SEED_APPROVED_A, user.id);
  await deleteApplication(admin, SEED_APPROVED_B, user.id);
  await deleteApplication(admin, SEED_PENDING, user.id);
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
  // Probe de conta nova exige Admin API (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY em .env.local).
  assert(
    Boolean(svc),
    "cenário 13: service role disponível para probe Admin API",
  );
  if (!svc) return;

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

/** Baseline admin legado (S2/S3). */
async function scenarioAdminBaseline() {
  if (!testUsers.admin.email || !testUsers.admin.password) {
    skip("admin baseline: docs-local/admin-test-user.md");
    return;
  }
  const { client: admin, error } = await signIn(testUsers.admin);
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
  await admin.auth.signOut();
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

if (skippedRequired.size > 0) {
  for (const n of [...skippedRequired].sort()) {
    let band = "S4-01 exige execução real de 3–9";
    if (n >= 10) band = "S6-01 exige execução real de 10–12";
    if (n === 13) band = "F-019 exige execução real do cenário 13";
    failures.push(`cenário ${n} ignorado (${band})`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} cenário(s) falharam.`);
  process.exit(1);
}

console.log(
  `\nRLS curadoria + apply V1 + F-019: ok (${skipped.length} aviso(s) opcionais; cenários 3–13 executados).`,
);
