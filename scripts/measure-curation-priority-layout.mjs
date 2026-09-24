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

function deltaY(a, b) {
  if (!a || !b || typeof a.y !== "number" || typeof b.y !== "number") return null;
  return Math.abs(a.y - b.y);
}

function withinThreshold(delta, max) {
  return delta !== null && delta <= max;
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = env.BASE_URL || "http://127.0.0.1:5173";
const { email, password } = loadAdminUser();
const outDir = resolve(process.cwd(), "docs-local/assets");
const outFile = resolve(outDir, "ux-curation-priority-layout-shift.json");

if (!email || !password) {
  console.error("Defina credenciais admin (docs-local/admin-test-user.md ou ADMIN_EMAIL/PASSWORD).");
  process.exitCode = 1;
} else {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    async function box(pageRef, selector) {
      const el = pageRef.locator(selector).first();
      await el.waitFor({ state: "visible", timeout: 20000 });
      return el.boundingBox();
    }

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

    const deltas = {
      queueRowY_urgent: deltaY(before.queue, urgent.queue),
      queueRowY_normal: deltaY(urgent.queue, normal.queue),
      feedbackY_urgent: deltaY(before.feedback, urgent.feedback),
      feedbackY_normal: deltaY(urgent.feedback, normal.feedback),
      detailY_urgent: deltaY(before.detail, urgent.detail),
      detailY_normal: deltaY(urgent.detail, normal.detail),
    };

    const boxesValid = [before, urgent, normal].every(
      (snap) => snap.queue && snap.feedback && snap.detail,
    );

    const report = {
      capturedAt: new Date().toISOString(),
      baseUrl,
      boxesValid,
      thresholdsPx: { queueRowY: 2, feedbackY: 2, detailY: 4 },
      deltas,
      pass:
        boxesValid &&
        withinThreshold(deltas.queueRowY_urgent, 2) &&
        withinThreshold(deltas.queueRowY_normal, 2) &&
        withinThreshold(deltas.feedbackY_urgent, 2) &&
        withinThreshold(deltas.feedbackY_normal, 2) &&
        withinThreshold(deltas.detailY_urgent, 4) &&
        withinThreshold(deltas.detailY_normal, 4),
    };

    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.pass ? 0 : 1;
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
