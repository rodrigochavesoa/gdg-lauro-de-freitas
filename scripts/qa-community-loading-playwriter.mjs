/**
 * Evidência loading /comunidade — desktop vs mobile (Playwright local).
 *   pnpm dev   # terminal 1
 *   node scripts/qa-community-loading-playwriter.mjs
 *
 * Playwriter CLI (mesmo fluxo, sessão headless):
 *   playwriter session new --browser headless
 *   playwriter -s 1 --timeout 180000 -f scripts/qa-community-loading-playwriter.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

function loadCandidateUser() {
  const file = resolve(process.cwd(), "docs-local/candidate-test-user.md");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  return {
    email: process.env.CANDIDATE_TEST_EMAIL || process.env.CANDIDATE_EMAIL || text.match(/E-mail:\s*(\S+)/i)?.[1],
    password: process.env.CANDIDATE_TEST_PASSWORD || process.env.CANDIDATE_PASSWORD || text.match(/Senha:\s*(\S+)/i)?.[1],
  };
}

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const { email, password } = loadCandidateUser();
const outDir = resolve(process.cwd(), "docs-local/assets/ux-community-loading-01");
mkdirSync(outDir, { recursive: true });
const listDelayMs = Number(process.env.COMMUNITY_LIST_DELAY_MS || 3500);

async function captureLoadingState(page, viewport, label) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const loginHeading = page.getByRole("heading", { name: /entrar/i });
  if (await loginHeading.isVisible().catch(() => false)) {
    await page.getByLabel(/e-mail/i).fill(email);
    await page.getByLabel(/senha/i).fill(password);
    await page.getByRole("button", { name: /entrar/i }).click();
  }
  await page.waitForURL(/\/(vagas|comunidade|onboarding)?/, { timeout: 45_000 }).catch(() => {});

  await page.route("**/rest/v1/rpc/list_community_profiles**", async (route) => {
    await new Promise((r) => setTimeout(r, listDelayMs));
    await route.continue();
  });

  await page.goto(`${baseUrl}/comunidade`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Comunidade" }).waitFor({ state: "visible", timeout: 30_000 });
  await page
    .getByRole("checkbox", { name: /quero compartilhar meu perfil/i })
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => {});

  await page
    .waitForFunction(
      () =>
        document.querySelector(".community-results--loading") ||
        document.querySelector(".community-empty") ||
        document.querySelector(".community-people-grid"),
      { timeout: 15_000 },
    )
    .catch(() => {});

  const metrics = await page.evaluate(() => ({
    pageSkeleton: Boolean(document.querySelector(".community-skeleton--page")),
    resultsLoading: Boolean(document.querySelector(".community-results--loading")),
    profileCardSkeletons: document.querySelectorAll(".community-person-card.community-skeleton-card").length,
    shareVisible: Boolean(document.querySelector(".community-share")),
    checkboxVisible: Boolean(document.querySelector(".community-share__toggle input")),
  }));

  const shot = resolve(outDir, `playwriter-${label}-community-loading.png`);
  await page.screenshot({ path: shot, fullPage: true });

  return { label, viewport, metrics, screenshot: shot };
}

const isPlaywriter = typeof globalThis.page !== "undefined" && globalThis.page?.goto;

async function run(browserPage) {
  const desktop = await captureLoadingState(browserPage, { width: 1280, height: 800 }, "desktop");
  const mobile = await captureLoadingState(browserPage, { width: 390, height: 844 }, "mobile");

  const log = {
    tool: isPlaywriter ? "playwriter" : "playwright",
    baseUrl,
    listDelayMs,
    desktop,
    mobile,
    passDesktop:
      !desktop.metrics.pageSkeleton &&
      desktop.metrics.profileCardSkeletons === 0 &&
      (desktop.metrics.resultsLoading || desktop.metrics.shareVisible),
    passMobile: !mobile.metrics.pageSkeleton && mobile.metrics.profileCardSkeletons === 0,
    at: new Date().toISOString(),
  };

  writeFileSync(resolve(outDir, "playwriter-audit-log.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
  return log;
}

if (isPlaywriter) {
  await run(page);
} else {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const browserPage = await context.newPage();
  try {
    await run(browserPage);
  } finally {
    await browser.close();
  }
}
