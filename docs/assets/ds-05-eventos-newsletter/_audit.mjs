/**
 * DS-05 Visual QA — shells /eventos e /newsletter.
 * chrome-devtools-mcp offline nesta sessão; Playwright library (não MCP).
 * Playwriter só se OAuth Google fosse necessário — login staff via /admin.
 * Não imprime senhas.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const preferred = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const fallback = "http://localhost:5173";
const outDir = resolve("docs/assets/ds-05-eventos-newsletter");
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

async function probeBase() {
  for (const url of [preferred, fallback]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) return url.replace(/\/$/, "");
    } catch {
      /* try next */
    }
  }
  throw new Error(`Dev server offline em ${preferred} e ${fallback}. Suba pnpm dev.`);
}

async function setTheme(page, label) {
  const closeFilter = page.locator(".filters.open .close-filter");
  if (await closeFilter.isVisible().catch(() => false)) {
    await closeFilter.click();
    await page.waitForTimeout(150);
  }
  const toggle = page.getByRole("button", { name: label });
  if ((await toggle.count()) === 0 || !(await toggle.first().isVisible())) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible().catch(() => false)) {
      await openMenu.click();
      await page.waitForTimeout(150);
    }
  }
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(250);
  const closeMenu = page.getByRole("button", { name: "Fechar menu" });
  if (await closeMenu.isVisible().catch(() => false)) {
    await closeMenu.click();
    await page.waitForTimeout(150);
  }
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(outDir, name), fullPage: true });
}

async function inspectEventos(page) {
  return page.evaluate(() => {
    const rgb = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    const thumbs = [...document.querySelectorAll(".event-index-card__thumb-wrap")].map((wrap) => {
      const img = wrap.querySelector("img");
      const wr = wrap.getBoundingClientRect();
      return {
        wrapBg: rgb(wrap),
        wrapRatio: wr.height ? +(wr.width / wr.height).toFixed(3) : null,
        imgFit: img ? getComputedStyle(img).objectFit : null,
        src: img?.getAttribute("src") ?? null,
      };
    });
    const desktopNav = document.querySelector(".topbar nav");
    const eventosLink = [...(desktopNav?.querySelectorAll("a") ?? [])].find((a) => a.textContent.trim() === "Eventos");
    const newsletterLink = [...(desktopNav?.querySelectorAll("a") ?? [])].find((a) => a.textContent.trim() === "Newsletter");
    const badges = [...document.querySelectorAll(".event-index-card .featured, .event-index-card .event-status")].map(
      (el) => el.textContent.trim(),
    );
    const filterLabels = [...document.querySelectorAll(".filters .checkline")].map((el) => el.textContent.replace(/\s+/g, " ").trim());
    const path = document.querySelector(".home-divider__curve path")?.getAttribute("d") ?? "";
    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      searchPlaceholder: document.querySelector(".searchbox input")?.getAttribute("placeholder") ?? "",
      hasSearchbox: Boolean(document.querySelector(".searchbox")),
      hasFilters: Boolean(document.querySelector(".filters")),
      filterMobileVisible: (() => {
        const btn = document.querySelector(".filter-mobile");
        if (!btn) return false;
        const cs = getComputedStyle(btn);
        return cs.display !== "none" && cs.visibility !== "hidden";
      })(),
      filterOpen: document.querySelector(".filters")?.classList.contains("open") ?? false,
      filterLabels,
      badges,
      cardCount: document.querySelectorAll(".event-index-card").length,
      empty: Boolean(document.querySelector(".empty")),
      emptyTitle: document.querySelector(".empty h3")?.textContent?.trim() ?? null,
      cta: Boolean(document.querySelector("section.cta")),
      ctaText: document.querySelector("section.cta")?.innerText?.slice(0, 180) ?? null,
      avatar: Boolean(document.querySelector(".home-divider__avatar")),
      dividerPathOk: path.includes("M-8 52 C 180 118"),
      dataTheme: document.documentElement.getAttribute("data-theme"),
      navEventosActive: eventosLink?.classList.contains("active") ?? false,
      navNewsletterActive: newsletterLink?.classList.contains("active") ?? false,
      thumbs,
    };
  });
}

