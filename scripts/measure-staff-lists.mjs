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
const baseUrl = env.BASE_URL || "http://127.0.0.1:5173";
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
const startedAt = new Map();

page.on("request", (request) => {
  const url = request.url();
  if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
  startedAt.set(request, Date.now());
});

page.on("response", async (response) => {
  const url = response.url();
  if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return;
  const request = response.request();
  let bytes = Number(response.headers()["content-length"] || 0);
  if (!bytes) {
    try {
      bytes = (await response.body()).length;
    } catch {
      bytes = 0;
    }
  }
  const began = startedAt.get(request) ?? Date.now();
  calls.push({
    at: new Date().toISOString(),
    method: request.method(),
    status: response.status(),
    ms: Date.now() - began,
    bytes,
    ...summarizeRequest(url),
  });
});

const routes = [
  { id: "admin", path: "/admin", heading: "Painel", settle: "Curadoria" },
  { id: "curadoria", path: "/admin/curadoria", heading: "Fila de revisão", settle: "Pendentes" },
  { id: "vagas", path: "/admin/vagas", heading: "Gestão de vagas", settle: "Aguardando curadoria" },
  { id: "ingestao", path: "/admin/ingestao", heading: "Ingestão", settle: "Registros" },
];

await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
const loginHeading = page.getByRole("heading", { name: "Entrar para curadoria ou admin" });
const panelHeading = page.getByRole("heading", { name: "Painel" });
const mfaHeading = page.getByRole("heading", { name: "Confirmar segundo fator" });
await Promise.race([
  loginHeading.waitFor({ state: "visible", timeout: 30_000 }),
  panelHeading.waitFor({ state: "visible", timeout: 30_000 }),
  mfaHeading.waitFor({ state: "visible", timeout: 30_000 }),
]).catch(() => {});

if (await loginHeading.isVisible().catch(() => false)) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const landed = await Promise.race([
  panelHeading.waitFor({ state: "visible", timeout: 30_000 }).then(() => "panel"),
  mfaHeading.waitFor({ state: "visible", timeout: 30_000 }).then(() => "mfa"),
]).catch(() => "timeout");

if (landed === "mfa") {
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

const report = [];

for (const route of routes) {
  const before = calls.length;
  const started = Date.now();
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: route.heading }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText(route.settle).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const shot = resolve(outDir, `desktop-${route.id}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  report.push({
    route: route.path,
    viewport: "1280x800",
    ms: Date.now() - started,
    calls: calls.slice(before),
    screenshot: shot,
  });
}

await page.setViewportSize({ width: 390, height: 844 });
for (const route of routes) {
  await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: route.heading }).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(400);
  const shot = resolve(outDir, `mobile-${route.id}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  report.push({ route: route.path, viewport: "390x844", screenshot: shot });
}

await browser.close();

const jsonPath = resolve(process.cwd(), "docs-local/perf/PERF-STAFF-LISTS-LIMIT-01-network.json");
mkdirSync(resolve(process.cwd(), "docs-local/perf"), { recursive: true });
writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, report }, null, 2));

for (const entry of report) {
  if (!entry.calls) continue;
  const names = entry.calls.map((call) => `${call.method} ${call.path} ${call.bytes}B ${call.ms}ms`).join(" | ");
  console.log(`${entry.route} ${entry.ms}ms (${entry.calls.length}) ${names || "(sem rest/auth)"}`);
}
console.log(`relatório ${jsonPath}`);
