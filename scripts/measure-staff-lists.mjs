/**
 * PERF-STAFF-LISTS-LIMIT-01 — tempo, payload e chamadas de /admin, curadoria, vagas e ingestão.
 * Não imprime senhas. Evidência em docs-local/ (gitignored).
 *
 *   pnpm dev
 *   pnpm qa:staff-lists
 *
 * Lê docs-local/admin-test-user.md ou ADMIN_EMAIL / ADMIN_PASSWORD.
 * BASE_URL default: http://127.0.0.1:5173
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateTotp } from "./totp.mjs";
import { loadLocalEnv } from "./measure-env.mjs";
import { attachObservers, cacheDelta, drainSample, livePageError, openRequestRow, readLiveProbe, requestsOpenedDuring, restPathFromUrl, waitForQuiet } from "./measure-observe.mjs";
import { measurePreflightError, measureRuns, sampleCountError } from "./measure-target.mjs";

function loadAdminUser() {
  const file = resolve(process.cwd(), "docs-local/admin-test-user.md");
  const fromFile = existsSync(file)
    ? {
        email: readFileSync(file, "utf8").match(/E-mail:\s*(\S+)/i)?.[1],
        password: readFileSync(file, "utf8").match(/Senha:\s*(\S+)/i)?.[1],
      }
    : {};
  return {
    email: process.env.ADMIN_EMAIL || fromFile.email,
    password: process.env.ADMIN_PASSWORD || fromFile.password,
  };
}

function summarizeRequest(url) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^.*\/(?:rest|auth)\/v1\//, "");
  const select = parsed.searchParams.get("select");
  return {
    path,
    select,
    count: parsed.searchParams.get("count"),
    hasDescription: Boolean(select && /\bdescription\b/.test(select)),
    hasPayload: Boolean(select && /canonical_payload/.test(select)),
    hasAttempts: Boolean(select && /job_ingestion_attempts/.test(select)),
    hasReviews: Boolean(select && /job_curation_reviews/.test(select)),
    hasModeration: path.includes("jobs_needing_moderation"),
  };
}

function loadAdminTotpSecret(env) {
  const fromEnv = env.ADMIN_TEST_TOTP_SECRET;
  if (fromEnv) return fromEnv.replace(/\s+/g, "");
  const file = resolve(process.cwd(), "docs-local/staff-mfa-totp-secrets.md");
  if (!existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\|\s*admin\s*\|[^|]*\|\s*([^|]+)\|/i);
    if (!match) continue;
    const secret = match[1].trim().replace(/`/g, "").replace(/\s+/g, "");
    if (!secret || /colar|placeholder|^_+$/i.test(secret)) continue;
    return secret;
  }
  return "";
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
const { email, password } = loadAdminUser();
const totpSecret = loadAdminTotpSecret(env);

if (!email || !password) {
  console.error("Defina ADMIN_EMAIL/ADMIN_PASSWORD ou docs-local/admin-test-user.md");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright localmente: pnpm exec playwright install chromium");
  process.exit(1);
}

const outDir = resolve(process.cwd(), "docs-local/assets/perf-staff-lists-limit-01");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const calls = [];
const traffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, traffic);
const startedAt = new Map();
const inflight = new Set();
const pendingCalls = new Set();
let readSample = null;

page.on("request", (request) => {
  const url = request.url();
  if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
  inflight.add(request);
  startedAt.set(request, Date.now());
});

page.on("requestfailed", (request) => {
  inflight.delete(request);
});
page.on("requestfinished", (request) => {
  inflight.delete(request);
});

page.on("response", (response) => {
  const url = response.url();
  if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
  const request = response.request();
  inflight.delete(request);
  const slot = { drop: false, path: restPathFromUrl(url), sample: readSample };
  let task;
  task = (async () => {
    let bytes = Number(response.headers()["content-length"] || 0);
    if (!bytes) {
      try {
        bytes = (await response.body()).byteLength;
      } catch {
        bytes = null;
      }
    }
    if (slot.drop) return;
    const began = startedAt.get(request) ?? Date.now();
    calls.push({
      at: new Date().toISOString(),
      method: request.method(),
      status: response.status(),
      ms: Date.now() - began,
      bytes,
      ...summarizeRequest(url),
    });
  })().finally(() => pendingCalls.delete(task));
  task.sample = slot.sample;
  task.slot = slot;
  pendingCalls.add(task);
});

const routes = [
  { id: "admin", path: "/admin", heading: "Painel", settle: "Curadoria", nav: "Painel" },
  { id: "curadoria", path: "/admin/curadoria", heading: "Fila de revisão", settle: "Pendentes", nav: "Curadoria" },
  { id: "vagas", path: "/admin/vagas", heading: "Gestão de vagas", settle: "Aguardando curadoria", nav: "Vagas" },
  { id: "ingestao", path: "/admin/ingestao", heading: "Ingestão", settle: "Registros", nav: "Ingestão" },
];

const adminNav = () => page.getByRole("navigation", { name: "Seções da área administrativa" });

await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
async function refuseUntrustedPage() {
  const pageError = await livePageError(page, baseUrl);
  const hostError = foreignError();
  if (!pageError && !hostError) return;
  console.error(`${pageError || hostError} Credenciais de teste não foram enviadas.`);
  await browser.close();
  process.exit(1);
}
await refuseUntrustedPage();
const loginHeading = page.getByRole("heading", { name: "Entrar para curadoria ou admin" });
const panelHeading = page.getByRole("heading", { name: "Painel" });
const mfaHeading = page.getByRole("heading", { name: "Confirmar segundo fator" });
await Promise.race([
  loginHeading.waitFor({ state: "visible", timeout: 30_000 }),
  panelHeading.waitFor({ state: "visible", timeout: 30_000 }),
  mfaHeading.waitFor({ state: "visible", timeout: 30_000 }),
]).catch(() => {});

if (await loginHeading.isVisible().catch(() => false)) {
  await refuseUntrustedPage();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const landed = await Promise.race([
  panelHeading.waitFor({ state: "visible", timeout: 30_000 }).then(() => "panel"),
  mfaHeading.waitFor({ state: "visible", timeout: 30_000 }).then(() => "mfa"),
]).catch(() => "timeout");

if (landed === "mfa") {
  await refuseUntrustedPage();
  if (!totpSecret) {
    console.error("O login pediu TOTP e não há ADMIN_TEST_TOTP_SECRET nem chave admin em docs-local/staff-mfa-totp-secrets.md");
    await browser.close();
    process.exit(1);
  }
  await page.getByLabel("Código do autenticador").fill(generateTotp(totpSecret));
  await page.getByRole("button", { name: "Confirmar código" }).click();
  await panelHeading.waitFor({ state: "visible", timeout: 30_000 });
} else if (landed !== "panel") {
  const shot = resolve(outDir, "login-blocker.png");
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const headings = await page.getByRole("heading").allTextContents().catch(() => []);
  console.error(`Não chegou ao painel (${landed}). Headings: ${headings.join(" | ") || "(nenhum)"}`);
  console.error(`screenshot ${shot}`);
  await browser.close();
  process.exit(1);
}
await page.getByText("Carregando indicadores…").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});

function publicCall(call) {
  return {
    method: call.method,
    path: call.path,
    status: call.status,
    ms: call.ms,
    bytes: call.bytes,
    hasDescription: Boolean(call.hasDescription),
    hasPayload: Boolean(call.hasPayload),
    hasAttempts: Boolean(call.hasAttempts),
    hasReviews: Boolean(call.hasReviews),
    hasModeration: Boolean(call.hasModeration),
  };
}

async function timeStaffRoute(route, phase) {
  const samples = [];
  const callRuns = [];
  const cacheRuns = [];
  const opsRuns = [];
  const errorRuns = [];
  const unsettledRuns = [];
  let captureIncomplete = false;
  for (let run = 1; run <= runs; run += 1) {
    if (phase === "warm") {
      const away = route.nav === "Painel" ? "Curadoria" : "Painel";
      const awayHeading = away === "Painel" ? "Painel" : "Fila de revisão";
      await adminNav().getByRole("link", { name: away, exact: true }).click();
      await page.getByRole("heading", { name: awayHeading }).waitFor({ state: "visible", timeout: 30_000 });
    }
    const beforeCalls = calls.length;
    const beforeOps = traffic.opsEvents.length;
    const beforeErrors = traffic.networkErrors.length;
    let cacheBefore = null;
    if (phase === "warm") {
      const beforeProbe = await readLiveProbe(page);
      if (beforeProbe.backendError) {
        console.error(beforeProbe.backendError);
        await browser.close();
        process.exit(1);
      }
      cacheBefore = beforeProbe.cache;
    }
    readSample = foreignError.beginSample();
    const inflightBefore = new Set(inflight);
    const started = Date.now();
    if (phase === "cold") {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
    } else {
      await adminNav().getByRole("link", { name: route.nav, exact: true }).click();
    }
    await page.getByRole("heading", { name: route.heading }).waitFor({ state: "visible", timeout: 30_000 });
    samples.push(Date.now() - started);
    await page.getByText(route.settle).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const quiet = await waitForQuiet(() => requestsOpenedDuring(inflight, inflightBefore).length > 0);
    const bodyDrain = await drainSample(pendingCalls, readSample, undefined, "body");
    const opsDrain = await foreignError.drain();
    const responseRows = requestsOpenedDuring(inflight, inflightBefore)
      .map((request) => openRequestRow(restPathFromUrl(request.url())))
      .filter((row) => row.path);
    if (quiet.timedOut || bodyDrain.timedOut || opsDrain.timedOut || responseRows.length > 0) {
      captureIncomplete = true;
    }
    const cacheAfter = await readLiveProbe(page);
    if (cacheAfter.backendError) {
      console.error(cacheAfter.backendError);
      await browser.close();
      process.exit(1);
    }
    callRuns.push(calls.slice(beforeCalls).map(publicCall));
    cacheRuns.push(phase === "cold" ? cacheAfter.cache : cacheDelta(cacheBefore, cacheAfter.cache));
    opsRuns.push(traffic.opsEvents.slice(beforeOps));
    errorRuns.push(traffic.networkErrors.slice(beforeErrors));
    unsettledRuns.push([
      ...responseRows,
      ...(bodyDrain.unsettled || []),
      ...(opsDrain.unsettled || []),
    ]);
    console.log(`${route.path} ${phase} run ${run}: ${samples.at(-1)}ms`);
  }
  return { samples, callRuns, cacheRuns, opsRuns, errorRuns, unsettledRuns, captureIncomplete };
}

const routesOut = [];
for (const route of routes) {
  const cold = await timeStaffRoute(route, "cold");
  const warm = await timeStaffRoute(route, "warm");
  for (const [label, values] of [[`${route.path} cold`, cold.samples], [`${route.path} warm`, warm.samples]]) {
    const countError = sampleCountError(values, runs, label);
    if (countError) {
      console.error(countError);
      await browser.close();
      process.exit(1);
    }
  }
  const shot = resolve(outDir, `desktop-${route.id}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  routesOut.push({
    route: route.path,
    coldMs: cold.samples,
    warmMs: warm.samples,
    coldCalls: cold.callRuns,
    warmCalls: warm.callRuns,
    coldCache: cold.cacheRuns,
    warmCache: warm.cacheRuns,
    coldOps: cold.opsRuns,
    warmOps: warm.opsRuns,
    coldNetworkErrors: cold.errorRuns,
    warmNetworkErrors: warm.errorRuns,
    coldUnsettled: cold.unsettledRuns,
    warmUnsettled: warm.unsettledRuns,
    coldCaptureIncomplete: cold.captureIncomplete,
    warmCaptureIncomplete: warm.captureIncomplete,
  });
}

if (foreignError()) {
  console.error(foreignError());
  await browser.close();
  process.exit(1);
}
await browser.close();

const jsonPath = resolve(process.cwd(), "docs-local/perf/PERF-STAFF-LISTS-LIMIT-01-network.json");
mkdirSync(resolve(process.cwd(), "docs-local/perf"), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify({ runId, pii: false, generatedAt: new Date().toISOString(), routes: routesOut }, null, 2)}\n`);
console.log(`relatório ${jsonPath}`);
