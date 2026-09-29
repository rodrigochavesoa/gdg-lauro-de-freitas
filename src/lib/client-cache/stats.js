/** Contadores hit/miss por nome de cache. Memória do processo, sem dashboard. */
const counts = new Map();

function bucket(name) {
  if (!counts.has(name)) counts.set(name, { hit: 0, miss: 0 });
  return counts.get(name);
}

export function noteClientCacheAccess(name, outcome) {
  const row = bucket(name);
  if (outcome === "hit") row.hit += 1;
  else row.miss += 1;
}

export function getClientCacheStats() {
  return Object.fromEntries(
    [...counts.entries()].map(([name, row]) => [name, { hit: row.hit, miss: row.miss }]),
  );
}

export function resetClientCacheStats() {
  counts.clear();
}
