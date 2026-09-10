/**
 * UX-PERF-02–04 Visual QA — Playwright fallback (chrome-devtools-mcp offline).
 * BASE_URL default http://localhost:5173 (127.0.0.1 often refused on this host).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const jobId = process.env.JOB_ID || "b2b2b2b2-0001-4000-8000-000000000001";
const outDir = resolve("docs/assets/ux-perf-02-04");
mkdirSync(outDir, { recursive: true });

function delayJobs(page, ms) {
  return page.route("**/rest/v1/jobs*", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

function classifyJobsSelect(url) {
  if (!url.includes("/rest/v1/jobs")) return null;
  let select = "";
  try {
    select = decodeURIComponent(new URL(url).searchParams.get("select") || "");
  } catch {
    select = url;
  }
  const hasTitle = /\btitle\b/i.test(select);
  const hasDescription = /\bdescription\b/i.test(select);
  const hasStack = /\bstack\b/i.test(select);
  if (hasDescription && !hasTitle && !hasStack) return "heavy";
  if (hasTitle && hasDescription) return "full";
  if (hasTitle && !hasDescription) return "list";
  return "other";
}

async function snapshotSkeletons(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll(".job-card--skeleton")];
    return els.map((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        isHomeCard: el.matches("article.job-card"),
        isStatic: el.classList.contains("job-card--skeleton-static"),
        animationName: cs.animationName,
        inDetailPage: Boolean(el.closest(".detail-page")),
      };
    });
  });
}

async function pageTextHas(page, re) {
  const text = await page.locator("body").innerText();
  return re.test(text);
}

async function setTheme(page, label) {
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(200);
}

