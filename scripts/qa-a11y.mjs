/**
 * Baseline axe-core **report-only**. Não entra no CI e não afirma certificação WCAG.
 *
 * Uso local:
 *   pnpm dev          # terminal 1 — http://127.0.0.1:5173
 *   pnpm qa:a11y      # terminal 2
 *
 * Rotas obrigatórias: `/`, `/vagas`, um `/jobs/:id` público, `/login`.
 * Temas: light e dark. Viewport extra ≤760px.
 * `/admin` e `/preferencias`: só se o login de homologação em docs-local/ funcionar.
 * Não imprime senhas. Relatório em docs-local/assets/a11y-gov-01/.
 *
 * Exit 0 mesmo com violações. Exit 1 só se uma rota obrigatória não carregar.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPORT_DIR_REL = "docs-local/assets/a11y-gov-01";
export const REPORT_DIR = resolve(ROOT, REPORT_DIR_REL);
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
export const DESKTOP = { width: 1280, height: 720 };
export const MOBILE = { width: 390, height: 844 };

export function exitCodeForRun({ requiredErrors = [] } = {}) {
  return requiredErrors.length > 0 ? 1 : 0;
}

export function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function loadTestUser(filename, envPrefix, env = process.env) {
  const file = resolve(ROOT, "docs-local", filename);
  const fromFile = existsSync(file)
    ? {
        email: readFileSync(file, "utf8").match(/E-mail:\s*(\S+)/i)?.[1],
        password: readFileSync(file, "utf8").match(/Senha:\s*(\S+)/i)?.[1],
      }
    : {};
  return {
    email: env[`${envPrefix}_EMAIL`] || fromFile.email,
    password: env[`${envPrefix}_PASSWORD`] || fromFile.password,
  };
}

export function hasCreds(user) {
  return Boolean(user?.email && user?.password);
}

export function supabaseAuthStorageKey(supabaseUrl) {
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}

export function sanitizeAxeResults(results) {
  const slimNodes = (nodes = []) =>
    nodes.map((node) => ({
      target: node.target,
      impact: node.impact,
      failureSummary: node.failureSummary,
    }));
  const slimRules = (rules = []) =>
    rules.map((rule) => ({
      id: rule.id,
      impact: rule.impact,
      description: rule.description,
      help: rule.help,
      helpUrl: rule.helpUrl,
      tags: rule.tags,
      nodes: slimNodes(rule.nodes),
    }));
  return {
    url: results.url,
    violations: slimRules(results.violations),
    incomplete: slimRules(results.incomplete),
    passesCount: results.passes?.length ?? 0,
    inapplicableCount: results.inapplicable?.length ?? 0,
  };
}

export function assertNoSecrets(text, secrets = []) {
  const leaked = secrets.filter((secret) => secret && text.includes(secret));
  return leaked;
}

export function summarizeScans(scans) {
  const violations = [];
  for (const scan of scans) {
    if (scan.error) continue;
    for (const rule of scan.axe?.violations ?? []) {
      violations.push({
        scanId: scan.id,
        route: scan.route,
        theme: scan.theme,
        viewport: scan.viewport,
        ruleId: rule.id,
        impact: rule.impact,
        help: rule.help,
        nodes: rule.nodes?.length ?? 0,
        targets: (rule.nodes ?? []).map((node) => node.target),
      });
    }
  }
  const byRule = {};
  for (const row of violations) {
    byRule[row.ruleId] ??= { ruleId: row.ruleId, impact: row.impact, help: row.help, scans: 0, nodes: 0 };
    byRule[row.ruleId].scans += 1;
    byRule[row.ruleId].nodes += row.nodes;
  }
  return {
    scanCount: scans.length,
    errorCount: scans.filter((scan) => scan.error).length,
    violationInstanceCount: violations.length,
    uniqueRules: Object.values(byRule).sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
    violations,
  };
}

export function buildMarkdownReport(payload) {
  const { generatedAt, baseUrl, axeTags, limitations, notTested, skipped, scans, summary } = payload;
  const lines = [
    "# Baseline axe-core — A11Y-GOV-01",
    "",
    "Este relatório é **interno e report-only**. Não é certificação WCAG, não é selo W3C e não declara conformidade.",
    "",
    `- Gerado em: ${generatedAt}`,
    `- BASE_URL: ${baseUrl}`,
    `- Tags axe: ${axeTags.join(", ")}`,
    `- Scans: ${summary.scanCount}`,
    `- Falhas de harness: ${summary.errorCount}`,
    `- Regras com violação (únicas): ${summary.uniqueRules.length}`,
    "",
    "## Violações (agregado)",
    "",
  ];
  if (summary.uniqueRules.length === 0) {
    lines.push("Nenhuma violação axe nas tags pedidas neste recorte. Isso **não** significa AA completo.", "");
  } else {
    lines.push("| Regra | Impacto | Scans | Nós | Ajuda |", "|---|---|---:|---:|---|");
    for (const rule of summary.uniqueRules) {
      lines.push(`| \`${rule.ruleId}\` | ${rule.impact ?? "—"} | ${rule.scans} | ${rule.nodes} | ${rule.help} |`);
    }
    lines.push("");
  }
  lines.push("## Por scan", "");
  for (const scan of scans) {
    const head = `- **${scan.id}** \`${scan.route}\` · ${scan.theme} · ${scan.viewport.width}×${scan.viewport.height}`;
    if (scan.error) {
      lines.push(`${head} — ERRO: ${scan.error}`);
      continue;
    }
    const count = scan.axe?.violations?.length ?? 0;
    lines.push(`${head} — ${count} regra(s)`);
    for (const rule of scan.axe?.violations ?? []) {
      lines.push(`  - \`${rule.id}\` (${rule.impact}): ${rule.help}`);
    }
  }
  lines.push("", "## Falsos positivos / incompletos", "");
  lines.push("Axe marca alguns contrastes e nomes acessíveis como `incomplete` (precisa de julgamento humano). Ver JSON `incomplete` por scan.");
  lines.push("", "## Limitações do axe vs WCAG 2.2 AA", "");
  for (const item of limitations) lines.push(`- ${item}`);
  lines.push("", "## O que não foi testado", "");
  for (const item of notTested) lines.push(`- ${item}`);
  if (skipped.length) {
    lines.push("", "## Amostras puladas", "");
    for (const item of skipped) lines.push(`- ${item}`);
  }
  lines.push("");
  return lines.join("\n");
}

const DEFAULT_LIMITATIONS = [
  "Axe cobre um subconjunto das WCAG 2.2 AA. Critérios de teclado, foco não obscurecido, tamanho de alvo, autenticação acessível e reflow exigem revisão humana.",
  "Color contrast depende de CSS computado; fontes webfont e overlays podem gerar falso positivo ou incomplete.",
  "SPA: título de documento único; axe não avalia 2.4.2 por rota.",
  "Leitor de tela real, zoom 200% e pessoas com deficiência não fazem parte deste script.",
];

function defaultNotTested({ skippedAuth }) {
  return [
    "Certificação, declaração pública, VLibras, UserWay.",
    "Produção, Camada B, Gemini, RLS.",
    "Forçar falha de API para loading/erro (só estados que a UI já expõe).",
    skippedAuth
      ? "Fluxos autenticados de candidato/admin quando o login de homologação não funcionou (N/A na matriz)."
      : "OAuth Google real no `/login` (o script não completa o IdP).",
    "Arrastar, atalhos de tecla de caractere, captura de movimento, PDF, mídia com diálogo.",
  ];
}

function waitCatalog(page) {
  return page.waitForSelector(".job-card:not(.job-card--skeleton), .empty", { timeout: 30_000 });
}

async function applyTheme(page, theme) {
  await page.evaluate((next) => {
    try {
      localStorage.setItem("gdgjobs-theme", next);
    } catch {
      /* private mode */
    }
    document.documentElement.setAttribute("data-theme", next);
  }, theme);
  await page.waitForTimeout(150);
}

