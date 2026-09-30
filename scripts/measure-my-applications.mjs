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
import { loadLocalEnv } from "./measure-env.mjs";
import { attachObservers, cacheDelta, livePageError, openRequestRow, readLiveProbe, requestsOpenedDuring, restPathFromUrl, waitForQuiet } from "./measure-observe.mjs";
import { documentMayStoreSession, measurePreflightError, measureRuns, sampleCountError } from "./measure-target.mjs";

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
const preflightError = measurePreflightError({
  supabaseUrl: env.VITE_SUPABASE_URL,
  baseUrl,
  measureRuns: env.MEASURE_RUNS,
});
if (preflightError) {
  console.error(preflightError);
  process.exit(1);
}
const runs = measureRuns(env.MEASURE_RUNS);
const runId = env.MEASURE_RUN_ID || "";
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const traffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, traffic);
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
const pageError = await livePageError(page, baseUrl);
if (pageError || foreignError()) {
  console.error(`${pageError || foreignError()} A sessão de teste não foi injetada.`);
  await browser.close();
  process.exit(1);
}
const auth = await signInCandidateSession();
const expectedOrigin = new URL(baseUrl).origin;
const stored = await page.evaluate(({ storageKey, session, expectedOrigin: origin }) => {
  if (location.origin !== origin) return false;
  localStorage.setItem(storageKey, JSON.stringify(session));
  return true;
}, { ...auth, expectedOrigin });
if (!stored || !documentMayStoreSession(new URL(page.url()).origin, expectedOrigin)) {
  console.error("A página aberta não está na origem exata de BASE_URL. A sessão de teste não foi injetada.");
  await browser.close();
  process.exit(1);
}
await page.reload({ waitUntil: "domcontentloaded" });
const primaryNav = () => page.getByRole("navigation", { name: "Principal" });
const myApplicationsLink = () => primaryNav().getByRole("link", { name: "Minhas candidaturas" });
const vagasLink = () => primaryNav().getByRole("link", { name: "Vagas", exact: true });
const restLog = [];
const inflight = new Set();
const lines = [];
const log = (message) => {
  lines.push(message);
  console.log(message);
};

