/**
 * Diagnóstico rápido: origem dos secrets TOTP, base32 e um login admin AAL2.
 * Não imprime senhas nem secrets TOTP (só fingerprint SHA-256 truncado).
 *
 * pwsh: pnpm verify:staff-mfa
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generateTotp, decodeBase32 } from "./totp.mjs";

function loadLocalEnv() {
  const path = ".env.local";
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

function parseTotpSecretsFile() {
  const file = "docs-local/staff-mfa-totp-secrets.md";
  const map = {};
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*(admin|curator2|curator3|curator|moderator)\s*\|[^|]*\|\s*([^|]+)\|/i,
    );
    if (!match) continue;
    const secret = match[2].trim().replace(/`/g, "").replace(/\s+/g, "");
    if (!secret || /colar|placeholder|^_+$/i.test(secret)) continue;
    map[match[1].toLowerCase()] = secret;
  }
  return map;
}

function fingerprint(secret) {
  const cleaned = String(secret ?? "").replace(/\s+/g, "");
  if (!cleaned) return null;
  return createHash("sha256").update(cleaned).digest("hex").slice(0, 12);
}

const ROLES = [
  ["admin", "ADMIN_TEST_TOTP_SECRET"],
  ["curator", "CURATOR_TEST_TOTP_SECRET"],
  ["curator2", "CURATOR2_TEST_TOTP_SECRET"],
  ["curator3", "CURATOR3_TEST_TOTP_SECRET"],
  ["moderator", "MODERATOR_TEST_TOTP_SECRET"],
];

const env = { ...loadLocalEnv(), ...process.env };
const fromFile = parseTotpSecretsFile();

console.log("=== TOTP staff (harness) ===\n");
for (const [role, envKey] of ROLES) {
  const fromEnv = env[envKey];
  const fromMd = fromFile[role];
  const effective = fromEnv || fromMd;
  let b32 = "n/a";
  try {
    if (effective) {
      decodeBase32(effective);
      b32 = "ok";
    }
  } catch {
    b32 = "invalid";
  }
  const source = fromEnv ? "env" : fromMd ? "staff-mfa-totp-secrets.md" : "MISSING";
  const warn =
    fromEnv && fromMd && fingerprint(fromEnv) !== fingerprint(fromMd)
      ? " (AVISO: env sobrescreve md — fingerprints diferentes)"
      : "";
  console.log(
    `${role}: source=${source} len=${effective ? String(effective).replace(/\s/g, "").length : 0} fp=${fingerprint(effective) ?? "—"} b32=${b32}${warn}`,
  );
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = env.ADMIN_TEST_EMAIL;
const password = env.ADMIN_TEST_PASSWORD;
const totpSecret = env.ADMIN_TEST_TOTP_SECRET || fromFile.admin;

console.log("\n=== Probe admin AAL2 (homolog) ===\n");
if (!url || !key) {
  console.log("SKIP: VITE_SUPABASE_URL ou chave anon/publishable ausente.");
  process.exit(0);
}
if (!email || !password || !totpSecret) {
  console.log("SKIP: ADMIN_TEST_* ou TOTP admin ausente.");
  process.exit(0);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signErr } = await client.auth.signInWithPassword({ email, password });
if (signErr) {
  console.log(`signIn: ${signErr.message}`);
  if (/rate limit|over_request_rate_limit/i.test(signErr.message)) {
    console.log("→ throttling Auth; aguarde 30–60 min sem logins no projeto de homolog.");
  }
  process.exit(0);
}

const { data: factors, error: fErr } = await client.auth.mfa.listFactors();
if (fErr) {
  console.log(`listFactors: ${fErr.message}`);
  await client.auth.signOut();
  process.exit(0);
}
const totp = factors?.totp?.find((f) => f.status === "verified");
if (!totp) {
  console.log("sem fator TOTP verificado — enroll em /admin ou Dashboard Auth.");
  await client.auth.signOut();
  process.exit(0);
}

const { data: challenge, error: chErr } = await client.auth.mfa.challenge({ factorId: totp.id });
if (chErr) {
  console.log(`challenge: ${chErr.message}`);
  await client.auth.signOut();
  process.exit(0);
}

const code = generateTotp(totpSecret);
const { error: vErr } = await client.auth.mfa.verify({
  factorId: totp.id,
  challengeId: challenge.id,
  code,
});
console.log(vErr ? `verify: ${vErr.message}` : "verify: OK AAL2");
if (vErr && /invalid totp/i.test(vErr.message)) {
  console.log("→ secret desatualizado: re-enroll ou alinhar homolog-rls com a chave do enroll.");
}
await client.auth.signOut();
