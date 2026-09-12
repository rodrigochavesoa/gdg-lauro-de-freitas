/**
 * Lista migrações seguras para o projeto Supabase de **produção**.
 * Homologação pode incluir seed fictício; produção não.
 *
 * pwsh: pnpm migrations:prod
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

/** Arquivos que só existem para demo/RLS em homologação. */
export const HOMOLOG_ONLY_PATTERN = /seed_fictitious/i;

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

export function isProdSafeMigration(filename) {
  return filename.endsWith(".sql") && !HOMOLOG_ONLY_PATTERN.test(filename);
}

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function listProdSafeMigrations(dir = MIGRATIONS_DIR) {
  return listMigrationFiles(dir).filter(isProdSafeMigration);
}

export function listHomologOnlyMigrations(dir = MIGRATIONS_DIR) {
  return listMigrationFiles(dir).filter((name) => !isProdSafeMigration(name));
}

export function assertProdSafeSql(sql, filename) {
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
    const sql = readFileSync(join(dir, filename), "utf8");
    assertProdSafeSql(sql, filename);
  }
  return { prod, homologOnly };
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
