/**
 * One-shot Visual QA measure for UX-HEADER-01 (anon Header shift).
 * Run via Playwriter -e after session new --browser headless.
 * Not a product feature; evidence helper only.
 */

async function box(page, selector) {
  const el = page.locator(selector).first();
  const count = await el.count();
  if (!count) return null;
  const h = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return {
      x: Math.round(r.x * 100) / 100,
      y: Math.round(r.y * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      right: Math.round(r.right * 100) / 100,
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    };
  });
  return h;
}

async function snapshot(page, label) {
  const theme = await page.locator("html").getAttribute("data-theme");
  const url = page.url();
  const cta = page.locator(".nav-actions a.primary");
  const ctaCount = await cta.count();
  const nav = await box(page, "header.topbar nav");
  const brand = await box(page, "header.topbar .brand");
  const actions = await box(page, "header.topbar .nav-actions");
  const vagas = await box(page, 'header.topbar nav a[href="/"]');
  const admin = await box(page, 'header.topbar nav a[href="/admin"]');
  const toggle = await box(page, "header.topbar .nav-actions .theme-toggle, header.topbar .nav-actions button.hide-mobile");
  return {
    label,
    url,
    theme,
    ctaVisible: ctaCount > 0,
    ctaText: ctaCount ? (await cta.first().innerText()).trim() : null,
    brand,
    nav,
    vagas,
    admin,
    actions,
    toggle,
  };
}

function delta(a, b) {
  if (!a || !b) return null;
  return {
    dx: Math.round((b.x - a.x) * 100) / 100,
    dy: Math.round((b.y - a.y) * 100) / 100,
    dw: Math.round((b.width - a.width) * 100) / 100,
  };
}

const outDir = "docs/assets/ux-header-01";
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("header.topbar .brand");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await page.waitForTimeout(300);

const home = await snapshot(page, "home-anon-light");
await page.screenshot({ path: `${outDir}/F-022-anon-home-light-1280x720.png`, fullPage: false });

await page.locator('header.topbar nav a[href="/admin"]').click();
await page.waitForURL("**/admin**");
await page.waitForSelector("header.topbar .brand");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await page.waitForTimeout(300);

const admin = await snapshot(page, "admin-anon-light");
await page.screenshot({ path: `${outDir}/F-022-anon-admin-light-1280x720.png`, fullPage: false });

await page.locator('header.topbar nav a[href="/"]').click();
await page.waitForURL((u) => new URL(u).pathname === "/");
await page.waitForTimeout(300);
const homeBack = await snapshot(page, "home-back-anon-light");
await page.screenshot({ path: `${outDir}/F-022-anon-home-back-light-1280x720.png`, fullPage: false });

await page.goto("http://localhost:5173/admin", { waitUntil: "domcontentloaded" });
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(200);
const adminDark = await snapshot(page, "admin-anon-dark-geometry");
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(200);
const homeDark = await snapshot(page, "home-anon-dark-geometry");

const report = {
  viewport: { width: 1280, height: 720 },
  tool: "Playwriter headless",
  session: "anon (fresh context)",
  home,
  admin,
  homeBack,
  deltasHomeToAdmin: {
    brand: delta(home.brand, admin.brand),
    nav: delta(home.nav, admin.nav),
    vagas: delta(home.vagas, admin.vagas),
    adminLink: delta(home.admin, admin.admin),
    actions: delta(home.actions, admin.actions),
  },
  deltasAdminToHome: {
    brand: delta(admin.brand, homeBack.brand),
    nav: delta(admin.nav, homeBack.nav),
    vagas: delta(admin.vagas, homeBack.vagas),
    adminLink: delta(admin.admin, homeBack.admin),
    actions: delta(admin.actions, homeBack.actions),
  },
  darkGeometry: {
    homeCta: homeDark.ctaVisible,
    adminCta: adminDark.ctaVisible,
    navDx: delta(homeDark.nav, adminDark.nav),
    actionsDx: delta(homeDark.actions, adminDark.actions),
  },
};

console.log(JSON.stringify(report, null, 2));
