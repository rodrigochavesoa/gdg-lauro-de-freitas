/**
 * Falha se o build estático (`dist/`) contiver segredos de servidor.
 * Chaves publishable/anon no bundle são esperadas (vão ao browser).
 *
 * pwsh: pnpm run build; pnpm check:bundle
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DIST = join(ROOT, "dist");

export const FORBIDDEN_PATTERNS = [
  { id: "service_role", source: /service_role/i },
  { id: "sb_secret", source: /sb_secret_[A-Za-z0-9]+/ },
  { id: "private_key", source: /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/ },
  { id: "service_role_env", source: /SUPABASE_SERVICE_ROLE(?:_KEY)?/ },
  { id: "secret_key_env", source: /SUPABASE_SECRET_KEY/ },
  { id: "clickup_token", source: /CLICKUP_API_TOKEN/ },
];

export function findForbiddenSecrets(text) {
  const hits = [];
  for (const { id, source } of FORBIDDEN_PATTERNS) {
    if (source.test(text)) hits.push(id);
  }
  return hits;
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walkFiles(path, acc);
    else acc.push(path);
  }
  return acc;
}

export function scanBundle(distDir = DEFAULT_DIST) {
  if (!existsSync(distDir)) {
    throw new Error(`Pasta "${distDir}" ausente. Rode \`pnpm run build\` antes.`);
  }
  const findings = [];
  for (const file of walkFiles(distDir)) {
    if (statSync(file).size > 5_000_000) continue;
    const text = readFileSync(file, "utf8");
    const hits = findForbiddenSecrets(text);
    if (hits.length > 0) {
      findings.push({ file, hits });
    }
  }
  return findings;
}

function main() {
  const findings = scanBundle();
  if (findings.length > 0) {
    for (const { file, hits } of findings) {
      console.error(`segredo no bundle: ${file} (${hits.join(", ")})`);
    }
    process.exit(1);
  }
  console.log("ok: dist/ sem service_role, sb_secret, chave privada ou tokens de servidor.");
}

const invokedDirectly = process.argv[1]?.replaceAll("\\", "/").endsWith("check-bundle-secrets.mjs");
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