async function inspectLanding(page) {
  return page.evaluate(() => {
    const banner = document.querySelector(".event-banner");
    const back = [...document.querySelectorAll("button.back")].find((el) => /voltar para eventos/i.test(el.textContent));
    const path = document.querySelector(".home-divider__curve path")?.getAttribute("d") ?? "";
    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      back: Boolean(back),
      cta: Boolean(document.querySelector("section.cta")),
      avatar: Boolean(document.querySelector(".home-divider__avatar")),
      dividerPathOk: path.includes("M-8 52 C 180 118"),
      bannerClass: banner?.className ?? null,
      bannerFit: banner ? getComputedStyle(banner).objectFit : null,
      bannerMaxHeight: banner ? getComputedStyle(banner).maxHeight : null,
      dataTheme: document.documentElement.getAttribute("data-theme"),
    };
  });
}

async function inspectNewsletter(page) {
  return page.evaluate(() => {
    const inputs = [...document.querySelectorAll(".newsletter-subscribe input")].map((el) => ({
      name: el.getAttribute("name"),
      disabled: el.disabled,
    }));
    const subscribeCta = document.querySelector(".newsletter-subscribe .primary");
    const issueCtas = [...document.querySelectorAll(".newsletter-issue__cta")].map((el) => {
      const cs = getComputedStyle(el);
      return { text: el.textContent.trim(), bg: cs.backgroundColor, color: cs.color, ariaDisabled: el.getAttribute("aria-disabled") };
    });
    const desktopNav = document.querySelector(".topbar nav");
    const eventosLink = [...(desktopNav?.querySelectorAll("a") ?? [])].find((a) => a.textContent.trim() === "Eventos");
    const newsletterLink = [...(desktopNav?.querySelectorAll("a") ?? [])].find((a) => a.textContent.trim() === "Newsletter");
    const path = document.querySelector(".home-divider__curve path")?.getAttribute("d") ?? "";
    return {
      title: document.querySelector("h1")?.textContent?.trim() ?? "",
      hasSubscribe: Boolean(document.querySelector(".newsletter-subscribe")),
      inputs,
      subscribeCta: subscribeCta
        ? { text: subscribeCta.textContent.trim(), ariaDisabled: subscribeCta.getAttribute("aria-disabled") }
        : null,
      issueCount: document.querySelectorAll(".newsletter-issue").length,
      issueCtas,
      cta: Boolean(document.querySelector("section.cta")),
      ctaText: document.querySelector("section.cta")?.innerText?.slice(0, 180) ?? null,
      avatar: Boolean(document.querySelector(".home-divider__avatar")),
      dividerPathOk: path.includes("M-8 52 C 180 118"),
      dataTheme: document.documentElement.getAttribute("data-theme"),
      navEventosActive: eventosLink?.classList.contains("active") ?? false,
      navNewsletterActive: newsletterLink?.classList.contains("active") ?? false,
    };
  });
}

