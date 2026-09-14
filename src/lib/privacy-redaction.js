/** Campos da matriz MVP-005 §5.2 que nunca podem ir para log ou metadata de auditoria.
 * Manter em sincronia com supabase/functions/_shared/redaction.ts. */
export const FORBIDDEN_LOG_KEYS = [
  "email",
  "bio",
  "cv",
  "cv_url",
  "curriculum",
  "resume",
  "snapshot",
  "prompt",
  "query",
  "response",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "apikey",
  "api_key",
  "resend",
  "html",
  "full_name",
  "skills",
  "headline",
  "preferences",
];

const FORBIDDEN_KEY_SET = new Set(FORBIDDEN_LOG_KEYS);

export function findForbiddenLogFields(value, acc = []) {
  if (Array.isArray(value)) {
    for (const item of value) findForbiddenLogFields(item, acc);
    return acc;
  }
  if (!value || typeof value !== "object") return acc;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY_SET.has(key) && nested !== "[redacted]" && !acc.includes(key)) acc.push(key);
    findForbiddenLogFields(nested, acc);
  }
  return acc;
}

export function redactForLog(value) {
  if (Array.isArray(value)) return value.map((item) => redactForLog(item));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY_SET.has(key)) continue;
    result[key] = redactForLog(nested);
  }
  return result;
}

export function assertSafeLogPayload(value) {
  const hits = findForbiddenLogFields(value);
  if (hits.length > 0) {
    throw new Error(`log contém campos proibidos: ${hits.join(", ")}`);
  }
  return value;
}
