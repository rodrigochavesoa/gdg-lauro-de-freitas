export function mergeById(current, incoming) {
  const seen = new Set(current.map((row) => String(row.id)));
  return [...current, ...incoming.filter((row) => !seen.has(String(row.id)))];
}