function isBlackish(cssRgb) {
  const m = String(cssRgb || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return r <= 8 && g <= 8 && b <= 8;
}

async function loginStaff(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator(".admin-tabs").waitFor({ state: "visible", timeout: 30_000 });
}

async function main() {
  const baseUrl = await probeBase();
  const log = {
    baseUrl,
    preferred,
    tool: "playwright-library (chrome-devtools-mcp offline; sem @playwright/mcp)",
    date: "2026-09-09",
    checks: [],
    consoleErrors: [],
    pageErrors: [],
  };

  const browser = await chromium.launch({ headless: true });

  const attach = (page) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") log.consoleErrors.push({ text: msg.text(), url: page.url() });
    });
    page.on("pageerror", (err) => {
      log.pageErrors.push({ text: err.message, url: page.url() });
    });
  };

  const persist = () => {
    const noise = /Failed to load resource|Download the React DevTools/i;
    const filtered = {
      ...log,
      consoleErrors: log.consoleErrors.filter((row) => !noise.test(row.text || "")),
      pageErrors: log.pageErrors.filter((row) => !noise.test(row.text || "")),
    };
    writeFileSync(resolve(outDir, "audit-log.json"), JSON.stringify(filtered, null, 2));
    return filtered;
  };

  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await desktop.newPage();
    attach(page);

    // --- 1. /eventos anônimo light ---
    await page.goto(`${baseUrl}/eventos`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(page, "Claro");
    let snap = await inspectEventos(page);
    await shot(page, "eventos-light.png");
    log.checks.push({
      id: "eventos-anon-light",
      pass:
        snap.title === "Eventos" &&
        snap.hasSearchbox &&
        snap.searchPlaceholder.includes("Evento") &&
        snap.hasFilters &&
        snap.filterLabels.includes("Em breve") &&
        snap.filterLabels.includes("Em andamento") &&
        snap.filterLabels.includes("Encerrado") &&
        snap.badges.includes("Em breve") &&
        snap.cta &&
        !snap.avatar &&
        snap.dividerPathOk &&
        snap.navEventosActive &&
        !snap.navNewsletterActive &&
        snap.thumbs.every((t) => t.imgFit === "contain" && Math.abs((t.wrapRatio || 0) - 16 / 9) < 0.05 && !isBlackish(t.wrapBg)),
      snap,
    });

    // empty state
    await page.locator(".searchbox input").fill("zzz-query-impossivel-ds05");
    await page.getByRole("button", { name: "Buscar eventos" }).click();
    await page.waitForTimeout(200);
    const emptySnap = await inspectEventos(page);
    await shot(page, "eventos-empty-light.png");
    log.checks.push({
      id: "eventos-empty",
      pass: emptySnap.empty && emptySnap.emptyTitle === "Nenhum evento encontrado" && emptySnap.cardCount === 0,
      snap: emptySnap,
    });
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await page.waitForTimeout(200);

    // --- 1b. /eventos anônimo dark ---
    await setTheme(page, "Escuro");
    snap = await inspectEventos(page);
    await shot(page, "eventos-dark.png");
    log.checks.push({
      id: "eventos-anon-dark",
      pass:
        snap.dataTheme === "dark" &&
        snap.cta &&
        !snap.avatar &&
        snap.thumbs.every((t) => t.imgFit === "contain" && !isBlackish(t.wrapBg)),
      snap,
    });

    // card thumbs close-up (first card)
    const firstThumb = page.locator(".event-index-card__thumb-wrap").first();
    if (await firstThumb.count()) {
      await firstThumb.screenshot({ path: resolve(outDir, "eventos-thumb-dark.png") });
    }
    await setTheme(page, "Claro");
    if (await firstThumb.count()) {
      await firstThumb.screenshot({ path: resolve(outDir, "eventos-thumb-light.png") });
    }

    // --- 3. landings ---
    await page.goto(`${baseUrl}/eventos/devfest-lauro-de-freitas-2026`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Voltar para eventos" }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(page, "Claro");
    let land = await inspectLanding(page);
    await shot(page, "eventos-devfest-light.png");
    log.checks.push({
      id: "landing-devfest-light",
      pass: land.back && !land.cta && !land.avatar && land.dividerPathOk && land.bannerFit === "cover",
      snap: land,
    });
    await setTheme(page, "Escuro");
    land = await inspectLanding(page);
    await shot(page, "eventos-devfest-dark.png");
    log.checks.push({
      id: "landing-devfest-dark",
      pass: land.back && !land.cta && !land.avatar && land.dataTheme === "dark",
      snap: land,
    });

    await page.getByRole("button", { name: "Voltar para eventos" }).click();
    await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 10_000 });
    log.checks.push({ id: "voltar-devfest", pass: page.url().includes("/eventos") && !page.url().includes("/devfest") });

    await page.goto(`${baseUrl}/eventos/devopsdays-salvador-2026`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Voltar para eventos" }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(page, "Claro");
    land = await inspectLanding(page);
    await shot(page, "eventos-devopsdays-light.png");
    log.checks.push({
      id: "landing-devopsdays-light",
      pass:
        land.back &&
        !land.cta &&
        !land.avatar &&
        land.dividerPathOk &&
        String(land.bannerClass).includes("event-banner--portrait") &&
        land.bannerFit === "contain",
      snap: land,
    });
    await setTheme(page, "Escuro");
    land = await inspectLanding(page);
    await shot(page, "eventos-devopsdays-dark.png");
    log.checks.push({
      id: "landing-devopsdays-dark",
      pass: land.back && !land.cta && !land.avatar && land.dataTheme === "dark",
      snap: land,
    });

    // --- 4. /newsletter anônimo ---
    await page.goto(`${baseUrl}/newsletter`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "GDG Jobs Letter", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(page, "Claro");
    let news = await inspectNewsletter(page);
    await shot(page, "newsletter-light.png");
    log.checks.push({
      id: "newsletter-anon-light",
      pass:
        news.hasSubscribe &&
        news.inputs.every((i) => i.disabled) &&
        news.subscribeCta?.ariaDisabled === "true" &&
        news.issueCount === 4 &&
        news.issueCtas.every((c) => c.ariaDisabled === "true" && c.text === "Ler edição") &&
        news.cta &&
        !news.avatar &&
        news.dividerPathOk &&
        news.navNewsletterActive &&
        !news.navEventosActive,
      snap: news,
    });
    await setTheme(page, "Escuro");
    news = await inspectNewsletter(page);
    await shot(page, "newsletter-dark.png");
    log.checks.push({
      id: "newsletter-anon-dark",
      pass: news.dataTheme === "dark" && news.cta && !news.avatar && news.inputs.every((i) => i.disabled),
      snap: news,
    });

    await desktop.close();

    // --- 1c. mobile filter ---
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mobile.newPage();
    attach(mpage);
    await mpage.goto(`${baseUrl}/eventos`, { waitUntil: "networkidle" });
    await mpage.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(mpage, "Claro");
    let msnap = await inspectEventos(mpage);
    await shot(mpage, "eventos-mobile-light.png");
    const filterBtn = mpage.getByRole("button", { name: /Filtros/ });
    await filterBtn.click();
    await mpage.waitForTimeout(250);
    const mopen = await inspectEventos(mpage);
    await shot(mpage, "eventos-filter-mobile-light.png");
    log.checks.push({
      id: "eventos-mobile-filter",
      pass: msnap.filterMobileVisible && mopen.filterOpen && mopen.filterLabels.includes("Em breve"),
      snap: { closed: msnap, open: mopen },
    });
    await setTheme(mpage, "Escuro");
    await shot(mpage, "eventos-mobile-dark.png");
    await mobile.close();

    const newsletterMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const nmpage = await newsletterMobile.newPage();
    attach(nmpage);
    await nmpage.goto(`${baseUrl}/newsletter`, { waitUntil: "networkidle" });
    await nmpage.getByRole("heading", { name: "GDG Jobs Letter", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    await setTheme(nmpage, "Claro");
    await shot(nmpage, "newsletter-mobile-light.png");
    await setTheme(nmpage, "Escuro");
    await shot(nmpage, "newsletter-mobile-dark.png");
    await newsletterMobile.close();

    // --- 2 + 5. logado: .cta ausente ---
    const { email, password } = loadAdminUser();
    if (!email || !password) {
      log.checks.push({ id: "logged-cta", pass: false, blocked: "sem credencial staff em docs-local/admin-test-user.md" });
    } else {
      const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const spage = await staffCtx.newPage();
      attach(spage);
      await loginStaff(spage, baseUrl, email, password);
      await setTheme(spage, "Claro");
      await spage.goto(`${baseUrl}/eventos`, { waitUntil: "networkidle" });
      await spage.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
      const loggedEventos = await inspectEventos(spage);
      await shot(spage, "eventos-logged-light.png");
      await setTheme(spage, "Escuro");
      await shot(spage, "eventos-logged-dark.png");
      log.checks.push({
        id: "eventos-logged",
        pass: !loggedEventos.cta && loggedEventos.cardCount >= 1 && loggedEventos.navEventosActive,
        snap: loggedEventos,
      });

      await spage.goto(`${baseUrl}/newsletter`, { waitUntil: "networkidle" });
      await spage.getByRole("heading", { name: "GDG Jobs Letter", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
      await setTheme(spage, "Claro");
      const loggedNews = await inspectNewsletter(spage);
      await shot(spage, "newsletter-logged-light.png");
      await setTheme(spage, "Escuro");
      await shot(spage, "newsletter-logged-dark.png");
      log.checks.push({
        id: "newsletter-logged",
        pass: !loggedNews.cta && loggedNews.navNewsletterActive && loggedNews.issueCount === 4,
        snap: loggedNews,
      });
      await staffCtx.close();
    }
  } finally {
    const out = persist();
    await browser.close();
    const failed = out.checks.filter((c) => c.pass === false);
    console.log(JSON.stringify({ baseUrl: out.baseUrl, pass: failed.length === 0, failed: failed.map((c) => c.id), checks: out.checks.map((c) => ({ id: c.id, pass: c.pass })) }, null, 2));
    if (failed.length) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
