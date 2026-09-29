import { noteClientCacheAccess } from "./stats.js";

/**
 * Cache em memória: `{ data, fetchedAt }`, TTL, dedupe de inflight e invalidação por chave ou prefixo.
 * Cada chave tem uma geração. `set` com geração antiga não regrava depois de invalidate/clear.
 * Não autoriza leitura. RLS e a sessão continuam a autoridade.
 */
export function createMemoryCache({ ttlMs, name }) {
  /** @type {Map<string, { data: unknown, fetchedAt: number }>} */
  const entries = new Map();
  /** @type {Map<string, Promise<unknown>>} */
  const inflight = new Map();
  /** @type {Map<string, number>} */
  const epochs = new Map();
  /** Contador monotônico. Nunca volta nem reemite uma geração já capturada. */
  let clock = 0;

  function isFresh(entry) {
    return Boolean(entry) && Date.now() - entry.fetchedAt <= ttlMs;
  }

  function epochOf(key) {
    return epochs.has(key) ? epochs.get(key) : clock;
  }

  function bump(key) {
    clock += 1;
    epochs.set(key, clock);
  }

  function pruneExpired() {
    for (const [key, entry] of entries) {
      if (!isFresh(entry)) entries.delete(key);
    }
  }

  return {
    peek(key) {
      pruneExpired();
      const entry = entries.get(key);
      if (!entry) {
        noteClientCacheAccess(name, "miss");
        return null;
      }
      noteClientCacheAccess(name, "hit");
      return entry.data;
    },
    /** Valor ainda dentro do TTL — merge de página, sem contar hit/miss. */
    get(key) {
      pruneExpired();
      return entries.get(key)?.data ?? null;
    },
    /** Geração da chave no início da leitura. Passe-a para `set` depois do await. */
    capture(key) {
      const epoch = epochOf(key);
      epochs.set(key, epoch);
      return epoch;
    },
    /**
     * Grava se `epoch` ainda for a geração atual.
     * Sem `epoch`, grava direto (só para semente de teste).
     */
    set(key, data, epoch) {
      pruneExpired();
      if (epoch !== undefined && epoch !== epochOf(key)) return false;
      entries.set(key, { data, fetchedAt: Date.now() });
      return true;
    },
    freshValues() {
      pruneExpired();
      return [...entries.values()].map((entry) => entry.data);
    },
    /** Descarta a entrada e invalida gravações já em voo. */
    invalidateKey(key) {
      entries.delete(key);
      inflight.delete(key);
      bump(key);
    },
    /** Nova geração sem apagar o valor. A leitura antiga não pode sobrescrever a nova. */
    supersede(key) {
      bump(key);
    },
    invalidatePrefix(prefix) {
      const keys = new Set([...entries.keys(), ...inflight.keys(), ...epochs.keys()]);
      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;
        entries.delete(key);
        inflight.delete(key);
        bump(key);
      }
    },
    clear() {
      entries.clear();
      inflight.clear();
      epochs.clear();
      clock += 1;
    },
    size() {
      pruneExpired();
      return entries.size;
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
