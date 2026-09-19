/**
 * AUTH-PROFILE-INIT-01 — evidência Network sanitizada (sem token/PII).
 * Simula retorno OAuth: sessão candidato homolog + carga fria em `/` (boot + subscribeAuth).
 *
 * Uso: pnpm dev (terminal 1) → node scripts/qa-auth-profile-init-01.mjs
 * Credenciais: docs-local/candidate-test-user.md ou CANDIDATE_TEST_* / .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

function loadCandidateUser() {
  const file = resolve(process.cwd(), "docs-local/candidate-test-user.md");
  const fromFile = existsSync(file)
    ? {
        email: readFileSync(file, "utf8").match(/E-mail:\s*(\S+)/i)?.[1],
        password: readFileSync(file, "utf8").match(/Senha:\s*(\S+)/i)?.[1],
      }
    : {};
  return {
    email: process.env.CANDIDATE_TEST_EMAIL || process.env.CANDIDATE_EMAIL || fromFile.email,
    password: process.env.CANDIDATE_TEST_PASSWORD || process.env.CANDIDATE_PASSWORD || fromFile.password,
  };
}

function redactProfilesUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/\/profiles/i.test(parsed.pathname)) return null;
    return `${parsed.origin}/rest/v1/profiles?…`;
  } catch {
    return /profiles/i.test(url) ? "/rest/v1/profiles?…" : null;
  }
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const { email, password } = loadCandidateUser();

if (!email || !password) {
  console.error("Defina credenciais em docs-local/candidate-test-user.md ou CANDIDATE_TEST_*");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Defina VITE_SUPABASE_URL e chave anon/publishable em .env.local");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm add -D playwright");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session) {
  console.error(`Login candidato homolog falhou: ${error?.message || "sem sessão"}`);
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
const session = data.session;
const userId = data.user.id;

const events = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

await context.addInitScript(
  ({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  },
  { storageKey, session },
);

const page = await context.newPage();
page.on("response", (response) => {
  const path = redactProfilesUrl(response.url());
  if (!path) return;
  events.push({
    method: response.request().method().toUpperCase(),
    status: response.status(),
    path,
  });
});

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1500);
await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1000);

await browser.close();

const statuses = events.map((e) => e.status);
const has409 = statuses.includes(409);
const summary = {
  capturedAt: new Date().toISOString(),
  scenario:
    "Candidato homolog (password API) + sessão injetada + GET / (cold boot) + reload — equivalente à corrida loadAuthSnapshot × subscribeAuth pós-login",
  environment: "local",
  baseUrl,
  supabaseProjectRef: projectRef,
  userIdRedacted: `${userId.slice(0, 4)}…${userId.slice(-4)}`,
  profileRequests: events,
  totals: {
    count: events.length,
    byStatus: statuses.reduce((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {}),
  },
  pass: !has409 && events.length > 0,
};

const outDir = resolve(process.cwd(), "docs-local/assets/auth-profile-init-01");
mkdirSync(outDir, { recursive: true });
const jsonPath = resolve(outDir, "network-evidence.json");
writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const mdPath = resolve(process.cwd(), "docs-local/auth-profile-init-01-network-evidence.md");
const md = `# AUTH-PROFILE-INIT-01 — evidência Network (sanitizada)

**Data:** ${summary.capturedAt.slice(0, 10)}  
**Ambiente:** \`${baseUrl}\` (homolog Supabase \`${projectRef}\`)  
**Cenário:** ${summary.scenario}

## Resultado

| Métrica | Valor |
|---|---|
| Requisições \`profiles\` capturadas | ${summary.totals.count} |
| Status HTTP | ${JSON.stringify(summary.totals.byStatus)} |
| **409 em profiles** | **${has409 ? "SIM — FALHA" : "não"}** |
| Veredito automação | ${summary.pass ? "**PASS**" : "**FAIL**"} |

## Detalhe (sem query/token/PII)

\`\`\`json
${JSON.stringify(summary.profileRequests, null, 2)}
\`\`\`

Artefato bruto: \`docs-local/assets/auth-profile-init-01/network-evidence.json\`

## Nota

Conta de teste homolog com perfil já existente — esperado predominantemente **GET 200**. O fix (dedupe + \`upsert ignoreDuplicates\`) cobre corrida de **criação**; testes unitários cobrem POST/upsert concorrente.

**OAuth Google:** fluxo UI validado até a tela Google (\`Entrar com Google\`); conclusão manual opcional. Esta evidência cobre inicialização pós-sessão candidato no app (mesmo código \`ensureProfileRow\`).
`;
writeFileSync(mdPath, md, "utf8");

console.log(JSON.stringify({ pass: summary.pass, has409, count: events.length, mdPath, jsonPath }));
process.exit(summary.pass ? 0 : 1);
