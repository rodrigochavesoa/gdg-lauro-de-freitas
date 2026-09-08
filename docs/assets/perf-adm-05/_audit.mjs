/**
 * PERF-ADM-05 Visual QA — Playwright fallback (chrome-devtools-mcp offline).
 * BASE_URL default http://localhost:5173 (127.0.0.1 recusado neste host).
 * Não imprime senhas.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const outDir = resolve("docs/assets/perf-adm-05");
mkdirSync(outDir, { recursive: true });

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

async function setTheme(page, label) {
  const toggle = page.getByRole("button", { name: label });
  if ((await toggle.count()) === 0 || !(await toggle.first().isVisible())) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible().catch(() => false)) {
      await openMenu.click();
      await page.waitForTimeout(150);
    }
  }
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(200);
  const closeMenu = page.getByRole("button", { name: "Fechar menu" });
  if (await closeMenu.isVisible().catch(() => false)) {
    await closeMenu.click();
    await page.waitForTimeout(150);
  }
}

async function watchGates(page, durationMs = 600) {
  return page.evaluate(async (ms) => {
    const started = performance.now();
    const samples = [];
    const queueNeedle = "Carregando fila de curadoria…";
    const adminNeedle = "Carregando área administrativa…";
    while (performance.now() - started < ms) {
      const text = document.body?.innerText || "";
      samples.push({
        t: Math.round(performance.now() - started),
        queueGate: text.includes(queueNeedle),
        adminGate: text.includes(adminNeedle),
      });
      await new Promise((r) => requestAnimationFrame(r));
    }
    return {
      sampleCount: samples.length,
      queueGateHits: samples.filter((s) => s.queueGate).length,
      adminGateHits: samples.filter((s) => s.adminGate).length,
      firstQueueGateMs: samples.find((s) => s.queueGate)?.t ?? null,
      lastQueueGateMs: [...samples].reverse().find((s) => s.queueGate)?.t ?? null,
      firstAdminGateMs: samples.find((s) => s.adminGate)?.t ?? null,
    };
  }, durationMs);
}

async function snapshotAdmin(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const tabs = [...document.querySelectorAll(".admin-tabs button")].map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      dataTheme: document.documentElement.getAttribute("data-theme"),
      hasAdminTabs: Boolean(document.querySelector(".admin-tabs")),
      hasQueueGate: text.includes("Carregando fila de curadoria…"),
      hasAdminGate: text.includes("Carregando área administrativa…"),
      hasFilaHeading: Boolean([...document.querySelectorAll("h1")].find((h) => h.textContent.includes("Fila de revisão"))),
      hasPendingHeading: Boolean([...document.querySelectorAll("h2")].find((h) => h.textContent.includes("Vagas pending"))),
      hasPublishHeading: Boolean([...document.querySelectorAll("h1")].find((h) => h.textContent.includes("Publicar nova vaga"))),
      pendingCount: [...document.querySelectorAll(".form-section button.ghost")].length,
      emptyQueue: text.includes("Nenhuma vaga pendente nesta fila."),
      tabs,
    };
  });
}

async function loginStaff(page, email, password) {
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator(".admin-tabs").waitFor({ state: "visible", timeout: 30_000 });
}

async function main() {
  const { email, password } = loadAdminUser();
  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL/ADMIN_PASSWORD ou docs-local/admin-test-user.md");
  }

  const log = {
    baseUrl,
    branch: "fix/perf-adm-05-curation-queue-remount",
    checks: [],
    consoleErrors: [],
    rest: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const persist = () => {
    const filteredConsole = log.consoleErrors.filter((row) => {
      const t = row.text || "";
      return !/Failed to load resource/i.test(t);
    });
    writeFileSync(resolve(outDir, "audit-log.json"), JSON.stringify({ ...log, consoleErrors: filteredConsole }, null, 2));
    return filteredConsole;
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") log.consoleErrors.push({ text: msg.text(), url: page.url() });
  });
  page.on("pageerror", (err) => {
    log.consoleErrors.push({ text: err.message, url: page.url(), kind: "pageerror" });
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/rest/v1/")) {
      log.rest.push({ at: Date.now(), path: url.split("?")[0].replace(/^.*\/rest\/v1\//, "") });
    }
  });

  try {
  await loginStaff(page, email, password);
  await setTheme(page, "Claro");

  const bootSnap = await snapshotAdmin(page);
  await page.screenshot({ path: resolve(outDir, "admin-boot-publish-light-1280x720.png") });
  log.checks.push({
    id: "PERF-ADM-03-boot",
    ...bootSnap,
    pass: bootSnap.hasAdminTabs && !bootSnap.hasAdminGate,
  });

  // --- Cold Curadoria (gate aceitável) ---
  const restBeforeCold = log.rest.length;
  const coldStarted = Date.now();
  const coldWatch = watchGates(page, 2500);
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible", timeout: 15_000 });
  const coldGates = await coldWatch;
  await page.getByText("Carregando fila de curadoria…").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  await page.getByRole("heading", { name: "Vagas pending" }).waitFor({ state: "visible", timeout: 30_000 });
  const coldReadyMs = Date.now() - coldStarted;
  await page.waitForTimeout(200);
  const coldSnap = await snapshotAdmin(page);
  await page.screenshot({ path: resolve(outDir, "curation-cold-ready-light-1280x720.png") });
  log.checks.push({
    id: "cold-curation",
    readyMs: coldReadyMs,
    gates: coldGates,
    restPaths: log.rest.slice(restBeforeCold).map((r) => r.path),
    ...coldSnap,
    note: "gate aceitável em cold miss",
  });

  // --- Remount P0: Vagas → Área admin → Curadoria (TTL < 30s) ---
  await page.getByRole("link", { name: "Vagas" }).click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);

  const restBeforeRemount = log.rest.length;
  const remountStarted = Date.now();
  const remountWatch = watchGates(page, 800);
  await page.getByRole("link", { name: "Área admin" }).click();
  await page.locator(".admin-tabs").waitFor({ state: "visible", timeout: 10_000 });
  const tabsMs = Date.now() - remountStarted;
  const adminGateAtTabs = await page.getByText("Carregando área administrativa…").count();
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible", timeout: 10_000 });
  const remountGates = await remountWatch;
  const remountSnapEarly = await snapshotAdmin(page);
  await page.screenshot({ path: resolve(outDir, "curation-remount-immediate-light-1280x720.png") });
  await page.getByRole("heading", { name: "Vagas pending" }).waitFor({ state: "visible", timeout: 10_000 });
  const remountReadyMs = Date.now() - remountStarted;
  const remountSnap = await snapshotAdmin(page);
  log.checks.push({
    id: "QA-ADM-07-remount-P0",
    tabsMs,
    remountReadyMs,
    adminGateAtTabs,
    gates: remountGates,
    early: remountSnapEarly,
    ready: remountSnap,
    restPaths: log.rest.slice(restBeforeRemount).map((r) => r.path),
    pass:
      remountSnapEarly.hasFilaHeading &&
      !remountSnapEarly.hasQueueGate &&
      remountGates.queueGateHits === 0 &&
      adminGateAtTabs === 0 &&
      remountGates.adminGateHits === 0,
  });

  // --- QA-ADM-08: Curadoria ↔ Publicar vaga ---
  const restBeforeTabs = log.rest.length;
  const tabWatch = watchGates(page, 700);
  await page.getByRole("button", { name: "Publicar vaga", exact: true }).click();
  await page.getByRole("heading", { name: "Publicar nova vaga" }).waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: resolve(outDir, "publish-after-tab-light-1280x720.png") });
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible" });
  const tabGates = await tabWatch;
  const tabSnap = await snapshotAdmin(page);
  await page.screenshot({ path: resolve(outDir, "curation-after-tab-switch-light-1280x720.png") });
  log.checks.push({
    id: "QA-ADM-08-tab-switch",
    gates: tabGates,
    ...tabSnap,
    restPaths: log.rest.slice(restBeforeTabs).map((r) => r.path),
    pass: !tabSnap.hasQueueGate && tabGates.queueGateHits === 0 && tabSnap.hasFilaHeading,
  });

  // --- Dark remount spot ---
  await setTheme(page, "Escuro");
  await page.screenshot({ path: resolve(outDir, "curation-dark-1280x720.png") });
  const darkTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.getByRole("link", { name: "Vagas" }).click();
  await page.getByRole("heading", { name: "Vagas em destaque" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  const darkWatch = watchGates(page, 700);
  await page.getByRole("link", { name: "Área admin" }).click();
  await page.locator(".admin-tabs").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await page.getByRole("heading", { name: "Fila de revisão" }).waitFor({ state: "visible" });
  const darkGates = await darkWatch;
  await page.screenshot({ path: resolve(outDir, "curation-remount-dark-1280x720.png") });
  const darkSnap = await snapshotAdmin(page);
  log.checks.push({
    id: "remount-dark",
    dataTheme: darkTheme,
    gates: darkGates,
    ...darkSnap,
    pass: darkTheme === "dark" && darkGates.queueGateHits === 0 && darkSnap.hasFilaHeading,
  });

  // --- Mobile QA-ADM-09 ---
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, "Claro");
  await page.waitForTimeout(200);
  const mobileSnap = await snapshotAdmin(page);
  await page.screenshot({ path: resolve(outDir, "curation-mobile-light-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Publicar vaga", exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(outDir, "publish-mobile-light-390x844.png"), fullPage: true });
  await page.getByRole("button", { name: "Curadoria", exact: true }).click();
  await setTheme(page, "Escuro");
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(outDir, "curation-mobile-dark-390x844.png"), fullPage: true });
  const tabMinH = Math.min(...(mobileSnap.tabs.map((t) => t.h) || [0]));
  log.checks.push({
    id: "QA-ADM-09-mobile",
    ...mobileSnap,
    tabMinH,
    pass: mobileSnap.hasAdminTabs && tabMinH >= 40 && mobileSnap.tabs.length >= 2,
  });

  } finally {
    const filteredConsole = persist();
    await browser.close();
    console.log(JSON.stringify(log.checks, null, 2));
    console.log("consoleErrors", filteredConsole.slice(0, 12));
    console.log(`screenshots → ${outDir}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
