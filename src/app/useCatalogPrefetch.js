import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { isAdminAreaPath } from "../features/admin/staff-access.js";
import { loadApprovedJobs } from "../features/catalog/jobs-api.js";

/** UX-PERF-05 — aquece o catálogo fora de /admin para /login → / não cair em skeleton frio. */
export function useCatalogPrefetch() {
  const catalogWarmed = useRef(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (isAdminAreaPath(pathname) || catalogWarmed.current) return undefined;
    catalogWarmed.current = true;
    loadApprovedJobs().catch(() => {});
    return undefined;
  }, [pathname]);
}
