/**
 * TOTP RFC 6238 (SHA-1, 30s, 6 dígitos) para o harness `pnpm test:rls`.
 * Não usar no frontend. Nunca logar o secret.
 */
import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(secret) {
  const cleaned = String(secret ?? "")
    .replace(/\s+/g, "")
    .replace(/=+$/g, "")
    .toUpperCase();
  if (!cleaned) throw new Error("TOTP secret vazio.");
  let bits = "";
  for (const char of cleaned) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error("TOTP secret inválido.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotp(secret, { period = 30, digits = 6, now = Date.now() } = {}) {
  const key = decodeBase32(secret);
  const counter = Math.floor(Math.floor(now / 1000) / period);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, "0");
}
