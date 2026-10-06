import { useCallback, useMemo } from "react";
import { loadMyApplications } from "../features/jobs/apply-api.js";
import { loadPrivacyPreferences } from "../features/privacy/privacy-api.js";
import { STAFF_ROLES } from "./staff-roles.js";

/** UX-PERF-06 / UX-PERF-07 — fornece prefetches privados para links com intenção. */
export function useCandidatePrefetch({ userId, role, needsOnboarding }) {
  const canPrefetch = Boolean(userId && role && !STAFF_ROLES.has(role) && !needsOnboarding);
  const prefetchApplications = useCallback(() => {
    if (!canPrefetch) return;
    loadMyApplications({ userId }).catch(() => {});
  }, [canPrefetch, userId]);
  const prefetchPrivacy = useCallback(() => {
    if (!canPrefetch) return;
    loadPrivacyPreferences({ userId }).catch(() => {});
  }, [canPrefetch, userId]);

  return useMemo(() => ({ prefetchApplications, prefetchPrivacy }), [prefetchApplications, prefetchPrivacy]);
}
