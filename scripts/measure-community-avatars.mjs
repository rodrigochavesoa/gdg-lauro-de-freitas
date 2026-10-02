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
import {
  COMMUNITY_EAGER_AVATAR_CARDS,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_READ_BUDGET_PER_MINUTE,
  estimateListVisitBudget,
  estimatePrefetchWaves,
  classifyBudgetRisk,
} from "./lib/community-avatar-budget.mjs";

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

function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(url).split("?")[0];
  }
}

function classifyRequest(url) {
  const path = redactUrl(url);
  if (path.includes("/functions/v1/community-avatar")) return "communityAvatarProxy";
  if (path.includes("/rest/v1/rpc/list_community_profiles")) return "rpcList";
  if (path.includes("/rest/v1/rpc/get_community_feature_status")) return "rpcStatus";
  if (path.includes("/rest/v1/rpc/get_community_profile")) return "rpcDetail";
  if (/\/storage\/v1\/object\//i.test(path) && !path.includes("/functions/v1/community-avatar")) {
    return "storageDirect";
  }
  return null;
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
    throw new Error(`login candidato falhou: ${error?.message || "sem sessão"}`);
  }
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    storageKey: `sb-${projectRef}-auth-token`,
    session: data.session,
  };
}

function createTrafficRecorder() {
  const rows = [];
  return {
    rows,
    onResponse(response) {
      const kind = classifyRequest(response.url());
      if (!kind) return;
      const timing = response.request().timing();
      rows.push({
        kind,
        status: response.status(),
        ms: timing?.responseEnd > 0 ? timing.responseEnd : null,
        at: Date.now(),
      });
    },
    snapshot() {
      const byKind = {};
      for (const row of rows) {
        byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
      }
      const proxyLatencies = rows
        .filter((r) => r.kind === "communityAvatarProxy" && r.status === 200 && Number.isFinite(r.ms))
        .map((r) => r.ms);
      return {
        total: rows.length,
        byKind,
        proxyLatencyMs: {
          count: proxyLatencies.length,
          median: median(proxyLatencies),
          p95: p95(proxyLatencies),
        },
      };
    },
    reset() {
      rows.length = 0;
    },
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const foreignTraffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, foreignTraffic);
const recorder = createTrafficRecorder();
page.on("response", (response) => recorder.onResponse(response));

const sessionPack = await signInCandidateSession();
const probeClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await probeClient.auth.setSession({
  access_token: sessionPack.session.access_token,
  refresh_token: sessionPack.session.refresh_token,
});
const { data: probeList } = await probeClient.rpc("list_community_profiles", { p_limit: 24 });
const homologBackendProbe = {
  publishedProfiles: Array.isArray(probeList) ? probeList.length : null,
  profilesWithAvatarFlag: Array.isArray(probeList)
    ? probeList.filter((row) => row.avatar_available === true).length
    : null,
};

await injectSession(page, sessionPack);
if (foreignError()) {
  console.error(foreignError());
  await browser.close();
  process.exit(1);
}

const scenarios = [];

for (let run = 0; run < runs; run += 1) {
  recorder.reset();
  const coldStart = Date.now();
  await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  const listReadyMs = await waitForCommunityReady(page);
  const avatarSettle = await waitForAvatarsSettled(page);
  const uiCold = await countAvatarUiState(page);
  const trafficCold = recorder.snapshot();

  recorder.reset();
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
  const trafficDetail = recorder.snapshot();

  recorder.reset();
  await page.getByRole("link", { name: /voltar à comunidade/i }).click().catch(async () => {
    await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  });
  await waitForCommunityReady(page);
  const backSettle = await waitForAvatarsSettled(page);
  const uiBack = await countAvatarUiState(page);
  const trafficBack = recorder.snapshot();

  recorder.reset();
  await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  const revisitReadyMs = await waitForCommunityReady(page);
  const revisitSettle = await waitForAvatarsSettled(page);
  const uiRevisit = await countAvatarUiState(page);
  const trafficRevisit = recorder.snapshot();

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

await browser.close();

const lastCold = scenarios.at(-1)?.cold ?? {};
const avatarsWithPhoto = lastCold.ui?.withImg ?? 0;
const cards = lastCold.ui?.cards ?? 0;
const avatarSlots = Math.max(
  avatarsWithPhoto + (lastCold.ui?.loading ?? 0),
  lastCold.traffic?.byKind?.communityAvatarProxy ?? 0,
);
const theoretical = estimateListVisitBudget({
  profilesOnPage: cards || COMMUNITY_PAGE_SIZE,
  withAvatars: avatarSlots || (cards > 0 ? cards : 0),
});
const prefetchWaves = estimatePrefetchWaves(theoretical.avatarProxies);
const coldProxyCount = lastCold.traffic?.byKind?.communityAvatarProxy ?? 0;
const revisitProxyCount = scenarios.at(-1)?.leaveAndReturn?.traffic?.byKind?.communityAvatarProxy ?? 0;

const report = {
  measuredAt: new Date().toISOString(),
  baseUrl,
  supabaseHost: new URL(supabaseUrl).hostname,
  homologBackendProbe,
  runs,
  model: {
    readBudgetPerMinute: COMMUNITY_READ_BUDGET_PER_MINUTE,
    pageSize: 24,
    prefetchConcurrency: 6,
    eagerAvatarCards: COMMUNITY_EAGER_AVATAR_CARDS,
    theoreticalFirstListVisit: theoretical,
    prefetchWaves,
    budgetRiskFirstVisit: classifyBudgetRisk(theoretical.total),
    note:
      "Cada proxy community-avatar conta 1 leitura no orçamento (RPC interna). Prefetch limita paralelismo, não o total.",
  },
  indicators: {
    cardsOnPage: cards,
    avatarsRenderedCold: avatarsWithPhoto,
    avatarProxyRequestsCold: coldProxyCount,
    avatarProxyRequestsAfterLeaveCommunity: revisitProxyCount,
    storageDirectRequests: scenarios.flatMap((s) => [
      s.cold?.traffic?.byKind?.storageDirect ?? 0,
      s.leaveAndReturn?.traffic?.byKind?.storageDirect ?? 0,
    ]).reduce((a, b) => a + b, 0),
    medianAvatarProxyLatencyMs: median(
      scenarios.flatMap((s) =>
        (s.cold?.traffic?.proxyLatencyMs?.median != null ? [s.cold.traffic.proxyLatencyMs.median] : []),
      ),
    ),
    medianListReadyMs: median(scenarios.map((s) => s.cold.listReadyMs)),
    medianAvatarSettleMs: median(scenarios.map((s) => s.cold.avatarSettleMs)),
    medianRevisitAvatarSettleMs: median(scenarios.map((s) => s.leaveAndReturn.avatarSettleMs)),
    shimmerAfterRevisit: scenarios.at(-1)?.leaveAndReturn?.ui?.loading ?? null,
  },
  scenarios,
};

const jsonPath = resolve(outDir, "latest.json");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "UX-COMMUNITY-AVATARS — indicadores",
  `amostras: ${runs} | origem: ${baseUrl} | backend: ${report.supabaseHost}`,
  "",
  "Modelo (1ª visita à lista, pior caso com prefetch de todos os avatares da página):",
  `  RPC status+lista: ${theoretical.listRpc} | proxies avatar: ${theoretical.avatarProxies} | total: ${theoretical.total}/${COMMUNITY_READ_BUDGET_PER_MINUTE} (${classifyBudgetRisk(theoretical.total)})`,
  `  ondas de prefetch (6 workers): ${prefetchWaves.waves}`,
  "",
  "Medido (última corrida):",
  `  cards: ${cards} | <img> na lista: ${avatarsWithPhoto} | shimmer ao voltar de /vagas: ${report.indicators.shimmerAfterRevisit}`,
  `  GET community-avatar (lista fria): ${coldProxyCount} | após sair da Comunidade: ${revisitProxyCount}`,
  `  GET Storage direto (esperado 0 com proxy): ${report.indicators.storageDirectRequests}`,
  `  mediana listReady: ${Math.round(report.indicators.medianListReadyMs ?? 0)} ms | mediana settle avatares: ${Math.round(report.indicators.medianAvatarSettleMs ?? 0)} ms | revisit settle: ${Math.round(report.indicators.medianRevisitAvatarSettleMs ?? 0)} ms`,
  "",
  `JSON: ${jsonPath}`,
];
writeFileSync(resolve(outDir, "measure.log"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
