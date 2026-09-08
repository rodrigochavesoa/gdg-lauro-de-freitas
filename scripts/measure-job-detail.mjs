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
 * JOB_ID opcional; MEASURE_RUNS default 5
 */
import { existsSync, readFileSync } from "node:fs";
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
const runs = Math.max(1, Number(env.MEASURE_RUNS || 5));

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

const restLog = [];

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
  if (url.includes("/rest/v1/") || url.includes("/auth/v1/")) {
    const path = url.includes("/rest/v1/")
      ? url.split("?")[0].replace(/^.*\/rest\/v1\//, "")
      : url.split("?")[0].replace(/^.*\/auth\/v1\//, "auth/");
    restLog.push({
      at: Date.now(),
      path,
      kind: classifyJobsSelect(url),
      url,
    });
  }
});
page.on("response", (response) => {
  const url = response.url();
  if (!url.includes("/rest/v1/")) return;
  const path = url.split("?")[0].replace(/^.*\/rest\/v1\//, "");
  const entry = [...restLog].reverse().find((row) => row.path === path && row.ms == null);
  if (entry) entry.ms = Date.now() - entry.at;
});

function formatRest(slice) {
  return slice
    .map((r) => {
      const kind = r.kind ? `:${r.kind}` : "";
      return `${r.path}${kind}${r.ms != null ? `@${r.ms}ms` : ""}`;
    })
    .join(", ");
}

async function waitCatalog() {
  await page.waitForSelector(".job-card:not(.job-card--skeleton), .empty", { timeout: 30_000 });
}

async function resolveSeedJobId() {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await waitCatalog();
  const first = page.locator(".job-card:not(.job-card--skeleton)").first();
  await first.waitFor({ state: "visible", timeout: 15_000 });
  await first.click();
  await page.waitForURL(/\/jobs\/[^/]+/, { timeout: 15_000 });
  return page.url().match(/\/jobs\/([^/?#]+)/)?.[1] ?? null;
}

async function measureDirect(jobId, label) {
  const shellTimes = [];
  const fullTimes = [];
  const loadingTextSeen = [];
  const skeletonSeen = [];
  const jobKinds = [];

  for (let run = 1; run <= runs; run += 1) {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await waitCatalog();
    await page.waitForTimeout(200);

    const before = restLog.length;
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

    await page.locator(".content-block p").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const fullMs = Date.now() - started;
    fullTimes.push(fullMs);

    const restThis = restLog.slice(before);
    jobKinds.push(...restThis.filter((r) => r.path === "jobs").map((r) => r.kind));
    console.log(
      `${label} run ${run}: shell=${shellMs}ms full=${fullMs}ms loadingText=${loadingTextSeen.at(-1)} skeleton=${skeletonSeen.at(-1)} rest=[${formatRest(restThis) || "nenhum"}]`,
    );
  }

  return { shellTimes, fullTimes, loadingTextSeen, skeletonSeen, jobKinds };
}

async function measureFromHome(jobId, label) {
  const usefulTimes = [];
  const fullTimes = [];
  const loadingTextSeen = [];
  const jobKinds = [];

  for (let run = 1; run <= runs; run += 1) {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await waitCatalog();
    await page.waitForTimeout(300);

    const before = restLog.length;
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

    await page.locator(".content-block p").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const fullMs = Date.now() - started;
    fullTimes.push(fullMs);

    const restThis = restLog.slice(before);
    jobKinds.push(...restThis.filter((r) => r.path === "jobs").map((r) => r.kind));
    console.log(
      `${label} run ${run}: useful=${usefulMs}ms full=${fullMs}ms loadingText=${loadingTextSeen.at(-1)} rest=[${formatRest(restThis) || "nenhum"}]`,
    );
  }

  return { usefulTimes, fullTimes, loadingTextSeen, jobKinds };
}

console.log(`BASE_URL=${baseUrl} runs=${runs}`);
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
console.log(summarize("anon cold full (content p)", anonDirect.fullTimes));
console.log(`anon cold "Carregando vaga…": ${anonDirect.loadingTextSeen.filter(Boolean).length}/${anonDirect.loadingTextSeen.length}`);
console.log(`anon cold skeleton/aria-busy: ${anonDirect.skeletonSeen.filter(Boolean).length}/${anonDirect.skeletonSeen.length}`);
console.log(`anon cold jobs select kinds: full=${countKind(anonDirect.jobKinds, "full")} heavy=${countKind(anonDirect.jobKinds, "heavy")} list=${countKind(anonDirect.jobKinds, "list")}`);
console.log(summarize("anon from-home useful (h1)", anonHome.usefulTimes));
console.log(summarize("anon from-home full (content p)", anonHome.fullTimes));
console.log(`anon from-home "Carregando vaga…": ${anonHome.loadingTextSeen.filter(Boolean).length}/${anonHome.loadingTextSeen.length}`);
console.log(`anon from-home jobs select kinds: full=${countKind(anonHome.jobKinds, "full")} heavy=${countKind(anonHome.jobKinds, "heavy")} list=${countKind(anonHome.jobKinds, "list")}`);
console.log("Meta PERF-04: from-home detail request = heavy (not full); cold miss = full");

await browser.close();
