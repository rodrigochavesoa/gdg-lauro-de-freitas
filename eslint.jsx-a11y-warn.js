/** Converte regras ESLint `error` → `warn` sem alterar opções. */
export function asWarnRules(rules = {}) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, value]) => [name, toWarn(value)]),
  );
}

export function ruleLevel(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function isErrorLevel(value) {
  const level = ruleLevel(value);
  return level === "error" || level === 2;
}

function toWarn(value) {
  if (value === "error" || value === 2) return "warn";
  if (Array.isArray(value) && (value[0] === "error" || value[0] === 2)) {
    return ["warn", ...value.slice(1)];
  }
  return value;
}
