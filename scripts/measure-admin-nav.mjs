/**
 * Mede Vagas → Área admin (staff já logado). Não imprime senhas.
 * Sem networkidle: o relógio começa no clique e os marcos são visibility.
 *
 * Uso local (não entra no CI):
 *   pnpm install
 *   pnpm exec playwright install chromium
 *   pnpm dev   # terminal 1
 *   pnpm qa:admin-nav
 *
 * Lê docs-local/admin-test-user.md ou ADMIN_EMAIL / ADMIN_PASSWORD.
 * BASE_URL default: http://127.0.0.1:5173
 *
 * Achado local (main+#43 + mount tardio da CurationQueue, 2026-09-08):
 *   T1 mediana 84 ms · T2 91 ms · T3 99 ms · spinner 0/5
 *   rest/v1 no remount: companies + jobs (fila de curadoria não dispara)
 *
 * PERF-ADM-05 T3-curation before: mediana 963 ms · gate 5/5
 * PERF-ADM-05 T3-curation after:  mediana 441 ms · gate 0/5
 *   rest: companies, jobs (+ SWR jobs/moderation/reviews em background)
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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(label, values) {
  return `${label}: ${values.join(", ")} | mediana ${Math.round(median(values))}`;
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = env.BASE_URL || "http://127.0.0.1:5173";
const { email, password } = loadAdminUser();

if (!email || !password) {
  console.error("Defina ADMIN_EMAIL/ADMIN_PASSWORD ou docs-local/admin-test-user.md");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright localmente: pnpm add -D playwright && pnpm exec playwright install chromium");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const restLog = [];

page.on("request", (request) => {
  const url = request.url();
  if (url.includes("/rest/v1/")) {
    restLog.push({ at: Date.now(), path: url.split("?")[0].replace(/^.*\/rest\/v1\//, "") });
  }
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("link", { name: "Área admin" }).click();
await page.getByLabel("E-mail").fill(email);
await page.getByLabel("Senha").fill(password);
await page.getByRole("button", { name: "Entrar" }).click();
await page.getByRole("button", { name: "Publicar vaga" }).waitFor({ state: "visible", timeout: 30_000 });

const t1 = [];
const t2 = [];
const t3 = [];
let spinnerHits = 0;

for (let run = 1; run <= 5; run += 1) {
  await page.getByRole("link", { name: "Vagas" }).click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);

  const beforeRest = restLog.length;
  const started = Date.now();
  await page.getByRole("link", { name: "Área admin" }).click();

  await page.locator(".admin-tabs").waitFor({ state: "visible" });
  t1.push(Date.now() - started);

  await page.getByRole("button", { name: "Publicar vaga" }).waitFor({ state: "visible" });
  t2.push(Date.now() - started);

  await page.getByRole("heading", { name: "Publicar nova vaga" }).waitFor({ state: "visible" });
  t3.push(Date.now() - started);

  const spinner = await page.getByText("Carregando área administrativa…").count();
  if (spinner > 0) spinnerHits += 1;

  const restThisNav = restLog.slice(beforeRest).map((row) => row.path);
  console.log(`run ${run} rest/v1: ${restThisNav.join(", ") || "(nenhum)"} (${restThisNav.length})`);
}

console.log(summarize("T1 .admin-tabs", t1));
console.log(summarize("T2 Publicar vaga (tab)", t2));
console.log(summarize("T3 h1 Publicar nova vaga", t3));
console.log(`spinner "Carregando área administrativa…": ${spinnerHits}/5`);

// PERF-ADM-05 — remount Curadoria: /admin → Curadoria → / → /admin → Curadoria
await page.getByRole("button", { name: "Curadoria", exact: true }).click();
await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible", timeout: 30_000 });
await page.getByText("Carregando fila de curadoria…").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
await page.getByRole("heading", { name: "Vagas pending" }).waitFor({ state: "visible", timeout: 30_000 });

const t3Curation = [];
let queueLoadingHits = 0;

for (let run = 1; run <= 5; run += 1) {
  await page.getByRole("link", { name: "Vagas" }).click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);

  const beforeRest = restLog.length;
  const started = Date.now();
  await page.getByRole("link", { name: "Área admin" }).click();
  await page.locator(".admin-tabs").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible" });

  const loadingVisible = await page
    .getByText("Carregando fila de curadoria…")
    .waitFor({ state: "visible", timeout: 250 })
    .then(() => true)
    .catch(() => false);
  if (loadingVisible) queueLoadingHits += 1;

  await page.getByText("Carregando fila de curadoria…").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await page.getByRole("heading", { name: "Vagas pending" }).waitFor({ state: "visible" });
  t3Curation.push(Date.now() - started);

  const restThisNav = restLog.slice(beforeRest).map((row) => row.path);
  console.log(`T3-curation run ${run} loading=${loadingVisible} rest/v1: ${restThisNav.join(", ") || "(nenhum)"} (${restThisNav.length})`);
}

console.log(summarize("T3-curation /admin remount → Fila", t3Curation));
console.log(`gate "Carregando fila de curadoria…": ${queueLoadingHits}/5`);
console.log(`BASE_URL=${baseUrl} (sem credenciais neste log)`);

await browser.close();
