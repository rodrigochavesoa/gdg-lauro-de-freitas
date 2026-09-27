/**
 * Visual QA — loading UX em /admin/vagas vs painel.
 * Evidência: docs-local/assets/ux-admin-vagas-loading-01/
 *
 *   pnpm dev
 *   node scripts/qa-admin-vagas-loading-state.mjs
 *
 * Credenciais: docs-local/admin-test-user.md ou ADMIN_EMAIL / ADMIN_PASSWORD.
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

const outDir = resolve(process.cwd(), "docs-local/assets/ux-admin-vagas-loading-01");
mkdirSync(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("pnpm exec playwright install chromium");
  process.exit(1);
}

async function staffLogin(page) {
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
    if (!totpSecret) throw new Error("TOTP necessário — configure ADMIN_TEST_TOTP_SECRET");
    await page.getByLabel("Código do autenticador").fill(generateTotp(totpSecret));
    await page.getByRole("button", { name: "Confirmar código" }).click();
    await panelHeading.waitFor({ state: "visible", timeout: 30_000 });
  } else if (landed !== "panel") {
    throw new Error(`Login staff não chegou ao painel (${landed})`);
  }
}

async function countLoadingUi(page) {
  return page.evaluate(() => ({
    vagasListShimmer: document.querySelectorAll(".admin-jobs-list-panel .admin-ingest__loading").length,
    vagasSkeletonCards: document.querySelectorAll(".admin-jobs-list-panel .job-card--skeleton").length,
    vagasDashedSkeletons: document.querySelectorAll(".admin-jobs-list-panel .job-card--skeleton-static").length,
    panelShimmerLines: document.querySelectorAll(".admin-jobs-list-panel .admin-dashboard-skeleton-value").length,
    dashboardShimmerValues: document.querySelectorAll(".admin-dashboard-skeleton-value").length,
    dashboardStatSkeleton: document.querySelectorAll(".admin-dashboard-stat--skeleton").length,
    carregandoVagas: Boolean(document.body.textContent?.includes("Carregando…")),
  }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const report = { generatedAt: new Date().toISOString(), baseUrl, checks: [] };

try {
  await staffLogin(page);

  await page.route("**/rest/v1/**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const dashboardDuring = await countLoadingUi(page);
  const dashShot = resolve(outDir, "mobile-admin-dashboard-loading.png");
  await page.screenshot({ path: dashShot, fullPage: true });
  report.checks.push({
    route: "/admin",
    phase: "loading-delayed-api",
    metrics: dashboardDuring,
    screenshot: dashShot,
  });

  await page.goto(`${baseUrl}/admin/vagas`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Gestão de vagas" }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".admin-jobs-list-panel .admin-ingest__loading").length >= 1,
    { timeout: 8000 },
  ).catch(() => {});
  const vagasDuring = await countLoadingUi(page);
  const vagasShot = resolve(outDir, "mobile-admin-vagas-loading.png");
  await page.screenshot({ path: vagasShot, fullPage: true });
  report.checks.push({
    route: "/admin/vagas",
    phase: "loading-delayed-api",
    metrics: vagasDuring,
    screenshot: vagasShot,
  });

  report.confirmed =
    vagasDuring.vagasListShimmer >= 1 &&
    vagasDuring.panelShimmerLines >= 3 &&
    vagasDuring.vagasSkeletonCards === 0 &&
    vagasDuring.vagasDashedSkeletons === 0;
} catch (err) {
  report.error = err.message;
  report.confirmed = false;
  await page.screenshot({ path: resolve(outDir, "error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const jsonPath = resolve(outDir, "audit-log.json");
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ confirmed: report.confirmed, jsonPath, checks: report.checks?.map((c) => ({ route: c.route, metrics: c.metrics })) }, null, 2));
process.exit(report.confirmed ? 0 : 1);
