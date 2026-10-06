import { useCallback } from "react";
import { loadApprovedJobs } from "../features/catalog/jobs-api.js";

/** UX-PERF-05 — aquece o catálogo somente quando há intenção de abrir Vagas. */
export function useCatalogPrefetch() {
  return useCallback(() => loadApprovedJobs().catch(() => {}), []);
}
