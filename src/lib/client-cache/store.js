import { noteClientCacheAccess } from "./stats.js";

/**
 * Cache em memória: `{ data, fetchedAt }`, TTL, dedupe de inflight e invalidação por chave ou prefixo.
 * Não autoriza leitura. RLS e a sessão continuam a autoridade.
 */
export function createMemoryCache({ ttlMs, name }) {
  /** @type {Map<string, { data: unknown, fetchedAt: number }>} */
  const entries = new Map();
  /** @type {Map<string, Promise<unknown>>} */
  const inflight = new Map();

  function isFresh(entry) {
    return Boolean(entry) && Date.now() - entry.fetchedAt <= ttlMs;
  }

  function dropInflight(match) {
    for (const key of inflight.keys()) {
      if (match(key)) inflight.delete(key);
    }
  }

  return {
    peek(key) {
      const entry = entries.get(key);
      if (!isFresh(entry)) {
        noteClientCacheAccess(name, "miss");
        return null;
      }
      noteClientCacheAccess(name, "hit");
      return entry.data;
    },
    /** Valor armazenado mesmo fora do TTL — merge de página, sem contar hit/miss. */
    get(key) {
      return entries.get(key)?.data ?? null;
    },
    set(key, data) {
      entries.set(key, { data, fetchedAt: Date.now() });
    },
    freshValues() {
      const values = [];
      for (const entry of entries.values()) {
        if (isFresh(entry)) values.push(entry.data);
      }
      return values;
    },
    invalidateKey(key) {
      entries.delete(key);
      inflight.delete(key);
    },
    invalidatePrefix(prefix) {
      for (const key of entries.keys()) {
        if (key.startsWith(prefix)) entries.delete(key);
      }
      dropInflight((key) => key.startsWith(prefix));
    },
    clear() {
      entries.clear();
      inflight.clear();
    },
    inflightGet(key) {
      return inflight.get(key) ?? null;
    },
    inflightSet(key, promise) {
      inflight.set(key, promise);
    },
    inflightDelete(key, promise) {
      if (!promise || inflight.get(key) === promise) inflight.delete(key);
    },
  };
}
