/**
 * Gera src/lib/database.types.ts a partir do schema public de homolog.
 * Pré-requisito: HOMOLOG_DATABASE_URL no ambiente ou em .env.local.
 * A CLI está pinada em devDependencies (supabase). O binário recebe a URL sem senha.
 * A senha fica só em PGPASSWORD e SUPABASE_DB_PASSWORD no ambiente do processo filho.
 * Não imprime a URL. Recusa o project ref de produção.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertHomologDatabaseUrl, mergeHomologEnvFromLocal } from "./prod-migrations.mjs";

export const SUPABASE_CLI_VERSION = "2.118.0";

const PLATFORMS = {
  darwin: { arm64: ["darwin-arm64"], x64: ["darwin-x64"] },
  linux: {
    arm64: ["linux-arm64", "linux-arm64-musl"],
    x64: ["linux-x64", "linux-x64-musl"],
  },
  win32: { arm64: ["windows-arm64"], x64: ["windows-x64"] },
};

const HEADER = `/**
 * Regenerar: pnpm types:database
 * Fonte: schema public do Supabase de homolog (HOMOLOG_DATABASE_URL).
 * CLI pinada: supabase@${SUPABASE_CLI_VERSION}. Senha fora dos argumentos do processo.
 * Este arquivo não contém secrets. O app permanece JavaScript.
 * Tabelas só de homolog (ingestão) aparecem aqui porque o schema ligado é o de homolog.
 * Isso não promove essas tabelas para prod.manifest.json.
 */

`;

export function databaseUrlWithoutPassword(dbUrl) {
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("HOMOLOG_DATABASE_URL inválida. Geração de tipos recusada.");
  }
  const password = decodeURIComponent(parsed.password);
  if (!password) {
    throw new Error("HOMOLOG_DATABASE_URL sem senha. Geração de tipos recusada.");
  }
  parsed.password = "";
  const connectionUrl = parsed.toString().replace(/^(postgres(?:ql)?:\/\/[^:/@]+):@/i, "$1@");
  if (/^postgres(?:ql)?:\/\/[^/@]*:[^@]*@/i.test(connectionUrl)) {
    throw new Error("Não foi possível retirar a senha da URL de homologação.");
  }
  return { connectionUrl, password };
}

export function resolveSupabaseCliBinary() {
  const suffixes = PLATFORMS[process.platform]?.[os.arch()];
  if (!suffixes) {
    throw new Error(`supabase CLI sem binário para ${process.platform}-${os.arch()}.`);
  }
  const requireFromSupabase = createRequire(createRequire(import.meta.url).resolve("supabase/package.json"));
  const ext = process.platform === "win32" ? ".exe" : "";
  for (const suffix of suffixes) {
    try {
      const pkgJsonPath = requireFromSupabase.resolve(`@supabase/cli-${suffix}/package.json`);
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      if (pkg.version !== SUPABASE_CLI_VERSION) {
        throw new Error(`CLI @supabase/cli-${suffix}@${pkg.version} não é a versão pinada ${SUPABASE_CLI_VERSION}.`);
      }
      return path.join(path.dirname(pkgJsonPath), "bin", `supabase${ext}`);
    } catch (error) {
      if (String(error?.message || "").includes("não é a versão pinada")) throw error;
    }
  }
  throw new Error(
    `Binário @supabase/cli ausente para ${process.platform}-${os.arch()}. Rode pnpm install (CLI ${SUPABASE_CLI_VERSION}).`,
  );
}

export function buildTypegenSpawn(dbUrl, { binaryPath }) {
  if (!binaryPath || /npx|shell/i.test(path.basename(binaryPath))) {
    throw new Error("Geração de tipos exige o binário pinado da CLI, não npx.");
  }
  const { connectionUrl, password } = databaseUrlWithoutPassword(dbUrl);
  const env = { ...process.env };
  delete env.HOMOLOG_DATABASE_URL;
  env.PGPASSWORD = password;
  env.SUPABASE_DB_PASSWORD = password;
  return {
    command: binaryPath,
    args: ["gen", "types", "typescript", "--db-url", connectionUrl, "--schema", "public"],
    shell: false,
    env,
    connectionUrl,
  };
}

function stripTrailingWhitespace(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function redact(text, secrets) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function run() {
  mergeHomologEnvFromLocal();
  const dbUrl = process.env.HOMOLOG_DATABASE_URL;
  assertHomologDatabaseUrl(dbUrl);
  const binaryPath = resolveSupabaseCliBinary();
  const spawnSpec = buildTypegenSpawn(dbUrl, { binaryPath });
  const result = spawnSync(spawnSpec.command, spawnSpec.args, {
    encoding: "utf8",
    shell: false,
    env: spawnSpec.env,
    windowsHide: true,
  });
  const secrets = [dbUrl, spawnSpec.env.PGPASSWORD];

  if (result.error) {
    throw new Error(`supabase CLI indisponível (${redact(result.error.message, secrets)}).`);
  }
  if (result.status !== 0) {
    const detail = redact(result.stderr || result.stdout || "gen types falhou", secrets);
    throw new Error(detail.trim());
  }

  const body = stripTrailingWhitespace(String(result.stdout || "")).trim();
  if (!/export type Database\b/.test(body)) {
    throw new Error("A saída do supabase gen types não contém export type Database.");
  }
  if (/postgres(?:ql)?:\/\//i.test(body) || (spawnSpec.env.PGPASSWORD && body.includes(spawnSpec.env.PGPASSWORD))) {
    throw new Error("A saída do supabase gen types contém credencial. Arquivo não foi escrito.");
  }

  const dest = path.join(process.cwd(), "src", "lib", "database.types.ts");
  writeFileSync(dest, `${stripTrailingWhitespace(HEADER).trim()}\n\n${body}\n`);
  console.log(`wrote src/lib/database.types.ts (${body.length} bytes of types)`);
}

if (isDirectRun()) run();
