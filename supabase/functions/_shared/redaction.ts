/** Keep in sync with src/lib/privacy-redaction.js (matriz MVP-005 §5.2). */
const FORBIDDEN_LOG_KEYS = [
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
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_LOG_KEYS);

export function findForbiddenLogFields(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) findForbiddenLogFields(item, acc);
    return acc;
  }
  if (!value || typeof value !== "object") return acc;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_SET.has(key) && nested !== "[redacted]" && !acc.includes(key)) acc.push(key);
    findForbiddenLogFields(nested, acc);
  }
  return acc;
}

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactForLog(item));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_SET.has(key)) continue;
    result[key] = redactForLog(nested);
  }
  return result;
}