async function main() {
  const log = { baseUrl, jobId, checks: [], consoleErrors: [], rest: [] };
  const browser = await chromium.launch({ headless: true });

  const newPage = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") log.consoleErrors.push(msg.text());
    });
    page.on("request", (req) => {
      const kind = classifyJobsSelect(req.url());
      if (kind) log.rest.push({ kind, url: req.url().slice(0, 180) });
    });
    return { context, page };
  };

  // --- 1. From-home: click card (delay heavy so partial is visible) ---
  {
    const { context, page } = await newPage();
    await page.route("**/rest/v1/jobs*", async (route) => {
      const kind = classifyJobsSelect(route.request().url());
      if (kind === "heavy") await new Promise((r) => setTimeout(r, 900));
      await route.continue();
    });
    await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
    await setTheme(page, "Claro");
    await page.locator(".job-card:not(.job-card--skeleton), .empty").first().waitFor({ timeout: 20_000 });
    const empty = await page.locator(".empty").count();
    if (empty && (await page.locator(".job-card:not(.job-card--skeleton)").count()) === 0) {
      await page.screenshot({ path: resolve(outDir, "home-empty-light-1280x720.png") });
      throw new Error("catálogo vazio — sem card para clicar");
    }
    await page.waitForTimeout(400);
    await page.locator(".job-card:not(.job-card--skeleton)").first().click();
    await page.waitForURL(/\/jobs\//, { timeout: 10_000 });

    const flashLoading = await pageTextHas(page, /Carregando vaga…/);
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    const company = await page.locator(".company-name").first().innerText().catch(() => "");
    const partialBlocks = await page.locator(".detail-skeleton-block").count();
    const ariaBusy = await page.locator("main.detail-page").getAttribute("aria-busy");
    await page.screenshot({ path: resolve(outDir, "from-home-partial-light-1280x720.png") });

    await page.locator(".detail-skeleton-block").first().waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(200);
    const desc = await page.locator(".content-block p").first().innerText().catch(() => "");
    const applyCta = await page.getByRole("button", { name: /Candidatar-se/i }).count();
    const back = await page.getByRole("button", { name: /Voltar para vagas/i }).count();
    const dotted = await page.evaluate(() => {
      const el = document.querySelector(".detail-page");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, image: cs.backgroundImage.slice(0, 80) };
    });
    await page.screenshot({ path: resolve(outDir, "from-home-ready-light-1280x720.png") });

    await page.getByRole("button", { name: /Voltar para vagas/i }).click();
    await page.waitForURL((u) => u.pathname === "/vagas", { timeout: 10_000 });

    log.checks.push({
      id: "from-home-click",
      flashCarregandoVaga: flashLoading,
      h1,
      company,
      partialBlocksAtNav: partialBlocks,
      ariaBusy,
      descriptionAfter: desc.slice(0, 80),
      applyCta,
      back,
      chrome: dotted,
    });
    await context.close();
  }

  // --- 2. Cold goto /jobs/:id (delay jobs to catch JobDetailSkeleton) ---
  {
    const { context, page } = await newPage();
    await delayJobs(page, 800);
    const nav = page.goto(`${baseUrl}/jobs/${jobId}`, { waitUntil: "domcontentloaded" });
    const skeleton = page.locator(".detail-skeleton-copy, .detail-skeleton-sr");
    const sawSkeleton = await skeleton.first().waitFor({ state: "attached", timeout: 8_000 }).then(() => true).catch(() => false);
    const coldFlash = await pageTextHas(page, /Carregando vaga…/);
    const sr = await page.locator(".detail-skeleton-sr").count();
    const skeletonCopy = await page.locator(".detail-skeleton-copy").count();
    const ariaBusyEarly = await page.locator("main.detail-page").getAttribute("aria-busy");
    await page.screenshot({ path: resolve(outDir, "cold-skeleton-light-1280x720.png") });
    await nav.catch(() => {});
    await page.locator(".detail-title h1, h1").first().waitFor({ timeout: 15_000 });
    await page.locator(".detail-skeleton-copy").first().waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
    const coldH1 = await page.locator("h1").first().innerText();
    const coldDesc = await page.locator(".content-block p").first().innerText().catch(() => "");
    await page.screenshot({ path: resolve(outDir, "cold-ready-light-1280x720.png") });
    log.checks.push({
      id: "cold-goto",
      sawSkeleton,
      flashCarregandoVaga: coldFlash,
      skeletonSr: sr,
      skeletonCopy,
      ariaBusyEarly,
      h1: coldH1,
      description: coldDesc.slice(0, 80),
    });
    await context.close();
  }

  // --- 3. /login → Vagas (PERF-05) light ---
  {
    const { context, page } = await newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await setTheme(page, "Claro");
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(outDir, "login-light-1280x720.png") });
    await page.getByRole("link", { name: /^vagas$/i }).click();
    await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 15_000 });
    await page.waitForTimeout(80);
    const skelAtNav = await snapshotSkeletons(page);
    const homeAnimated = skelAtNav.filter((s) => s.isHomeCard && !s.isStatic && s.animationName !== "none");
    await page.locator(".jobs-layout").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(outDir, "login-to-home-light-1280x720.png") });
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    await page.mouse.wheel(0, -300);
    const cards = await page.locator(".job-card:not(.job-card--skeleton)").count();
    log.checks.push({
      id: "login-to-home-light",
      skeletons: skelAtNav,
      homeAnimatedCount: homeAnimated.length,
      cards,
    });

    await setTheme(page, "Escuro");
    await page.screenshot({ path: resolve(outDir, "login-to-home-dark-1280x720.png") });
    const darkTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    log.checks.push({ id: "home-dark", dataTheme: darkTheme });

    // 2nd visit warm
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    await page.getByRole("link", { name: /^vagas$/i }).click();
    await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 15_000 });
    const skelWarm = await snapshotSkeletons(page);
    const homeWarmAnimated = skelWarm.filter((s) => s.isHomeCard);
    await page.screenshot({ path: resolve(outDir, "home-warm-dark-1280x720.png") });
    log.checks.push({
      id: "second-visit-warm",
      homeCardSkeletons: homeWarmAnimated.length,
      skeletons: skelWarm,
    });
    await context.close();
  }

  // --- 4. Detail dark + apply CTA ---
  {
    const { context, page } = await newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await setTheme(page, "Escuro");
    await page.locator(".job-card:not(.job-card--skeleton)").first().waitFor({ timeout: 15_000 });
    await page.locator(".job-card:not(.job-card--skeleton)").first().click();
    await page.waitForURL(/\/jobs\//);
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, "detail-ready-dark-1280x720.png") });
    const apply = await page.getByRole("button", { name: /Candidatar-se/i }).isVisible();
    await page.getByRole("button", { name: /Candidatar-se/i }).click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    log.checks.push({ id: "apply-cta-anon", applyVisible: apply, landed: page.url() });
    await context.close();
  }

  await browser.close();
  writeFileSync(resolve(outDir, "audit-log.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log.checks, null, 2));
  console.log("consoleErrors", log.consoleErrors.slice(0, 8));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