async function settle(page) {
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await page.locator("#conteudo").waitFor({ state: "attached", timeout: 15_000 });
}

async function analyze(page, AxeBuilder) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return sanitizeAxeResults(results);
}

async function scanRoute({ browser, AxeBuilder, baseUrl, id, route, theme, viewport, afterGoto }) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await context.newPage();
  const scan = { id, route, theme, viewport, required: true };
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await applyTheme(page, theme);
    if (afterGoto) await afterGoto(page);
    await settle(page);
    scan.axe = await analyze(page, AxeBuilder);
  } catch (error) {
    scan.error = error.message || String(error);
  } finally {
    await context.close();
  }
  return scan;
}

async function resolveJobRoute(browser, baseUrl) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitCatalog(page);
    const href = await page.locator("a.job-card:not(.job-card--skeleton)").first().getAttribute("href");
    return href || null;
  } finally {
    await context.close();
  }
}

async function signInAdmin(browser, baseUrl, creds) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const emailField = page.getByLabel("E-mail");
  await emailField.waitFor({ timeout: 15_000 });
  await emailField.fill(creds.email);
  await page.getByLabel("Senha").fill(creds.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator(".admin-tabs").waitFor({ timeout: 30_000 });
  return { context, page };
}

async function candidateStorage(env, creds) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const storageKey = supabaseAuthStorageKey(url);
  if (!url || !key || !storageKey || !hasCreds(creds)) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error || !data.session) return null;
  return { storageKey, session: data.session };
}

