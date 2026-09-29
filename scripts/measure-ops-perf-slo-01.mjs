/**
 * OPS-PERF-SLO-01 — medição local de homolog. Não entra no CI.
 * Não duplica o Playwright de job-detail, candidaturas ou listas staff: só dispara esses scripts
 * e mede / (portal) e /vagas, que eles não cobrem.
 *
 *   pnpm dev
 *   pnpm qa:ops-perf-slo
 *   pnpm qa:ops-perf-slo -- --check
 *
 * Falha se faltar VITE_SUPABASE_URL, o dev server em BASE_URL, sessão staff ou candidato.
 * Não imprime senha, e-mail nem URL com chave.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homologSupabaseHostnameError, loopbackBaseUrlError } from "./measure-target.mjs";

const OUT_DIR = resolve(process.cwd(), "docs-local/perf/OPS-PERF-SLO-01");

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

function fileHas(path, pattern) {
  return existsSync(path) && pattern.test(readFileSync(path, "utf8"));
}

function assertPrereqs(env, baseUrl) {
  const supabaseError = homologSupabaseHostnameError(env.VITE_SUPABASE_URL || "");
  if (supabaseError) {
    console.error(supabaseError);
    process.exit(1);
  }
  const baseError = loopbackBaseUrlError(baseUrl);
  if (baseError) {
    console.error(baseError);
    process.exit(1);
  }
  const staffFile = resolve(process.cwd(), "docs-local/admin-test-user.md");
  const hasStaff = (env.ADMIN_EMAIL && env.ADMIN_PASSWORD)
    || fileHas(staffFile, /E-mail:\s*\S+/i) && fileHas(staffFile, /Senha:\s*\S+/i);
  if (!hasStaff) {
    console.error("Falta sessão staff: ADMIN_EMAIL/ADMIN_PASSWORD ou docs-local/admin-test-user.md.");
    process.exit(1);
  }
  const candidateFile = resolve(process.cwd(), "docs-local/candidate-test-user.md");
  const hasCandidate = (env.CANDIDATE_TEST_EMAIL || env.CANDIDATE_EMAIL)
    && (env.CANDIDATE_TEST_PASSWORD || env.CANDIDATE_PASSWORD)
    || fileHas(candidateFile, /E-mail:\s*\S+/i) && fileHas(candidateFile, /Senha:\s*\S+/i);
  if (!hasCandidate) {
    console.error("Falta candidato: CANDIDATE_TEST_EMAIL/CANDIDATE_TEST_PASSWORD ou docs-local/candidate-test-user.md.");
    process.exit(1);
  }
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
    console.error("Falta a chave publishable/anon em .env.local.");
    process.exit(1);
  }
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

function parseSummarize(stdout, label) {
  const line = stdout.split(/\r?\n/).find((row) => row.includes(label));
  if (!line) return [];
  const match = line.match(/:\s*([\d,\s]+)\|/);
  if (!match) return [];
  return match[1].split(",").map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
}

async function measureSpaRoute(page, { route, ready, leave, back, runs }) {
  const cold = [];
  const warm = [];
  const coldRest = [];
  const warmRest = [];
  const coldBytes = [];
  const warmBytes = [];

  for (let run = 1; run <= runs; run += 1) {
    const coldBucket = [];
    const onResponse = async (response) => {
      const url = response.url();
      if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
      const path = url.split("?")[0].replace(/^.*\/(?:rest|auth)\/v1\//, "");
      let bytes = Number(response.headers()["content-length"] || 0);
      if (!bytes) {
        try {
          bytes = (await response.body()).byteLength;
        } catch {
          bytes = 0;
        }
      }
      coldBucket.push({ path, bytes, status: response.status() });
    };
    page.on("response", onResponse);
    const started = Date.now();
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await ready();
    cold.push(Date.now() - started);
    await page.waitForTimeout(1200);
    page.removeListener("response", onResponse);
    coldRest.push(coldBucket.map((row) => row.path));
    coldBytes.push(coldBucket.reduce((sum, row) => sum + row.bytes, 0));

    await leave();
    const warmBucket = [];
    const onWarm = async (response) => {
      const url = response.url();
      if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
      const path = url.split("?")[0].replace(/^.*\/(?:rest|auth)\/v1\//, "");
      let bytes = Number(response.headers()["content-length"] || 0);
      if (!bytes) {
        try {
          bytes = (await response.body()).byteLength;
        } catch {
          bytes = 0;
        }
      }
      warmBucket.push({ path, bytes, status: response.status() });
    };
    page.on("response", onWarm);
    const warmStarted = Date.now();
    await back();
    await ready();
    warm.push(Date.now() - warmStarted);
    await page.waitForTimeout(800);
    page.removeListener("response", onWarm);
    warmRest.push(warmBucket.map((row) => row.path));
    warmBytes.push(warmBucket.reduce((sum, row) => sum + row.bytes, 0));
    console.log(`spa ${route} run ${run}: cold=${cold.at(-1)}ms warm=${warm.at(-1)}ms restCold=${coldRest.at(-1).join(",") || "(nenhum)"} restWarm=${warmRest.at(-1).join(",") || "(nenhum)"}`);
  }

  return { cold, warm, coldRest, warmRest, coldBytes, warmBytes };
}

function routeFile(id, phase, runStartedAt, sha, route, usefulMs, restPaths, bytes) {
  writeJson(`${id}-${phase}.json`, {
    story: "OPS-PERF-SLO-01",
    pii: false,
    sha,
    environment: "homolog",
    runStartedAt,
    measuredAt: new Date().toISOString(),
    route,
    phase,
    coldMeans: "cache em memória da aba frio; o contexto do navegador e a sessão podem ser reutilizados",
    usefulMs: summary(usefulMs),
    restPaths,
    payloadBytes: summary(bytes),
  });
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
assertPrereqs(env, baseUrl);
const runs = Math.max(1, Number(env.MEASURE_RUNS || 5));
const checkOnly = process.argv.includes("--check");

try {
  const probe = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
  if (!probe.ok && probe.status >= 500) {
    console.error(`BASE_URL respondeu ${probe.status}. Suba pnpm dev antes de medir.`);
    process.exit(1);
  }
} catch {
  console.error(`Não alcançou BASE_URL (${baseUrl}). Suba pnpm dev em outro terminal.`);
  process.exit(1);
}

console.log(`OPS-PERF-SLO-01 check ok. BASE_URL alcançável. homolog. runs=${runs}. Sem credenciais neste log.`);
if (checkOnly) {
  console.log("Checklist: pnpm qa:staff-lists · pnpm qa:job-detail · pnpm qa:my-applications · portal e /vagas neste script.");
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
const portal = await measureSpaRoute(page, {
  route: `${baseUrl}/`,
  runs,
  ready: () => page.getByRole("heading", { name: /Seu futuro em tech/i }).waitFor({ state: "visible", timeout: 30_000 }),
  leave: async () => {
    await page.getByRole("link", { name: "Eventos" }).first().click();
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  },
  back: () => page.getByRole("link", { name: "Ir para a página inicial" }).click(),
});
const catalog = await measureSpaRoute(page, {
  route: `${baseUrl}/vagas`,
  runs,
  ready: () => page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible", timeout: 30_000 }),
  leave: async () => {
    await page.getByRole("link", { name: "Eventos" }).first().click();
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  },
  back: () => page.getByRole("link", { name: "Vagas", exact: true }).click(),
});
await browser.close();

routeFile("portal", "cold", runStartedAt, sha, "/", portal.cold, portal.coldRest, portal.coldBytes);
routeFile("portal", "warm", runStartedAt, sha, "/", portal.warm, portal.warmRest, portal.warmBytes);
routeFile("catalog", "cold", runStartedAt, sha, "/vagas", catalog.cold, catalog.coldRest, catalog.coldBytes);
routeFile("catalog", "warm", runStartedAt, sha, "/vagas", catalog.warm, catalog.warmRest, catalog.warmBytes);

const childEnv = { MEASURE_RUNS: String(runs), BASE_URL: baseUrl };
console.log("\n=== qa:staff-lists ===");
await runNode("scripts/measure-staff-lists.mjs", childEnv);
console.log("\n=== qa:job-detail ===");
const jobStdout = await runNode("scripts/measure-job-detail.mjs", childEnv);
console.log("\n=== qa:my-applications ===");
await runNode("scripts/measure-my-applications.mjs", childEnv);

const staffPath = resolve(process.cwd(), "docs-local/perf/PERF-STAFF-LISTS-LIMIT-01-network.json");
const staffRaw = JSON.parse(readFileSync(staffPath, "utf8"));
const staffDesktop = (staffRaw.report || []).filter((entry) => entry.viewport === "1280x800" && Array.isArray(entry.calls));
for (const entry of staffDesktop) {
  const id = {
    "/admin": "admin",
    "/admin/curadoria": "admin-curadoria",
    "/admin/vagas": "admin-vagas",
    "/admin/ingestao": "admin-ingestao",
  }[entry.route] || "admin-other";
  const calls = entry.calls.map((call) => ({
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
  writeJson(`${id}-cold.json`, {
    story: "OPS-PERF-SLO-01",
    pii: false,
    sha,
    environment: "homolog",
    runStartedAt,
    measuredAt: new Date().toISOString(),
    route: entry.route,
    phase: "point",
    sampleN: 1,
    percentiles: false,
    usefulMs: entry.ms,
    calls,
    note: id === "admin"
      ? "Observação pontual, sem p50/p95. Confirma a RPC pós-#205. Os percentis da RPC estão no estudo de 20 chamadas (item 3 do gate). usefulMs inclui waitForTimeout(800)."
      : "Observação pontual, sem p50/p95. O script de listas staff não repete a rota. usefulMs inclui waitForTimeout(800).",
  });
}

const coldShell = parseSummarize(jobStdout, "anon cold shell");
const coldFull = parseSummarize(jobStdout, "anon cold full");
const warmUseful = parseSummarize(jobStdout, "anon from-home useful");
const warmFull = parseSummarize(jobStdout, "anon from-home full");
writeJson("jobs-detail-cold.json", {
  story: "OPS-PERF-SLO-01",
  pii: false,
  sha,
  environment: "homolog",
  runStartedAt,
  measuredAt: new Date().toISOString(),
  route: "/jobs/:id",
  phase: "cold",
  coldMeans: "cache em memória da aba frio; o contexto do navegador pode ser reutilizado",
  shellMs: summary(coldShell),
  fullMs: summary(coldFull),
});
writeJson("jobs-detail-warm.json", {
  story: "OPS-PERF-SLO-01",
  pii: false,
  sha,
  environment: "homolog",
  runStartedAt,
  measuredAt: new Date().toISOString(),
  route: "/jobs/:id",
  phase: "warm",
  usefulMs: summary(warmUseful),
  fullMs: summary(warmFull),
  note: "Clique no card em /vagas, com o catálogo já na memória da aba.",
});

const appsPath = resolve(process.cwd(), "docs-local/assets/ux-perf-06/metrics-after.json");
const apps = JSON.parse(readFileSync(appsPath, "utf8"));
writeJson("minhas-candidaturas-cold.json", {
  story: "OPS-PERF-SLO-01",
  pii: false,
  sha,
  environment: "homolog",
  runStartedAt,
  measuredAt: apps.measuredAt || new Date().toISOString(),
  route: "/minhas-candidaturas",
  phase: "cold",
  coldMeans: "cache em memória da aba frio depois de reload; a sessão do candidato permanece",
  usefulMs: summary(apps.t1?.ms || []),
  restPaths: apps.t1?.rest || [],
});
writeJson("minhas-candidaturas-warm.json", {
  story: "OPS-PERF-SLO-01",
  pii: false,
  sha,
  environment: "homolog",
  runStartedAt,
  measuredAt: apps.measuredAt || new Date().toISOString(),
  route: "/minhas-candidaturas",
  phase: "warm",
  usefulMs: summary(apps.t2?.ms || []),
  restPaths: apps.t2?.rest || [],
});

writeJson("run.json", {
  story: "OPS-PERF-SLO-01",
  pii: false,
  sha,
  environment: "homolog",
  runStartedAt,
  runFinishedAt: new Date().toISOString(),
});

console.log(`relatórios em docs-local/perf/OPS-PERF-SLO-01 (pii: false, sha ${sha})`);