page.on("request", (request) => {
  const path = restPathFromUrl(request.url());
  if (!path) return;
  inflight.add(request);
  restLog.push({ at: Date.now(), path, status: null });
});
page.on("requestfailed", (request) => {
  inflight.delete(request);
});
page.on("requestfinished", (request) => {
  inflight.delete(request);
});
page.on("response", (response) => {
  const path = restPathFromUrl(response.url());
  if (!path) return;
  inflight.delete(response.request());
  const entry = [...restLog].reverse().find((row) => row.path === path && row.status == null);
  if (entry) entry.status = response.status();
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await myApplicationsLink().waitFor({ state: "visible", timeout: 30_000 });

const t1 = [];
const t1Ready = [];
let t1RouteHits = 0;
let t1GateHits = 0;
let t1SkeletonRuns = 0;
const t1Rest = [];
const t1Cache = [];
const t1Ops = [];
const t1Net = [];
const t1Unsettled = [];
let t1CaptureIncomplete = false;

async function navigationMark() {
  const probe = await readLiveProbe(page);
  if (probe.backendError) {
    console.error(probe.backendError);
    await browser.close();
    process.exit(1);
  }
  return {
    rest: restLog.length,
    ops: traffic.opsEvents.length,
    net: traffic.networkErrors.length,
    cache: probe.cache,
    inflightBefore: new Set(inflight),
  };
}

async function navigationSlice(start) {
  const quiet = await waitForQuiet(() => requestsOpenedDuring(inflight, start.inflightBefore).length > 0);
  const opsDrain = await foreignError.drain();
  const probe = await readLiveProbe(page);
  if (probe.backendError) {
    console.error(probe.backendError);
    await browser.close();
    process.exit(1);
  }
  const rest = restLog.slice(start.rest).map((row) => ({ path: row.path, status: row.status }));
  const unsettled = [
    ...requestsOpenedDuring(inflight, start.inflightBefore)
      .map((request) => openRequestRow(restPathFromUrl(request.url())))
      .filter((row) => row.path),
    ...(opsDrain.unsettled || []),
  ];
  return {
    rest,
    unsettled,
    captureIncomplete: quiet.timedOut || opsDrain.timedOut || unsettled.length > 0,
    cache: cacheDelta(start.cache, probe.cache),
    ops: traffic.opsEvents.slice(start.ops),
    net: traffic.networkErrors.slice(start.net),
  };
}

log(`label=${label} runs=${runs} (sem credenciais neste log)`);
log("\n=== T1 cold — reload / → clique Minhas candidaturas ===");

for (let run = 1; run <= runs; run += 1) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await myApplicationsLink().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("heading", { name: /Seu futuro em tech/i }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(200);

  const startedMark = await navigationMark();
  const started = Date.now();
  await myApplicationsLink().click();
  const rafPromise = sampleRaf(page, 800);
  const kind = await waitForReady(page);
  t1.push(Date.now() - started);
  t1Ready.push(kind);
  const raf = await rafPromise;
  if (raf.routeSpinnerHits > 0) t1RouteHits += 1;
  if (raf.gateHits > 0) t1GateHits += 1;
  if (raf.skeletonHits > 0) t1SkeletonRuns += 1;

  const slice = await navigationSlice(startedMark);
  t1Rest.push(slice.rest);
  t1Unsettled.push(slice.unsettled);
  if (slice.captureIncomplete) t1CaptureIncomplete = true;
  t1Cache.push(slice.cache);
  t1Ops.push(slice.ops);
  t1Net.push(slice.net);
  log(`T1 run ${run} ${Math.round(t1[t1.length - 1])} ms ready=${kind} rafGate=${raf.gateHits}/${raf.sampleCount} rafRoute=${raf.routeSpinnerHits} rafSkel=${raf.skeletonHits} rest=${slice.rest.map((row) => `${row.path}:${row.status ?? "sem-resposta"}`).join(",") || "(nenhum)"}`);
}

log("\n=== T2 remount — Vagas → Minhas candidaturas (cache SPA) ===");

await vagasLink().click();
await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
await myApplicationsLink().click();
await waitForReady(page);

const t2 = [];
const t2Ready = [];
const t2Raf = [];
let t2RouteHits = 0;
let t2GateHits = 0;
let t2SkeletonRuns = 0;
const t2Rest = [];
const t2Cache = [];
const t2Ops = [];
const t2Net = [];
const t2Unsettled = [];
let t2CaptureIncomplete = false;

for (let run = 1; run <= runs; run += 1) {
  await vagasLink().click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);

  const startedMark = await navigationMark();
  const started = Date.now();
  await myApplicationsLink().click();
  const rafPromise = sampleRaf(page, 800);
  const kind = await waitForReady(page);
  t2.push(Date.now() - started);
  t2Ready.push(kind);
  const raf = await rafPromise;
  t2Raf.push(raf);
  if (raf.routeSpinnerHits > 0) t2RouteHits += 1;
  if (raf.gateHits > 0) t2GateHits += 1;
  if (raf.skeletonHits > 0) t2SkeletonRuns += 1;

  const slice = await navigationSlice(startedMark);
  t2Rest.push(slice.rest);
  t2Unsettled.push(slice.unsettled);
  if (slice.captureIncomplete) t2CaptureIncomplete = true;
  t2Cache.push(slice.cache);
  t2Ops.push(slice.ops);
  t2Net.push(slice.net);
  log(
    `T2 run ${run} ${Math.round(t2[t2.length - 1])} ms ready=${kind} rafGate=${raf.gateHits}/${raf.sampleCount} rafRoute=${raf.routeSpinnerHits} rafSkel=${raf.skeletonHits} rest=${slice.rest.map((row) => `${row.path}:${row.status ?? "sem-resposta"}`).join(",") || "(nenhum)"}`,
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

for (const [name, values] of [["T1", t1], ["T2", t2]]) {
  const countError = sampleCountError(values, runs, name);
  if (countError) {
    console.error(countError);
    await browser.close();
    process.exit(1);
  }
}

const metrics = {
  name: label,
  runId,
  pii: false,
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
    unsettled: t1Unsettled,
    captureIncomplete: t1CaptureIncomplete,
    cache: t1Cache,
    opsEvents: t1Ops,
    networkErrors: t1Net,
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
    unsettled: t2Unsettled,
    captureIncomplete: t2CaptureIncomplete,
    cache: t2Cache,
    opsEvents: t2Ops,
    networkErrors: t2Net,
  },
};

if (foreignError()) {
  console.error(foreignError());
  await browser.close();
  process.exit(1);
}

writeFileSync(resolve(outDir, `metrics-${label}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
writeFileSync(resolve(outDir, `measure-${label}.log`), `${lines.join("\n")}\n`);
log(`wrote docs-local/assets/ux-perf-06/metrics-${label}.json`);

await browser.close();
