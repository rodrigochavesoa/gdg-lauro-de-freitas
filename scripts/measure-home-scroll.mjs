/**
 * UX-PERF-05 — diagnose home scroll jank after /login → /
 * Captures PerformanceObserver longtasks + frame timing during scroll,
 * and renders a Main-thread timeline PNG (MCP chrome-devtools offline fallback).
 *
 *   pnpm dev
 *   node scripts/measure-home-scroll.mjs
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
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

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const outDir = resolve("docs/assets/ux-perf-05");
mkdirSync(outDir, { recursive: true });
const label = env.MEASURE_LABEL || "before";

async function injectObservers(page) {
  await page.addInitScript(() => {
    window.__perf05 = {
      longTasks: [],
      frames: [],
      skeletons: [],
      restJobs: 0,
      startedAt: performance.now(),
    };
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__perf05.longTasks.push({
            start: e.startTime,
            dur: e.duration,
            name: e.name,
          });
        }
      });
      po.observe({ type: "longtask", buffered: true });
    } catch {}
    let last = performance.now();
    const tick = (ts) => {
      const dt = ts - last;
      last = ts;
      window.__perf05.frames.push({ t: ts, dt });
      if (window.__perf05.frames.length < 240) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function countSkeletons(page) {
  return page.locator(".job-card--skeleton").count();
}

async function scrollHome(page, durationMs = 3200) {
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(80);
    await page.mouse.wheel(0, -280);
    await page.waitForTimeout(80);
  }
}

async function renderFlameViaPage(browser, title, longTasks, frames, outPath) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
  const payload = JSON.stringify({ title, longTasks, frames });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#1e1e1e;color:#ddd;font:13px Consolas,monospace">
<canvas id="c" width="1100" height="520"></canvas>
<script>
const data = ${payload};
const c = document.getElementById('c');
const ctx = c.getContext('2d');
ctx.fillStyle = '#1e1e1e';
ctx.fillRect(0,0,1100,520);
ctx.fillStyle = '#fff';
ctx.font = '16px sans-serif';
ctx.fillText(data.title, 16, 28);
ctx.font = '12px monospace';
ctx.fillStyle = '#9cdcfe';
ctx.fillText('Main thread timeline (Long Tasks + frame dt) — chrome-devtools-mcp offline fallback', 16, 50);

const tasks = data.longTasks || [];
const frames = data.frames || [];
const t0 = frames[0]?.t ?? tasks[0]?.start ?? 0;
const t1 = Math.max(
  frames.at(-1)?.t ?? t0 + 1,
  ...tasks.map(t => t.start + t.dur),
  t0 + 1
);
const span = Math.max(1, t1 - t0);
const x = (t) => 16 + ((t - t0) / span) * 1060;
const laneY = 120;

ctx.fillStyle = '#3c3c3c';
ctx.fillRect(16, laneY, 1060, 40);
ctx.fillStyle = '#ce9178';
for (const task of tasks) {
  const w = Math.max(2, ((task.dur) / span) * 1060);
  ctx.fillRect(x(task.start), laneY + 4, w, 32);
}
ctx.fillStyle = '#dcdcaa';
ctx.fillText('Long tasks (>50ms scripting/layout) — count=' + tasks.length, 16, laneY - 10);

const frameY = 220;
ctx.fillStyle = '#3c3c3c';
ctx.fillRect(16, frameY, 1060, 80);
let bad = 0;
for (const f of frames) {
  const h = Math.min(76, (f.dt / 50) * 76);
  if (f.dt > 33) { ctx.fillStyle = '#f44747'; bad++; }
  else if (f.dt > 18) ctx.fillStyle = '#d7ba7d';
  else ctx.fillStyle = '#6a9955';
  ctx.fillRect(x(f.t), frameY + 80 - h, 3, h);
}
ctx.fillStyle = '#dcdcaa';
ctx.fillText('Frame intervals (green ≤18ms, yellow ≤33ms, red >33ms) — jank frames=' + bad + '/' + frames.length, 16, frameY - 10);

const totalLong = tasks.reduce((s,t)=>s+t.dur,0);
ctx.fillStyle = '#ccc';
ctx.fillText('longTask total ms: ' + totalLong.toFixed(1) + ' | span: ' + span.toFixed(0) + 'ms', 16, 360);
ctx.fillText('Evidence for UX-PERF-05 when chrome-devtools-mcp unavailable', 16, 390);
</script></body></html>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: outPath, type: "png" });
  await page.close();
  return { longTaskCount: longTasks.length, jankFrames: frames.filter((f) => f.dt > 33).length, frameCount: frames.length };
}

async function runScenario(browser, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await injectObservers(page);

  const rest = [];
  page.on("request", (req) => {
    if (req.url().includes("/rest/v1/jobs")) rest.push(req.url());
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  // Allow shell prefetch (UX-PERF-05) to complete before navigating — human dwell
  await page.waitForTimeout(Number(env.LOGIN_DWELL_MS || 900));
  // Clear catalog cache so login→home is cold (matches PO: first visit after login surface)
  await page.evaluate(() => {
    // cache is in-module; hard reload home after login nav is enough if we never visited /
  });

  const navStart = Date.now();
  await page.getByRole("link", { name: /^vagas$/i }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 15_000 });

  const skelAtNav = await countSkeletons(page);
  // Scroll immediately during potential load
  const scrollPromise = scrollHome(page, 3000);
  await page.waitForTimeout(120);
  const skelDuring = await countSkeletons(page);
  await scrollPromise;

  const perf = await page.evaluate(() => window.__perf05);
  const cards = await page.locator(".job-card:not(.job-card--skeleton)").count();

  // Second visit warm
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  await page.getByRole("link", { name: /^vagas$/i }).click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 15_000 });
  const skelWarm = await countSkeletons(page);
  await scrollHome(page, 1500);
  const perfWarm = await page.evaluate(() => window.__perf05);

  await context.close();

  return {
    name,
    navMs: Date.now() - navStart,
    skelAtNav,
    skelDuring,
    skelWarm,
    cards,
    restJobs: rest.length,
    longTasks: perf?.longTasks ?? [],
    frames: perf?.frames ?? [],
    longTasksWarm: perfWarm?.longTasks ?? [],
  };
}

// Avoid optional canvas dependency — timeline via HTML screenshot
async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log(`BASE_URL=${baseUrl} label=${label}`);
  const result = await runScenario(browser, label);
  console.log(JSON.stringify({
    skelAtNav: result.skelAtNav,
    skelDuring: result.skelDuring,
    skelWarm: result.skelWarm,
    cards: result.cards,
    restJobs: result.restJobs,
    longTasks: result.longTasks.length,
    longTaskMs: result.longTasks.reduce((s, t) => s + t.dur, 0),
    jankFrames: result.frames.filter((f) => f.dt > 33).length,
    frames: result.frames.length,
  }, null, 2));

  const out = resolve(outDir, `flame-${label}.png`);
  const stats = await renderFlameViaPage(
    browser,
    `UX-PERF-05 ${label}: /login → / scroll`,
    result.longTasks,
    result.frames,
    out,
  );
  console.log(`wrote ${out}`, stats);

  writeFileSync(resolve(outDir, `metrics-${label}.json`), JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
