/**
 * UX-COMMUNITY-AVATARS — medição local do proxy de avatares (sem signed URL).
 * Não imprime tokens nem PII. Não entra no CI. Saída em docs-local/assets/ux-community-avatars/.
 *
 * Uso:
 *   pnpm dev   # http://127.0.0.1:5173
 *   pnpm qa:community-avatars
 *
 * Credenciais: docs-local/candidate-test-user.md ou CANDIDATE_TEST_* em .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLocalEnv } from "./measure-env.mjs";
import { attachObservers, livePageError } from "./measure-observe.mjs";
import { documentMayStoreSession, measurePreflightError, measureRuns } from "./measure-target.mjs";
import { createCommunityAvatarRecorder, installAvatarBrowserMetrics } from "./lib/community-avatar-metrics.mjs";

let safeStage = "preflight";
const failSanitized = () => {
  console.error(`Falha na medição (${safeStage}); detalhes técnicos foram omitidos para proteger dados de teste.`);
  process.exit(1);
};
process.on("uncaughtException", failSanitized);
process.on("unhandledRejection", failSanitized);

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
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
const runs = measureRuns(env.MEASURE_RUNS, 3);
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const { email, password } = loadCandidateUser();
const outDir = resolve(process.cwd(), "docs-local/assets/ux-community-avatars");
mkdirSync(outDir, { recursive: true });

if (!email || !password) {
  console.error("Defina credenciais de candidato (docs-local/candidate-test-user.md).");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Defina VITE_SUPABASE_URL e chave publishable/anon em .env.local");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm exec playwright install chromium");
  process.exit(1);
}

async function signInCandidateSession() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error("login de teste não concluído");
  }
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    storageKey: `sb-${projectRef}-auth-token`,
    session: data.session,
  };
}

async function waitForCommunityReady(page, timeout = 45_000) {
  const started = Date.now();
  await Promise.race([
    page.locator(".community-person-card").first().waitFor({ state: "visible", timeout }),
    page.getByRole("heading", { name: /nenhum perfil/i }).waitFor({ state: "visible", timeout }).catch(() => {}),
    page.locator(".community-empty").first().waitFor({ state: "visible", timeout }).catch(() => {}),
  ]).catch(() => {});
  return Date.now() - started;
}

async function countAvatarUiState(page) {
  return page.evaluate(() => ({
    cards: document.querySelectorAll(".community-person-card").length,
    loading: document.querySelectorAll(".community-avatar--loading").length,
    withImg: document.querySelectorAll(".community-person-card .community-avatar[src]").length,
    fallbacks: document.querySelectorAll(".community-person-card .community-avatar--fallback").length,
  }));
}

async function waitForAvatarsSettled(page, maxMs = 20_000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < maxMs) {
    const state = await countAvatarUiState(page);
    last = state;
    if (state.cards === 0 || state.loading === 0) break;
    await page.waitForTimeout(200);
  }
  return { elapsedMs: Date.now() - started, state: last };
}

async function injectSession(page, sessionPack) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const pageError = await livePageError(page, baseUrl);
  if (pageError) throw new Error(pageError);
  const expectedOrigin = new URL(baseUrl).origin;
  const stored = await page.evaluate(({ storageKey, session, expectedOrigin: origin }) => {
    if (location.origin !== origin) return false;
    localStorage.setItem(storageKey, JSON.stringify(session));
    return true;
  }, { ...sessionPack, expectedOrigin });
  if (!stored || !documentMayStoreSession(new URL(page.url()).origin, expectedOrigin)) {
    throw new Error("Sessão de teste não foi injetada na origem de BASE_URL.");
  }
  await page.reload({ waitUntil: "domcontentloaded" });
}

safeStage = "inicialização do navegador";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const foreignTraffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, foreignTraffic);
const recorder = createCommunityAvatarRecorder();
let activePhase = null;
page.addInitScript(installAvatarBrowserMetrics);
page.on("request", (request) => recorder.onRequest(request, activePhase));
page.on("response", (response) => recorder.onResponse(response));
page.on("requestfailed", (request) => recorder.onRequestFailed(request));
async function beginPhase(run, name) {
  activePhase = { run, name };
  await page.evaluate((phase) => {
    sessionStorage.setItem("__gdgAvatarMetricsPhase", JSON.stringify(phase));
    globalThis.__gdgAvatarMetrics?.setPhase?.(phase);
  }, activePhase).catch(() => {});
  // Ensure the next document can attribute object URL and decode events to this phase.
  await page.evaluate((phase) => globalThis.__gdgAvatarMetrics?.setPhase?.(phase), activePhase).catch(() => {});
  return { run, name };
}

async function collectBrowserEvents() {
  try {
    const events = await page.evaluate(() => globalThis.__gdgAvatarMetrics?.takeEvents?.() || []);
    for (const event of events) recorder.recordBrowserEvent(event);
  } catch {
    // Keep capture failures generic and exclude browser-provided details.
  }
}

safeStage = "login";
const sessionPack = await signInCandidateSession();
safeStage = "sessão local";
await injectSession(page, sessionPack);
if (foreignError()) {
  console.error(foreignError());
  await browser.close();
  process.exit(1);
}

const scenarios = [];

safeStage = "medição das rotas";
for (let run = 0; run < runs; run += 1) {
  const coldPhase = await beginPhase(run + 1, "list");
  const coldStart = Date.now();
  await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  const listReadyMs = await waitForCommunityReady(page);
  const avatarSettle = await waitForAvatarsSettled(page);
  const uiCold = await countAvatarUiState(page);
  await collectBrowserEvents();
  const trafficCold = coldPhase;

  const detailPhase = await beginPhase(run + 1, "detail");
  const detailStart = Date.now();
  const firstProfile = page.locator(".community-person-card__cta").first();
  let detailMs = null;
  let detailUi = null;
  if (await firstProfile.isVisible().catch(() => false)) {
    await firstProfile.click();
    await page.locator(".community-profile__identity").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    detailMs = Date.now() - detailStart;
    await waitForAvatarsSettled(page, 15_000);
    detailUi = await countAvatarUiState(page);
  }
  await collectBrowserEvents();
  const trafficDetail = detailPhase;

  const backPhase = await beginPhase(run + 1, "backToList");
  await page.getByRole("link", { name: /voltar à comunidade/i }).click().catch(async () => {
    await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  });
  await waitForCommunityReady(page);
  const backSettle = await waitForAvatarsSettled(page);
  const uiBack = await countAvatarUiState(page);
  await collectBrowserEvents();
  const trafficBack = backPhase;

  const revisitPhase = await beginPhase(run + 1, "leaveAndReturn");
  await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  const revisitReadyMs = await waitForCommunityReady(page);
  const revisitSettle = await waitForAvatarsSettled(page);
  const uiRevisit = await countAvatarUiState(page);
  await collectBrowserEvents();
  const trafficRevisit = revisitPhase;

  scenarios.push({
    run: run + 1,
    cold: {
      wallMs: Date.now() - coldStart,
      listReadyMs,
      avatarSettleMs: avatarSettle.elapsedMs,
      ui: uiCold,
      traffic: trafficCold,
    },
    detail: { detailMs, ui: detailUi, traffic: trafficDetail },
    backToList: { avatarSettleMs: backSettle.elapsedMs, ui: uiBack, traffic: trafficBack },
    leaveAndReturn: {
      listReadyMs: revisitReadyMs,
      avatarSettleMs: revisitSettle.elapsedMs,
      ui: uiRevisit,
      traffic: trafficRevisit,
    },
  });
}

await new Promise((resolve) => setTimeout(resolve, 100));
await collectBrowserEvents();
await browser.close();

for (const scenario of scenarios) {
  scenario.cold.traffic = recorder.snapshot(scenario.cold.traffic);
  scenario.detail.traffic = recorder.snapshot(scenario.detail.traffic);
  scenario.backToList.traffic = recorder.snapshot(scenario.backToList.traffic);
  scenario.leaveAndReturn.traffic = recorder.snapshot(scenario.leaveAndReturn.traffic);
}

const countKind = (traffic, kind) => traffic?.requests?.filter((row) => row.kind === kind).length ?? 0;
const lastCold = scenarios.at(-1)?.cold ?? {};
const avatarsWithPhoto = lastCold.ui?.withImg ?? 0;
const cards = lastCold.ui?.cards ?? 0;
const coldProxyCount = countKind(lastCold.traffic, "avatarGet");
const revisitProxyCount = countKind(scenarios.at(-1)?.leaveAndReturn?.traffic, "avatarGet");

const report = {
  runs,
  indicators: {
    cardsOnPage: cards,
    avatarsRenderedCold: avatarsWithPhoto,
    avatarProxyRequestsCold: coldProxyCount,
    avatarProxyRequestsAfterLeaveCommunity: revisitProxyCount,
    storageDirectRequests: scenarios.flatMap((s) => [s.cold, s.detail, s.backToList, s.leaveAndReturn])
      .flatMap((phase) => phase.traffic.requests)
      .filter((row) => row.kind === "storageDirect").length,
    medianAvatarGetHeadersMs: median(scenarios.flatMap((s) =>
      s.cold.traffic.requests.filter((row) => row.kind === "avatarGet" && row.status === "ok" && row.durationMs != null)
        .map((row) => row.durationMs),
    )),
    medianAvatarBlobConsumeMs: median(scenarios.flatMap((s) =>
      s.cold.traffic.requests.filter((row) => row.kind === "avatarBlobBody" && row.status === "ok" && row.bodyDurationMs != null)
        .map((row) => row.bodyDurationMs),
    )),
    avatarGetBodyBytes: scenarios.flatMap((s) => s.cold.traffic.requests)
      .filter((row) => row.kind === "avatarBlobBody" && row.bodyBytes != null)
      .map((row) => row.bodyBytes),
    medianListReadyMs: median(scenarios.map((s) => s.cold.listReadyMs)),
    medianAvatarSettleMs: median(scenarios.map((s) => s.cold.avatarSettleMs)),
    medianRevisitAvatarSettleMs: median(scenarios.map((s) => s.leaveAndReturn.avatarSettleMs)),
    shimmerAfterRevisit: scenarios.at(-1)?.leaveAndReturn?.ui?.loading ?? null,
  },
  scenarios,
};

safeStage = "gravação do relatório sanitizado";
const jsonPath = resolve(outDir, "latest.json");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "UX-COMMUNITY-AVATARS — indicadores",
  `amostras: ${runs}`,
  `rotas medidas: ${scenarios.length * 4}`,
  `  cards: ${cards} | imagens na lista: ${avatarsWithPhoto} | loading ao voltar: ${report.indicators.shimmerAfterRevisit}`,
  `  GET community-avatar (lista fria): ${coldProxyCount} | após sair da Comunidade: ${revisitProxyCount}`,
  `  GET mediana até headers: ${Math.round(report.indicators.medianAvatarGetHeadersMs ?? 0)} ms | Blob consumido: ${Math.round(report.indicators.medianAvatarBlobConsumeMs ?? 0)} ms | bytes: ${report.indicators.avatarGetBodyBytes.reduce((a, b) => a + b, 0)}`,
  `  mediana lista pronta: ${Math.round(report.indicators.medianListReadyMs ?? 0)} ms | settle imagem: ${Math.round(report.indicators.medianAvatarSettleMs ?? 0)} ms | retorno: ${Math.round(report.indicators.medianRevisitAvatarSettleMs ?? 0)} ms`,
  "",
];
writeFileSync(resolve(outDir, "measure.log"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
