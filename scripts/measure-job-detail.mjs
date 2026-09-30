/**
 * UX-PERF-02/03/04 — mede load de `/jobs/:id` até shell útil e detalhe completo.
 * Classifica SELECT jobs: list | heavy | full (UX-PERF-04).
 * Sem networkidle: relógio no clique/goto; marcos por visibility + rest/v1.
 *
 * Uso local (não entra no CI):
 *   pnpm dev   # terminal 1 — preferir http://localhost:5173
 *   pnpm qa:job-detail
 *
 * BASE_URL default: http://localhost:5173
 * A lista do catálogo é /vagas. / é o portal e não tem .job-card.
 * JOB_ID opcional; MEASURE_RUNS default 5
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLocalEnv } from "./measure-env.mjs";
import { attachObservers, bodySlotForRequest, cacheDelta, drainSample, livePageError, readLiveProbe, rememberRequestSample, restPathFromUrl, unsettledRows, waitForQuiet } from "./measure-observe.mjs";
import { measurePreflightError, measureRuns, sampleCountError, detailContentSample, validDetailLatencies } from "./measure-target.mjs";

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

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
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

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm add -D playwright && pnpm exec playwright install chromium");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const traffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, traffic);

const restLog = [];
const pendingBodies = new Set();
const requestSamples = new WeakMap();
let readSample = null;

function classifyJobsSelect(url) {
  if (!url.includes("/rest/v1/jobs")) return null;
  let select = "";
  try {
    select = decodeURIComponent(new URL(url).searchParams.get("select") || "");
  } catch {
    select = url;
  }
  const hasTitle = /\btitle\b/i.test(select);
  const hasDescription = /\bdescription\b/i.test(select);
  const hasStack = /\bstack\b/i.test(select);
  if (hasDescription && !hasTitle && !hasStack) return "heavy";
  if (hasTitle && hasDescription) return "full";
  if (hasTitle && !hasDescription) return "list";
  return "other";
}

page.on("request", (request) => {
  const url = request.url();
  const path = restPathFromUrl(url);
  if (!path) return;
  restLog.push({
    at: Date.now(),
    path,
    kind: classifyJobsSelect(url),
    url,
  });
  rememberRequestSample(requestSamples, request, readSample);
});
page.on("requestfailed", (request) => {
  const path = restPathFromUrl(request.url());
  if (!path) return;
  const entry = [...restLog].reverse().find((row) => row.path === path && row.status == null && !row.failed);
  if (entry) entry.failed = true;
});

page.on("response", (response) => {
  const url = response.url();
  const path = restPathFromUrl(url);
  if (!path) return;
  const entry = [...restLog].reverse().find((row) => row.path === path && row.status == null);
  if (!entry) return;
  const request = response.request();
  const slot = bodySlotForRequest(requestSamples, request, path);
  let task;
  task = (async () => {
    entry.status = response.status();
    if (entry.ms == null) entry.ms = Date.now() - entry.at;
    let bytes = Number(response.headers()["content-length"] || 0);
    if (!bytes) {
      try {
        bytes = (await response.body()).byteLength;
      } catch {
        bytes = null;
      }
    }
    if (slot.drop) return;
    entry.bytes = bytes;
  })().finally(() => pendingBodies.delete(task));
  task.sample = slot.sample;
  task.slot = slot;
  pendingBodies.add(task);
});

async function drainDetailTraffic(sliceStart) {
  const sample = readSample;
  const quiet = await waitForQuiet(() => restLog.slice(sliceStart).some((row) => row.status == null && !row.failed));
  const bodyDrain = await drainSample(pendingBodies, sample, undefined, "body");
  const opsDrain = await foreignError.drain();
  return {
    incomplete: quiet.timedOut || bodyDrain.timedOut || opsDrain.timedOut,
    reads: [...(bodyDrain.unsettled || []), ...(opsDrain.unsettled || [])],
  };
}

function formatRest(slice) {
  return slice
    .map((row) => {
      const kind = row.kind ? `:${row.kind}` : "";
      const timing = row.ms != null ? `@${row.ms}ms` : "";
      const status = row.status == null ? "status=sem-resposta" : `status=${row.status}`;
      return `${row.path}${kind}${timing} ${status}`;
    })
    .join(", ");
}

function callRecord(row) {
  return {
    path: row.path,
    kind: row.kind,
    ms: row.ms ?? null,
    status: row.status ?? null,
    bytes: row.bytes ?? null,
  };
}

function httpErrors(calls) {
  return calls.flat().filter((row) => row.status >= 400);
}

async function waitCatalog() {
  await page.waitForSelector(".job-card:not(.job-card--skeleton), .empty", { timeout: 30_000 });
}

async function waitForDetailContent() {
  try {
    await page.locator(".content-block p").first().waitFor({ state: "visible", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveSeedJobId() {
  await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
  await waitCatalog();
  const first = page.locator(".job-card:not(.job-card--skeleton)").first();
  await first.waitFor({ state: "visible", timeout: 15_000 });
  await first.click();
  await page.waitForURL(/\/jobs\/[^/]+/, { timeout: 15_000 });
  return page.url().match(/\/jobs\/([^/?#]+)/)?.[1] ?? null;
}

async function measureDirect(jobId, label) {
  const shellTimes = [];
  const fullSamples = [];
  const loadingTextSeen = [];
  const skeletonSeen = [];
  const jobKinds = [];
  const rest = [];
  const cache = [];
  const opsEvents = [];
  const networkErrors = [];
  const unsettled = [];
  let captureIncomplete = false;

  for (let run = 1; run <= runs; run += 1) {
    await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
    await waitCatalog();
    await page.waitForTimeout(200);

    const before = restLog.length;
    const opsBefore = traffic.opsEvents.length;
    const netBefore = traffic.networkErrors.length;
    readSample = foreignError.beginSample();
    const started = Date.now();
    await page.goto(`${baseUrl}/jobs/${jobId}`, { waitUntil: "domcontentloaded" });

    const loadingPromise = page
      .getByText("Carregando vaga…")
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);

    await page.getByRole("button", { name: /voltar para vagas/i }).waitFor({ state: "visible", timeout: 30_000 });
    const shellMs = Date.now() - started;
    shellTimes.push(shellMs);
    skeletonSeen.push((await page.locator(".detail-page[aria-busy='true']").count()) > 0 || (await page.locator(".detail-skeleton-line").count()) > 0);
    loadingTextSeen.push(await loadingPromise);

    const reached = await waitForDetailContent();
    const fullSample = detailContentSample(Date.now() - started, reached);
    fullSamples.push(fullSample);

    const drained = await drainDetailTraffic(before);
    if (drained.incomplete) captureIncomplete = true;
    const restThis = restLog.slice(before).map(callRecord);
    rest.push(restThis);
    unsettled.push([
      ...unsettledRows(restLog.slice(before).filter((row) => !row.failed)),
      ...drained.reads,
    ]);
    const live = await readLiveProbe(page);
    if (live.backendError) {
      console.error(live.backendError);
      await browser.close();
      process.exit(1);
    }
    cache.push(live.cache);
    opsEvents.push(traffic.opsEvents.slice(opsBefore));
    networkErrors.push(traffic.networkErrors.slice(netBefore));
    jobKinds.push(...restThis.filter((row) => row.path === "jobs").map((row) => row.kind));
    console.log(
      `${label} run ${run}: shell=${shellMs}ms full=${fullSample.reached ? `${fullSample.ms}ms` : "invalida"} contentReached=${fullSample.reached} loadingText=${loadingTextSeen.at(-1)} skeleton=${skeletonSeen.at(-1)} rest=[${formatRest(restThis) || "nenhum"}]`,
    );
  }

  return { shellTimes, fullSamples, loadingTextSeen, skeletonSeen, jobKinds, rest, cache, opsEvents, networkErrors, unsettled, captureIncomplete };
}

async function measureFromHome(jobId, label) {
  const usefulTimes = [];
  const fullSamples = [];
  const loadingTextSeen = [];
  const jobKinds = [];
  const rest = [];
  const cache = [];
  const opsEvents = [];
  const networkErrors = [];
  const unsettled = [];
  let captureIncomplete = false;

  for (let run = 1; run <= runs; run += 1) {
    await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
    await waitCatalog();
    await page.waitForTimeout(300);

    const before = restLog.length;
    const opsBefore = traffic.opsEvents.length;
    const netBefore = traffic.networkErrors.length;
    const cacheBefore = await readLiveProbe(page);
    if (cacheBefore.backendError) {
      console.error(cacheBefore.backendError);
      await browser.close();
      process.exit(1);
    }
    readSample = foreignError.beginSample();
    const started = Date.now();
    await page.locator(".job-card:not(.job-card--skeleton)").first().click();
    await page.waitForURL(/\/jobs\//, { timeout: 15_000 });

    const loadingPromise = page
      .getByText("Carregando vaga…")
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);

    await page.locator(".detail-page h1").first().waitFor({ state: "visible", timeout: 30_000 });
    const usefulMs = Date.now() - started;
    usefulTimes.push(usefulMs);
    loadingTextSeen.push(await loadingPromise);

    const reached = await waitForDetailContent();
    const fullSample = detailContentSample(Date.now() - started, reached);
    fullSamples.push(fullSample);

    const drained = await drainDetailTraffic(before);
    if (drained.incomplete) captureIncomplete = true;
    const restThis = restLog.slice(before).map(callRecord);
    rest.push(restThis);
    unsettled.push([
      ...unsettledRows(restLog.slice(before).filter((row) => !row.failed)),
      ...drained.reads,
    ]);
    const live = await readLiveProbe(page);
    if (live.backendError) {
      console.error(live.backendError);
      await browser.close();
      process.exit(1);
    }
    cache.push(cacheDelta(cacheBefore.cache, live.cache));
    opsEvents.push(traffic.opsEvents.slice(opsBefore));
    networkErrors.push(traffic.networkErrors.slice(netBefore));
    jobKinds.push(...restThis.filter((row) => row.path === "jobs").map((row) => row.kind));
    console.log(
      `${label} run ${run}: useful=${usefulMs}ms full=${fullSample.reached ? `${fullSample.ms}ms` : "invalida"} contentReached=${fullSample.reached} loadingText=${loadingTextSeen.at(-1)} rest=[${formatRest(restThis) || "nenhum"}]`,
    );
  }

  return { usefulTimes, fullSamples, loadingTextSeen, jobKinds, rest, cache, opsEvents, networkErrors, unsettled, captureIncomplete };
}

console.log(`runs=${runs}`);
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
const pageError = await livePageError(page, baseUrl);
if (pageError || foreignError()) {
  console.error(pageError || foreignError());
  await browser.close();
  process.exit(1);
}
let jobId = env.JOB_ID || null;
if (!jobId) {
  console.log("Resolving seed job id from catalog…");
  jobId = await resolveSeedJobId();
} else {
  console.log("Using JOB_ID from env");
}
if (!jobId) {
  console.error("Nenhuma vaga approved no catálogo para medir. Passe JOB_ID=…");
  await browser.close();
  process.exit(1);
}
console.log(`JOB_ID=${jobId}`);

console.log("\n=== ANON — cold goto /jobs/:id ===");
const anonDirect = await measureDirect(jobId, "anon-direct");

console.log("\n=== ANON — click card from home (cache quente) ===");
const anonHome = await measureFromHome(jobId, "anon-home");

const countKind = (kinds, kind) => kinds.filter((k) => k === kind).length;

console.log("\n=== RESUMO (UX-PERF-04) ===");
console.log(summarize("anon cold shell (Voltar/skeleton)", anonDirect.shellTimes));
console.log(summarize("anon cold full (content p)", validDetailLatencies(anonDirect.fullSamples)));
console.log(`anon cold content reached: ${anonDirect.fullSamples.filter((sample) => sample.reached).length}/${runs}`);
console.log(`anon cold "Carregando vaga…": ${anonDirect.loadingTextSeen.filter(Boolean).length}/${anonDirect.loadingTextSeen.length}`);
console.log(`anon cold skeleton/aria-busy: ${anonDirect.skeletonSeen.filter(Boolean).length}/${anonDirect.skeletonSeen.length}`);
console.log(`anon cold jobs select kinds: full=${countKind(anonDirect.jobKinds, "full")} heavy=${countKind(anonDirect.jobKinds, "heavy")} list=${countKind(anonDirect.jobKinds, "list")}`);
console.log(summarize("anon from-home useful (h1)", anonHome.usefulTimes));
console.log(summarize("anon from-home full (content p)", validDetailLatencies(anonHome.fullSamples)));
console.log(`anon from-home content reached: ${anonHome.fullSamples.filter((sample) => sample.reached).length}/${runs}`);
console.log(`anon from-home "Carregando vaga…": ${anonHome.loadingTextSeen.filter(Boolean).length}/${anonHome.loadingTextSeen.length}`);
console.log(`anon from-home jobs select kinds: full=${countKind(anonHome.jobKinds, "full")} heavy=${countKind(anonHome.jobKinds, "heavy")} list=${countKind(anonHome.jobKinds, "list")}`);
console.log("Meta PERF-04: from-home detail request = heavy (not full); cold miss = full");

for (const [name, values] of [
  ["detalhe cold shell", anonDirect.shellTimes],
  ["detalhe cold full", anonDirect.fullSamples],
  ["detalhe warm útil", anonHome.usefulTimes],
  ["detalhe warm full", anonHome.fullSamples],
]) {
  const countError = sampleCountError(values, runs, name);
  if (countError) {
    console.error(countError);
    await browser.close();
    process.exit(1);
  }
}

const detailPath = resolve(process.cwd(), "docs-local/perf/UX-PERF-04-detail.json");
mkdirSync(resolve(process.cwd(), "docs-local/perf"), { recursive: true });
writeFileSync(detailPath, `${JSON.stringify({
  pii: false,
  runId,
  runs,
  cold: {
    shellMs: anonDirect.shellTimes,
    fullSamples: anonDirect.fullSamples,
    fullMs: validDetailLatencies(anonDirect.fullSamples),
    rest: anonDirect.rest,
    httpErrors: httpErrors(anonDirect.rest),
    networkErrors: anonDirect.networkErrors,
    unsettled: anonDirect.unsettled,
    captureIncomplete: anonDirect.captureIncomplete,
    cache: anonDirect.cache,
    opsEvents: anonDirect.opsEvents,
  },
  warm: {
    usefulMs: anonHome.usefulTimes,
    fullSamples: anonHome.fullSamples,
    fullMs: validDetailLatencies(anonHome.fullSamples),
    rest: anonHome.rest,
    httpErrors: httpErrors(anonHome.rest),
    networkErrors: anonHome.networkErrors,
    unsettled: anonHome.unsettled,
    captureIncomplete: anonHome.captureIncomplete,
    cache: anonHome.cache,
    opsEvents: anonHome.opsEvents,
  },
}, null, 2)}\n`);
console.log("wrote docs-local/perf/UX-PERF-04-detail.json");

await browser.close();
