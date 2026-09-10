/**
 * GOV-VQA-01 — amostragem Playwriter CLI (não MCP).
 * Uso: playwriter -s <id> --timeout 90000 -f docs/assets/gov-vqa-01/_sample.mjs
 */
import { resolve } from "node:path";

const out = resolve("docs/assets/gov-vqa-01");
const base = "http://127.0.0.1:5173";

async function setTheme(label) {
  const toggle = page.getByRole("button", { name: label });
  if ((await toggle.count()) === 0 || !(await toggle.first().isVisible())) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible().catch(() => false)) {
      await openMenu.click();
      await page.waitForTimeout(150);
    }
  }
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(300);
  const closeMenu = page.getByRole("button", { name: "Fechar menu" });
  if (await closeMenu.isVisible().catch(() => false)) {
    await closeMenu.click();
    await page.waitForTimeout(150);
  }
}

async function main() {
  await page.goto(`${base}/eventos`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Eventos", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await setTheme("Claro");
  await page.screenshot({ path: `${out}/eventos-light.png`, fullPage: true, scale: "css" });
  await setTheme("Escuro");
  await page.screenshot({ path: `${out}/eventos-dark.png`, fullPage: true, scale: "css" });

  await page.goto(`${base}/newsletter`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "GDG Jobs Letter", exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page.screenshot({ path: `${out}/newsletter-dark.png`, fullPage: true, scale: "css" });
  await setTheme("Claro");
  await page.screenshot({ path: `${out}/newsletter-light.png`, fullPage: true, scale: "css" });

  const theme = await page.locator("html").getAttribute("data-theme");
  return {
    url: page.url(),
    theme,
    files: ["eventos-light.png", "eventos-dark.png", "newsletter-dark.png", "newsletter-light.png"],
  };
}

await main();
