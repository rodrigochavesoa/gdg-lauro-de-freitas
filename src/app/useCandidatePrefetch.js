import { useEffect } from "react";
import { loadMyApplications } from "../features/jobs/apply-api.js";
import { loadPrivacyPreferences } from "../features/privacy/privacy-api.js";
import { STAFF_ROLES } from "./staff-roles.js";

/** UX-PERF-06 / UX-PERF-07 — aquece candidaturas e privacidade do candidato (dedupe via inflight/TTL). */
export function useCandidatePrefetch({ userId, role, needsOnboarding }) {
  useEffect(() => {
    if (!userId || !role || STAFF_ROLES.has(role)) return undefined;
    loadMyApplications({ userId }).catch(() => {});
    if (!needsOnboarding) {
      loadPrivacyPreferences({ userId }).catch(() => {});
    }
    return undefined;
  }, [userId, role, needsOnboarding]);
}
