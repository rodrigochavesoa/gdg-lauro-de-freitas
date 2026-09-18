/**
 * PERF-AVATAR-01 — mede signed URL + download do avatar após 10 trocas de aba/foco.
 * Não imprime tokens, query strings nem PII. Não entra no CI.
 *
 * Uso local:
 *   pnpm dev   # terminal 1 — http://127.0.0.1:5173
 *   pnpm qa:perf-avatar-01
 *
 * Credenciais: docs-local/candidate-test-user.md ou CANDIDATE_TEST_EMAIL / CANDIDATE_TEST_PASSWORD
 * BASE_URL default: http://127.0.0.1:5173
 *
 * Cleanup: restaura avatar_path e arquivo originais do candidato de teste em homolog (try/finally).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSyntheticAvatar256 } from "./lib/synthetic-avatar-256.mjs";

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

function redactPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url).split("?")[0];
  }
}

function isAvatarStorageUrl(url) {
  return /\/storage\/v1\/object\/(?:sign\/avatars|avatars)\//i.test(url);
}

function classifyAvatarRequest(response) {
  const url = response.url();
  if (!isAvatarStorageUrl(url)) return null;
  const method = response.request().method().toUpperCase();
  const resourceType = response.request().resourceType();
  if (method === "POST") return "signCreate";
  if (resourceType === "image") return "imageDownload";
  if (method === "GET") return "imageDownload";
  if (resourceType === "fetch" && method !== "GET") return "signCreate";
  return "other";
}

const env = { ...loadLocalEnv(), ...process.env };
const baseUrl = (env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const tabSwitches = Math.max(1, Number(env.AVATAR_TAB_SWITCHES || 10));
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const { email, password } = loadCandidateUser();
const outDir = resolve(process.cwd(), "docs-local/assets/perf-avatar-01");
mkdirSync(outDir, { recursive: true });

if (!email || !password) {
  console.error("Defina CANDIDATE_TEST_EMAIL/CANDIDATE_TEST_PASSWORD ou docs-local/candidate-test-user.md");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("Defina VITE_SUPABASE_URL e a chave publishable/anon em .env.local");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Instale Playwright: pnpm add -D playwright && pnpm exec playwright install chromium");
  process.exit(1);
}

async function signInCandidateSession() {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`login candidato falhou: ${error?.message || "sem sessão"}`);
  }
  const { data: profile } = await client
    .from("profiles")
    .select("avatar_path")
    .eq("id", data.user.id)
    .maybeSingle();
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    client,
    storageKey: `sb-${projectRef}-auth-token`,
    session: data.session,
    userId: data.user.id,
    avatarPath: profile?.avatar_path ?? null,
    hasAvatar: Boolean(profile?.avatar_path),
  };
}

async function downloadAvatarBytes(client, path) {
  if (!path) return { bytes: null, error: null };
  const { data, error } = await client.storage.from("avatars").download(path);
  if (error || !data) {
    return { bytes: null, error: error?.message ?? "download sem dados" };
  }
  return { bytes: Buffer.from(await data.arrayBuffer()), error: null };
}

function assertCanSafelySeed(snapshot) {
  if (!snapshot.originalAvatarPath) return;
  if (!snapshot.originalAvatarBytes) {
    throw new Error(
      `abort: avatar_path original (${snapshot.originalAvatarPath}) sem bytes preservados` +
        (snapshot.downloadError ? ` (${snapshot.downloadError})` : ""),
    );
  }
}

async function seedCandidateAvatar(auth, avatarBytes, fixturePath) {
  const upload = await auth.client.storage.from("avatars").upload(fixturePath, avatarBytes, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "0",
  });
  if (upload.error) {
    throw new Error(`seed avatar falhou: ${upload.error.message}`);
  }
  const { error } = await auth.client
    .from("profiles")
    .update({ avatar_path: fixturePath, updated_at: new Date().toISOString() })
    .eq("id", auth.userId);
  if (error) {
    throw new Error(`persist avatar_path falhou: ${error.message}`);
  }
  return {
    ...auth,
    avatarPath: fixturePath,
    hasAvatar: true,
    seededAvatar: true,
    seedBytes: avatarBytes.length,
  };
}

async function restoreCandidateAvatar(auth, snapshot) {
  const errors = [];
  const steps = [];
  const { client, userId } = auth;
  const fixturePath = snapshot.fixturePath;
  const bucket = client.storage.from("avatars");

  const restoreProfile = async (avatarPath) => {
    const { error } = await client
      .from("profiles")
      .update({
        avatar_path: avatarPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) errors.push(`profile.avatar_path: ${error.message}`);
    else steps.push(`profile.avatar_path=${avatarPath ?? "null"}`);
  };

  const uploadBytes = async (path, bytes, contentType = "image/jpeg") => {
    const { error } = await bucket.upload(path, bytes, {
      upsert: true,
      contentType,
      cacheControl: "0",
    });
    if (error) errors.push(`upload ${path}: ${error.message}`);
    else steps.push(`upload ${path} (${bytes.length} bytes)`);
  };

  const removePath = async (path) => {
    const { error } = await bucket.remove([path]);
    if (error) errors.push(`remove ${path}: ${error.message}`);
    else steps.push(`remove ${path}`);
  };

  if (snapshot.originalAvatarPath == null) {
    await removePath(fixturePath);
    await restoreProfile(null);
  } else if (snapshot.originalAvatarPath === fixturePath) {
    if (!snapshot.originalAvatarBytes) {
      errors.push("bytes originais indisponíveis para restaurar fixture no mesmo path");
    } else {
      await uploadBytes(fixturePath, snapshot.originalAvatarBytes);
      await restoreProfile(fixturePath);
    }
  } else {
    if (!snapshot.originalAvatarBytes) {
      errors.push("bytes originais indisponíveis para validar restauração do avatar");
    } else {
      await uploadBytes(snapshot.originalAvatarPath, snapshot.originalAvatarBytes);
    }
    await restoreProfile(snapshot.originalAvatarPath);
    if (fixturePath !== snapshot.originalAvatarPath) {
      await removePath(fixturePath);
    }
  }

  const samePathWithoutBytes =
    snapshot.originalAvatarPath === fixturePath && !snapshot.originalAvatarBytes;
  const status = errors.length === 0 && !samePathWithoutBytes ? "completed" : "failed";

  return {
    status,
    steps,
    errors,
    restoredAvatarPath: snapshot.originalAvatarPath,
    fixtureRemoved: snapshot.originalAvatarPath == null || snapshot.originalAvatarPath !== fixturePath,
  };
}

async function countAvatarDom(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const slots = [...document.querySelectorAll(".nav-actions .avatar")];
    const imgs = [...document.querySelectorAll(".nav-actions .avatar img")];
    return {
      avatarSlots: slots.length,
      imgsTotal: imgs.length,
      imgsVisible: imgs.filter(isVisible).length,
      imgsHidden: imgs.filter((el) => !isVisible(el)).length,
      pending: document.querySelectorAll(".nav-actions .avatar--pending").length,
    };
  });
}

function summarizeNetwork(rows) {
  const byKind = { signCreate: 0, imageDownload: 0, other: 0 };
  let transferBytes = 0;
  let encodedBytes = 0;
  for (const row of rows) {
    byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    if (typeof row.transferSize === "number") transferBytes += row.transferSize;
    if (typeof row.encodedBodySize === "number") encodedBytes += row.encodedBodySize;
  }
  return { byKind, transferBytes, encodedBytes };
}

function writeEvidence({
  pass,
  cleanup,
  auth,
  snapshot,
  initialLoadSummary,
  baselineDom,
  stableSummary,
  switchSummary,
  finalDom,
  pendingFinal,
  allNetwork,
  lines,
}) {
  const markdown = `# PERF-AVATAR-01 — network log (redigido)

**Medido em:** ${new Date().toISOString()}  
**BASE_URL:** ${baseUrl}  
**Avatar de teste:** sintético 256×256 JPEG (${auth.seedBytes} bytes, sem PII)  
**Candidato com avatar_path:** sim (fixture temporário em homolog)  
**Trocas de aba:** ${tabSwitches}

## Cleanup homolog (obrigatório)

| Campo | Valor |
|---|---|
| \`avatar_path\` original | ${snapshot.originalAvatarPath ?? "null"} |
| Fixture temporário | \`${snapshot.fixturePath}\` |
| Bytes originais salvos | ${snapshot.originalAvatarBytes ? snapshot.originalAvatarBytes.length : 0} |
| Erro no download original | ${snapshot.downloadError ?? "nenhum"} |
| Status cleanup | **${cleanup.status}** |
| Passos | ${cleanup.steps.length ? cleanup.steps.join("; ") : "—"} |
| Erros cleanup | ${cleanup.errors.length ? cleanup.errors.join("; ") : "nenhum"} |

## Histórico da evidência

- **Medição 1 (incompleta):** candidato sem \`avatar_path\`.
- **Medição 2:** probe 1×1 px — switches OK, peso irreal.
- **Medição 3:** avatar 256×256 — categorias separadas; sem cleanup (ressalva Plan).
- **Medição 4 (esta):** avatar 256×256 + restore do candidato em \`finally\`.

## Carga inicial (até avatar visível)

| Categoria | Valor | Esperado (desktop 1280px) |
|---|---|---|
| \`signCreate\` (POST createSignedUrl) | ${initialLoadSummary.byKind.signCreate} | ~1 |
| \`imageDownload\` (GET da imagem, \`initiatorType: image\`) | ${initialLoadSummary.byKind.imageDownload} | ~1 |
| \`transferSize\` total (bytes) | ${initialLoadSummary.transferBytes} | >0 |
| \`encodedBodySize\` total (bytes) | ${initialLoadSummary.encodedBytes} | >0 |
| slots \`.avatar\` | ${baselineDom.avatarSlots} | 2 (desktop + mobile shell) |
| \`<img>\` visíveis | ${baselineDom.imgsVisible} | 1 |
| \`<img>\` ocultos | ${baselineDom.imgsHidden} | 0 |
| \`.avatar--pending\` | ${baselineDom.pending} | 0 |

## Janela estável pré-switches (2s, rede zerada)

| Categoria | Valor | Esperado |
|---|---|---|
| \`signCreate\` | ${stableSummary.byKind.signCreate} | 0 |
| \`imageDownload\` | ${stableSummary.byKind.imageDownload} | 0 |

## Após ${tabSwitches} trocas de aba (sem upload)

| Métrica | Valor | Meta |
|---|---|---|
| Novas \`signCreate\` | ${switchSummary.byKind.signCreate} | 0 |
| Novos \`imageDownload\` | ${switchSummary.byKind.imageDownload} | 0 |
| \`.avatar--pending\` | ${pendingFinal} | 0 |
| \`<img>\` visíveis | ${finalDom.imgsVisible} | ≥1 |

**Resultado switches:** ${pass ? "PASS" : "FAIL"}  
**Resultado geral:** ${pass && cleanup.status === "completed" ? "PASS" : "FAIL"}

## Eventos de rede (rota redigida)

| # | kind | method | status | initiatorType | transferSize | encodedBodySize | route |
|---|---|---|---|---|---|---|---|
${allNetwork.map((row, index) => `| ${index + 1} | ${row.kind} | ${row.method} | ${row.status} | ${row.initiatorType} | ${row.transferSize ?? "—"} | ${row.encodedBodySize ?? "—"} | ${row.route} |`).join("\n")}

## Notas

- Query strings e tokens omitidos de propósito.
- \`signCreate\` = chamada de criação da signed URL; \`imageDownload\` = GET da imagem (inclui \`initiatorType: image\`).
- Fixture sintético é revertido ao estado anterior do candidato de teste ao final do script.
- \`cacheControl: "0"\` permanece — reload completo ainda pode baixar de novo (gate **PERF-AVATAR-02** / Camada B).
- Regressão automatizada: \`auth-api.test.js\` (cache 55 min + expiração) e \`App.smoke.test.jsx\` (\`TOKEN_REFRESHED\` ×10).
`;

  writeFileSync(resolve(outDir, "network-log.md"), markdown);
  writeFileSync(resolve(outDir, "measure.log"), `${lines.join("\n")}\n`);
  writeFileSync(
    resolve(outDir, "network-log.json"),
    `${JSON.stringify({
      measuredAt: new Date().toISOString(),
      baseUrl,
      tabSwitches,
      seedBytes: auth.seedBytes,
      hasAvatar: auth.hasAvatar,
      pass,
      cleanup,
      snapshot: {
        originalAvatarPath: snapshot.originalAvatarPath,
        fixturePath: snapshot.fixturePath,
        originalBytesSaved: snapshot.originalAvatarBytes?.length ?? 0,
        downloadError: snapshot.downloadError,
      },
      initialLoad: { ...initialLoadSummary, dom: baselineDom },
      stablePreSwitch: stableSummary,
      afterSwitches: { ...switchSummary, dom: finalDom },
      network: allNetwork,
    }, null, 2)}\n`,
  );
}

const authBase = await signInCandidateSession();
const fixturePath = `${authBase.userId}/avatar.jpg`;
const downloaded = await downloadAvatarBytes(authBase.client, authBase.avatarPath);
const snapshot = {
  originalAvatarPath: authBase.avatarPath,
  originalAvatarBytes: downloaded.bytes,
  downloadError: downloaded.error,
  fixturePath,
};

const lines = [];
const log = (message) => {
  lines.push(message);
  console.log(message);
};

let browser = null;
let pass = false;
let seeded = false;
let cleanup = { status: "skipped", steps: [], errors: ["medição não concluída"] };
let evidence = null;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const seedPage = await context.newPage();
  const avatarBytes = await createSyntheticAvatar256(seedPage);
  await seedPage.close();
  log(
    `snapshot: avatar_path original=${snapshot.originalAvatarPath ?? "null"} bytes=${snapshot.originalAvatarBytes?.length ?? 0}` +
      (snapshot.downloadError ? ` downloadError=${snapshot.downloadError}` : ""),
  );
  assertCanSafelySeed(snapshot);
  const auth = await seedCandidateAvatar(authBase, avatarBytes, fixturePath);
  seeded = true;

  await context.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: auth.storageKey, session: auth.session },
  );

  const page = await context.newPage();
  const helperPage = await context.newPage();
  const network = [];
  const allNetwork = [];

  page.on("response", async (response) => {
    const kind = classifyAvatarRequest(response);
    if (!kind) return;
    const headers = response.headers();
    const contentLength = headers["content-length"] ? Number(headers["content-length"]) : null;
    let transferSize = null;
    let encodedBodySize = contentLength;
    try {
      const sizes = await response.request().sizes();
      transferSize = (sizes.responseBodySize ?? 0) + (sizes.responseHeadersSize ?? 0);
      if (encodedBodySize == null && sizes.responseBodySize != null) {
        encodedBodySize = sizes.responseBodySize;
      }
    } catch {
      transferSize = null;
    }
    const row = {
      at: Date.now(),
      route: redactPath(response.url()),
      status: response.status(),
      method: response.request().method().toUpperCase(),
      initiatorType: response.request().resourceType(),
      transferSize,
      encodedBodySize,
      kind,
    };
    network.push(row);
    allNetwork.push(row);
  });

  const countSince = (startedAt, kind = null) =>
    network.filter((row) => row.at >= startedAt && (kind ? row.kind === kind : true)).length;

  log(`BASE_URL=${baseUrl} tabSwitches=${tabSwitches}`);
  log(`seed: avatar sintético 256×256 JPEG (${auth.seedBytes} bytes, sem PII)`);
  log("(log redigido: sem query string, token ou e-mail)");

  await page.goto(`${baseUrl}/vagas`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Conta|Menu de / }).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".nav-actions .avatar img").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(500);

  const initialLoadRows = [...network];
  const initialLoadSummary = summarizeNetwork(initialLoadRows);
  const baselineDom = await countAvatarDom(page);
  const imgSrc = await page.locator(".nav-actions .avatar img").first().getAttribute("src").catch(() => null);

  network.length = 0;

  log("\n=== Carga inicial (até avatar visível) ===");
  log(`signCreate (POST createSignedUrl): ${initialLoadSummary.byKind.signCreate}`);
  log(`imageDownload (GET <img>): ${initialLoadSummary.byKind.imageDownload}`);
  log(`transferSize total: ${initialLoadSummary.transferBytes} bytes`);
  log(`encodedBodySize total: ${initialLoadSummary.encodedBytes} bytes`);
  log(`avatar slots: ${baselineDom.avatarSlots} | img visíveis: ${baselineDom.imgsVisible} | img ocultos: ${baselineDom.imgsHidden} | pending: ${baselineDom.pending}`);
  if (imgSrc) log(`img route (redigida): ${redactPath(imgSrc)}`);

  log("\n=== Janela estável pré-switches (2s, rede zerada) ===");
  await page.waitForTimeout(2000);
  const stableRows = [...network];
  const stableSummary = summarizeNetwork(stableRows);
  log(`signCreate: ${stableSummary.byKind.signCreate} | imageDownload: ${stableSummary.byKind.imageDownload}`);

  log("\n=== Baseline para aceite (só trocas de aba) ===");
  log("rede zerada após carga; contagem abaixo é só durante switches");

  log(`\n=== ${tabSwitches} trocas de aba/foco (sem upload) ===`);

  const switchStart = Date.now();
  for (let i = 1; i <= tabSwitches; i += 1) {
    const tick = Date.now();
    await helperPage.bringToFront();
    await page.waitForTimeout(400);
    await page.bringToFront();
    await page.waitForTimeout(1200);
    const signDelta = countSince(tick, "signCreate");
    const downloadDelta = countSince(tick, "imageDownload");
    const pending = (await countAvatarDom(page)).pending;
    log(`switch ${i}: +signCreate=${signDelta} +imageDownload=${downloadDelta} pending=${pending}`);
  }

  const switchRows = network.filter((row) => row.at >= switchStart);
  const switchSummary = summarizeNetwork(switchRows);
  const finalDom = await countAvatarDom(page);
  const pendingFinal = finalDom.pending;

  log("\n=== RESUMO PERF-AVATAR-01 ===");
  log(`Após ${tabSwitches} switches: novas signCreate=${switchSummary.byKind.signCreate} novos imageDownload=${switchSummary.byKind.imageDownload}`);
  log(`Estado final: img visíveis=${finalDom.imgsVisible} ocultos=${finalDom.imgsHidden} pending=${pendingFinal}`);
  log("Meta após switches: signCreate=0 imageDownload=0 pending=0");

  pass = auth.hasAvatar
    && switchSummary.byKind.signCreate === 0
    && switchSummary.byKind.imageDownload === 0
    && pendingFinal === 0
    && finalDom.imgsVisible >= 1;

  evidence = {
    pass,
    auth,
    snapshot,
    initialLoadSummary,
    baselineDom,
    stableSummary,
    switchSummary,
    finalDom,
    pendingFinal,
    allNetwork,
  };
} catch (error) {
  log(`\nERRO: ${error.message}`);
} finally {
  if (browser) {
    await browser.close();
    browser = null;
  }
  log("\n=== Cleanup homolog (restore candidato de teste) ===");
  if (!seeded) {
    cleanup = { status: "skipped", steps: ["nenhuma mutação em homolog"], errors: [] };
    log("cleanup: skipped — medição não alterou homolog");
  } else {
    try {
      cleanup = await restoreCandidateAvatar(authBase, snapshot);
      if (cleanup.status === "completed") {
        log(`cleanup: completed — ${cleanup.steps.join("; ")}`);
      } else {
        log(`cleanup: FAILED — ${cleanup.errors.join("; ")}`);
      }
    } catch (error) {
      cleanup = { status: "failed", steps: [], errors: [error.message] };
      log(`cleanup: FAILED — ${error.message}`);
    }
  }

  if (evidence) {
    writeEvidence({ ...evidence, cleanup, lines });
    log(`\nwrote ${resolve(outDir, "network-log.md")}`);
  }
}

const overallPass = pass && cleanup.status === "completed";
process.exit(overallPass ? 0 : 1);
