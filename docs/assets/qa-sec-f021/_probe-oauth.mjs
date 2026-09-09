/**
 * F-021 / QA-SEC-05 — probe OAuth redirect (sem JWT/senha no log).
 * Caso B: redirectTo externo vs origem homolog. Caso A screenshots via Playwright.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = resolve("docs/assets/qa-sec-f021");
mkdirSync(outDir, { recursive: true });

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function redactUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw, "http://placeholder.invalid");
    const params = {};
    for (const [k, v] of u.searchParams.entries()) {
      if (/token|code|state|id_token|access|refresh|jwt/i.test(k)) {
        params[k] = `[redacted len=${v.length}]`;
      } else if (k === "redirect_to" || k === "redirect_uri" || k === "provider" || k === "error" || k === "error_code" || k === "error_description") {
        params[k] = v.slice(0, 180);
      } else {
        params[k] = `[kept-key]`;
      }
    }
    return {
      origin: u.origin,
      pathname: u.pathname,
      params,
      hashPresent: Boolean(u.hash && u.hash.length > 1),
    };
  } catch {
    return { unparsed: String(raw).slice(0, 80) };
  }
}

async function probe(url, { apikey, method = "GET" } = {}) {
  const headers = { Accept: "application/json" };
  if (apikey) {
    headers.apikey = apikey;
    headers.Authorization = `Bearer ${apikey}`;
  }
  const res = await fetch(url, { method, redirect: "manual", headers });
  const location = res.headers.get("location");
  const body = await res.text().catch(() => "");
  return {
    status: res.status,
    location: redactUrl(location),
    locationRawHost: location ? (() => { try { return new URL(location).host; } catch { return "(relative)"; } })() : null,
    contentType: res.headers.get("content-type"),
    bodyPreview: body.replace(/eyJ[A-Za-z0-9_-]{20,}/g, "[jwt]").slice(0, 240),
  };
}

async function setTheme(page, label) {
  const btn = page.getByRole("button", { name: label });
  if ((await btn.count()) === 0 || !(await btn.first().isVisible())) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible().catch(() => false)) await openMenu.click();
  }
  await page.getByRole("button", { name: label }).first().click();
  await page.waitForTimeout(250);
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const supabaseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const apikey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
  const attacker = "https://gdgjobs-f021-attacker.invalid/";
  const legit = `${baseUrl}/`;

  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL ausente em .env.local");

  const log = {
    supabaseHost: new URL(supabaseUrl).host,
    baseUrl,
    attackerHost: "gdgjobs-f021-attacker.invalid",
    probes: [],
    visual: [],
    consoleErrors: [],
  };

  const authz = (redirectTo) =>
    `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  const callback = (redirectTo) =>
    `${supabaseUrl}/auth/v1/callback?redirect_to=${encodeURIComponent(redirectTo)}`;

  log.probes.push({ id: "B-authorize-legit", ...(await probe(authz(legit), { apikey })) });
  log.probes.push({ id: "B-authorize-attacker", ...(await probe(authz(attacker), { apikey })) });
  log.probes.push({ id: "B-callback-legit-no-code", ...(await probe(callback(legit), { apikey })) });
  log.probes.push({ id: "B-callback-attacker-no-code", ...(await probe(callback(attacker), { apikey })) });
  log.probes.push({
    id: "B-authorize-attacker-skip-redirect",
    ...(await probe(`${authz(attacker)}&skip_http_redirect=true`, { apikey })),
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") log.consoleErrors.push(msg.text().slice(0, 200));
  });

  const hops = [];
  page.on("response", (res) => {
    const u = res.url();
    if (/auth\/v1\/(authorize|callback)|accounts\.google|gdgjobs-f021-attacker/i.test(u)) {
      hops.push({
        status: res.status(),
        ...redactUrl(u),
        location: redactUrl(res.headers()["location"]),
      });
    }
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await setTheme(page, "Claro");
  await page.getByRole("button", { name: /Entrar ou criar conta com Google/i }).waitFor({ timeout: 15_000 });
  await page.screenshot({ path: resolve(outDir, "A-login-light-1280x720.png") });
  log.visual.push({
    id: "A-login-light",
    url: page.url(),
    theme: await page.evaluate(() => document.documentElement.getAttribute("data-theme")),
  });

  await setTheme(page, "Escuro");
  await page.screenshot({ path: resolve(outDir, "A-login-dark-1280x720.png") });
  log.visual.push({
    id: "A-login-dark",
    url: page.url(),
    theme: await page.evaluate(() => document.documentElement.getAttribute("data-theme")),
  });

  // Caso B: navegação real ao authorize com redirectTo atacante (1º hop).
  hops.length = 0;
  const attackerNav = authz(attacker);
  const bResp = await page.goto(attackerNav, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch((err) => ({ error: err.message }));
  await page.waitForTimeout(800);
  const bUrl = page.url();
  await page.screenshot({ path: resolve(outDir, "B-authorize-attacker-preflight-1280x720.png") });
  log.visual.push({
    id: "B-preflight-browser",
    finalUrl: redactUrl(bUrl),
    finalHost: (() => { try { return new URL(bUrl).host; } catch { return bUrl; } })(),
    landedOnAttacker: /gdgjobs-f021-attacker/i.test(bUrl),
    hops: hops.slice(0, 12),
    navError: bResp?.error || null,
  });

  // Callback GoTrue sem code (pós-preflight): URL final não pode ser o atacante.
  hops.length = 0;
  await page.goto(callback(attacker), { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(400);
  const cbUrl = page.url();
  await page.screenshot({ path: resolve(outDir, "B-callback-attacker-final-1280x720.png") });
  log.visual.push({
    id: "B-callback-final",
    finalUrl: redactUrl(cbUrl),
    finalHost: (() => { try { return new URL(cbUrl).host; } catch { return cbUrl; } })(),
    landedOnAttacker: /gdgjobs-f021-attacker/i.test(cbUrl),
    hops: hops.slice(0, 12),
  });

  // Caso A: clicar Google a partir do app (redirectTo = origin). Headless pode parar no Google.
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await setTheme(page, "Claro");
  hops.length = 0;
  await page.getByRole("button", { name: /Entrar ou criar conta com Google/i }).click();
  await page.waitForURL(/accounts\.google|127\.0\.0\.1:5173|localhost:5173|onboarding/, { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const afterClick = page.url();
  const aHost = (() => { try { return new URL(afterClick).host; } catch { return afterClick; } })();
  await page.screenshot({ path: resolve(outDir, "A-oauth-after-click-light-1280x720.png") });
  const sessionLike = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => /supabase|sb-/i.test(k));
    return { storageKeys: keys.length, onAppOrigin: location.host.includes("127.0.0.1") || location.host.includes("localhost") };
  }).catch(() => ({ storageKeys: 0 }));
  log.visual.push({
    id: "A-oauth-click",
    finalUrl: redactUrl(afterClick),
    finalHost: aHost,
    landedOnAttacker: /gdgjobs-f021-attacker/i.test(afterClick),
    hops: hops.slice(0, 12),
    sessionLike,
  });

  await browser.close();
  writeFileSync(resolve(outDir, "probe-log.json"), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ probes: log.probes, visual: log.visual, consoleErrors: log.consoleErrors.slice(0, 8) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