async function scanWithStorage({ browser, AxeBuilder, baseUrl, storage, id, route, theme, viewport, afterGoto }) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await context.addInitScript(
    ({ key, session }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch {
        /* ignore */
      }
    },
    { key: storage.storageKey, session: storage.session },
  );
  const page = await context.newPage();
  const scan = { id, route, theme, viewport, required: false };
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await applyTheme(page, theme);
    if (afterGoto) await afterGoto(page);
    await settle(page);
    scan.finalUrl = page.url();
    scan.axe = await analyze(page, AxeBuilder);
  } catch (error) {
    scan.error = error.message || String(error);
  } finally {
    await context.close();
  }
  return scan;
}

export async function runA11yQa(options = {}) {
  const env = { ...loadDotEnv(resolve(ROOT, ".env.local")), ...process.env, ...options.env };
  const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
  const admin = loadTestUser("admin-test-user.md", "ADMIN_TEST", env);
  const candidate = loadTestUser("candidate-test-user.md", "CANDIDATE_TEST", env);

  let chromium;
  let AxeBuilder;
  try {
    ({ chromium } = await import("playwright"));
    ({ default: AxeBuilder } = await import("@axe-core/playwright"));
  } catch {
    throw new Error("Instale Playwright e @axe-core/playwright: pnpm install && pnpm exec playwright install chromium");
  }

  const browser = await chromium.launch({ headless: true });
  const scans = [];
  const skipped = [];
  const requiredErrors = [];

  try {
    const jobRoute = options.jobRoute || env.JOB_PATH || (await resolveJobRoute(browser, baseUrl));
    if (!jobRoute) {
      requiredErrors.push("Nenhuma vaga pública em /vagas para amostrar /jobs/:id");
    }

    const requiredRoutes = [
      { id: "home", route: "/" },
      { id: "catalog", route: "/vagas", afterGoto: waitCatalog },
      { id: "login", route: "/login" },
    ];
    if (jobRoute) requiredRoutes.push({ id: "job-detail", route: jobRoute });

    const combos = [
      { theme: "light", viewport: DESKTOP },
      { theme: "dark", viewport: DESKTOP },
      { theme: "light", viewport: MOBILE },
      { theme: "dark", viewport: MOBILE },
    ];

    for (const spec of requiredRoutes) {
      for (const combo of combos) {
        const scan = await scanRoute({
          browser,
          AxeBuilder,
          baseUrl,
          id: `${spec.id}-${combo.theme}-${combo.viewport.width}`,
          route: spec.route,
          theme: combo.theme,
          viewport: combo.viewport,
          afterGoto: spec.afterGoto,
        });
        scan.required = true;
        scans.push(scan);
        if (scan.error) requiredErrors.push(`${scan.id}: ${scan.error}`);
      }
    }

    const unavailable = await scanRoute({
      browser,
      AxeBuilder,
      baseUrl,
      id: "job-unavailable-light-1280",
      route: "/jobs/00000000-0000-4000-8000-000000000000",
      theme: "light",
      viewport: DESKTOP,
    });
    unavailable.required = false;
    scans.push(unavailable);

    if (hasCreds(admin)) {
      try {
        const { context, page } = await signInAdmin(browser, baseUrl, admin);
        try {
          for (const combo of [
            { theme: "light", viewport: DESKTOP },
            { theme: "dark", viewport: DESKTOP },
            { theme: "light", viewport: MOBILE },
          ]) {
            await page.setViewportSize(combo.viewport);
            await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await applyTheme(page, combo.theme);
            await settle(page);
            const scan = {
              id: `admin-${combo.theme}-${combo.viewport.width}`,
              route: "/admin",
              theme: combo.theme,
              viewport: combo.viewport,
              required: false,
              axe: await analyze(page, AxeBuilder),
            };
            scans.push(scan);
          }
          const curationTab = page.getByRole("button", { name: "Curadoria", exact: true });
          if (await curationTab.count()) {
            await curationTab.click();
            await page.getByRole("heading", { name: /Fila de revisão/ }).waitFor({ timeout: 15_000 });
            await applyTheme(page, "light");
            await settle(page);
            scans.push({
              id: "admin-curation-light-1280",
              route: "/admin#curadoria",
              theme: "light",
              viewport: DESKTOP,
              required: false,
              axe: await analyze(page, AxeBuilder),
            });
          }
        } finally {
          await context.close();
        }
      } catch (error) {
        skipped.push(`/admin: login de homologação falhou (${(error.message || "erro").split("\n")[0]}). N/A na matriz.`);
      }
    } else {
      skipped.push("/admin: sem credenciais em docs-local/admin-test-user.md (N/A).");
    }

    let skippedAuth = !hasCreds(candidate);
    if (hasCreds(candidate)) {
      const storage = await candidateStorage(env, candidate);
      if (!storage) {
        skippedAuth = true;
        skipped.push("/preferencias e candidatura: login candidato de homologação falhou (N/A).");
      } else {
        for (const route of ["/preferencias", "/minhas-candidaturas"]) {
          const scan = await scanWithStorage({
            browser,
            AxeBuilder,
            baseUrl,
            storage,
            id: `${route.slice(1) || "root"}-light-1280`,
            route,
            theme: "light",
            viewport: DESKTOP,
          });
          scans.push(scan);
          if (scan.finalUrl?.includes("/onboarding")) {
            scans.push({
              ...scan,
              id: "onboarding-from-auth-light-1280",
              route: "/onboarding",
            });
          }
        }
        const onboarding = await scanWithStorage({
          browser,
          AxeBuilder,
          baseUrl,
          storage,
          id: "onboarding-light-1280",
          route: "/onboarding",
          theme: "light",
          viewport: DESKTOP,
        });
        scans.push(onboarding);
        if (onboarding.finalUrl && !onboarding.finalUrl.includes("/onboarding")) {
          skipped.push("/onboarding: sessão de homologação já tem perfil D-01; rota redirecionou. Revisão de código na matriz.");
        }
      }
    } else {
      skipped.push("/preferencias, /minhas-candidaturas, /onboarding: sem credenciais de candidato (N/A).");
    }

    const summary = summarizeScans(scans);
    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      axeTags: AXE_TAGS,
      reportOnly: true,
      certification: false,
      limitations: DEFAULT_LIMITATIONS,
      notTested: defaultNotTested({ skippedAuth }),
      skipped,
      requiredErrors,
      scans,
      summary,
    };

    mkdirSync(REPORT_DIR, { recursive: true });
    const jsonPath = resolve(REPORT_DIR, "axe-baseline.json");
    const mdPath = resolve(REPORT_DIR, "axe-baseline.md");
    const jsonText = JSON.stringify(payload, null, 2);
    const leaked = assertNoSecrets(jsonText, [admin.password, candidate.password]);
    if (leaked.length) {
      throw new Error("Relatório recusou gravar: senha de homologação vazaria no JSON.");
    }
    writeFileSync(jsonPath, jsonText);
    writeFileSync(mdPath, buildMarkdownReport(payload));
    payload.paths = { json: jsonPath, md: mdPath };
    return payload;
  } finally {
    await browser.close();
  }
}

const invokedDirectly = process.argv[1]?.replaceAll("\\", "/").endsWith("qa-a11y.mjs");
if (invokedDirectly) {
  try {
    const result = await runA11yQa();
    const code = exitCodeForRun({ requiredErrors: result.requiredErrors });
    console.log(`qa:a11y report-only → ${REPORT_DIR_REL}`);
    console.log(`scans=${result.summary.scanCount} regras=${result.summary.uniqueRules.length} harness=${result.requiredErrors.length}`);
    for (const rule of result.summary.uniqueRules) {
      console.log(`  ${rule.ruleId} (${rule.impact}) ×${rule.scans}`);
    }
    for (const skip of result.skipped) console.log(`skip: ${skip}`);
    if (code !== 0) {
      console.error("Rotas obrigatórias não carregaram:");
      for (const err of result.requiredErrors) console.error(`  ${err}`);
    }
    process.exit(code);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
