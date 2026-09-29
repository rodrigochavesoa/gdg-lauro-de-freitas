import { createMemoryCache } from "./store.js";
import { LIST_CACHE_TTL_MS } from "./ttl.js";

/** Fila e detalhe de curadoria não levam userId na chave. O logout limpa os dois mapas. */
export const curationQueueCache = createMemoryCache({
  ttlMs: LIST_CACHE_TTL_MS,
  name: "curation-queue",
});

export const curationDetailCache = createMemoryCache({
  ttlMs: LIST_CACHE_TTL_MS,
  name: "curation-detail",
});

export function invalidateCurationMemory() {
  curationQueueCache.clear();
  curationDetailCache.clear();
}
