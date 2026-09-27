/**
 * Playwriter CLI — evidência loading /admin/vagas (sessão headless: playwriter session new --browser headless).
 * playwriter -s 1 --timeout 120000 -f scripts/qa-admin-vagas-loading-playwriter.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateTotp } from "./totp.mjs";

function loadAdminUser() {
  const file = resolve(process.cwd(), "docs-local/admin-test-user.md");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  return {
    email: process.env.ADMIN_EMAIL || text.match(/E-mail:\s*(\S+)/i)?.[1],
    password: process.env.ADMIN_PASSWORD || text.match(/Senha:\s*(\S+)/i)?.[1],
  };
}

function loadTotp() {
  const fromEnv = process.env.ADMIN_TEST_TOTP_SECRET;
  if (fromEnv) return fromEnv.replace(/\s+/g, "");
  const file = resolve(process.cwd(), "docs-local/staff-mfa-totp-secrets.md");
  if (!existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\|\s*admin\s*\|[^|]*\|\s*([^|]+)\|/i);
    if (!match) continue;
    return match[1].trim().replace(/`/g, "").replace(/\s+/g, "");
  }
  return "";
}

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const { email, password } = loadAdminUser();
const totpSecret = loadTotp();
const outDir = resolve(process.cwd(), "docs-local/assets/ux-admin-vagas-loading-01");
mkdirSync(outDir, { recursive: true });

await page.setViewportSize({ width: 390, height: 844 });

await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
const login = page.getByRole("heading", { name: "Entrar para curadoria ou admin" });
const panel = page.getByRole("heading", { name: "Painel" });
const mfa = page.getByRole("heading", { name: "Confirmar segundo fator" });

if (await login.isVisible().catch(() => false)) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}
if (await mfa.isVisible().catch(() => false)) {
  await page.getByLabel("Código do autenticador").fill(generateTotp(totpSecret));
  await page.getByRole("button", { name: "Confirmar código" }).click();
}
await panel.waitFor({ state: "visible", timeout: 45_000 });

await page.route("**/rest/v1/**", async (route) => {
  await new Promise((r) => setTimeout(r, 2500));
  await route.continue();
});

await page.goto(`${baseUrl}/admin/vagas`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Gestão de vagas" }).waitFor({ state: "visible", timeout: 20_000 });
await page
  .waitForFunction(() => document.querySelectorAll(".admin-jobs-skeleton.job-card--skeleton").length >= 1, { timeout: 10_000 })
  .catch(() => {});

const metrics = await page.evaluate(() => ({
  vagasSkeletonCards: document.querySelectorAll(".admin-jobs-skeleton.job-card--skeleton").length,
  dashed: document.querySelectorAll(".job-card--skeleton-static").length,
  carregando: document.body.textContent?.includes("Carregando…"),
}));

const shot = resolve(outDir, "playwriter-mobile-admin-vagas-loading.png");
await page.screenshot({ path: shot, fullPage: true });

const log = {
  tool: "playwriter",
  confirmed: metrics.vagasSkeletonCards >= 4 && metrics.dashed >= 4,
  metrics,
  screenshot: shot,
  at: new Date().toISOString(),
};
writeFileSync(resolve(outDir, "playwriter-audit-log.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log));
