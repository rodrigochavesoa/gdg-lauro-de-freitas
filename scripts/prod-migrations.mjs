/**
 * Lista migrações seguras para o projeto Supabase de **produção**.
 * Fonte de verdade: `supabase/migrations/prod.manifest.json` (não o nome do arquivo).
 * Homologação pode incluir seed fictício; produção não.
 *
 * pwsh: pnpm migrations:prod
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Mesmo padrão de `check-rls.mjs` — apply lê HOMOLOG_* de `.env.local` se não estiver no shell. */
export function loadDotEnvLocal(cwd = ROOT) {
  const path = resolve(cwd, ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function mergeHomologEnvFromLocal(cwd = ROOT) {
  const local = loadDotEnvLocal(cwd);
  for (const key of ["HOMOLOG_DATABASE_URL", "HOMOLOG_SUPABASE_PROJECT_REF", "PROD_SUPABASE_PROJECT_REF"]) {
    const value = local[key];
    if (value && !process.env[key]) process.env[key] = value;
  }
}
export const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
/** Subpastas ignoradas pelo `supabase db push` (o CLI só lê `*.sql` na raiz). */
export const HOMOLOG_SUBDIR = "homolog";
export const HELD_SUBDIR = "held";
export const PROD_MANIFEST_FILENAME = "prod.manifest.json";

/**
 * Arquivos que só existem para demo/RLS em homologação.
 * - `_homolog.sql` é o marcador explícito (MVP-013 e arquivos novos).
 * - `seed_fictitious` cobre o catálogo fictício.
 * - `avatars_` é legado amplo: também classifica `avatars_versioned_path.sql` e
 *   `avatars_single_object.sql` (Camada B, sem sufixo `_homolog`). Não apertar neste
 *   PR — follow-up GOV-AVATAR-MIG-CLASS-01 reclassifica esses arquivos (marcador
 *   Camada B / manifesto) antes de promover avatar a produção.
 */
export const HOMOLOG_ONLY_PATTERN = /seed_fictitious|avatars_|_homolog\.sql$/i;

/** Comentários SQL que proíbem apply em produção (Camada B / PO). */
export const PROD_DO_NOT_APPLY_MARKER =
  /produção:\s*não aplicar|não aplicar em produção/i;

/** UUIDs do catálogo fictício — não podem aparecer em SQL de produção. */
export const FICTITIOUS_SEED_UUIDS = [
  "a1a1a1a1-0001-4000-8000-000000000001",
  "a1a1a1a1-0002-4000-8000-000000000002",
  "a1a1a1a1-0003-4000-8000-000000000003",
  "a1a1a1a1-0004-4000-8000-000000000004",
  "b2b2b2b2-0001-4000-8000-000000000001",
  "b2b2b2b2-0002-4000-8000-000000000002",
  "b2b2b2b2-0003-4000-8000-000000000003",
  "b2b2b2b2-0004-4000-8000-000000000004",
  "b2b2b2b2-0005-4000-8000-000000000005",
];

export function prodManifestPath(dir = MIGRATIONS_DIR) {
  return join(dir, PROD_MANIFEST_FILENAME);
}

export function homologMigrationsDir(cliDir = MIGRATIONS_DIR) {
  return join(cliDir, HOMOLOG_SUBDIR);
}

export function heldMigrationsDir(cliDir = MIGRATIONS_DIR) {
  return join(cliDir, HELD_SUBDIR);
}

export function isHomologOnlyMigration(filename) {
  return filename.endsWith(".sql") && HOMOLOG_ONLY_PATTERN.test(filename);
}

export function loadProdManifest(dir = MIGRATIONS_DIR) {
  const manifestPath = prodManifestPath(dir);
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifesto de produção não encontrado: ${manifestPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Manifesto de produção inválido (${manifestPath}): ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Manifesto de produção deve ser um array de nomes de arquivo .sql.");
  }
  const seen = new Set();
  for (const entry of parsed) {
    if (typeof entry !== "string" || !entry.endsWith(".sql")) {
      throw new Error(`Entrada inválida no manifesto de produção: ${JSON.stringify(entry)}`);
    }
    if (seen.has(entry)) {
      throw new Error(`Entrada duplicada no manifesto de produção: ${entry}`);
    }
    seen.add(entry);
  }
  return parsed;
}

export function isProdSafeMigration(filename, dir = MIGRATIONS_DIR) {
  return filename.endsWith(".sql") && loadProdManifest(dir).includes(filename);
}

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function listProdSafeMigrations(dir = MIGRATIONS_DIR) {
  const prod = loadProdManifest(dir);
  for (const filename of prod) {
    if (!existsSync(join(dir, filename))) {
      throw new Error(`Arquivo do manifesto de produção não existe: ${filename}`);
    }
  }
  return prod;
}

export function listHomologOnlyMigrations(cliDir = MIGRATIONS_DIR) {
  return listMigrationFiles(homologMigrationsDir(cliDir)).filter(isHomologOnlyMigration);
}

/**
 * Camada B vive em `held/` (fora do path do CLI).
 * Marker «Produção: não aplicar» = classificado, sem apply em produção.
 * Sem marker = não classificado (deve falhar).
 */
export function classifyNonManifestSql(dir = MIGRATIONS_DIR) {
  const camadaB = [];
  const unclassified = [];
  for (const filename of listMigrationFiles(heldMigrationsDir(dir))) {
    const sql = readFileSync(join(heldMigrationsDir(dir), filename), "utf8");
    if (PROD_DO_NOT_APPLY_MARKER.test(sql)) {
      camadaB.push(filename);
    } else {
      unclassified.push(filename);
    }
  }
  return { camadaB, unclassified };
}

export function assertProdSafeSql(sql, filename) {
  if (PROD_DO_NOT_APPLY_MARKER.test(sql)) {
    throw new Error(
      `Migração de produção "${filename}" contém «não aplicar em produção».`,
    );
  }
  for (const uuid of FICTITIOUS_SEED_UUIDS) {
    if (sql.includes(uuid)) {
      throw new Error(
        `Migração de produção "${filename}" contém UUID de seed fictício (${uuid}).`,
      );
    }
  }
}

export function validateProdMigrations(dir = MIGRATIONS_DIR) {
  const prodNames = loadProdManifest(dir);
  const prodSet = new Set(prodNames);
  const leaked = listMigrationFiles(dir).filter((name) => !prodSet.has(name));
  if (leaked.length > 0) {
    throw new Error(
      `Migration(s) fora do manifesto ainda no path do CLI (supabase db push as aplicaria): ${leaked.join(", ")}. Homolog-only vai para ${HOMOLOG_SUBDIR}/; Camada B vai para ${HELD_SUBDIR}/.`,
    );
  }
  const homologDir = homologMigrationsDir(dir);
  const homologFiles = listMigrationFiles(homologDir);
  const misfiled = homologFiles.filter((name) => !isHomologOnlyMigration(name));
  if (misfiled.length > 0) {
    throw new Error(
      `Arquivo(s) em ${HOMOLOG_SUBDIR}/ sem marcador homolog-only: ${misfiled.join(", ")}`,
    );
  }
  const homologOnly = listHomologOnlyMigrations(dir);
  if (!homologOnly.some((name) => /seed_fictitious/i.test(name))) {
    throw new Error("Esperado ao menos um arquivo de seed fictício marcado como homolog-only.");
  }
  const prod = listProdSafeMigrations(dir);
  if (prod.length < 1) {
    throw new Error("Nenhuma migração de produção encontrada.");
  }
  for (const filename of prod) {
    if (isHomologOnlyMigration(filename)) {
      throw new Error(
        `Migração de produção "${filename}" está marcada como homolog-only e não pode constar no manifesto.`,
      );
    }
    const sql = readFileSync(join(dir, filename), "utf8");
    assertProdSafeSql(sql, filename);
  }
  const { camadaB, unclassified } = classifyNonManifestSql(dir, prod);
  if (unclassified.length > 0) {
    throw new Error(
      `Migration(s) sem classificação (não estão no manifesto, não são homolog-only e não têm «Produção: não aplicar»): ${unclassified.join(", ")}`,
    );
  }
  return { prod, homologOnly, camadaB };
}

export function listHomologChain(dir = MIGRATIONS_DIR) {
  const { prod, homologOnly, camadaB } = validateProdMigrations(dir);
  return [...prod, ...camadaB, ...homologOnly].sort();
}

export function resolveHomologChain(dir = MIGRATIONS_DIR) {
  return listHomologChain(dir).map((name) => {
    const candidates = [dir, heldMigrationsDir(dir), homologMigrationsDir(dir)];
    const path = candidates.map((folder) => join(folder, name)).find((file) => existsSync(file));
    if (!path) throw new Error(`Arquivo da cadeia de homologação não encontrado: ${name}`);
    return { name, path };
  });
}

export function migrationVersion(filename) {
  return filename.match(/^(\d+)/)?.[1] ?? null;
}

export function supabaseProjectRef(dbUrl) {
  return dbUrl.match(/postgres\.([a-z0-9]+)/i)?.[1]
    || dbUrl.match(/db\.([a-z0-9]+)\.supabase\.co/i)?.[1]
    || "";
}

/**
 * Fail-closed: sem allowlist de homologação, ou com ref diferente dela, o apply para.
 * Não imprime a URL.
 */
export function assertHomologDatabaseUrl(dbUrl, options = {}) {
  const homologProjectRef = "homologProjectRef" in options
    ? options.homologProjectRef
    : process.env.HOMOLOG_SUPABASE_PROJECT_REF;
  const prodProjectRef = "prodProjectRef" in options
    ? options.prodProjectRef
    : process.env.PROD_SUPABASE_PROJECT_REF;
  if (typeof dbUrl !== "string" || dbUrl.trim() === "") {
    throw new Error("HOMOLOG_DATABASE_URL ausente. Apply de homologação recusado.");
  }
  if (!homologProjectRef || !String(homologProjectRef).trim()) {
    throw new Error("HOMOLOG_SUPABASE_PROJECT_REF ausente. Apply recusado (fail-closed).");
  }
  if (/gdg-jobs-prod/i.test(dbUrl)) {
    throw new Error("Apply recusado: a URL aponta para produção (gdg-jobs-prod).");
  }
  const ref = supabaseProjectRef(dbUrl);
  if (!ref) {
    throw new Error("Apply recusado: a URL não tem project ref do Supabase.");
  }
  if (ref !== homologProjectRef) {
    throw new Error("Apply recusado: a URL não está na allowlist de homologação.");
  }
  if (prodProjectRef && (ref === prodProjectRef || homologProjectRef === prodProjectRef)) {
    throw new Error("Apply recusado: a URL aponta para o project ref de produção.");
  }
}

export function connectionWithoutPassword(dbUrl) {
  const parsed = new URL(dbUrl);
  const password = decodeURIComponent(parsed.password);
  parsed.password = "";
  return {
    connectionUrl: parsed.toString(),
    env: { ...process.env, PGPASSWORD: password },
  };
}

export function psqlInvocation(dbUrl, filePath, { version, name }) {
  if (!version) throw new Error(`Migration sem versão numérica: ${name || filePath}`);
  const { connectionUrl, env } = connectionWithoutPassword(dbUrl);
  const include = filePath.replaceAll("\\", "/").replaceAll("'", "''");
  const safeVersion = String(version).replaceAll("'", "''");
  const safeName = String(name || "").replaceAll("'", "''");
  const input = [
    "BEGIN;",
    `\\i '${include}'`,
    "INSERT INTO supabase_migrations.schema_migrations (version, name)",
    `VALUES ('${safeVersion}', '${safeName}') ON CONFLICT (version) DO NOTHING;`,
    "COMMIT;",
    "",
  ].join("\n");
  return {
    args: [connectionUrl, "-v", "ON_ERROR_STOP=1", "-f", "-"],
    env,
    input,
  };
}

function throwPsqlFailure(result) {
  if (result.error) {
    throw new Error(`psql indisponível (${result.error.message}). Instale o cliente PostgreSQL para aplicar a cadeia.`);
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql falhou").trim());
  }
}

export function runPsqlQuery(dbUrl, sql) {
  const { connectionUrl, env } = connectionWithoutPassword(dbUrl);
  const result = spawnSync("psql", [connectionUrl, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    env,
  });
  throwPsqlFailure(result);
  return result.stdout || "";
}

export function ensureMigrationHistory(dbUrl, runQuery = runPsqlQuery) {
  runQuery(
    dbUrl,
    "CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);",
  );
}

export function loadAppliedVersions(dbUrl, runQuery = runPsqlQuery) {
  const out = runQuery(dbUrl, "SELECT version FROM supabase_migrations.schema_migrations");
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function runPsqlFile(dbUrl, filePath, meta) {
  const { args, env, input } = psqlInvocation(dbUrl, filePath, meta);
  const result = spawnSync("psql", args, { encoding: "utf8", env, input });
  throwPsqlFailure(result);
}

export function applyHomologChain(dbUrl, options = {}) {
  const {
    dir = MIGRATIONS_DIR,
    runFile = runPsqlFile,
    appliedVersions,
    loadVersions = loadAppliedVersions,
    ensureHistory = ensureMigrationHistory,
  } = options;
  assertHomologDatabaseUrl(dbUrl, options);
  if (appliedVersions == null) ensureHistory(dbUrl);
  const applied = new Set(appliedVersions ?? loadVersions(dbUrl));
  const ran = [];
  const skipped = [];
  for (const item of resolveHomologChain(dir)) {
    const version = migrationVersion(item.name);
    if (!version) throw new Error(`Migration sem versão numérica: ${item.name}`);
    if (applied.has(version)) {
      skipped.push(item.name);
      continue;
    }
    runFile(dbUrl, item.path, { version, name: item.name });
    applied.add(version);
    ran.push(item.name);
  }
  return { ran, skipped };
}

function main() {
  const { prod, homologOnly, camadaB } = validateProdMigrations();
  if (process.argv.includes("--apply")) {
    mergeHomologEnvFromLocal();
    const dbUrl = process.env.HOMOLOG_DATABASE_URL;
    const { ran, skipped } = applyHomologChain(dbUrl);
    console.log("Cadeia de homologação (histórico em supabase_migrations.schema_migrations):");
    for (const name of skipped) console.log(`  skip  ${name}`);
    for (const name of ran) console.log(`  applied ${name}`);
    console.log(`ok: ${ran.length} aplicado(s), ${skipped.length} já no histórico.`);
    return;
  }
  if (process.argv.includes("--homolog-chain")) {
    console.log("Cadeia de homologação (ordem de timestamp). Apply: pnpm migrations:homolog:apply");
    for (const item of resolveHomologChain()) console.log(`  homolog ${item.name}`);
    console.log(
      `ok: ${prod.length} produção + ${camadaB.length} Camada B + ${homologOnly.length} homolog-only. Sem apply.`,
    );
    return;
  }
  console.log(`Homologação apenas (supabase/migrations/${HOMOLOG_SUBDIR}/; o CLI não aplica):`);
  for (const name of homologOnly) console.log(`  skip  ${name}`);
  console.log(`Camada B (supabase/migrations/${HELD_SUBDIR}/; o CLI não aplica; não promover sem PO):`);
  for (const name of camadaB) console.log(`  hold  ${name}`);
  console.log("Produção (raiz = manifesto; supabase db push só vê estes arquivos):");
  for (const name of prod) console.log(`  apply ${name}`);
  console.log(`ok: ${prod.length} migrações de produção validadas.`);
}

const invokedDirectly = process.argv[1]?.replaceAll("\\", "/").endsWith("prod-migrations.mjs");
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
