/**
 * Gera src/lib/database.types.ts a partir do schema public de homolog.
 * Pré-requisito: HOMOLOG_DATABASE_URL no ambiente ou em .env.local.
 * Não imprime a URL. Recusa o project ref de produção.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertHomologDatabaseUrl, mergeHomologEnvFromLocal } from "./prod-migrations.mjs";

const HEADER = `/**
 * Regenerar: pnpm types:database
 * Fonte: schema public do Supabase de homolog (HOMOLOG_DATABASE_URL).
 * Este arquivo não contém secrets. O app permanece JavaScript.
 * Tabelas só de homolog (ingestão) aparecem aqui porque o schema ligado é o de homolog.
 * Isso não promove essas tabelas para prod.manifest.json.
 */

`;

mergeHomologEnvFromLocal();
const dbUrl = process.env.HOMOLOG_DATABASE_URL;
assertHomologDatabaseUrl(dbUrl);

const quotedUrl = dbUrl.replaceAll('"', "");
const command = `npx --yes supabase gen types typescript --db-url "${quotedUrl}" --schema public`;
const result = spawnSync(command, { encoding: "utf8", shell: true });

if (result.error) {
  throw new Error(`supabase CLI indisponível (${result.error.message}).`);
}
if (result.status !== 0) {
  const detail = (result.stderr || result.stdout || "gen types falhou").replace(dbUrl, "[redacted]");
  throw new Error(detail.trim());
}

const body = String(result.stdout || "").trim();
if (!/export type Database\b/.test(body)) {
  throw new Error("A saída do supabase gen types não contém export type Database.");
}

const dest = join(process.cwd(), "src", "lib", "database.types.ts");
writeFileSync(dest, `${HEADER}${body}\n`);
console.log(`wrote src/lib/database.types.ts (${body.length} bytes of types)`);
