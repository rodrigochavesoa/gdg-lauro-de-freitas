/**
 * OPS-PERF-SLO-01 — medição local de homolog. Não entra no CI.
 * Não duplica o Playwright de job-detail, candidaturas ou listas staff: só dispara esses scripts
 * e mede / (portal) e /vagas, que eles não cobrem.
 *
 *   pnpm dev
 *   pnpm qa:ops-perf-slo
 *   pnpm qa:ops-perf-slo -- --check
 *
 * Falha se faltar VITE_SUPABASE_URL, o dev server em BASE_URL ou sessão staff.
 * /minhas-candidaturas é opcional: só roda quando há candidato de teste.
 * Não imprime senha, e-mail nem URL com chave.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLocalEnv } from "./measure-env.mjs";
import { attachObservers, cacheDelta, drainPromises, expiredReadRows, livePageError, openRequestRow, readLiveProbe, restPathFromUrl, waitForQuiet } from "./measure-observe.mjs";
import { measurePreflightError, measureRuns, sampleCountError, lineStatus, validDetailLatencies } from "./measure-target.mjs";

const OUT_DIR = resolve(process.cwd(), "docs-local/perf/OPS-PERF-SLO-01");

function fileHas(path, pattern) {
  return existsSync(path) && pattern.test(readFileSync(path, "utf8"));
}

function assertPrereqs(env) {
  const staffFile = resolve(process.cwd(), "docs-local/admin-test-user.md");
  const hasStaff = (env.ADMIN_EMAIL && env.ADMIN_PASSWORD)
    || fileHas(staffFile, /E-mail:\s*\S+/i) && fileHas(staffFile, /Senha:\s*\S+/i);
  if (!hasStaff) {
    console.error("Falta sessão staff: ADMIN_EMAIL/ADMIN_PASSWORD ou docs-local/admin-test-user.md.");
    process.exit(1);
  }
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
    console.error("Falta a chave publishable/anon em .env.local.");
    process.exit(1);
  }
}

function hasCandidate(env) {
  const candidateFile = resolve(process.cwd(), "docs-local/candidate-test-user.md");
  const fromEnv = (env.CANDIDATE_TEST_EMAIL || env.CANDIDATE_EMAIL)
    && (env.CANDIDATE_TEST_PASSWORD || env.CANDIDATE_PASSWORD);
  const fromFile = fileHas(candidateFile, /E-mail:\s*\S+/i) && fileHas(candidateFile, /Senha:\s*\S+/i);
  return Boolean(fromEnv || fromFile);
}

function nearestRank(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

function summary(values) {
  return {
    samples: values,
    n: values.length,
    p50: nearestRank(values, 0.5),
    p95: nearestRank(values, 0.95),
  };
}

const LIMIT_MS = {
  "portal-cold": 2000,
  "portal-warm": 250,
  "catalog-cold": 800,
  "catalog-warm": 300,
  "admin-cold": 2000,
  "admin-warm": 800,
  "admin-curadoria-cold": 2000,
  "admin-curadoria-warm": 800,
  "admin-vagas-cold": 2000,
  "admin-vagas-warm": 800,
  "admin-ingestao-cold": 2000,
  "admin-ingestao-warm": 800,
};

function mark(label, samples, limitMs, expectedN = samples.length, captureIncomplete = false) {
  const stats = summary(samples);
  const status = lineStatus({
    captureIncomplete,
    validN: stats.n,
    expectedN,
    p95: stats.p95,
    limitMs,
  });
  if (status === "fora do teto") {
    console.log(`${label}: fora do teto (p95 ${stats.p95} ms, limite ${limitMs} ms). O limite permanece.`);
  }
  if (captureIncomplete) {
    console.log(`${label}: captura incompleta. A linha fica hipótese.`);
  }
  return { stats, limitMs, status };
}

function writeJson(name, body) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, name), `${JSON.stringify(body, null, 2)}\n`);
}

function runNode(script, extraEnv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise(out);
      else reject(new Error(`${script} saiu com código ${code}`));
    });
  });
}

async function captureRestCall(response) {
  const url = response.url();
  if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return null;
  const path = url.split("?")[0].replace(/^.*\/(?:rest|auth)\/v1\//, "");
  let bytes = Number(response.headers()["content-length"] || 0);
  if (!bytes) {
    try {
      bytes = (await response.body()).byteLength;
    } catch {
      bytes = null;
    }
  }
  return { path, bytes, status: response.status() };
}

function attachRest(page, bucket) {
  const pending = new Set();
  const inflight = new Set();
  const openReads = new Set();
  const onRequest = (request) => {
    if (restPathFromUrl(request.url())) inflight.add(request);
  };
  const onResponse = (response) => {
    const request = response.request();
    inflight.delete(request);
    const slot = { drop: false, path: restPathFromUrl(response.url()) };
    openReads.add(slot);
    let task;
    task = captureRestCall(response).then((row) => {
      if (slot.drop || !row) return;
      bucket.push(row);
    }).finally(() => {
      openReads.delete(slot);
      pending.delete(task);
    });
    pending.add(task);
  };
  const onFailed = (request) => {
    inflight.delete(request);
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);
  return async () => {
    const quiet = await waitForQuiet(() => inflight.size > 0);
    page.removeListener("request", onRequest);
    page.removeListener("response", onResponse);
    page.removeListener("requestfailed", onFailed);
    const bodyUnsettled = [];
    const drained = await drainPromises(pending, undefined, () => {
      bodyUnsettled.push(...expiredReadRows(openReads, "body"));
    });
    const unsettled = [
      ...[...inflight]
        .map((request) => openRequestRow(restPathFromUrl(request.url())))
        .filter((row) => row.path),
      ...bodyUnsettled,
    ];
    return {
      unsettled,
      incomplete: quiet.timedOut || drained.timedOut || unsettled.length > 0,
    };
  };
}

function httpErrorsOf(calls) {
  return calls.flat().filter((row) => row.status >= 400);
}

async function measureSpaRoute(page, traffic, { route, ready, leave, back, runs }) {
  const cold = [];
  const warm = [];
  const coldRest = [];
  const warmRest = [];
  const coldBytes = [];
  const warmBytes = [];
  const coldCache = [];
  const warmCache = [];
  const coldOps = [];
  const warmOps = [];
  const coldNet = [];
  const warmNet = [];
  const coldUnsettled = [];
  const warmUnsettled = [];
  const coldIncomplete = [];
  const warmIncomplete = [];

  for (let run = 1; run <= runs; run += 1) {
    const coldBucket = [];
    const stopCold = attachRest(page, coldBucket);
    const netBefore = traffic.networkErrors.length;
    const opsBefore = traffic.opsEvents.length;
    const started = Date.now();
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await ready();
    cold.push(Date.now() - started);
    const coldProbe = await readLiveProbe(page);
    if (coldProbe.backendError) throw new Error(coldProbe.backendError);
    await page.waitForTimeout(1200);
    const coldOpen = await stopCold();
    const coldOpsDrain = await traffic.drain();
    coldRest.push(coldBucket.map(({ path, status, bytes }) => ({ path, status, bytes })));
    coldBytes.push(coldBucket.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0));
    coldUnsettled.push([...(coldOpen.unsettled || []), ...(coldOpsDrain.unsettled || [])]);
    coldIncomplete.push(coldOpen.incomplete || coldOpsDrain.timedOut);
    coldCache.push(coldProbe.cache);
    coldOps.push(traffic.opsEvents.slice(opsBefore));
    coldNet.push(traffic.networkErrors.slice(netBefore));

    await leave();
    const warmBefore = await readLiveProbe(page);
    if (warmBefore.backendError) throw new Error(warmBefore.backendError);
    const warmBucket = [];
    const stopWarm = attachRest(page, warmBucket);
    const warmNetBefore = traffic.networkErrors.length;
    const warmOpsBefore = traffic.opsEvents.length;
    const warmStarted = Date.now();
    await back();
    await ready();
    warm.push(Date.now() - warmStarted);
    const warmAfter = await readLiveProbe(page);
    if (warmAfter.backendError) throw new Error(warmAfter.backendError);
    await page.waitForTimeout(800);
    const warmOpen = await stopWarm();
    const warmOpsDrain = await traffic.drain();
    warmRest.push(warmBucket.map(({ path, status, bytes }) => ({ path, status, bytes })));
    warmBytes.push(warmBucket.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0));
    warmUnsettled.push([...(warmOpen.unsettled || []), ...(warmOpsDrain.unsettled || [])]);
    warmIncomplete.push(warmOpen.incomplete || warmOpsDrain.timedOut);
    warmCache.push(cacheDelta(warmBefore.cache, warmAfter.cache));
    warmOps.push(traffic.opsEvents.slice(warmOpsBefore));
    warmNet.push(traffic.networkErrors.slice(warmNetBefore));
    const coldPaths = coldRest.at(-1).map((row) => `${row.path}:${row.status}`).join(",") || "(nenhum)";
    const warmPaths = warmRest.at(-1).map((row) => `${row.path}:${row.status}`).join(",") || "(nenhum)";
    console.log(`spa ${route} run ${run}: cold=${cold.at(-1)}ms warm=${warm.at(-1)}ms restCold=${coldPaths} restWarm=${warmPaths}`);
  }

  return {
    cold, warm, coldRest, warmRest, coldBytes, warmBytes, coldCache, warmCache, coldOps, warmOps, coldNet, warmNet,
    coldUnsettled, warmUnsettled, coldIncomplete, warmIncomplete,
  };
}

function storyRecord(runStartedAt, sha, fields) {
  return {
    story: "OPS-PERF-SLO-01",
    pii: false,
    sha,
    environment: "homolog",
    runStartedAt,
    measuredAt: new Date().toISOString(),
    ...fields,
  };
}

function routeFile(id, phase, runStartedAt, sha, route, usefulMs, extra) {
  const captureIncomplete = (extra.captureIncomplete || []).some(Boolean);
  const marked = mark(`${route} ${phase}`, usefulMs, LIMIT_MS[`${id}-${phase}`], usefulMs.length, captureIncomplete);
  writeJson(`${id}-${phase}.json`, storyRecord(runStartedAt, sha, {
    route,
    phase,
    captureIncomplete,
    coldMeans: "cache em memória da aba frio; o contexto do navegador e a sessão podem ser reutilizados",
    usefulMs: marked.stats,
    limitMs: marked.limitMs,
    status: marked.status,
    restCalls: extra.restCalls,
    httpErrors: httpErrorsOf(extra.restCalls),
    networkErrors: extra.networkErrors,
    unsettled: extra.unsettled || [],
    cache: extra.cache,
    opsEvents: extra.opsEvents,
    payloadBytes: summary(extra.bytes),
  }));
}

function requireSamples(values, expected, label) {
  const error = sampleCountError(values, expected, label);
  if (error) {
    console.error(error);
    process.exit(1);
  }
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
assertPrereqs(env);
const checkOnly = process.argv.includes("--check");

try {
  const probe = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
  if (!probe.ok && probe.status >= 500) {
    console.error(`BASE_URL respondeu ${probe.status}. Suba pnpm dev antes de medir.`);
    process.exit(1);
  }
} catch {
  console.error("Não alcançou BASE_URL. Suba pnpm dev em outro terminal.");
  process.exit(1);
}

const applicationsOptional = hasCandidate(env);
console.log(`OPS-PERF-SLO-01 check ok. BASE_URL alcançável. homolog. runs=${runs}. Sem credenciais neste log.`);
console.log(applicationsOptional
  ? "Candidaturas: candidato presente; a rota opcional entra nesta rodada."
  : "Candidaturas: omitidas. A rota é opcional e não há candidato de teste.");
if (checkOnly) {
  console.log("Checklist: pnpm qa:staff-lists · pnpm qa:job-detail · portal e /vagas neste script. qa:my-applications só com candidato.");
  process.exit(0);
}

const sha = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
const runStartedAt = new Date().toISOString();

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm exec playwright install chromium");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const traffic = { foreign: [], networkErrors: [], opsEvents: [] };
const foreignError = attachObservers(page, traffic);
traffic.drain = foreignError.drain;
await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
const pageError = await livePageError(page, baseUrl);
if (pageError || foreignError()) {
  console.error(pageError || foreignError());
  await browser.close();
  process.exit(1);
}
const portal = await measureSpaRoute(page, traffic, {
  route: `${baseUrl}/`,
  runs,
  ready: () => page.getByRole("heading", { name: /Seu futuro em tech/i }).waitFor({ state: "visible", timeout: 30_000 }),
  leave: async () => {
    await page.getByRole("link", { name: "Eventos" }).first().click();
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  },
  back: () => page.getByRole("link", { name: "Ir para a página inicial" }).click(),
});
const catalog = await measureSpaRoute(page, traffic, {
  route: `${baseUrl}/vagas`,
  runs,
  ready: () => page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible", timeout: 30_000 }),
  leave: async () => {
    await page.getByRole("link", { name: "Eventos" }).first().click();
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  },
  back: () => page.getByRole("link", { name: "Vagas", exact: true }).click(),
});
if (foreignError()) {
  console.error(foreignError());
  await browser.close();
  process.exit(1);
}
await browser.close();

requireSamples(portal.cold, runs, "portal cold");
requireSamples(portal.warm, runs, "portal warm");
requireSamples(catalog.cold, runs, "catálogo cold");
requireSamples(catalog.warm, runs, "catálogo warm");
routeFile("portal", "cold", runStartedAt, sha, "/", portal.cold, {
  restCalls: portal.coldRest, bytes: portal.coldBytes, networkErrors: portal.coldNet, unsettled: portal.coldUnsettled, captureIncomplete: portal.coldIncomplete, cache: portal.coldCache, opsEvents: portal.coldOps,
});
routeFile("portal", "warm", runStartedAt, sha, "/", portal.warm, {
  restCalls: portal.warmRest, bytes: portal.warmBytes, networkErrors: portal.warmNet, unsettled: portal.warmUnsettled, captureIncomplete: portal.warmIncomplete, cache: portal.warmCache, opsEvents: portal.warmOps,
});
routeFile("catalog", "cold", runStartedAt, sha, "/vagas", catalog.cold, {
  restCalls: catalog.coldRest, bytes: catalog.coldBytes, networkErrors: catalog.coldNet, unsettled: catalog.coldUnsettled, captureIncomplete: catalog.coldIncomplete, cache: catalog.coldCache, opsEvents: catalog.coldOps,
});
routeFile("catalog", "warm", runStartedAt, sha, "/vagas", catalog.warm, {
  restCalls: catalog.warmRest, bytes: catalog.warmBytes, networkErrors: catalog.warmNet, unsettled: catalog.warmUnsettled, captureIncomplete: catalog.warmIncomplete, cache: catalog.warmCache, opsEvents: catalog.warmOps,
});

const childEnv = {
  MEASURE_RUNS: String(runs),
  BASE_URL: baseUrl,
  MEASURE_LABEL: "after",
  MEASURE_RUN_ID: runStartedAt,
};
console.log("\n=== qa:staff-lists ===");
await runNode("scripts/measure-staff-lists.mjs", childEnv);
console.log("\n=== qa:job-detail ===");
await runNode("scripts/measure-job-detail.mjs", childEnv);
if (applicationsOptional) {
  console.log("\n=== qa:my-applications ===");
  await runNode("scripts/measure-my-applications.mjs", childEnv);
} else {
  console.log("\n=== qa:my-applications omitido ===");
}

function requireThisRun(record, label) {
  if (record?.runId !== runStartedAt) {
    console.error(`${label} não é desta rodada.`);
    process.exit(1);
  }
}

const staffPath = resolve(process.cwd(), "docs-local/perf/PERF-STAFF-LISTS-LIMIT-01-network.json");
const staffRaw = JSON.parse(readFileSync(staffPath, "utf8"));
requireThisRun(staffRaw, "Lista staff");
const staffIds = {
  "/admin": "admin",
  "/admin/curadoria": "admin-curadoria",
  "/admin/vagas": "admin-vagas",
  "/admin/ingestao": "admin-ingestao",
};
for (const route of Object.keys(staffIds)) {
  const entry = (staffRaw.routes || []).find((row) => row.route === route);
  if (!entry) {
    console.error(`Lista staff sem a rota ${route}.`);
    process.exit(1);
  }
  requireSamples(entry.coldMs, runs, `${route} cold`);
  requireSamples(entry.warmMs, runs, `${route} warm`);
  const id = staffIds[route];
  for (const phase of ["cold", "warm"]) {
    const calls = (entry[`${phase}Calls`] || []).flat().map((call) => ({
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
    }));
    const marked = mark(
      `${route} ${phase}`,
      entry[`${phase}Ms`],
      LIMIT_MS[`${id}-${phase}`],
      entry[`${phase}Ms`].length,
      Boolean(entry[`${phase}CaptureIncomplete`]),
    );
    writeJson(`${id}-${phase}.json`, storyRecord(runStartedAt, sha, {
      route,
      phase,
      coldMeans: "reload do documento; a sessão staff permanece",
      usefulMs: marked.stats,
      limitMs: marked.limitMs,
      status: marked.status,
      calls,
      httpErrors: calls.filter((call) => call.status >= 400),
      networkErrors: entry[`${phase}NetworkErrors`] || [],
      unsettled: entry[`${phase}Unsettled`] || [],
      captureIncomplete: Boolean(entry[`${phase}CaptureIncomplete`]),
      cache: entry[`${phase}Cache`] || [],
      opsEvents: entry[`${phase}Ops`] || [],
      note: "Relógio até o heading. Os 800 ms seguintes só esperam a rede.",
    }));
  }
}

const detailPath = resolve(process.cwd(), "docs-local/perf/UX-PERF-04-detail.json");
if (!existsSync(detailPath)) {
  console.error("measure-job-detail.mjs não gravou docs-local/perf/UX-PERF-04-detail.json.");
  process.exit(1);
}
const detail = JSON.parse(readFileSync(detailPath, "utf8"));
requireThisRun(detail, "Detalhe");
requireSamples(detail.cold?.shellMs, runs, "detalhe cold shell");
requireSamples(detail.cold?.fullSamples, runs, "detalhe cold full");
requireSamples(detail.warm?.usefulMs, runs, "detalhe warm útil");
requireSamples(detail.warm?.fullSamples, runs, "detalhe warm full");
const coldShell = mark("/jobs/:id cold shell", detail.cold.shellMs, 500, detail.cold.shellMs.length, Boolean(detail.cold.captureIncomplete));
const coldFull = mark(
  "/jobs/:id cold full",
  validDetailLatencies(detail.cold.fullSamples),
  1500,
  detail.cold.fullSamples.length,
  Boolean(detail.cold.captureIncomplete),
);
writeJson("jobs-detail-cold.json", storyRecord(runStartedAt, sha, {
  route: "/jobs/:id",
  phase: "cold",
  coldMeans: "cache em memória da aba frio; o contexto do navegador pode ser reutilizado",
  shellMs: coldShell.stats,
  shellLimitMs: coldShell.limitMs,
  shellStatus: coldShell.status,
  fullMs: coldFull.stats,
  fullSamples: detail.cold.fullSamples,
  fullLimitMs: coldFull.limitMs,
  fullStatus: coldFull.status,
  captureIncomplete: Boolean(detail.cold.captureIncomplete),
  restCalls: detail.cold.rest,
  httpErrors: detail.cold.httpErrors,
  networkErrors: detail.cold.networkErrors,
  unsettled: detail.cold.unsettled || [],
  cache: detail.cold.cache,
  opsEvents: detail.cold.opsEvents,
}));
const warmUseful = mark("/jobs/:id warm h1", detail.warm.usefulMs, 250, detail.warm.usefulMs.length, Boolean(detail.warm.captureIncomplete));
const warmFull = mark(
  "/jobs/:id warm full",
  validDetailLatencies(detail.warm.fullSamples),
  1200,
  detail.warm.fullSamples.length,
  Boolean(detail.warm.captureIncomplete),
);
writeJson("jobs-detail-warm.json", storyRecord(runStartedAt, sha, {
  route: "/jobs/:id",
  phase: "warm",
  usefulMs: warmUseful.stats,
  usefulLimitMs: warmUseful.limitMs,
  usefulStatus: warmUseful.status,
  fullMs: warmFull.stats,
  fullSamples: detail.warm.fullSamples,
  fullLimitMs: warmFull.limitMs,
  fullStatus: warmFull.status,
  captureIncomplete: Boolean(detail.warm.captureIncomplete),
  restCalls: detail.warm.rest,
  httpErrors: detail.warm.httpErrors,
  networkErrors: detail.warm.networkErrors,
  unsettled: detail.warm.unsettled || [],
  cache: detail.warm.cache,
  opsEvents: detail.warm.opsEvents,
  note: "Clique no card em /vagas, com o catálogo já na memória da aba.",
}));

if (applicationsOptional) {
  const appsPath = resolve(process.cwd(), "docs-local/assets/ux-perf-06/metrics-after.json");
  const apps = JSON.parse(readFileSync(appsPath, "utf8"));
  requireThisRun(apps, "Candidaturas");
  requireSamples(apps.t1?.ms, runs, "candidaturas cold");
  requireSamples(apps.t2?.ms, runs, "candidaturas warm");
  const appsCold = mark("/minhas-candidaturas cold", apps.t1.ms, 400, apps.t1.ms.length, Boolean(apps.t1.captureIncomplete));
  const appsWarm = mark("/minhas-candidaturas warm", apps.t2.ms, 200, apps.t2.ms.length, Boolean(apps.t2.captureIncomplete));
  writeJson("minhas-candidaturas-cold.json", storyRecord(runStartedAt, sha, {
    route: "/minhas-candidaturas",
    phase: "cold",
    coldMeans: "cache em memória da aba frio depois de reload; a sessão do candidato permanece",
    usefulMs: appsCold.stats,
    limitMs: appsCold.limitMs,
    status: appsCold.status,
    captureIncomplete: Boolean(apps.t1.captureIncomplete),
    restCalls: apps.t1.rest,
    httpErrors: httpErrorsOf(apps.t1.rest || []),
    networkErrors: apps.t1.networkErrors || [],
    unsettled: apps.t1.unsettled || [],
    cache: apps.t1.cache || [],
    opsEvents: apps.t1.opsEvents || [],
  }));
  writeJson("minhas-candidaturas-warm.json", storyRecord(runStartedAt, sha, {
    route: "/minhas-candidaturas",
    phase: "warm",
    usefulMs: appsWarm.stats,
    limitMs: appsWarm.limitMs,
    status: appsWarm.status,
    captureIncomplete: Boolean(apps.t2.captureIncomplete),
    restCalls: apps.t2.rest,
    httpErrors: httpErrorsOf(apps.t2.rest || []),
    networkErrors: apps.t2.networkErrors || [],
    unsettled: apps.t2.unsettled || [],
    cache: apps.t2.cache || [],
    opsEvents: apps.t2.opsEvents || [],
  }));
} else {
  writeJson("minhas-candidaturas.json", storyRecord(runStartedAt, sha, {
    route: "/minhas-candidaturas",
    skipped: true,
    reason: "rota opcional, fora da matriz obrigatória, sem candidato de teste",
  }));
}

writeJson("run.json", storyRecord(runStartedAt, sha, {
  runFinishedAt: new Date().toISOString(),
}));

console.log(`relatórios em docs-local/perf/OPS-PERF-SLO-01 (pii: false, sha ${sha})`);
console.log("exit 0: a bateria terminou. Isso não afirma que todo p95 coube no teto.");
