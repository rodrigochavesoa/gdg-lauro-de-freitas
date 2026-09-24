/**
 * Mede salto vertical ao alternar prioridade na curadoria (UX-ADMIN-VAGAS-LIST-PARITY).
 * Evidência: docs-local/assets/ux-curation-priority-layout-shift.json
 *
 *   pnpm dev
 *   pnpm exec node scripts/measure-curation-priority-layout.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

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

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = env.BASE_URL || "http://127.0.0.1:5173";
const { email, password } = loadAdminUser();
const outDir = resolve(process.cwd(), "docs-local/assets");
const outFile = resolve(outDir, "ux-curation-priority-layout-shift.json");

if (!email || !password) {
  console.error("Defina credenciais admin (docs-local/admin-test-user.md ou ADMIN_EMAIL/PASSWORD).");
  process.exit(1);
}

async function box(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 20000 });
  return el.boundingBox();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/admin/, { timeout: 30000 });

  await page.goto(`${baseUrl}/admin/curadoria`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pessoa Dev|\(fila\)/ }).first().click();
  await page.getByRole("heading", { name: "Prioridade (admin)" }).waitFor();

  const queueRow = ".curation-workspace__queue-item:first-child .curation-workspace__select";
  const feedback = ".curation-priority-feedback__slot";
  const detail = ".curation-workspace__detail";

  const before = {
    queue: await box(page, queueRow),
    feedback: await box(page, feedback),
    detail: await box(page, detail),
  };

  await page.getByLabel("Motivo interno para urgente").fill("layout shift check");
  await page.getByRole("button", { name: "Urgente", exact: true }).click();
  await page.getByText("Prioridade urgente registrada.").waitFor({ timeout: 15000 });

  const urgent = {
    queue: await box(page, queueRow),
    feedback: await box(page, feedback),
    detail: await box(page, detail),
  };

  await page.getByRole("button", { name: "Normal", exact: true }).click();
  await page.getByText("Prioridade definida como normal.").waitFor({ timeout: 15000 });

  const normal = {
    queue: await box(page, queueRow),
    feedback: await box(page, feedback),
    detail: await box(page, detail),
  };

  const delta = (a, b) => (a && b ? Math.abs(a.y - b.y) : null);

  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    thresholdsPx: { queueRowY: 2, feedbackY: 2, detailY: 4 },
    deltas: {
      queueRowY_urgent: delta(before.queue, urgent.queue),
      queueRowY_normal: delta(urgent.queue, normal.queue),
      feedbackY_urgent: delta(before.feedback, urgent.feedback),
      feedbackY_normal: delta(urgent.feedback, normal.feedback),
      detailY_urgent: delta(before.detail, urgent.detail),
      detailY_normal: delta(urgent.detail, normal.detail),
    },
    pass:
      delta(before.queue, urgent.queue) <= 2 &&
      delta(urgent.queue, normal.queue) <= 2 &&
      delta(before.feedback, urgent.feedback) <= 2 &&
      delta(urgent.feedback, normal.feedback) <= 2 &&
      delta(before.detail, urgent.detail) <= 4 &&
      delta(urgent.detail, normal.detail) <= 4,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await browser.close();
}
