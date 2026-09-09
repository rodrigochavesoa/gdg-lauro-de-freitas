const { mkdirSync } = require("node:fs");
const { resolve } = require("node:path");

const outDir = resolve("docs/assets/qa-sec-f021");
mkdirSync(outDir, { recursive: true });
const baseUrl = "http://127.0.0.1:5173";

async function setTheme(label) {
  const btn = page.getByRole("button", { name: label });
  if ((await btn.count()) === 0 || !(await btn.first().isVisible())) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible().catch(() => false)) await openMenu.click();
  }
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(300);
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await setTheme("Claro");
await page.screenshot({ path: resolve(outDir, "A-playwriter-login-light-1280x720.png") });

await page.getByRole("button", { name: /Entrar ou criar conta com Google/i }).click();
await page.waitForTimeout(1500);

const account = page.locator("[data-identifier], [data-email]").first();
if (await account.isVisible({ timeout: 8_000 }).catch(() => false)) {
  await account.click();
  await page.waitForTimeout(800);
}

for (const name of ["Continue", "Continuar", "Allow", "Permitir", "Next", "Avançar"]) {
  const b = page.getByRole("button", { name, exact: true });
  if (await b.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await b.click();
    await page.waitForTimeout(600);
  }
}

await page
  .waitForURL((u) => /127\.0\.0\.1:5173|localhost:5173/.test(u.host), { timeout: 90_000 })
  .catch(() => {});

const finalHost = hostOf(page.url());
let pathName = "";
try {
  pathName = new URL(page.url()).pathname;
} catch {
  pathName = "";
}

await page.waitForTimeout(800);
await page.screenshot({ path: resolve(outDir, "A-callback-final-light-1280x720.png") });

let sessionActive = false;
if (/127\.0\.0\.1:5173|localhost:5173/.test(finalHost)) {
  sessionActive = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    return keys.some((k) => /supabase|sb-/i.test(k) && (localStorage.getItem(k) || "").length > 20);
  });
  const sair = page.getByRole("button", { name: /Sair/i });
  const avatar = page.locator(".avatar").first();
  sessionActive = sessionActive || (await sair.isVisible().catch(() => false)) || (await avatar.isVisible().catch(() => false));
  await setTheme("Escuro");
  await page.screenshot({ path: resolve(outDir, "A-callback-final-dark-1280x720.png") });
}

console.log(JSON.stringify({
  finalHost,
  pathName,
  sessionActive,
}));
