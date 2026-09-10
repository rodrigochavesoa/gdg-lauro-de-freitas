/**
 * UX-PERF-06 — mede candidato logado → Minhas candidaturas.
 * T1 cold (reload + clique) · T2 remount SPA Vagas → Minhas candidaturas + rAF ~800 ms.
 * Sem networkidle. Não imprime senhas. Não entra no CI.
 *
 * Uso local:
 *   pnpm dev   # terminal 1 — http://127.0.0.1:5173
 *   pnpm qa:my-applications
 *
 * Credenciais: docs-local/candidate-test-user.md ou CANDIDATE_TEST_EMAIL / CANDIDATE_TEST_PASSWORD
 * BASE_URL default: http://127.0.0.1:5173
 * MEASURE_LABEL=before|after  MEASURE_RUNS default 5
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function loadCandidateUser() {
  const file = resolve(process.cwd(), "docs-local/candidate-test-user.md");
  const fromFile = existsSync(file)
    ? {
        email: readFileSync(file, "utf8").match(/E-mail:\s*(\S+)/i)?.[1],
        password: readFileSync(file, "utf8").match(/Senha:\s*(\S+)/i)?.[1],
      }
    : {};
  return {
    email: process.env.CANDIDATE_TEST_EMAIL || process.env.CANDIDATE_EMAIL || fromFile.email,
    password: process.env.CANDIDATE_TEST_PASSWORD || process.env.CANDIDATE_PASSWORD || fromFile.password,
  };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(label, values) {
  if (values.length === 0) return `${label}: (sem amostras)`;
  return `${label}: ${values.map((v) => Math.round(v)).join(", ")} | mediana ${Math.round(median(values))}`;
}

function hitsLabel(hits, total) {
  return `${hits}/${total}`;
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const runs = Math.max(1, Number(env.MEASURE_RUNS || 5));
const label = (env.MEASURE_LABEL || "after").toLowerCase() === "before" ? "before" : "after";
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const { email, password } = loadCandidateUser();
const outDir = resolve(process.cwd(), "docs-local/assets/ux-perf-06");
mkdirSync(outDir, { recursive: true });

if (!email || !password) {
  console.error("Defina CANDIDATE_TEST_EMAIL/CANDIDATE_TEST_PASSWORD ou docs-local/candidate-test-user.md");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Defina VITE_SUPABASE_URL e a chave publishable/anon em .env.local");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm add -D playwright && pnpm exec playwright install chromium");
  process.exit(1);
}

async function signInCandidateSession() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`login candidato falhou: ${error?.message || "sem sessão"}`);
  }
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    storageKey: `sb-${projectRef}-auth-token`,
    session: data.session,
  };
}

async function waitForReady(page, timeout = 30_000) {
  const card = page.locator(".job-card:not(.job-card--skeleton)").first();
  const empty = page.getByRole("heading", { name: "Você ainda não se candidatou" });
  await Promise.race([
    card.waitFor({ state: "visible", timeout }),
    empty.waitFor({ state: "visible", timeout }),
  ]);
  const hasCard = await card.isVisible().catch(() => false);
  return hasCard ? "cards" : "empty";
}

async function sampleRaf(page, durationMs = 800) {
  return page.evaluate(async (ms) => {
    const started = performance.now();
    const samples = [];
    const routeNeedle = "Carregando…";
    const gateNeedle = "Carregando candidaturas";
    while (performance.now() - started < ms) {
      const text = document.body?.innerText || "";
      samples.push({
        t: Math.round(performance.now() - started),
        routeSpinner: text.includes(routeNeedle),
        gate: text.includes(gateNeedle),
        skeletons: document.querySelectorAll(".job-card--skeleton").length,
      });
      await new Promise((r) => requestAnimationFrame(r));
    }
    return {
      sampleCount: samples.length,
      routeSpinnerHits: samples.filter((s) => s.routeSpinner).length,
      gateHits: samples.filter((s) => s.gate).length,
      skeletonHits: samples.filter((s) => s.skeletons > 0).length,
      firstGateMs: samples.find((s) => s.gate)?.t ?? null,
      firstRouteMs: samples.find((s) => s.routeSpinner)?.t ?? null,
      maxSkeletons: samples.reduce((max, s) => Math.max(max, s.skeletons), 0),
    };
  }, durationMs);
}

const auth = await signInCandidateSession();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(
  ({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  },
  auth,
);

const page = await context.newPage();
const restLog = [];
const lines = [];
const log = (message) => {
  lines.push(message);
  console.log(message);
};

page.on("request", (request) => {
  const url = request.url();
  if (url.includes("/rest/v1/")) {
    restLog.push({ at: Date.now(), path: url.split("?")[0].replace(/^.*\/rest\/v1\//, "") });
  }
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Minhas candidaturas" }).waitFor({ state: "visible", timeout: 30_000 });

const t1 = [];
const t1Ready = [];
let t1RouteHits = 0;
let t1GateHits = 0;
let t1SkeletonRuns = 0;
const t1Rest = [];

log(`BASE_URL=${baseUrl} label=${label} runs=${runs} (sem credenciais neste log)`);
log("\n=== T1 cold — reload / → clique Minhas candidaturas ===");

for (let run = 1; run <= runs; run += 1) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Minhas candidaturas" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(200);

  const beforeRest = restLog.length;
  const started = Date.now();
  await page.getByRole("link", { name: "Minhas candidaturas" }).click();
  const rafPromise = sampleRaf(page, 800);
  const kind = await waitForReady(page);
  t1.push(Date.now() - started);
  t1Ready.push(kind);
  const raf = await rafPromise;
  if (raf.routeSpinnerHits > 0) t1RouteHits += 1;
  if (raf.gateHits > 0) t1GateHits += 1;
  if (raf.skeletonHits > 0) t1SkeletonRuns += 1;

  const restThisNav = restLog.slice(beforeRest).map((row) => row.path);
  t1Rest.push(restThisNav);
  log(`T1 run ${run} ${Math.round(t1[t1.length - 1])} ms ready=${kind} rafGate=${raf.gateHits}/${raf.sampleCount} rafRoute=${raf.routeSpinnerHits} rafSkel=${raf.skeletonHits} rest=${restThisNav.join(",") || "(nenhum)"}`);
}

log("\n=== T2 remount — Vagas → Minhas candidaturas (cache SPA) ===");

await page.getByRole("link", { name: "Vagas", exact: true }).click();
await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
await page.getByRole("link", { name: "Minhas candidaturas" }).click();
await waitForReady(page);

const t2 = [];
const t2Ready = [];
const t2Raf = [];
let t2RouteHits = 0;
let t2GateHits = 0;
let t2SkeletonRuns = 0;
const t2Rest = [];

for (let run = 1; run <= runs; run += 1) {
  await page.getByRole("link", { name: "Vagas", exact: true }).click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);

  const beforeRest = restLog.length;
  const started = Date.now();
  await page.getByRole("link", { name: "Minhas candidaturas" }).click();
  const rafPromise = sampleRaf(page, 800);
  const kind = await waitForReady(page);
  t2.push(Date.now() - started);
  t2Ready.push(kind);
  const raf = await rafPromise;
  t2Raf.push(raf);
  if (raf.routeSpinnerHits > 0) t2RouteHits += 1;
  if (raf.gateHits > 0) t2GateHits += 1;
  if (raf.skeletonHits > 0) t2SkeletonRuns += 1;

  const restThisNav = restLog.slice(beforeRest).map((row) => row.path);
  t2Rest.push(restThisNav);
  log(
    `T2 run ${run} ${Math.round(t2[t2.length - 1])} ms ready=${kind} rafGate=${raf.gateHits}/${raf.sampleCount} rafRoute=${raf.routeSpinnerHits} rafSkel=${raf.skeletonHits} rest=${restThisNav.join(",") || "(nenhum)"}`,
  );
}

log("\n=== RESUMO UX-PERF-06 ===");
log(summarize("T1 cold → card/empty", t1));
log(`T1 "Carregando…" route: ${hitsLabel(t1RouteHits, runs)}`);
log(`T1 "Carregando candidaturas" gate: ${hitsLabel(t1GateHits, runs)}`);
log(`T1 skeleton visível (amostra imediata): ${hitsLabel(t1SkeletonRuns, runs)}`);
log(`T1 ready: ${t1Ready.join(", ")}`);
log(summarize("T2 remount → card/empty", t2));
log(`T2 "Carregando…" route: ${hitsLabel(t2RouteHits, runs)}`);
log(`T2 "Carregando candidaturas" gate: ${hitsLabel(t2GateHits, runs)}`);
log(`T2 skeleton visível (amostra imediata): ${hitsLabel(t2SkeletonRuns, runs)}`);
log(`T2 ready: ${t2Ready.join(", ")}`);
log(`Meta remount: gate 0/${runs} · route 0/${runs} com cache quente · T2 mediana ≤500 ms`);

const metrics = {
  name: label,
  baseUrl,
  measuredAt: new Date().toISOString(),
  runs,
  t1: {
    ms: t1,
    medianMs: median(t1) == null ? null : Math.round(median(t1)),
    ready: t1Ready,
    routeSpinnerHits: t1RouteHits,
    gateHits: t1GateHits,
    skeletonRuns: t1SkeletonRuns,
    rest: t1Rest,
  },
  t2: {
    ms: t2,
    medianMs: median(t2) == null ? null : Math.round(median(t2)),
    ready: t2Ready,
    routeSpinnerHits: t2RouteHits,
    gateHits: t2GateHits,
    skeletonRuns: t2SkeletonRuns,
    raf: t2Raf,
    rest: t2Rest,
  },
};

writeFileSync(resolve(outDir, `metrics-${label}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
writeFileSync(resolve(outDir, `measure-${label}.log`), `${lines.join("\n")}\n`);
log(`wrote docs-local/assets/ux-perf-06/metrics-${label}.json`);

await browser.close();
