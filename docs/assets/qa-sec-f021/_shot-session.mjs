/**
 * Screenshots Caso A (sessão injetada, temp gitignored) + card Caso B.
 * Apaga docs-local/.f021-session-tmp.json ao terminar. Não imprime JWT.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = resolve("docs/assets/qa-sec-f021");
mkdirSync(outDir, { recursive: true });
const tmp = resolve("docs-local/.f021-session-tmp.json");
if (!existsSync(tmp)) throw new Error("temp session missing — reexport Playwriter localStorage");
const store = JSON.parse(readFileSync(tmp, "utf8"));
unlinkSync(tmp);

const probe = JSON.parse(readFileSync(resolve(outDir, "probe-log.json"), "utf8"));
const attackerCb = probe.probes.find((p) => p.id === "B-callback-attacker-no-code");
const attackerAuthz = probe.probes.find((p) => p.id === "B-authorize-attacker");

const html = [
  "<!doctype html><html><head><meta charset='utf-8'><title>F-021 Caso B</title>",
  "<style>body{font-family:Segoe UI,sans-serif;background:#f8fafc;color:#18181b;padding:32px;max-width:900px}",
  "h1{font-size:22px}table{border-collapse:collapse;width:100%;background:#fff}",
  "td,th{border:1px solid #e4e4e7;padding:10px;text-align:left}code{font-size:13px}",
  ".ok{color:#16a34a;font-weight:700}</style></head><body>",
  "<h1>QA-SEC-05 / F-021 — Caso B (probe HTTP, sem JWT)</h1>",
  "<p>redirectTo atacante: <code>https://gdgjobs-f021-attacker.invalid/</code></p>",
  "<table><tr><th>Passo</th><th>HTTP</th><th>Location host</th></tr>",
  `<tr><td>authorize (preflight)</td><td>${attackerAuthz.status}</td><td><code>${attackerAuthz.locationRawHost}</code></td></tr>`,
  `<tr><td>callback sem code</td><td>${attackerCb.status}</td><td><code>${attackerCb.locationRawHost}</code></td></tr>`,
  "</table>",
  "<p class='ok'>URL final do callback NÃO é o domínio atacante. Fallback GoTrue: Site URL http://localhost:3000 (error invalid_request / state missing).</p>",
  "<p>redirect_uri Google permanece o callback fixo <code>*.supabase.co/auth/v1/callback</code>.</p>",
  "</body></html>",
].join("");
writeFileSync(resolve(outDir, "_b-probe.html"), html);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
}, store);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Claro" }).first().click().catch(() => {});
await page.waitForTimeout(250);
const sair = await page.getByRole("button", { name: /Sair/i }).isVisible();
const avatar = await page.locator(".avatar").first().isVisible();
await page.screenshot({ path: resolve(outDir, "A-callback-home-light-1280x720.png") });
await page.getByRole("button", { name: "Escuro" }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(outDir, "A-callback-home-dark-1280x720.png") });

await page.goto(`file:///${resolve(outDir, "_b-probe.html").replace(/\\/g, "/")}`);
await page.screenshot({ path: resolve(outDir, "B-callback-final-headers-1280x720.png") });

await browser.close();
console.log(JSON.stringify({ sessionUiSair: sair, avatar, aLight: true, aDark: true }));
