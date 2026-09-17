/**
 * Lista migrações seguras para o projeto Supabase de **produção**.
 * Fonte de verdade: `supabase/migrations/prod.manifest.json` (não o nome do arquivo).
 * Homologação pode incluir seed fictício; produção não.
 *
 * pwsh: pnpm migrations:prod
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
export const PROD_MANIFEST_FILENAME = "prod.manifest.json";

/** Arquivos que só existem para demo/RLS em homologação. */
export const HOMOLOG_ONLY_PATTERN = /seed_fictitious|avatars_storage_homolog|avatars_single_object/i;

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

export function listHomologOnlyMigrations(dir = MIGRATIONS_DIR) {
  return listMigrationFiles(dir).filter(isHomologOnlyMigration);
}

/**
 * `.sql` fora do manifesto e fora do pattern homolog-only.
 * Marker «Produção: não aplicar» = Camada B (classificado, sem apply).
 * Sem marker = não classificado (deve falhar).
 */
export function classifyNonManifestSql(dir = MIGRATIONS_DIR, prodFilenames = loadProdManifest(dir)) {
  const prodSet = new Set(prodFilenames);
  const camadaB = [];
  const unclassified = [];
  for (const filename of listMigrationFiles(dir)) {
    if (prodSet.has(filename) || isHomologOnlyMigration(filename)) continue;
    const sql = readFileSync(join(dir, filename), "utf8");
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
  const homologOnly = listHomologOnlyMigrations(dir);
  if (homologOnly.length < 1) {
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

function main() {
  const { prod, homologOnly } = validateProdMigrations();
  console.log("Homologação apenas (não aplicar em produção):");
  for (const name of homologOnly) console.log(`  skip  ${name}`);
  console.log("Produção (schema + grants; sem seed):");
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
